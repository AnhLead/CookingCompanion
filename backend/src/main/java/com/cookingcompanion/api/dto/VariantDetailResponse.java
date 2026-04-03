package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Schema(name = "VariantDetailResponse")
public record VariantDetailResponse(
        UUID id,
        UUID dishId,
        String title,
        String yields,
        Integer prepTimeMin,
        Integer cookTimeMin,
        boolean canonical,
        UUID sourceId,
        UUID ownerUserId,
        List<IngredientLineDto> ingredients,
        List<RecipeStepDto> steps,
        Instant createdAt,
        Instant updatedAt) {}
