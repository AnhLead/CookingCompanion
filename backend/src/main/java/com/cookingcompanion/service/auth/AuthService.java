package com.cookingcompanion.service.auth;

import com.cookingcompanion.api.dto.AuthMeResponse;
import com.cookingcompanion.api.dto.AuthTokenResponse;
import com.cookingcompanion.config.AppJwtProperties;
import com.cookingcompanion.domain.AppUser;
import com.cookingcompanion.repo.AppUserRepository;
import com.cookingcompanion.web.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final JwtTokenService jwtTokenService;
    private final RefreshTokenService refreshTokenService;
    private final PasswordEncoder passwordEncoder;
    private final AppJwtProperties jwtProperties;

    public AuthService(
            AppUserRepository appUserRepository,
            JwtTokenService jwtTokenService,
            RefreshTokenService refreshTokenService,
            PasswordEncoder passwordEncoder,
            AppJwtProperties jwtProperties) {
        this.appUserRepository = appUserRepository;
        this.jwtTokenService = jwtTokenService;
        this.refreshTokenService = refreshTokenService;
        this.passwordEncoder = passwordEncoder;
        this.jwtProperties = jwtProperties;
    }

    @Transactional(readOnly = true)
    public AuthTokenResponse login(String email, String password) {
        requireSigningConfigured();
        AppUser user = appUserRepository
                .findByEmailIgnoreCase(email == null ? "" : email.trim())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        if (!passwordEncoder.matches(password == null ? "" : password, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return issueTokens(user.getId());
    }

    @Transactional
    public AuthTokenResponse refresh(String rawRefreshToken) {
        requireSigningConfigured();
        UUID userId = refreshTokenService.rotate(rawRefreshToken);
        return issueTokens(userId);
    }

    @Transactional(readOnly = true)
    public AuthMeResponse me(UUID userId) {
        AppUser user = appUserRepository
                .findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required"));
        return new AuthMeResponse(user.getId(), user.getEmail());
    }

    private AuthTokenResponse issueTokens(UUID userId) {
        RefreshTokenService.IssuedRefreshToken refresh = refreshTokenService.issue(userId);
        return new AuthTokenResponse(
                jwtTokenService.issueAccessToken(userId),
                refresh.rawToken(),
                jwtTokenService.accessTokenExpiresInSeconds(),
                "Bearer");
    }

    private void requireSigningConfigured() {
        if (!jwtProperties.isSigningConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Auth signing is not configured");
        }
    }
}
