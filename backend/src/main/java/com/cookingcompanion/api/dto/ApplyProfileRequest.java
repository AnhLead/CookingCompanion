package com.cookingcompanion.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "ApplyProfileRequest")
public record ApplyProfileRequest(
        @Schema(description = "none | omit | substitute_oat") String dairyMode,
        List<String> omitTokens,
        @Schema(description = "Opt-in; server rejects when feature flag is off") Boolean useGenerative) {

    public Map<String, Object> toProfileMap() {
        Map<String, Object> m = new HashMap<>();
        if (dairyMode != null) {
            m.put("dairyMode", dairyMode);
        }
        if (omitTokens != null) {
            m.put("omitTokens", omitTokens);
        }
        if (useGenerative != null) {
            m.put("useGenerative", useGenerative);
        }
        return m;
    }
}
