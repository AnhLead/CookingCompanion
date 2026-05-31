package com.cookingcompanion.service.auth;

import com.cookingcompanion.config.AppJwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {

    private final AppJwtProperties jwtProperties;

    public JwtTokenService(AppJwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
    }

    public String issueAccessToken(UUID userId) {
        if (!jwtProperties.isSigningConfigured()) {
            throw new IllegalStateException("JWT signing secret is not configured");
        }
        Instant now = Instant.now();
        Instant exp = now.plus(jwtProperties.getAccessTokenTtl());
        return Jwts.builder()
                .subject(userId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(signingKey())
                .compact();
    }

    public int accessTokenExpiresInSeconds() {
        return (int) jwtProperties.getAccessTokenTtl().toSeconds();
    }

    /**
     * Validates signature and expiry; returns {@code sub} as UUID when valid.
     */
    public Optional<UUID> parseVerifiedAccessToken(String bearerToken) {
        if (!jwtProperties.isSigningConfigured() || bearerToken == null || bearerToken.isBlank()) {
            return Optional.empty();
        }
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey())
                    .build()
                    .parseSignedClaims(bearerToken.trim())
                    .getPayload();
            if (claims.getSubject() == null) {
                return Optional.empty();
            }
            return Optional.of(UUID.fromString(claims.getSubject()));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public boolean isExpiredAccessToken(String bearerToken) {
        if (!jwtProperties.isSigningConfigured() || bearerToken == null || bearerToken.isBlank()) {
            return false;
        }
        try {
            Jwts.parser()
                    .verifyWith(signingKey())
                    .build()
                    .parseSignedClaims(bearerToken.trim());
            return false;
        } catch (ExpiredJwtException e) {
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private SecretKey signingKey() {
        return Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
    }
}
