package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Ordered cooking step")
public record RecipeStepDto(
        @Schema(description = "Stable id when reading persisted variant; omit on create") String id,
        @NotNull Integer sortOrder,
        @NotBlank String text,
        Integer timerSeconds,
        String linkUrl) {}
