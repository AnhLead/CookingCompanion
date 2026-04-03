package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Join an existing household using its invite code")
public record HouseholdJoinRequest(
        @NotBlank @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "JOINME01") String code) {}
