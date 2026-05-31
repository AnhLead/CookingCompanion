package com.cookingcompanion.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cookingcompanion.domain.ImportPreview;
import com.cookingcompanion.repo.ImportPreviewRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
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
class ImportApiErrorPathIntegrationTest extends AbstractImportApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ImportPreviewRepository importPreviewRepository;

    @Test
    void duplicateSourceUrlCommitReturns409WithExistingSourceId() throws Exception {
        String sourceUrl = "https://example.com/recipes/dup-" + System.nanoTime();
        String body =
                """
                {
                  "dishName": "First Import",
                  "sourceUrl": "%s",
                  "variant": {
                    "title": "First Variant",
                    "canonical": true,
                    "ingredients": [{"sortOrder": 0, "ingredientText": "salt"}],
                    "steps": [{"sortOrder": 0, "text": "mix"}]
                  }
                }
                """
                        .formatted(sourceUrl);

        mockMvc.perform(post("/api/v1/import/commit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists());

        mockMvc.perform(post("/api/v1/import/commit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Source URL already imported (anonymous owner)"))
                .andExpect(jsonPath("$.existingSourceId").exists())
                .andExpect(jsonPath("$.existingSourceId").isString());
    }

    @Test
    void secondCommitSamePreviewIdReturns409Consumed() throws Exception {
        String html =
                """
                <html><head><script type="application/ld+json">
                {"@type":"Recipe","name":"Consumed Chili","recipeIngredient":["2 cups beans"],"recipeInstructions":[{"@type":"HowToStep","text":"Simmer."}]}
                </script></head></html>
                """;

        MvcResult previewResult = mockMvc.perform(
                        post("/api/v1/import/preview")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("html", html))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previewId").exists())
                .andReturn();

        JsonNode previewJson = objectMapper.readTree(previewResult.getResponse().getContentAsString());
        String previewId = previewJson.get("previewId").asText();
        String commitBody = "{\"previewId\": \"" + previewId + "\"}";

        mockMvc.perform(post("/api/v1/import/commit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commitBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists());

        mockMvc.perform(post("/api/v1/import/commit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commitBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("preview already committed"));
    }

    @Test
    void commitExpiredPreviewReturns410() throws Exception {
        String html =
                """
                <html><head><script type="application/ld+json">
                {"@type":"Recipe","name":"Expired Stew","recipeIngredient":["1 lb beef"],"recipeInstructions":[{"@type":"HowToStep","text":"Brown."}]}
                </script></head></html>
                """;

        MvcResult previewResult = mockMvc.perform(
                        post("/api/v1/import/preview")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("html", html))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previewId").exists())
                .andReturn();

        JsonNode previewJson = objectMapper.readTree(previewResult.getResponse().getContentAsString());
        String previewId = previewJson.get("previewId").asText();

        ImportPreview row = importPreviewRepository.findById(java.util.UUID.fromString(previewId)).orElseThrow();
        row.setExpiresAt(Instant.now().minusSeconds(60));
        importPreviewRepository.save(row);

        mockMvc.perform(post("/api/v1/import/commit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"previewId\": \"" + previewId + "\"}"))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.detail").value("preview expired"));
    }
}
