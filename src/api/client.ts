import { getApiBaseUrl } from '../lib/config';
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
    public readonly problem?: ProblemDetails
  ) {
    super(message);
    this.name = 'ApiError';
  }
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

async function requestJson<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null
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

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const problem = await parseProblem(res);
    const msg = problem?.detail ?? problem?.title ?? res.statusText;
    throw new ApiError(msg || `HTTP ${res.status}`, res.status, problem);
  }

  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) {
    return (await res.json()) as T;
  }
  return undefined as T;
}

/** Optional JWT from env for early integration (replace with secure storage + auth flow). */
export function getDevBearer(): string | null {
  return process.env.EXPO_PUBLIC_API_BEARER?.trim() || null;
}

export async function listDishes(): Promise<Dish[]> {
  const base = getApiBaseUrl();
  if (!base) return MOCK_DISHES;
  try {
    return await requestJson<Dish[]>('GET', '/api/v1/dishes', undefined, getDevBearer());
  } catch {
    return MOCK_DISHES;
  }
}

export async function listVariants(dishId: string): Promise<RecipeVariantSummary[]> {
  const base = getApiBaseUrl();
  if (!base) return mockVariantsForDish(dishId);
  try {
    return await requestJson<RecipeVariantSummary[]>(
      'GET',
      `/api/v1/dishes/${encodeURIComponent(dishId)}/variants`,
      undefined,
      getDevBearer()
    );
  } catch {
    return mockVariantsForDish(dishId);
  }
}

export async function getVariant(variantId: string): Promise<RecipeVariantDetail> {
  const base = getApiBaseUrl();
  if (!base) {
    const v = MOCK_VARIANTS[variantId];
    if (!v) throw new ApiError('Variant not found', 404);
    return v;
  }
  try {
    return await requestJson<RecipeVariantDetail>(
      'GET',
      `/api/v1/variants/${encodeURIComponent(variantId)}`,
      undefined,
      getDevBearer()
    );
  } catch (e) {
    const v = MOCK_VARIANTS[variantId];
    if (v) return v;
    throw e;
  }
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
