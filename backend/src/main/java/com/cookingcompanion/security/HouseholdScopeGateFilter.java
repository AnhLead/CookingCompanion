package com.cookingcompanion.security;

import com.cookingcompanion.repo.HouseholdMemberRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class HouseholdScopeGateFilter extends OncePerRequestFilter {

    private final HouseholdMemberRepository householdMemberRepository;

    public HouseholdScopeGateFilter(HouseholdMemberRepository householdMemberRepository) {
        this.householdMemberRepository = householdMemberRepository;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null || !uri.startsWith("/api/v1/")) {
            return true;
        }
        if (uri.startsWith("/api/v1/households")) {
            return true;
        }
        return !(uri.startsWith("/api/v1/dishes")
                || uri.startsWith("/api/v1/variants")
                || uri.startsWith("/api/v1/import"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        request.removeAttribute(RequestAuthAttributes.HOUSEHOLD_SCOPE_ID);
        String raw = request.getHeader("X-Household-Id");
        if (raw == null || raw.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }
        final UUID householdId;
        try {
            householdId = UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid X-Household-Id");
            return;
        }
        UUID userId = (UUID) request.getAttribute(RequestAuthAttributes.USER_ID);
        if (userId == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Authentication required for household scope");
            return;
        }
        if (!householdMemberRepository.existsByIdHouseholdIdAndIdUserId(householdId, userId)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Not a member of this household");
            return;
        }
        request.setAttribute(RequestAuthAttributes.HOUSEHOLD_SCOPE_ID, householdId);
        filterChain.doFilter(request, response);
    }
}
