package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import java.util.List;

@Schema(name = "PatchVariant")
public record PatchVariantRequest(
        String title,
        String yields,
        Integer prepTimeMin,
        Integer cookTimeMin,
        Boolean canonical,
        java.util.UUID sourceId,
        @Valid List<IngredientLineDto> ingredients,
        @Valid List<RecipeStepDto> steps) {}
