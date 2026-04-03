/** Types aligned with MON-12 OpenAPI direction (`/api/v1`). */

export type Dish = {
  id: string;
  name: string;
  tags?: string[];
  heroImageUrl?: string | null;
};

export type RecipeVariantSummary = {
  id: string;
  dishId: string;
  title: string;
  yields?: string;
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
};

/** `GET /api/v1/households` — present once backend household platform ships. */
export type HouseholdSummary = {
  id: string;
  name: string;
  /** e.g. owner, member */
  membershipRole?: string | null;
};


/** Request body for `POST /api/v1/variants/{id}/apply-profile` (slice C). */
export type DairyMode = 'none' | 'omit' | 'substitute_oat';

export type ApplyVariantProfileRequest = {
  dairyMode?: DairyMode;
  /** Substring match per ingredient line (case-insensitive), same as backend. */
  omitTokens?: string[];
};

/** Normalized apply-profile result for UI (maps API DTO field names to app types). */
export type ApplyVariantProfileResult = {
  adjustmentId: string;
  appliedProfile: Record<string, unknown>;
  summary: string;
  adjustedIngredients: IngredientLine[];
  adjustedSteps: RecipeStep[];
};
