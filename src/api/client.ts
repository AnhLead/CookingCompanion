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
  ImportCommitRequest,
  ImportCommitResponse,
  ImportPreviewRequest,
  ImportPreviewResponse,
  IngredientLine,
  ProblemDetails,
  RecipeStep,
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

function isAbortError(e: unknown): boolean {
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
  timeoutMs: number
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

type RequestJsonOptions = {
  timeoutMs?: number;
  /** GET only: retry transient failures with exponential backoff */
  idempotentRead?: boolean;
};

async function performOnce<T>(
  method: string,
  url: string,
  body: unknown | undefined,
  headers: Record<string, string>,
  timeoutMs: number
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
      timeoutMs
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
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${base}${path}`;
  const idempotentRead = method === 'GET' && (options?.idempotentRead ?? true);

  let lastErr: unknown;
  const maxAttempts = idempotentRead ? READ_MAX_ATTEMPTS : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await performOnce<T>(method, url, body, headers, timeoutMs);
    } catch (e) {
      lastErr = e;
      const transientFailure =
        e instanceof ApiError
          ? Boolean(e.transient || isTransientHttpStatus(e.status))
          : isAbortError(e) || e instanceof TypeError;
      const canRetry = idempotentRead && attempt < maxAttempts - 1 && transientFailure;

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

export async function listDishes(): Promise<Dish[]> {
  const base = getApiBaseUrl();
  if (!base) return MOCK_DISHES;
  return requestJson<Dish[]>('GET', '/api/v1/dishes', undefined, getDevBearer());
}

export async function listVariants(dishId: string): Promise<RecipeVariantSummary[]> {
  const base = getApiBaseUrl();
  if (!base) return mockVariantsForDish(dishId);
  return requestJson<RecipeVariantSummary[]>(
    'GET',
    `/api/v1/dishes/${encodeURIComponent(dishId)}/variants`,
    undefined,
    getDevBearer()
  );
}

export async function getVariant(variantId: string): Promise<RecipeVariantDetail> {
  const base = getApiBaseUrl();
  if (!base) {
    const v = MOCK_VARIANTS[variantId];
    if (!v) throw new ApiError('Variant not found', 404);
    return v;
  }
  return requestJson<RecipeVariantDetail>(
    'GET',
    `/api/v1/variants/${encodeURIComponent(variantId)}`,
    undefined,
    getDevBearer()
  );
}

export async function forkVariant(variantId: string): Promise<RecipeVariantDetail> {
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
  return requestJson<RecipeVariantDetail>(
    'POST',
    `/api/v1/variants/${encodeURIComponent(variantId)}/fork`,
    {},
    getDevBearer()
  );
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
  const summary = `dairyMode=${dairyMode}, omitTokens=${omitTokens.length}, ingredients ${before}→${after}`;

  const applied: Record<string, unknown> = { dairyMode };
  if (omitTokens.length) applied.omitTokens = omitTokens;

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
  profile: ApplyVariantProfileRequest
): Promise<ApplyVariantProfileResult> {
  const base = getApiBaseUrl();
  if (!base) {
    const v = await getVariant(variantId);
    return applyVariantProfileLocally(v, profile);
  }
  const body: Record<string, unknown> = {};
  if (profile.dairyMode != null) body.dairyMode = profile.dairyMode;
  if (profile.omitTokens != null && profile.omitTokens.length > 0) {
    body.omitTokens = profile.omitTokens;
  }
  const raw = await requestJson<ApplyProfileResponseWire>(
    'POST',
    `/api/v1/variants/${encodeURIComponent(variantId)}/apply-profile`,
    body,
    getDevBearer()
  );
  return normalizeApplyProfileWire(raw);
}

export async function importPreview(
  body: ImportPreviewRequest
): Promise<ImportPreviewResponse> {
  const base = getApiBaseUrl();
  if (!base) {
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
  return requestJson<ImportPreviewResponse>(
    'POST',
    '/api/v1/import/preview',
    body,
    getDevBearer()
  );
}

export async function importCommit(
  body: ImportCommitRequest
): Promise<ImportCommitResponse> {
  const base = getApiBaseUrl();
  if (!base) {
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
  return requestJson<ImportCommitResponse>(
    'POST',
    '/api/v1/import/commit',
    body,
    getDevBearer()
  );
}
