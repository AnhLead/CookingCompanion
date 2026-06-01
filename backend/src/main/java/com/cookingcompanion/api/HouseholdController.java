package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.HouseholdCreateRequest;
import com.cookingcompanion.api.dto.HouseholdJoinRequest;
import com.cookingcompanion.api.dto.HouseholdSummaryResponse;
import com.cookingcompanion.security.CurrentRecipeRequestContext;
import com.cookingcompanion.service.HouseholdService;
import com.cookingcompanion.web.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ProblemDetail;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/households")
@Tag(name = "Households")
public class HouseholdController {

    private final HouseholdService householdService;
    private final CurrentRecipeRequestContext requestContext;

    public HouseholdController(HouseholdService householdService, CurrentRecipeRequestContext requestContext) {
        this.householdService = householdService;
        this.requestContext = requestContext;
    }

    @GetMapping
    @Operation(operationId = "listHouseholds", summary = "List households the authenticated user belongs to")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "OK",
                content =
                        @Content(
                                mediaType = "application/json",
                                array =
                                        @ArraySchema(
                                                schema = @Schema(implementation = HouseholdSummaryResponse.class)))),
        @ApiResponse(
                responseCode = "401",
                description =
                        "Missing or invalid authenticated principal (`Authorization` bearer or dev `X-User-Id`)",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public List<HouseholdSummaryResponse> list() {
        UUID userId = requestContext
                .userId()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
        return householdService.listForUser(userId);
    }

    @PostMapping
    @Operation(operationId = "createHousehold", summary = "Create a household (creator becomes owner with invite code)")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "OK — includes inviteCode for the new owner",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = HouseholdSummaryResponse.class))),
        @ApiResponse(
                responseCode = "401",
                description =
                        "Missing or invalid authenticated principal (`Authorization` bearer or dev `X-User-Id`)",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public HouseholdSummaryResponse create(@Valid @RequestBody HouseholdCreateRequest body) {
        UUID userId = requestContext
                .userId()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
        return householdService.create(userId, body.name());
    }

    @PostMapping("/join")
    @Operation(operationId = "joinHousehold", summary = "Join a household with an invite code")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "OK",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = HouseholdSummaryResponse.class))),
        @ApiResponse(
                responseCode = "401",
                description =
                        "Missing or invalid authenticated principal (`Authorization` bearer or dev `X-User-Id`)",
                content =
                        @Content(
                                mediaType = "application/json",
                                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public HouseholdSummaryResponse join(@Valid @RequestBody HouseholdJoinRequest body) {
        UUID userId = requestContext
                .userId()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
        return householdService.join(userId, body.code());
    }
}
