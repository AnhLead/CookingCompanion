package com.cookingcompanion.security;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

@Component
@RequestScope
public class CurrentRecipeRequestContext {

    private final HttpServletRequest request;

    public CurrentRecipeRequestContext(HttpServletRequest request) {
        this.request = request;
    }

    public Optional<UUID> userId() {
        return Optional.ofNullable((UUID) request.getAttribute(RequestAuthAttributes.USER_ID));
    }

    /** Present only when {@code X-Household-Id} was sent and membership was validated. */
    public Optional<UUID> householdScopeId() {
        return Optional.ofNullable((UUID) request.getAttribute(RequestAuthAttributes.HOUSEHOLD_SCOPE_ID));
    }
}
