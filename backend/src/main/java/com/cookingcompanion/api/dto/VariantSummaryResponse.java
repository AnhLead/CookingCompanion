package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

@Schema(name = "RecipeVariantSummary")
public record VariantSummaryResponse(
        UUID id,
        UUID dishId,
        String title,
        String yields,
        Integer prepTimeMin,
        Integer cookTimeMin,
        boolean canonical,
        UUID sourceId,
        UUID ownerUserId,
        Instant createdAt,
        Instant updatedAt) {}
