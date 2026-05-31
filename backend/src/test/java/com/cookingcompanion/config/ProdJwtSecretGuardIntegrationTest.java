package com.cookingcompanion.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cookingcompanion.CookingCompanionApplication;
import com.cookingcompanion.api.AbstractImportApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@ActiveProfiles({"test", "prod"})
@TestPropertySource(
        properties = {
            "app.jwt.secret=integration-prod-guard-secret-32chars-min",
            "spring.main.web-application-type=none"
        })
class ProdJwtSecretGuardIntegrationTest extends AbstractImportApiIntegrationTest {

    @Test
    void prodContextStartsWithNonDefaultSecret() {
        // Context load is the assertion; web layer disabled for speed.
    }

    @Test
    void prodStartupFailsWhenJwtSecretIsDevDefault() {
        // Prod only — do not activate the "test" profile (its application-test.yml overrides app.jwt.secret).
        assertThatThrownBy(() -> new SpringApplicationBuilder(CookingCompanionApplication.class)
                        .profiles("prod")
                        .properties(
                                "spring.datasource.url=" + embeddedPostgresJdbcUrl(),
                                "spring.datasource.username=postgres",
                                "spring.datasource.password=postgres")
                        .run(
                                "--spring.main.web-application-type=none",
                                "--app.jwt.secret=" + ProdJwtSecretGuard.DEFAULT_DEV_SECRET))
                .rootCause()
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("dev default");
    }
}
