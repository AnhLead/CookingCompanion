package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.CreateDishRequest;
import com.cookingcompanion.api.dto.DishResponse;
import com.cookingcompanion.api.dto.PatchDishRequest;
import com.cookingcompanion.service.DishService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dishes")
@Tag(name = "Dishes")
public class DishController {

    private final DishService dishService;

    public DishController(DishService dishService) {
        this.dishService = dishService;
    }

    @GetMapping
    @Operation(operationId = "listDishes", summary = "List dishes")
    public List<DishResponse> list(@RequestParam(name = "q", required = false) String q) {
        return dishService.list(q);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "createDish", summary = "Create dish")
    public DishResponse create(@Valid @RequestBody CreateDishRequest req) {
        return dishService.create(req);
    }

    @GetMapping("/{dishId}")
    @Operation(operationId = "getDish", summary = "Get dish")
    public DishResponse get(@PathVariable UUID dishId) {
        return dishService.get(dishId);
    }

    @PatchMapping("/{dishId}")
    @Operation(operationId = "patchDish", summary = "Update dish")
    public DishResponse patch(@PathVariable UUID dishId, @RequestBody PatchDishRequest req) {
        return dishService.patch(dishId, req);
    }

    @DeleteMapping("/{dishId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteDish", summary = "Delete dish (cascades variants)")
    public void delete(@PathVariable UUID dishId) {
        dishService.delete(dishId);
    }
}
