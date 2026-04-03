package com.cookingcompanion.security;

import com.cookingcompanion.config.AppSecurityProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class PrincipalResolutionFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final ObjectMapper objectMapper;
    private final AppSecurityProperties securityProperties;

    public PrincipalResolutionFilter(ObjectMapper objectMapper, AppSecurityProperties securityProperties) {
        this.objectMapper = objectMapper;
        this.securityProperties = securityProperties;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri == null || !uri.startsWith("/api/v1/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        request.removeAttribute(RequestAuthAttributes.USER_ID);
        UUID userId = null;
        String auth = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (auth != null && auth.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            String token = auth.substring(BEARER_PREFIX.length()).trim();
            if (securityProperties.isParseJwtSubjectWithoutVerification()) {
                userId = JwtSubjectParser.tryParseSubAsUuid(token, objectMapper);
            }
        }
        if (userId == null && securityProperties.isAllowXUserId()) {
            String raw = request.getHeader("X-User-Id");
            if (raw != null && !raw.isBlank()) {
                try {
                    userId = UUID.fromString(raw.trim());
                } catch (IllegalArgumentException ignored) {
                    // leave null
                }
            }
        }
        if (userId != null) {
            request.setAttribute(RequestAuthAttributes.USER_ID, userId);
        }
        filterChain.doFilter(request, response);
    }
}
