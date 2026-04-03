package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.CreateVariantRequest;
import com.cookingcompanion.api.dto.VariantSummaryResponse;
import com.cookingcompanion.service.VariantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dishes/{dishId}/variants")
@Tag(name = "Dish variants")
public class DishVariantController {

    private final VariantService variantService;

    public DishVariantController(VariantService variantService) {
        this.variantService = variantService;
    }

    @GetMapping
    @Operation(operationId = "listVariants", summary = "List variants for dish")
    public List<VariantSummaryResponse> list(@PathVariable UUID dishId) {
        return variantService.listByDish(dishId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "createVariant", summary = "Create variant")
    public VariantSummaryResponse create(@PathVariable UUID dishId, @Valid @RequestBody CreateVariantRequest req) {
        return variantService.create(dishId, req);
    }
}
