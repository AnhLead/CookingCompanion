package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "RecipeAiFlags", description = "Feature flags for optional recipe AI endpoints")
public record RecipeAiFlagsResponse(
        @Schema(description = "When false, clients must not send useGenerative on apply-profile")
                boolean generativeAdjustmentsEnabled) {}
