package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Schema(description = "Dish card / library entry")
public record DishResponse(
        UUID id,
        String name,
        List<String> tags,
        String heroImageUrl,
        UUID ownerUserId,
        Instant createdAt,
        Instant updatedAt) {}
