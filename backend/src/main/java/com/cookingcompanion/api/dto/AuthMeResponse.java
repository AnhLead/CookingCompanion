package com.cookingcompanion.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(name = "AuthMeResponse")
public record AuthMeResponse(
        @JsonProperty("userId") UUID userId, @JsonProperty("email") String email) {}
