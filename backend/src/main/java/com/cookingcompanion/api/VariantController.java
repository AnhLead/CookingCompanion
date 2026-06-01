package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.ApplyProfileRequest;
import com.cookingcompanion.api.dto.ApplyProfileResponse;
import com.cookingcompanion.api.dto.PatchVariantRequest;
import com.cookingcompanion.api.dto.VariantDetailResponse;
import com.cookingcompanion.service.ParameterProfileService;
import com.cookingcompanion.service.VariantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/variants")
@Tag(name = "Variants")
public class VariantController {

    private final VariantService variantService;
    private final ParameterProfileService parameterProfileService;

    public VariantController(VariantService variantService, ParameterProfileService parameterProfileService) {
        this.variantService = variantService;
        this.parameterProfileService = parameterProfileService;
    }

    @GetMapping("/{variantId}")
    @Operation(
            operationId = "getVariant",
            summary = "Get variant with ingredients and steps",
            parameters = {
                @Parameter(
                        name = "Authorization",
                        in = ParameterIn.HEADER,
                        required = false,
                        schema = @Schema(type = "string")),
                @Parameter(
                        name = "X-Household-Id",
                        in = ParameterIn.HEADER,
                        required = false,
                        schema = @Schema(type = "string", format = "uuid"))
            })
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "OK",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = VariantDetailResponse.class))),
        @ApiResponse(
                responseCode = "401",
                description =
                        "Missing authentication for a protected variant, or `X-Household-Id` sent without a verified"
                                + " authenticated user",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "403",
                description =
                        "Authenticated caller is not a member of the household in `X-Household-Id`"
                                + " (`HouseholdScopeGateFilter`), or household-owned variant accessed without matching"
                                + " `X-Household-Id`",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public VariantDetailResponse get(@PathVariable UUID variantId) {
        return variantService.get(variantId);
    }

    @PatchMapping("/{variantId}")
    @Operation(
            operationId = "patchVariant",
            summary = "Patch variant metadata and optionally replace ingredients/steps",
            parameters = {
                @Parameter(
                        name = "Authorization",
                        in = ParameterIn.HEADER,
                        required = false,
                        schema = @Schema(type = "string")),
                @Parameter(
                        name = "X-Household-Id",
                        in = ParameterIn.HEADER,
                        required = false,
                        schema = @Schema(type = "string", format = "uuid"))
            })
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "OK",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = VariantDetailResponse.class))),
        @ApiResponse(
                responseCode = "401",
                description =
                        "Missing authentication for a protected variant, or `X-Household-Id` sent without a verified"
                                + " authenticated user",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "403",
                description =
                        "Authenticated caller is not a member of the household in `X-Household-Id`"
                                + " (`HouseholdScopeGateFilter`), or household-owned variant accessed without matching"
                                + " `X-Household-Id`",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public VariantDetailResponse patch(@PathVariable UUID variantId, @Valid @RequestBody PatchVariantRequest req) {
        return variantService.patch(variantId, req);
    }

    @DeleteMapping("/{variantId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            operationId = "deleteVariant",
            summary = "Delete variant",
            parameters = {
                @Parameter(
                        name = "Authorization",
                        in = ParameterIn.HEADER,
                        required = false,
                        schema = @Schema(type = "string")),
                @Parameter(
                        name = "X-Household-Id",
                        in = ParameterIn.HEADER,
                        required = false,
                        schema = @Schema(type = "string", format = "uuid"))
            })
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "No Content"),
        @ApiResponse(
                responseCode = "401",
                description =
                        "Missing authentication for a protected variant, or `X-Household-Id` sent without a verified"
                                + " authenticated user",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "403",
                description =
                        "Authenticated caller is not a member of the household in `X-Household-Id`"
                                + " (`HouseholdScopeGateFilter`), or household-owned variant accessed without matching"
                                + " `X-Household-Id`",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public void delete(@PathVariable UUID variantId) {
        variantService.delete(variantId);
    }

    @PostMapping("/{variantId}/fork")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "forkVariant", summary = "Fork variant (copy-on-write under same dish)")
    public VariantDetailResponse fork(@PathVariable UUID variantId) {
        return variantService.fork(variantId);
    }

    @PostMapping("/{variantId}/apply-profile")
    @Operation(
            operationId = "applyVariantProfile",
            summary = "Apply parameter profile",
            description =
                    "Preview-only: returns adjusted ingredients/steps and persists a VariantAdjustment audit row; does not overwrite the variant. "
                            + "Deterministic rules: `dairyMode` = none | omit | substitute_oat; optional `omitTokens`. "
                            + "Optional `useGenerative: true` (explicit opt-in) requires `GET /api/v1/recipe-ai/flags` and provider config; otherwise 403/503.")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "Preview result",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ApplyProfileResponse.class))),
        @ApiResponse(
                responseCode = "403",
                description =
                        "Generative preview requested (`useGenerative: true`) but AI-assisted adjustments are disabled on this server",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "429",
                description = "Generative adjustment rate limit exceeded",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "502",
                description = "Generative provider or transport failure",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "503",
                description = "Generative adjustment is not configured (for example missing provider API key)",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ApplyProfileResponse applyProfile(
            @PathVariable UUID variantId, @RequestBody ApplyProfileRequest profile) {
        return parameterProfileService.apply(variantId, profile.toProfileMap());
    }
}
