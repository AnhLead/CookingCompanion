/** Types aligned with MON-12 OpenAPI direction (`/api/v1`). */

export type Dish = {
  id: string;
  name: string;
  tags?: string[];
  heroImageUrl?: string | null;
};

/** Body for `POST /api/v1/dishes` (`DishCreate` in OpenAPI). */
export type DishCreateRequest = {
  name: string;
  tags?: string[];
};

/** Body for `PATCH /api/v1/dishes/{dishId}` (`PatchDish` in OpenAPI). */
export type DishPatchRequest = {
  name?: string;
  tags?: string[];
  heroImageUrl?: string | null;
};

/** Body for `POST /api/v1/dishes/{dishId}/variants` (`RecipeVariantCreate` in OpenAPI). */
export type VariantCreateRequest = {
  title: string;
  yields?: string;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  canonical?: boolean;
};

/** Body for `PATCH /api/v1/variants/{variantId}` (`PatchVariant` in OpenAPI). */
export type VariantPatchRequest = {
  title?: string;
  yields?: string;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  canonical?: boolean;
};

export type RecipeVariantSummary = {
  id: string;
  dishId: string;
  title: string;
  yields?: string;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  totalTimeMin?: number | null;
  isCanonical?: boolean;
  sourceAttribution?: string | null;
};

export type IngredientLine = {
  id: string;
  text: string;
  quantity?: { amount?: number; unit?: string } | null;
};

export type RecipeStep = {
  id: string;
  order: number;
  text: string;
  timerSec?: number | null;
};

export type Source = {
  type: 'web' | 'manual' | 'import_file' | 'youtube';
  url?: string | null;
  attribution?: string;
};

export type RecipeVariantDetail = RecipeVariantSummary & {
  ingredients: IngredientLine[];
  steps: RecipeStep[];
  source?: Source | null;
};

/**
 * Import API wire vs app types (see `openapi/openapi.yaml` import paths + Spring DTOs):
 * - Preview JSON is flat `RecipeDraftResponse` (`suggestedDishName`, `variantDraft`, `previewId`, …).
 *   `importPreview` maps that to nested `ImportPreviewResponse` for UI.
 * - Commit accepts `ImportCommitRequest` (`CreateVariantRequest` for `variant`); successful POST returns
 *   `VariantDetailResponse` (201). `importCommit` returns `{ dishId, variantId }` for callers.
 */
export type ImportPreviewRequest = {
  url?: string;
  html?: string;
};

export type ImportPreviewResponse = {
  /** Returned by the API after preview; send back on commit to merge stored draft. */
  previewId?: string;
  draft: {
    dishName?: string;
    title?: string;
    yields?: string;
    totalTimeMin?: number | null;
    ingredients?: IngredientLine[];
    steps?: RecipeStep[];
    source?: Source | null;
  };
  parseConfidence?: number;
  parseMethod?: string;
  warnings?: string[];
};

export type ImportCommitRequest = {
  /** When set (with configured API base), commit merges the server-stored preview. */
  previewId?: string;
  dishName: string;
  variant: {
    title: string;
    yields?: string;
    totalTimeMin?: number | null;
    ingredients: IngredientLine[];
    steps: RecipeStep[];
    source?: Source | null;
  };
};

export type ImportCommitResponse = {
  dishId: string;
  variantId: string;
};

export type ProblemDetails = {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  /** RFC 7807 extension: echoed log / request correlation (pairs with response headers). */
  correlationId?: string;
  /** Import commit 409: id of the existing source for duplicate URL. */
  existingSourceId?: string;
};

/** `GET /api/v1/households` — present once backend household platform ships. */
export type HouseholdSummary = {
  id: string;
  name: string;
  /** e.g. owner, member */
  membershipRole?: string | null;
  /** Present for owners only — share with invitees. */
  inviteCode?: string | null;
};


/** `GET /api/v1/recipe-ai/flags` — mobile uses this to gate generative adjustment UX. */
export type RecipeAiFlags = {
  generativeAdjustmentsEnabled: boolean;
};

/** Request body for `POST /api/v1/variants/{id}/apply-profile` (slice C). */
export type DairyMode = 'none' | 'omit' | 'substitute_oat';

export type ApplyVariantProfileRequest = {
  dairyMode?: DairyMode;
  /** Substring match per ingredient line (case-insensitive), same as backend. */
  omitTokens?: string[];
  /**
   * When true, server runs the generative path (explicit user opt-in). Otherwise same as rules-only.
   * Documented errors: 403 when feature disabled; 503 when enabled but provider not configured; 502 / 429 for
   * provider or rate-limit failures — see `openapi/openapi.yaml` apply-profile responses.
   */
  useGenerative?: boolean;
};

/** Normalized apply-profile result for UI (maps API DTO field names to app types). */
export type ApplyVariantProfileResult = {
  adjustmentId: string;
  appliedProfile: Record<string, unknown>;
  summary: string;
  adjustedIngredients: IngredientLine[];
  adjustedSteps: RecipeStep[];
};
