package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.ImportCommitRequest;
import com.cookingcompanion.api.dto.ImportPreviewRequest;
import com.cookingcompanion.api.dto.RecipeDraftResponse;
import com.cookingcompanion.api.dto.VariantDetailResponse;
import com.cookingcompanion.service.VariantService;
import com.cookingcompanion.service.importing.RecipeImportService;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/import")
@Tag(name = "Import")
public class ImportController {

    private final RecipeImportService recipeImportService;
    private final VariantService variantService;

    public ImportController(RecipeImportService recipeImportService, VariantService variantService) {
        this.recipeImportService = recipeImportService;
        this.variantService = variantService;
    }

    @PostMapping("/preview")
    @RateLimiter(name = "importPreview")
    @Operation(operationId = "importPreview", summary = "Preview import from URL or HTML (no persist)")
    public RecipeDraftResponse preview(@RequestBody ImportPreviewRequest req) {
        return recipeImportService.preview(req);
    }

    @PostMapping("/commit")
    @RateLimiter(name = "importCommit")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "importCommit", summary = "Commit validated draft")
    public VariantDetailResponse commit(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody ImportCommitRequest req) {
        var ids = recipeImportService.commit(req, idempotencyKey);
        return variantService.get(ids.variantId());
    }
}
