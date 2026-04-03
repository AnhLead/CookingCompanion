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

    @DynamicPropertySource
    protected static void registerDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> EMBEDDED.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
    }
}
