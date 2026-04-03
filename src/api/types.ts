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
