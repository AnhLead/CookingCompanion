package com.cookingcompanion.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * Import API + optional {@code Authorization: Bearer} and {@code X-Household-Id} (see
 * {@code HouseholdScopeGateFilter}, {@code RecipeImportService}).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@Sql(scripts = "/household-it.sql", executionPhase = ExecutionPhase.BEFORE_TEST_METHOD)
@Sql(scripts = "/household-it-teardown.sql", executionPhase = ExecutionPhase.AFTER_TEST_METHOD)
class ImportApiAuthIntegrationTest extends AbstractImportApiIntegrationTest {

    private static final String JOINER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    private static final String HOUSE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /** Unverified JWT payload only — matches {@code JwtSubjectParser} test expectations. */
    private static String bearerForUserUuid(String uuid) {
        String payload = "{\"sub\":\"" + uuid + "\"}";
        String b64 = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return "Bearer eyJhbGciOiJub25lIn0." + b64 + ".e30";
    }

    @Test
    void previewWithHouseholdHeaderButNoPrincipalReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/import/preview")
                        .header("X-Household-Id", HOUSE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("html", "<html></html>"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void commitWithBearerAndHouseholdIdCreatesHouseholdScopedDish() throws Exception {
        String html =
                """
                <html><head><script type="application/ld+json">
                {"@type":"Recipe","name":"Scoped Soup","recipeIngredient":["1 qt stock"],"recipeInstructions":[{"@type":"HowToStep","text":"Heat."}]}
                </script></head></html>
                """;

        MvcResult previewResult = mockMvc.perform(post("/api/v1/import/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("html", html))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previewId").exists())
                .andReturn();

        JsonNode previewJson = objectMapper.readTree(previewResult.getResponse().getContentAsString());
        String previewId = previewJson.get("previewId").asText();

        MvcResult commitResult = mockMvc.perform(post("/api/v1/import/commit")
                        .header("Authorization", bearerForUserUuid(JOINER))
                        .header("X-Household-Id", HOUSE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"previewId\": \"" + previewId + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.dishId").exists())
                .andExpect(jsonPath("$.ownerUserId").value(JOINER))
                .andReturn();

        JsonNode body = objectMapper.readTree(commitResult.getResponse().getContentAsString());
        String dishId = body.get("dishId").asText();

        mockMvc.perform(get("/api/v1/dishes/" + dishId)
                        .header("X-User-Id", JOINER)
                        .header("X-Household-Id", HOUSE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Scoped Soup"));
    }
}
