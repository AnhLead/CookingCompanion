package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.CreateDishRequest;
import com.cookingcompanion.api.dto.DishResponse;
import com.cookingcompanion.api.dto.PatchDishRequest;
import com.cookingcompanion.service.DishService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
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
    @Operation(
            operationId = "listDishes",
            summary = "List dishes",
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
                                array =
                                        @ArraySchema(schema = @Schema(implementation = DishResponse.class)))),
        @ApiResponse(
                responseCode = "401",
                description =
                        "`X-Household-Id` sent without a verified authenticated user (`Authorization` bearer or dev"
                                + " `X-User-Id`)",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "403",
                description =
                        "Authenticated caller is not a member of the household in `X-Household-Id`"
                                + " (`HouseholdScopeGateFilter`)",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
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
    @Operation(
            operationId = "getDish",
            summary = "Get dish by id",
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
                                schema = @Schema(implementation = DishResponse.class))),
        @ApiResponse(
                responseCode = "401",
                description =
                        "Missing authentication for a protected dish, or `X-Household-Id` sent without a verified"
                                + " authenticated user",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "403",
                description =
                        "Authenticated caller is not a member of the household in `X-Household-Id`"
                                + " (`HouseholdScopeGateFilter`), or household-owned dish accessed without matching"
                                + " `X-Household-Id`",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public DishResponse get(@PathVariable UUID dishId) {
        return dishService.get(dishId);
    }

    @PatchMapping("/{dishId}")
    @Operation(
            operationId = "patchDish",
            summary = "Update dish",
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
                                schema = @Schema(implementation = DishResponse.class))),
        @ApiResponse(
                responseCode = "401",
                description =
                        "Missing authentication for a protected dish, or `X-Household-Id` sent without a verified"
                                + " authenticated user",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "403",
                description =
                        "Authenticated caller is not a member of the household in `X-Household-Id`"
                                + " (`HouseholdScopeGateFilter`), or household-owned dish accessed without matching"
                                + " `X-Household-Id`",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public DishResponse patch(@PathVariable UUID dishId, @RequestBody PatchDishRequest req) {
        return dishService.patch(dishId, req);
    }

    @DeleteMapping("/{dishId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            operationId = "deleteDish",
            summary = "Delete dish (cascades variants)",
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
                        "Missing authentication for a protected dish, or `X-Household-Id` sent without a verified"
                                + " authenticated user",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "403",
                description =
                        "Authenticated caller is not a member of the household in `X-Household-Id`"
                                + " (`HouseholdScopeGateFilter`), or household-owned dish accessed without matching"
                                + " `X-Household-Id`",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public void delete(@PathVariable UUID dishId) {
        dishService.delete(dishId);
    }
}
