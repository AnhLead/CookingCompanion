package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.CreateVariantRequest;
import com.cookingcompanion.api.dto.VariantSummaryResponse;
import com.cookingcompanion.service.VariantService;
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
    @Operation(
            operationId = "listVariants",
            summary = "List variants for dish",
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
                        schema = @Schema(type = "string", format = "uuid")),
                @Parameter(
                        name = "dishId",
                        in = ParameterIn.PATH,
                        required = true,
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
                                        @ArraySchema(
                                                schema = @Schema(implementation = VariantSummaryResponse.class)))),
        @ApiResponse(
                responseCode = "401",
                description =
                        "`X-Household-Id` sent without a verified authenticated user (`Authorization` bearer or dev"
                                + " `X-User-Id`), or missing authentication for a protected dish",
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
    public List<VariantSummaryResponse> list(@PathVariable UUID dishId) {
        return variantService.listByDish(dishId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            operationId = "createVariant",
            summary = "Create variant",
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
                        schema = @Schema(type = "string", format = "uuid")),
                @Parameter(
                        name = "dishId",
                        in = ParameterIn.PATH,
                        required = true,
                        schema = @Schema(type = "string", format = "uuid"))
            })
    @ApiResponses({
        @ApiResponse(
                responseCode = "201",
                description = "Created",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = VariantSummaryResponse.class))),
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
    public VariantSummaryResponse create(@PathVariable UUID dishId, @Valid @RequestBody CreateVariantRequest req) {
        return variantService.create(dishId, req);
    }
}
