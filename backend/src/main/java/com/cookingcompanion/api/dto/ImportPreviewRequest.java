package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Provide a URL to fetch, raw HTML to parse, or both (HTML wins if both set)")
public record ImportPreviewRequest(
        String url,
        @Schema(description = "Raw HTML body (e.g. pasted from a site)") String html) {}
