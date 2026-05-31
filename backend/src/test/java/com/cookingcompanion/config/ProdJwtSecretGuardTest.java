package com.cookingcompanion.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ProdJwtSecretGuardTest {

    @Test
    void rejectsMissingOrBlankSecret() {
        assertThatThrownBy(() -> ProdJwtSecretGuard.validateProdSecret(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
        assertThatThrownBy(() -> ProdJwtSecretGuard.validateProdSecret("   "))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    @Test
    void rejectsDevDefaultSecret() {
        assertThatThrownBy(() -> ProdJwtSecretGuard.validateProdSecret(ProdJwtSecretGuard.DEFAULT_DEV_SECRET))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("dev default");
    }

    @Test
    void rejectsShortSecret() {
        assertThatThrownBy(() -> ProdJwtSecretGuard.validateProdSecret("too-short"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 characters");
    }

    @Test
    void acceptsStrongSecret() {
        assertThatCode(() -> ProdJwtSecretGuard.validateProdSecret("prod-operator-secret-at-least-32-chars!!"))
                .doesNotThrowAnyException();
    }
}
