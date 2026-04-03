import { getApiBaseUrl } from '../lib/config';
import { reportClientError } from '../lib/errorReporting';
import {
  MOCK_DISHES,
  MOCK_VARIANTS,
  mockVariantsForDish,
} from './mockData';
import type {
  ApplyVariantProfileRequest,
  ApplyVariantProfileResult,
  Dish,
  DishCreateRequest,
  ImportCommitRequest,
  ImportCommitResponse,
  ImportPreviewRequest,
  ImportPreviewResponse,
  IngredientLine,
  ProblemDetails,
  HouseholdSummary,
  RecipeStep,
  RecipeAiFlags,
  RecipeVariantDetail,
  RecipeVariantSummary,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly problem?: ProblemDetails,
    public readonly transient?: boolean
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const DEFAULT_TIMEOUT_MS = (() => {
  const n = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 25_000;
})();

const READ_MAX_ATTEMPTS = 3;
const READ_BACKOFF_BASE_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

function isTransientHttpStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

/** True when the UI should offer an explicit retry (transient HTTP or network/timeout). */
export function isRetriableClientFailure(e: unknown): boolean {
  if (e instanceof ApiError) {
    return Boolean(e.transient || isTransientHttpStatus(e.status));
  }
  return isAbortError(e) || e instanceof TypeError;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  userSignal?: AbortSignal
): Promise<Response> {
  const parent = new AbortController();
  const t = setTimeout(() => parent.abort(), timeoutMs);
  const onUserAbort = () => parent.abort();
  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(t);
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    userSignal.addEventListener('abort', onUserAbort, { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: parent.signal });
  } finally {
    clearTimeout(t);
    if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
  }
}

type RequestJsonOptions = {
  timeoutMs?: number;
  /** When aborted, the request stops and is not retried. */
  signal?: AbortSignal;
  /** GET only: retry transient failures with exponential backoff */
  idempotentRead?: boolean;
  /**
   * POST that does not persist (e.g. import preview): retry transient HTTP/network failures.
   * Do not use for commit or other mutating calls.
   */
  transientSafeRetry?: boolean;
  /** Merged after default JSON headers (e.g. `X-Household-Id`). */
  extraHeaders?: Record<string, string>;
};

/** When `householdId` is set, recipe calls include `X-Household-Id` for shared libraries. */
export type RecipeScope = {
  householdId?: string | null;
};

function scopeHeaders(scope?: RecipeScope): Record<string, string> | undefined {
  const id = scope?.householdId?.trim();
  if (!id) return undefined;
  return { 'X-Household-Id': id };
}

async function performOnce<T>(
  method: string,
  url: string,
  body: unknown | undefined,
  headers: Record<string, string>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      timeoutMs,
      signal
    );
  } catch (e) {
    if (isAbortError(e)) {
      throw new ApiError('Request timed out', 0, undefined, true);
    }
    if (e instanceof TypeError) {
      throw new ApiError(e.message || 'Network request failed', 0, undefined, true);
    }
    throw e;
  }

  if (!res.ok) {
    const problem = await parseProblem(res);
    const msg = problem?.detail ?? problem?.title ?? res.statusText;
    const transient = isTransientHttpStatus(res.status);
    throw new ApiError(msg || `HTTP ${res.status}`, res.status, problem, transient);
  }

  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) {
    return (await res.json()) as T;
  }
  return undefined as T;
}

async function requestJson<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
  options?: RequestJsonOptions
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError('API base URL not configured', 0);
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...options?.extraHeaders,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${base}${path}`;
  const idempotentRead = method === 'GET' && (options?.idempotentRead ?? true);
  const transientSafeWrite =
    method !== 'GET' && options?.transientSafeRetry === true;

  let lastErr: unknown;
  const maxAttempts =
    idempotentRead || transientSafeWrite ? READ_MAX_ATTEMPTS : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await performOnce<T>(method, url, body, headers, timeoutMs, options?.signal);
    } catch (e) {
      lastErr = e;
      if (isAbortError(e) && options?.signal?.aborted) {
        throw e;
      }
      const transientFailure =
        e instanceof ApiError
          ? Boolean(e.transient || isTransientHttpStatus(e.status))
          : isAbortError(e) || e instanceof TypeError;
      const canRetry =
        (idempotentRead || transientSafeWrite) &&
        attempt < maxAttempts - 1 &&
        transientFailure;

      if (!canRetry) {
        reportClientError(e, { method, path, attempt });
        throw e;
      }
      const delay = READ_BACKOFF_BASE_MS * 2 ** attempt;
      await sleep(delay);
    }
  }

  reportClientError(lastErr, { method, path, attempt: maxAttempts - 1 });
  throw lastErr;
}

async function parseProblem(res: Response): Promise<ProblemDetails | undefined> {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return undefined;
  try {
    const body = (await res.json()) as ProblemDetails;
    if (typeof body?.title === 'string' && typeof body?.status === 'number') {
      return body;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Optional JWT from env for early integration (replace with secure storage + auth flow). */
export function getDevBearer(): string | null {
  return process.env.EXPO_PUBLIC_API_BEARER?.trim() || null;
}

export type ListHouseholdsResult = {
  items: HouseholdSummary[];
  /** False when `GET /api/v1/households` is missing (404/501) — backend slice not deployed yet. */
  endpointAvailable: boolean;
};

export async function listHouseholds(): Promise<ListHouseholdsResult> {
  const base = getApiBaseUrl();
  if (!base) {
    return { items: [], endpointAvailable: false };
  }
  try {
    const items = await requestJson<HouseholdSummary[]>('GET', '/api/v1/households', undefined, getDevBearer(), {
      idempotentRead: true,
    });
    return { items, endpointAvailable: true };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 501)) {
      return { items: [], endpointAvailable: false };
    }
    throw e;
  }
}

/**
 * Join a household with an invite code. Requires backend `POST /api/v1/households/join`.
 * Surfaces 404/501 as ApiError so the UI can explain the feature is not live yet.
 */
/**
 * Server feature flags for recipe AI. Missing endpoint (404/501) is treated as generative disabled
 * so older deployments degrade gracefully.
 */
export async function getRecipeAiFlags(scope?: RecipeScope): Promise<RecipeAiFlags> {
  const base = getApiBaseUrl();
  if (!base) {
    return { generativeAdjustmentsEnabled: true };
  }
  try {
    const raw = await requestJson<RecipeAiFlags>(
      'GET',
      '/api/v1/recipe-ai/flags',
      undefined,
      getDevBearer(),
      { extraHeaders: scopeHeaders(scope), idempotentRead: true }
    );
    return { generativeAdjustmentsEnabled: Boolean(raw?.generativeAdjustmentsEnabled) };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 501)) {
      return { generativeAdjustmentsEnabled: false };
    }
    throw e;
  }
}

export async function joinHouseholdWithCode(code: string): Promise<HouseholdSummary> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError('API base URL not configured', 0);
  }
  const trimmed = code.trim();
  if (!trimmed) {
    throw new ApiError('Invite code is required', 0);
  }
  return requestJson<HouseholdSummary>(
    'POST',
    '/api/v1/households/join',
    { code: trimmed },
    getDevBearer()
  );
}

export type ListDishesOptions = {
  /** Server-side filter; omitted when empty after trim. */
  q?: string;
  signal?: AbortSignal;
};

export async function listDishes(scope?: RecipeScope, options?: ListDishesOptions): Promise<Dish[]> {
  const base = getApiBaseUrl();
  const q = options?.q?.trim();
  if (!base) {
    if (!q) return MOCK_DISHES;
    const lower = q.toLowerCase();
    return MOCK_DISHES.filter(
      (d) =>
        d.name.toLowerCase().includes(lower) ||
        Boolean(d.tags?.some((t) => t.toLowerCase().includes(lower)))
    );
  }
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const query = params.toString();
  const path = query ? `/api/v1/dishes?${query}` : '/api/v1/dishes';
  return requestJson<Dish[]>('GET', path, undefined, getDevBearer(), {
    extraHeaders: scopeHeaders(scope),
    signal: options?.signal,
  });
}

export type CreateDishOptions = {
  signal?: AbortSignal;
};

/**
 * Create an empty dish shell (`POST /api/v1/dishes`). Uses `X-Household-Id` when `scope.householdId` is set,
 * consistent with {@link listDishes}.
 */
export async function createDish(
  body: DishCreateRequest,
  scope?: RecipeScope,
  options?: CreateDishOptions
): Promise<Dish> {
  const trimmed = body.name.trim();
  if (!trimmed) {
    throw new ApiError('Dish name is required', 0);
  }
  const base = getApiBaseUrl();
  if (!base) {
    if (options?.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const tags = body.tags?.map((t) => t.trim()).filter(Boolean);
    const dish: Dish = {
      id: `dish-local-${Date.now()}`,
      name: trimmed,
      ...(tags && tags.length > 0 ? { tags } : {}),
    };
    MOCK_DISHES.push(dish);
    return dish;
  }
  const payload: Record<string, unknown> = { name: trimmed };
  const tags = body.tags?.map((t) => t.trim()).filter(Boolean);
  if (tags && tags.length > 0) {
    payload.tags = tags;
  }
  return requestJson<Dish>(
    'POST',
    '/api/v1/dishes',
    payload,
    getDevBearer(),
    { extraHeaders: scopeHeaders(scope), signal: options?.signal }
  );
}

export async function listVariants(dishId: string, scope?: RecipeScope): Promise<RecipeVariantSummary[]> {
  const base = getApiBaseUrl();
  if (!base) return mockVariantsForDish(dishId);
  return requestJson<RecipeVariantSummary[]>(
    'GET',
    `/api/v1/dishes/${encodeURIComponent(dishId)}/variants`,
    undefined,
    getDevBearer(),
    { extraHeaders: scopeHeaders(scope) }
  );
}

export async function getVariant(variantId: string, scope?: RecipeScope): Promise<RecipeVariantDetail> {
  const base = getApiBaseUrl();
  if (!base) {
    const v = MOCK_VARIANTS[variantId];
    if (!v) throw new ApiError('Variant not found', 404);
    return v;
  }
  const raw = await requestJson<unknown>(
    'GET',
    `/api/v1/variants/${encodeURIComponent(variantId)}`,
    undefined,
    getDevBearer(),
    { extraHeaders: scopeHeaders(scope) }
  );
  return normalizeRecipeVariantDetail(raw);
}

export async function forkVariant(variantId: string, scope?: RecipeScope): Promise<RecipeVariantDetail> {
  const base = getApiBaseUrl();
  if (!base) {
    const src = MOCK_VARIANTS[variantId];
    if (!src) throw new ApiError('Variant not found', 404);
    const copy: RecipeVariantDetail = {
      ...src,
      id: `fork-${variantId}-${Date.now()}`,
      title: `${src.title} (fork)`,
      isCanonical: false,
      source: { type: 'manual', attribution: 'Forked from demo' },
    };
    MOCK_VARIANTS[copy.id] = copy;
    return copy;
  }
  const raw = await requestJson<unknown>(
    'POST',
    `/api/v1/variants/${encodeURIComponent(variantId)}/fork`,
    {},
    getDevBearer(),
    { extraHeaders: scopeHeaders(scope) }
  );
  return normalizeRecipeVariantDetail(raw);
}

/** Wire shape from `ApplyProfileResponse` (Jackson camelCase). */
type IngredientLineWire = {
  id?: string | null;
  sortOrder: number;
  amountNumeric?: number | null;
  unit?: string | null;
  ingredientText: string;
  preparationNote?: string | null;
  alternates?: string[];
};

type RecipeStepWire = {
  id?: string | null;
  sortOrder: number;
  text: string;
  timerSeconds?: number | null;
  linkUrl?: string | null;
};

type ApplyProfileResponseWire = {
  adjustmentId: string;
  appliedProfile: Record<string, unknown>;
  summary: string;
  adjustedIngredients: IngredientLineWire[];
  adjustedSteps: RecipeStepWire[];
};

function wireIngredientToLine(w: IngredientLineWire): IngredientLine {
  const qty =
    w.amountNumeric != null || (w.unit != null && w.unit !== '')
      ? { amount: w.amountNumeric ?? undefined, unit: w.unit ?? undefined }
      : null;
  return {
    id: w.id ?? `tmp-ing-${w.sortOrder}`,
    text: w.ingredientText,
    quantity: qty,
  };
}

function wireStepToStep(w: RecipeStepWire): RecipeStep {
  return {
    id: w.id ?? `tmp-step-${w.sortOrder}`,
    order: w.sortOrder,
    text: w.text,
    timerSec: w.timerSeconds ?? null,
  };
}

function normalizeApplyProfileWire(body: ApplyProfileResponseWire): ApplyVariantProfileResult {
  return {
    adjustmentId: String(body.adjustmentId),
    appliedProfile: body.appliedProfile ?? {},
    summary: body.summary ?? '',
    adjustedIngredients: (body.adjustedIngredients ?? []).map(wireIngredientToLine),
    adjustedSteps: (body.adjustedSteps ?? []).map(wireStepToStep),
  };
}

const DAIRY_TOKENS = [
  'milk',
  'cream',
  'butter',
  'cheese',
  'yogurt',
  'yoghurt',
  'parmesan',
  'mozzarella',
  'cheddar',
  'ghee',
];

function matchesAnyToken(text: string, tokens: string[]): boolean {
  if (!text || tokens.length === 0) return false;
  const lower = text.toLowerCase();
  return tokens.some((t) => t && lower.includes(t.trim().toLowerCase()));
}

function containsDairy(lower: string): boolean {
  return DAIRY_TOKENS.some((t) => lower.includes(t));
}

function isDairyLineText(text: string): boolean {
  return matchesAnyToken(text, DAIRY_TOKENS);
}

function replaceWordInsensitive(input: string, needle: string, replacement: string): string {
  const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  return input.replace(re, replacement);
}

function substituteDairyOatInText(t: string): string {
  const lower = t.toLowerCase();
  if (!containsDairy(lower)) return t;
  let replaced = t;
  replaced = replaceWordInsensitive(replaced, 'whole milk', 'oat milk');
  replaced = replaceWordInsensitive(replaced, 'skim milk', 'oat milk');
  replaced = replaceWordInsensitive(replaced, 'milk', 'oat milk');
  replaced = replaceWordInsensitive(replaced, 'heavy cream', 'oat cream');
  replaced = replaceWordInsensitive(replaced, 'cream', 'oat cream');
  replaced = replaceWordInsensitive(replaced, 'butter', 'vegan butter');
  return replaced;
}

/** Mirrors backend `ParameterProfileService` for demo/offline (uses app `IngredientLine.text`). */
function applyVariantProfileLocally(
  v: RecipeVariantDetail,
  profile: ApplyVariantProfileRequest
): ApplyVariantProfileResult {
  const dairyMode = profile.dairyMode ?? 'none';
  const omitTokens = profile.omitTokens?.filter((t) => t.trim()) ?? [];

  let ingredients = v.ingredients.map((ing) => ({ ...ing }));
  ingredients = ingredients.filter((ing) => !matchesAnyToken(ing.text, omitTokens));

  if (dairyMode === 'omit') {
    ingredients = ingredients.filter((ing) => !isDairyLineText(ing.text));
  } else if (dairyMode === 'substitute_oat') {
    ingredients = ingredients.map((ing) => {
      const next = substituteDairyOatInText(ing.text);
      return next === ing.text ? ing : { ...ing, text: next };
    });
  }

  let steps = v.steps.map((s) => ({ ...s }));
  if (dairyMode === 'substitute_oat') {
    steps = steps.map((s) => {
      const next = substituteDairyOatInText(s.text);
      return next === s.text ? s : { ...s, text: next };
    });
  }

  const before = v.ingredients.length;
  const after = ingredients.length;
  let summary = `dairyMode=${dairyMode}, omitTokens=${omitTokens.length}, ingredients ${before}→${after}`;
  if (profile.useGenerative) {
    summary = 'AI-assisted preview (offline rules): ' + summary;
  }

  const applied: Record<string, unknown> = { dairyMode };
  if (omitTokens.length) applied.omitTokens = omitTokens;
  if (profile.useGenerative) applied.useGenerative = true;

  return {
    adjustmentId: `local-${Date.now()}`,
    appliedProfile: applied,
    summary,
    adjustedIngredients: ingredients,
    adjustedSteps: steps,
  };
}

export async function applyVariantProfile(
  variantId: string,
  profile: ApplyVariantProfileRequest,
  scope?: RecipeScope
): Promise<ApplyVariantProfileResult> {
  const base = getApiBaseUrl();
  if (!base) {
    const v = await getVariant(variantId, scope);
    return applyVariantProfileLocally(v, profile);
  }
  const body: Record<string, unknown> = {};
  if (profile.dairyMode != null) body.dairyMode = profile.dairyMode;
  if (profile.omitTokens != null && profile.omitTokens.length > 0) {
    body.omitTokens = profile.omitTokens;
  }
  if (profile.useGenerative === true) {
    body.useGenerative = true;
  }
  const raw = await requestJson<ApplyProfileResponseWire>(
    'POST',
    `/api/v1/variants/${encodeURIComponent(variantId)}/apply-profile`,
    body,
    getDevBearer(),
    { extraHeaders: scopeHeaders(scope) }
  );
  return normalizeApplyProfileWire(raw);
}

/** Backend `RecipeDraftResponse` (OpenAPI / integration tests). */
type ImportPreviewWire = {
  suggestedDishName?: string;
  confidence?: number;
  warnings?: string[];
  heroImageUrl?: string | null;
  parseMethod?: string;
  previewId?: string;
  variantDraft?: {
    title?: string;
    yields?: string | null;
    prepTimeMin?: number | null;
    cookTimeMin?: number | null;
    canonical?: boolean;
    ingredients?: Array<{
      id?: string | null;
      sortOrder?: number;
      ingredientText?: string;
    }>;
    steps?: Array<{
      id?: string | null;
      sortOrder?: number;
      text?: string;
    }>;
  };
};

function isImportPreviewWire(x: unknown): x is ImportPreviewWire {
  return (
    typeof x === 'object' &&
    x !== null &&
    'variantDraft' in x &&
    typeof (x as ImportPreviewWire).variantDraft === 'object' &&
    (x as ImportPreviewWire).variantDraft !== null
  );
}

function normalizeImportPreviewWire(wire: ImportPreviewWire): ImportPreviewResponse {
  const vd = wire.variantDraft!;
  const prep = vd.prepTimeMin ?? null;
  const cook = vd.cookTimeMin ?? null;
  const totalTimeMin =
    prep != null && cook != null ? prep + cook : (prep ?? cook ?? null) ?? null;
  const ingList = vd.ingredients ?? [];
  const stepList = vd.steps ?? [];
  return {
    previewId: wire.previewId,
    draft: {
      dishName: wire.suggestedDishName,
      title: vd.title,
      yields: vd.yields?.trim() ? vd.yields : undefined,
      totalTimeMin,
      ingredients: ingList.map((ing, i) => ({
        id: ing.id?.trim() ? String(ing.id) : `ing-${i}`,
        text: String(ing.ingredientText ?? ''),
      })),
      steps: stepList
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((st, i) => ({
          id: st.id?.trim() ? String(st.id) : `st-${i}`,
          order: (st.sortOrder ?? i) + 1,
          text: String(st.text ?? ''),
        })),
      source: { type: 'manual', attribution: 'import' },
    },
    parseConfidence: typeof wire.confidence === 'number' ? wire.confidence : undefined,
    warnings: wire.warnings ?? [],
  };
}

/** Build `CreateVariantRequest`-shaped body for POST /import/commit. */
function variantToImportCommitWire(
  v: ImportCommitRequest['variant']
): Record<string, unknown> {
  const cook = v.totalTimeMin != null && Number.isFinite(v.totalTimeMin) ? v.totalTimeMin : null;
  return {
    title: v.title,
    yields: v.yields?.trim() ? v.yields : null,
    prepTimeMin: null,
    cookTimeMin: cook,
    canonical: true,
    ingredients: v.ingredients.map((ing, i) => ({
      sortOrder: i,
      ingredientText: ing.text,
    })),
    steps: v.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((st, i) => ({
        sortOrder: i,
        text: st.text,
      })),
  };
}

function buildImportCommitBody(body: ImportCommitRequest): Record<string, unknown> {
  if (body.previewId?.trim()) {
    return {
      previewId: body.previewId.trim(),
      dishName: body.dishName.trim(),
      variant: variantToImportCommitWire(body.variant),
    };
  }
  return {
    dishName: body.dishName.trim(),
    variant: variantToImportCommitWire(body.variant),
  };
}

/** Backend `VariantDetailResponse` uses `id` / `ingredientText` / `sortOrder` / `timerSeconds`. */
function normalizeRecipeVariantDetail(raw: unknown): RecipeVariantDetail {
  const o = raw as Record<string, unknown>;
  const prep = (o.prepTimeMin as number | null | undefined) ?? null;
  const cook = (o.cookTimeMin as number | null | undefined) ?? null;
  const totalTimeMin =
    prep != null && cook != null ? prep + cook : (prep ?? cook ?? null) ?? null;
  const ingRows = (o.ingredients as unknown[]) ?? [];
  const stepRows = (o.steps as unknown[]) ?? [];
  const ingredients: IngredientLine[] = ingRows.map((row, i) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id ?? `ing-${i}`),
      text: String(r.ingredientText ?? r.text ?? ''),
      quantity: null,
    };
  });
  const steps: RecipeStep[] = stepRows
    .map((row, i) => {
      const r = row as Record<string, unknown>;
      const sortOrder = typeof r.sortOrder === 'number' ? r.sortOrder : i;
      return {
        id: String(r.id ?? `st-${i}`),
        order: sortOrder + 1,
        text: String(r.text ?? ''),
        timerSec: (r.timerSeconds as number | null | undefined) ?? null,
      };
    })
    .sort((a, b) => a.order - b.order);
  return {
    id: String(o.id),
    dishId: String(o.dishId),
    title: String(o.title ?? ''),
    yields: (o.yields as string | undefined) ?? undefined,
    totalTimeMin,
    isCanonical: Boolean(o.canonical),
    ingredients,
    steps,
    source: null,
  };
}

export async function importPreview(
  body: ImportPreviewRequest,
  options?: { signal?: AbortSignal; scope?: RecipeScope }
): Promise<ImportPreviewResponse> {
  const base = getApiBaseUrl();
  if (!base) {
    if (options?.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    return {
      draft: {
        dishName: 'Imported dish',
        title: body.url ? `From ${body.url}` : 'Pasted recipe',
        ingredients: [
          { id: 'n1', text: 'Ingredient one — edit me' },
          { id: 'n2', text: 'Ingredient two — edit me' },
        ],
        steps: [
          { id: 'n1', order: 1, text: 'Step one — edit me' },
          { id: 'n2', order: 2, text: 'Step two — edit me' },
        ],
        source: { type: 'web', url: body.url ?? null, attribution: body.url ?? 'paste' },
      },
      parseConfidence: 0.4,
      warnings: ['Demo mode: backend not configured; showing placeholder draft.'],
    };
  }
  const raw = await requestJson<unknown>(
    'POST',
    '/api/v1/import/preview',
    body,
    getDevBearer(),
    {
      transientSafeRetry: true,
      signal: options?.signal,
      extraHeaders: scopeHeaders(options?.scope),
    }
  );
  if (isImportPreviewWire(raw)) {
    return normalizeImportPreviewWire(raw);
  }
  return raw as ImportPreviewResponse;
}

export async function importCommit(
  body: ImportCommitRequest,
  options?: { signal?: AbortSignal; scope?: RecipeScope }
): Promise<ImportCommitResponse> {
  const base = getApiBaseUrl();
  if (!base) {
    if (options?.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const dishId = `dish-local-${Date.now()}`;
    const variantId = `var-local-${Date.now()}`;
    const dish: Dish = { id: dishId, name: body.dishName };
    MOCK_DISHES.push(dish);
    const detail: RecipeVariantDetail = {
      id: variantId,
      dishId,
      title: body.variant.title,
      yields: body.variant.yields,
      totalTimeMin: body.variant.totalTimeMin ?? null,
      ingredients: body.variant.ingredients,
      steps: body.variant.steps.sort((a, b) => a.order - b.order),
      source: body.variant.source ?? { type: 'manual', attribution: 'import' },
    };
    MOCK_VARIANTS[variantId] = detail;
    return { dishId, variantId };
  }
  const raw = await requestJson<unknown>(
    'POST',
    '/api/v1/import/commit',
    buildImportCommitBody(body),
    getDevBearer(),
    { signal: options?.signal, extraHeaders: scopeHeaders(options?.scope) }
  );
  if (raw && typeof raw === 'object' && 'id' in raw && 'dishId' in raw) {
    const r = raw as { id: unknown; dishId: unknown };
    return { variantId: String(r.id), dishId: String(r.dishId) };
  }
  return raw as ImportCommitResponse;
}
