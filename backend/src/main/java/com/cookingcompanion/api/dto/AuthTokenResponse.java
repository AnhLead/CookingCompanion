package com.cookingcompanion.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AuthTokenResponse",
        description = "Token pair returned by login and refresh. Mobile accepts camelCase; snake_case aliases supported on input only.")
public record AuthTokenResponse(
        @JsonProperty("accessToken") @Schema(description = "Bearer access JWT; `sub` is the user UUID") String accessToken,
        @JsonProperty("refreshToken") @Schema(description = "Opaque refresh token; single-use with rotation on refresh") String refreshToken,
        @JsonProperty("expiresIn") @Schema(description = "Access token lifetime in seconds") int expiresIn,
        @JsonProperty("tokenType") @Schema(example = "Bearer") String tokenType) {}
