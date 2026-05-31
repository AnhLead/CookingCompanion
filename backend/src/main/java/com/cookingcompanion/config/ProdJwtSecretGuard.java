package com.cookingcompanion.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Fail-fast when {@code prod} profile is active but {@code app.jwt.secret} is unset, too short, or still
 * the dev default from {@code application.yml}.
 */
@Component
@Profile("prod")
public class ProdJwtSecretGuard implements InitializingBean {

    /** Default placeholder in {@code application.yml} — must not ship to production. */
    public static final String DEFAULT_DEV_SECRET = "dev-only-change-me-in-production-min-32-chars!!";

    private final AppJwtProperties jwtProperties;

    public ProdJwtSecretGuard(AppJwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
    }

    @Override
    public void afterPropertiesSet() {
        validateProdSecret(jwtProperties.getSecret());
    }

    public static void validateProdSecret(String secret) {
        if (!StringUtils.hasText(secret)) {
            throw new IllegalStateException(
                    "Production startup blocked: JWT_SECRET (app.jwt.secret) must be set. "
                            + "Generate a random secret of at least 32 characters and inject it via the environment.");
        }
        if (DEFAULT_DEV_SECRET.equals(secret)) {
            throw new IllegalStateException(
                    "Production startup blocked: JWT_SECRET must not equal the dev default from application.yml. "
                            + "Set a unique secret via the JWT_SECRET environment variable.");
        }
        if (secret.length() < 32) {
            throw new IllegalStateException(
                    "Production startup blocked: JWT_SECRET must be at least 32 characters for HMAC signing.");
        }
    }
}
