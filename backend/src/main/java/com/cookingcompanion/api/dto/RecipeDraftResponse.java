package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Non-persisted draft from import preview")
public record RecipeDraftResponse(
        @Schema(description = "Suggested dish name (may be edited before commit)") String suggestedDishName,
        @Schema(description = "Parse confidence 0..1") double confidence,
        @Schema(description = "Optional notes or warnings") List<String> warnings,
        @Schema(
                        description =
                                "Hero image URL from JSON-LD, microdata, or og:image when detected (safe http(s) only)")
                String heroImageUrl,
        @Schema(description = "How the recipe was extracted: json_ld, microdata, or heuristic") String parseMethod,
        CreateVariantRequest variantDraft) {

    public RecipeDraftResponse {
        if (warnings == null) {
            warnings = List.of();
        }
        if (parseMethod == null || parseMethod.isBlank()) {
            parseMethod = "heuristic";
        }
    }
}
