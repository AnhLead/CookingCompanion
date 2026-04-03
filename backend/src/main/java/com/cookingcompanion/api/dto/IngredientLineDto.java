package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

@Schema(description = "Normalised ingredient line")
public record IngredientLineDto(
        @Schema(description = "Stable id when reading persisted variant; omit on create") String id,
        @NotNull Integer sortOrder,
        BigDecimal amountNumeric,
        String unit,
        @NotBlank String ingredientText,
        String preparationNote,
        List<String> alternates) {

    public IngredientLineDto {
        if (alternates == null) {
            alternates = List.of();
        }
    }
}
