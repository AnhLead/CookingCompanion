package com.cookingcompanion.api.dto;

import java.time.Instant;
import java.util.UUID;

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
