package com.cookingcompanion.config;

import com.cookingcompanion.api.AbstractImportApiIntegrationTest;
import org.junit.jupiter.api.Test;
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
        // Negative path (dev default secret) covered by ProdJwtSecretGuardTest — Spring Boot env
        // precedence on CI runners makes a second embedded context unreliable.
    }
}
