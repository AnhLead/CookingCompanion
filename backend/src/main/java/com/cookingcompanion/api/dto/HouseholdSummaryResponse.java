package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(name = "HouseholdSummary", description = "Household visible to the authenticated user")
public record HouseholdSummaryResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
        @Schema(description = "owner, member, …") String membershipRole,
        @Schema(
                        description =
                                "Invite code; present for household owners (e.g. after create), omitted or null for members",
                        nullable = true)
                String inviteCode) {}
