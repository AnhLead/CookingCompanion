package com.cookingcompanion.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.jwt")
public class AppJwtProperties {

    /**
     * HMAC secret for access JWTs (min 32 bytes recommended). Required for signed auth flows.
     */
    private String secret = "";

    private Duration accessTokenTtl = Duration.ofMinutes(15);

    private Duration refreshTokenTtl = Duration.ofDays(7);

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public Duration getAccessTokenTtl() {
        return accessTokenTtl;
    }

    public void setAccessTokenTtl(Duration accessTokenTtl) {
        this.accessTokenTtl = accessTokenTtl;
    }

    public Duration getRefreshTokenTtl() {
        return refreshTokenTtl;
    }

    public void setRefreshTokenTtl(Duration refreshTokenTtl) {
        this.refreshTokenTtl = refreshTokenTtl;
    }

    public boolean isSigningConfigured() {
        return secret != null && secret.length() >= 32;
    }
}
