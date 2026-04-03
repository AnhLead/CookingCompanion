package com.cookingcompanion.service.ai;

import com.cookingcompanion.api.dto.IngredientLineDto;
import com.cookingcompanion.api.dto.RecipeStepDto;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Produces a preview-only adjustment (ingredients + steps). Callers persist {@link
 * com.cookingcompanion.domain.VariantAdjustment} for audit; recipe rows are not mutated here.
 */
public interface GenerativeRecipeAdjustmentClient {

    record GenerativeResult(
            String summary, List<IngredientLineDto> adjustedIngredients, List<RecipeStepDto> adjustedSteps) {}

    /**
     * @param profile same map as apply-profile (dairyMode, omitTokens, useGenerative, etc.)
     */
    GenerativeResult adjust(
            UUID variantId,
            Optional<UUID> actorUserId,
            List<IngredientLineDto> baseIngredients,
            List<RecipeStepDto> baseSteps,
            Map<String, Object> profile);
}
