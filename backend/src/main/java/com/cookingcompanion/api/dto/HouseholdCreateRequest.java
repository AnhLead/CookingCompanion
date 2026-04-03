package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Create a new household; the creator becomes owner")
public record HouseholdCreateRequest(
        @NotBlank @Size(max = 512) @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name) {}
