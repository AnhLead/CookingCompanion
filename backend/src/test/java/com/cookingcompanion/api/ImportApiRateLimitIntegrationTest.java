package com.cookingcompanion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.annotation.DirtiesContext.ClassMode;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
        properties = {
            "resilience4j.ratelimiter.instances.importPreview.limitForPeriod=1",
            "resilience4j.ratelimiter.instances.importPreview.limitRefreshPeriod=1h",
            "resilience4j.ratelimiter.instances.importCommit.limitForPeriod=1",
            "resilience4j.ratelimiter.instances.importCommit.limitRefreshPeriod=1h",
        })
@DirtiesContext(classMode = ClassMode.AFTER_EACH_TEST_METHOD)
class ImportApiRateLimitIntegrationTest extends AbstractImportApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void previewSecondRequestReturns429ProblemDetails() throws Exception {
        String html = "<html><head><title>x</title></head><body><h1>T</h1></body></html>";
        String payload = objectMapper.writeValueAsString(Map.of("html", html));

        mockMvc.perform(post("/api/v1/import/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/import/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.detail").value("Too many requests; try again later."))
                .andDo(result -> {
                    String headerId = result.getResponse().getHeader("X-Correlation-ID");
                    JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
                    assertThat(body.get("correlationId").asText()).isEqualTo(headerId);
                });
    }

    @Test
    void commitSecondRequestReturns429ProblemDetails() throws Exception {
        String body =
                """
                {
                  "dishName": "Rate Limit Dish",
                  "variant": {
                    "title": "Rate Limit Variant",
                    "canonical": true,
                    "ingredients": [{"sortOrder": 0, "ingredientText": "pepper"}],
                    "steps": [{"sortOrder": 0, "text": "stir"}]
                  }
                }
                """;

        mockMvc.perform(post("/api/v1/import/commit")
                        .header("Idempotency-Key", "rl-first-" + System.nanoTime())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/import/commit")
                        .header("Idempotency-Key", "rl-second-" + System.nanoTime())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.detail").value("Too many requests; try again later."));
    }
}
