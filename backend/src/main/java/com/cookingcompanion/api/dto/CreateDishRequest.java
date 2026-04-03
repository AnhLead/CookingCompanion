package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.UUID;

@Schema(description = "Create dish")
public record CreateDishRequest(
        @NotBlank String name,
        List<String> tags,
        String heroImageUrl,
        @Schema(description = "Optional owner user id for future JWT scoping (MON-9)") UUID ownerUserId) {

    public CreateDishRequest {
        if (tags == null) {
            tags = List.of();
        }
    }
}
