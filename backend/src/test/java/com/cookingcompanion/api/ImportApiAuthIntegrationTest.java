package com.cookingcompanion.api;

import static org.assertj.core.api.Assertions.assertThat;
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
    /** Household the joiner fixture user is not a member of. */
    private static final String WRONG_HOUSEHOLD = "b1111111-1111-1111-1111-111111111111";

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
    void previewWithWrongHouseholdReturns403WithCorrelationId() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/import/preview")
                        .header("Authorization", bearerForUserUuid(JOINER))
                        .header("X-Household-Id", WRONG_HOUSEHOLD)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("html", "<html></html>"))))
                .andExpect(status().isForbidden())
                .andReturn();
        assertCorrelationIdPresent(result);
    }

    @Test
    void commitWithWrongHouseholdReturns403WithCorrelationId() throws Exception {
        MvcResult previewResult = mockMvc.perform(post("/api/v1/import/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("html", minimalRecipeHtml()))))
                .andExpect(status().isOk())
                .andReturn();

        String previewId = objectMapper
                .readTree(previewResult.getResponse().getContentAsString())
                .get("previewId")
                .asText();

        MvcResult result = mockMvc.perform(post("/api/v1/import/commit")
                        .header("Authorization", bearerForUserUuid(JOINER))
                        .header("X-Household-Id", WRONG_HOUSEHOLD)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"previewId\": \"" + previewId + "\"}"))
                .andExpect(status().isForbidden())
                .andReturn();
        assertCorrelationIdPresent(result);
    }

    @Test
    void authenticatedCommitWithoutHouseholdHeaderSucceeds() throws Exception {
        MvcResult previewResult = mockMvc.perform(post("/api/v1/import/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("html", minimalRecipeHtml()))))
                .andExpect(status().isOk())
                .andReturn();

        String previewId = objectMapper
                .readTree(previewResult.getResponse().getContentAsString())
                .get("previewId")
                .asText();

        mockMvc.perform(post("/api/v1/import/commit")
                        .header("Authorization", bearerForUserUuid(JOINER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"previewId\": \"" + previewId + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ownerUserId").value(JOINER));
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
        MvcResult previewResult = mockMvc.perform(post("/api/v1/import/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("html", minimalRecipeHtml("Scoped Soup")))))
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

    private static String minimalRecipeHtml() {
        return minimalRecipeHtml("Test Soup");
    }

    private static String minimalRecipeHtml(String name) {
        return """
                <html><head><script type="application/ld+json">
                {"@type":"Recipe","name":"%s","recipeIngredient":["1 qt stock"],"recipeInstructions":[{"@type":"HowToStep","text":"Heat."}]}
                </script></head></html>
                """
                .formatted(name);
    }

    private void assertCorrelationIdPresent(MvcResult result) throws Exception {
        String headerId = result.getResponse().getHeader("X-Correlation-ID");
        assertThat(headerId).isNotBlank();
        String body = result.getResponse().getContentAsString();
        if (body != null && body.startsWith("{")) {
            JsonNode json = objectMapper.readTree(body);
            if (json.has("correlationId")) {
                assertThat(json.get("correlationId").asText()).isEqualTo(headerId);
            }
        }
    }
}
