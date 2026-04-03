import { getApiBaseUrl } from '../lib/config';
import {
  MOCK_DISHES,
  MOCK_VARIANTS,
  mockVariantsForDish,
} from './mockData';
import type {
  Dish,
  ImportCommitRequest,
  ImportCommitResponse,
  ImportPreviewRequest,
  ImportPreviewResponse,
  ProblemDetails,
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
