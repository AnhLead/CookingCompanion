package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.UUID;

@Schema(description = "Create variant under a dish")
public record CreateVariantRequest(
        @NotBlank String title,
        String yields,
        Integer prepTimeMin,
        Integer cookTimeMin,
        boolean canonical,
        UUID sourceId,
        UUID ownerUserId,
        @Valid List<IngredientLineDto> ingredients,
        @Valid List<RecipeStepDto> steps) {

    public CreateVariantRequest {
        if (ingredients == null) {
            ingredients = List.of();
        }
        if (steps == null) {
            steps = List.of();
        }
    }
}
