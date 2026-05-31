package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.AuthLoginRequest;
import com.cookingcompanion.api.dto.AuthMeResponse;
import com.cookingcompanion.api.dto.AuthRefreshRequest;
import com.cookingcompanion.api.dto.AuthTokenResponse;
import com.cookingcompanion.security.CurrentRecipeRequestContext;
import com.cookingcompanion.service.auth.AuthService;
import com.cookingcompanion.web.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth")
public class AuthController {

    private final AuthService authService;
    private final CurrentRecipeRequestContext requestContext;

    public AuthController(AuthService authService, CurrentRecipeRequestContext requestContext) {
        this.authService = authService;
        this.requestContext = requestContext;
    }

    @PostMapping("/login")
    @Operation(
            operationId = "authLogin",
            summary = "Exchange email/password for access + refresh tokens",
            description =
                    "Demo user in dev: dev@example.com / password. Refresh tokens rotate on each POST /auth/refresh call.")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "OK",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = AuthTokenResponse.class))),
        @ApiResponse(
                responseCode = "400",
                description = "Validation failed (missing or invalid email/password)",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "401",
                description = "Invalid credentials",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "503",
                description = "Auth signing is not configured",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public AuthTokenResponse login(@Valid @RequestBody AuthLoginRequest body) {
        return authService.login(body.email(), body.password());
    }

    @PostMapping("/refresh")
    @Operation(
            operationId = "authRefresh",
            summary = "Rotate refresh token and issue a new access token",
            description =
                    "Send the opaque refresh token from login or a prior refresh. "
                            + "The presented refresh token is revoked; a new refresh token is returned. "
                            + "Reuse of a revoked refresh token revokes the whole token family.")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "OK — new token pair; prior refresh token is invalid",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = AuthTokenResponse.class))),
        @ApiResponse(
                responseCode = "400",
                description = "Validation failed (missing refresh token)",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "401",
                description = "Invalid, expired, or reused refresh token",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "503",
                description = "Auth signing is not configured",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public AuthTokenResponse refresh(@Valid @RequestBody AuthRefreshRequest body) {
        return authService.refresh(body.refreshToken());
    }

    @GetMapping("/me")
    @Operation(operationId = "authMe", summary = "Current user from Bearer access JWT")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "OK",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = AuthMeResponse.class))),
        @ApiResponse(
                responseCode = "401",
                description = "Missing or invalid Bearer access JWT",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public AuthMeResponse me() {
        UUID userId = requestContext
                .userId()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
        return authService.me(userId);
    }
}
