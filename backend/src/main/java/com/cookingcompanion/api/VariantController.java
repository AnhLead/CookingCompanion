package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.ApplyProfileResponse;
import com.cookingcompanion.api.dto.PatchVariantRequest;
import com.cookingcompanion.api.dto.VariantDetailResponse;
import com.cookingcompanion.service.ParameterProfileService;
import com.cookingcompanion.service.VariantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
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
    @Operation(summary = "Get variant with ingredients and steps")
    public VariantDetailResponse get(@PathVariable UUID variantId) {
        return variantService.get(variantId);
    }

    @PatchMapping("/{variantId}")
    @Operation(summary = "Patch variant metadata and optionally replace ingredients/steps")
    public VariantDetailResponse patch(@PathVariable UUID variantId, @Valid @RequestBody PatchVariantRequest req) {
        return variantService.patch(variantId, req);
    }

    @DeleteMapping("/{variantId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete variant")
    public void delete(@PathVariable UUID variantId) {
        variantService.delete(variantId);
    }

    @PostMapping("/{variantId}/fork")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Fork variant (copy-on-write under same dish)")
    public VariantDetailResponse fork(@PathVariable UUID variantId) {
        return variantService.fork(variantId);
    }

    @PostMapping("/{variantId}/apply-profile")
    @Operation(
            summary = "Apply parameter profile",
            description =
                    "Deterministic rules: `dairyMode` = none | omit | substitute_oat; optional `omitTokens` (substring match per line).")
    public ApplyProfileResponse applyProfile(
            @PathVariable UUID variantId, @RequestBody Map<String, Object> profile) {
        return parameterProfileService.apply(variantId, profile);
    }
}
