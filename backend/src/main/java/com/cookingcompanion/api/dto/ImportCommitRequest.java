package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

@Schema(description = "Persist dish + variant from a validated draft")
public record ImportCommitRequest(
        @Schema(description = "When set, server merges stored preview from POST /import/preview") UUID previewId,
        @Schema(description = "Required unless previewId is set (defaults to preview suggested name)") String dishName,
        List<String> dishTags,
        String heroImageUrl,
        UUID ownerUserId,
        @Schema(description = "Source URL for idempotency when ownerUserId is set") String sourceUrl,
        @Schema(description = "Required unless previewId is set (defaults to stored variant draft)") @Valid
                CreateVariantRequest variant) {

    public ImportCommitRequest {
        if (dishTags == null) {
            dishTags = List.of();
        }
    }
}
