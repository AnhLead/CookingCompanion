package com.cookingcompanion.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security")
public class AppSecurityProperties {

    /**
     * When true, {@code X-User-Id} may set the request principal (dev/test only; disable in production).
     */
    private boolean allowXUserId = true;

    /**
     * When true, parse JWT {@code sub} from Bearer tokens without signature verification (MVP bridge
     * until proper JWT validation ships).
     */
    private boolean parseJwtSubjectWithoutVerification = true;

    public boolean isAllowXUserId() {
        return allowXUserId;
    }

    public void setAllowXUserId(boolean allowXUserId) {
        this.allowXUserId = allowXUserId;
    }

    public boolean isParseJwtSubjectWithoutVerification() {
        return parseJwtSubjectWithoutVerification;
    }

    public void setParseJwtSubjectWithoutVerification(boolean parseJwtSubjectWithoutVerification) {
        this.parseJwtSubjectWithoutVerification = parseJwtSubjectWithoutVerification;
    }
}
