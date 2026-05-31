package com.cookingcompanion.service.auth;

import com.cookingcompanion.config.AppJwtProperties;
import com.cookingcompanion.domain.RefreshToken;
import com.cookingcompanion.repo.RefreshTokenRepository;
import com.cookingcompanion.web.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RefreshTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;
    private final AppJwtProperties jwtProperties;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository, AppJwtProperties jwtProperties) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtProperties = jwtProperties;
    }

    public record IssuedRefreshToken(String rawToken, UUID familyId) {}

    @Transactional
    public IssuedRefreshToken issue(UUID userId) {
        UUID familyId = UUID.randomUUID();
        return persist(userId, familyId);
    }

    @Transactional
    public UUID rotate(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }
        String hash = hashToken(rawRefreshToken.trim());
        Instant now = Instant.now();
        RefreshToken stored =
                refreshTokenRepository.findByTokenHash(hash).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid refresh token"));

        if (stored.getRevokedAt() != null) {
            refreshTokenRepository.revokeActiveInFamily(stored.getFamilyId(), now);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Refresh token reuse detected");
        }
        if (stored.getExpiresAt().isBefore(now)) {
            stored.setRevokedAt(now);
            refreshTokenRepository.save(stored);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }

        stored.setRevokedAt(now);
        refreshTokenRepository.save(stored);
        persist(stored.getUserId(), stored.getFamilyId());
        return stored.getUserId();
    }

    private IssuedRefreshToken persist(UUID userId, UUID familyId) {
        String raw = generateRawToken();
        RefreshToken row = new RefreshToken();
        row.setUserId(userId);
        row.setTokenHash(hashToken(raw));
        row.setFamilyId(familyId);
        row.setExpiresAt(Instant.now().plus(jwtProperties.getRefreshTokenTtl()));
        refreshTokenRepository.save(row);
        return new IssuedRefreshToken(raw, familyId);
    }

    public static String hashToken(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String generateRawToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
