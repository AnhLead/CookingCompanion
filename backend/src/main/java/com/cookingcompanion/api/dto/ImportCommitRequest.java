package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

@Schema(description = "Persist dish + variant from a validated draft")
public record ImportCommitRequest(
        @NotBlank String dishName,
        List<String> dishTags,
        String heroImageUrl,
        UUID ownerUserId,
        @Schema(description = "Source URL for idempotency when ownerUserId is set") String sourceUrl,
        @NotNull @Valid CreateVariantRequest variant) {

    public ImportCommitRequest {
        if (dishTags == null) {
            dishTags = List.of();
        }
    }
}
