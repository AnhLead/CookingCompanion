package com.cookingcompanion.api.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(name = "AuthRefreshRequest", description = "Accepts camelCase or snake_case refresh token field")
public record AuthRefreshRequest(
        @NotBlank
                @JsonProperty("refreshToken")
                @JsonAlias("refresh_token")
                @Schema(description = "Opaque refresh token from login or prior refresh")
                String refreshToken) {}
