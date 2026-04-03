package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.HouseholdCreateRequest;
import com.cookingcompanion.api.dto.HouseholdJoinRequest;
import com.cookingcompanion.api.dto.HouseholdSummaryResponse;
import com.cookingcompanion.security.CurrentRecipeRequestContext;
import com.cookingcompanion.service.HouseholdService;
import com.cookingcompanion.web.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
    public List<HouseholdSummaryResponse> list() {
        UUID userId = requestContext
                .userId()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
        return householdService.listForUser(userId);
    }

    @PostMapping
    @Operation(operationId = "createHousehold", summary = "Create a household (creator becomes owner with invite code)")
    public HouseholdSummaryResponse create(@Valid @RequestBody HouseholdCreateRequest body) {
        UUID userId = requestContext
                .userId()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
        return householdService.create(userId, body.name());
    }

    @PostMapping("/join")
    @Operation(operationId = "joinHousehold", summary = "Join a household with an invite code")
    public HouseholdSummaryResponse join(@Valid @RequestBody HouseholdJoinRequest body) {
        UUID userId = requestContext
                .userId()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
        return householdService.join(userId, body.code());
    }
}
