package com.cookingcompanion.api.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ApplyProfileResponse(
        UUID adjustmentId,
        Map<String, Object> appliedProfile,
        String summary,
        List<IngredientLineDto> adjustedIngredients,
        List<RecipeStepDto> adjustedSteps) {}
