package com.cookingcompanion.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.Sql.ExecutionPhase;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
        properties = {
            "app.recipe-ai.generative-adjustments-enabled=true",
            "app.recipe-ai.openai-api-key="
        })
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/recipe-ai-it.sql", executionPhase = ExecutionPhase.BEFORE_TEST_METHOD)
@Sql(scripts = "/recipe-ai-it-teardown.sql", executionPhase = ExecutionPhase.AFTER_TEST_METHOD)
class RecipeAiGenerativeUnconfiguredIntegrationTest extends AbstractImportApiIntegrationTest {

    private static final String OWNER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    private static final String VARIANT = "f2222222-2222-2222-2222-222222222222";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void applyProfileWithUseGenerativeReturns503WhenOpenAiKeyMissing() throws Exception {
        mockMvc.perform(
                        post("/api/v1/variants/" + VARIANT + "/apply-profile")
                                .header("X-User-Id", OWNER)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        Map.of("useGenerative", true, "dairyMode", "none"))))
                .andExpect(status().isServiceUnavailable());
    }
}
