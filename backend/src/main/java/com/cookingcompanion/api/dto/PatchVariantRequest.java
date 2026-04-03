package com.cookingcompanion.api.dto;

import jakarta.validation.Valid;
import java.util.List;

public record PatchVariantRequest(
        String title,
        String yields,
        Integer prepTimeMin,
        Integer cookTimeMin,
        Boolean canonical,
        java.util.UUID sourceId,
        @Valid List<IngredientLineDto> ingredients,
        @Valid List<RecipeStepDto> steps) {}
