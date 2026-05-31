package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(name = "AuthLoginRequest")
public record AuthLoginRequest(
        @NotBlank @Email @Schema(example = "dev@example.com") String email,
        @NotBlank @Schema(example = "password") String password) {}
