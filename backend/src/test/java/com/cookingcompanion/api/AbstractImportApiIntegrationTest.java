package com.cookingcompanion.api;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Single embedded PostgreSQL for import contract tests (Flyway migrations are Postgres-specific).
 */
public abstract class AbstractImportApiIntegrationTest {

    private static final EmbeddedPostgres EMBEDDED;

    static {
        try {
            EMBEDDED = EmbeddedPostgres.start();
        } catch (IOException e) {
            throw new ExceptionInInitializerError(e);
        }
        Runtime.getRuntime()
                .addShutdownHook(new Thread(() -> {
                    try {
                        EMBEDDED.close();
                    } catch (IOException ignored) {
                        // best-effort shutdown
                    }
                }));
    }

    protected static String embeddedPostgresJdbcUrl() {
        return EMBEDDED.getJdbcUrl("postgres", "postgres");
    }

    @DynamicPropertySource
    protected static void registerDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", AbstractImportApiIntegrationTest::embeddedPostgresJdbcUrl);
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
    }
}
