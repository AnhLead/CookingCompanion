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

export type ImportPreviewRequest = {
  url?: string;
  html?: string;
};

export type ImportPreviewResponse = {
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
