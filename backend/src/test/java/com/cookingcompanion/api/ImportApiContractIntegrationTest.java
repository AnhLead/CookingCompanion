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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ImportApiContractIntegrationTest extends AbstractImportApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void previewThenCommitHappyPath() throws Exception {
        String html =
                """
                <html><head><script type="application/ld+json">
                {"@type":"Recipe","name":"Contract Chili","recipeIngredient":["2 cups beans"],"recipeInstructions":[{"@type":"HowToStep","text":"Simmer."}]}
                </script></head></html>
                """;

        MvcResult previewResult = mockMvc.perform(
                        post("/api/v1/import/preview")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("html", html))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previewId").exists())
                .andExpect(jsonPath("$.suggestedDishName").value("Contract Chili"))
                .andReturn();

        JsonNode previewJson = objectMapper.readTree(previewResult.getResponse().getContentAsString());
        String previewId = previewJson.get("previewId").asText();

        mockMvc.perform(post("/api/v1/import/commit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"previewId\": \"" + previewId + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.dishId").exists())
                .andExpect(jsonPath("$.title").value("Contract Chili"));
    }

    @Test
    void commitWithIdempotencyKeyReturnsSameVariantOnReplay() throws Exception {
        String body =
                """
                {
                  "dishName": "Idem Dish",
                  "variant": {
                    "title": "Idem Variant",
                    "canonical": true,
                    "ingredients": [{"sortOrder": 0, "ingredientText": "salt"}],
                    "steps": [{"sortOrder": 0, "text": "mix"}]
                  }
                }
                """;

        String key = "contract-idem-" + System.nanoTime();

        MvcResult first = mockMvc.perform(post("/api/v1/import/commit")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.dishId").exists())
                .andReturn();

        String variantId =
                objectMapper.readTree(first.getResponse().getContentAsString()).get("id").asText();

        MvcResult second = mockMvc.perform(post("/api/v1/import/commit")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();

        String replayId =
                objectMapper.readTree(second.getResponse().getContentAsString()).get("id").asText();
        assertThat(replayId).isEqualTo(variantId);
    }
}
