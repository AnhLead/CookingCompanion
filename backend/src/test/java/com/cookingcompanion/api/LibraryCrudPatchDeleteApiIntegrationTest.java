package com.cookingcompanion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
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
 * Contract lock for library CRUD: {@code GET|PATCH|DELETE /dishes/{id}} and
 * {@code GET|PATCH|DELETE /variants/{id}} — auth, household scope, ProblemDetail + correlationId.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@Sql(scripts = "/create-variant-it.sql", executionPhase = ExecutionPhase.BEFORE_TEST_METHOD)
class LibraryCrudPatchDeleteApiIntegrationTest extends AbstractImportApiIntegrationTest {

    private static final String DEMO_EMAIL = "dev@example.com";
    private static final String DEMO_PASSWORD = "password";
    private static final String DEMO_HOUSEHOLD_ID = "b1111111-1111-1111-1111-111111111111";
    private static final String PERSONAL_DISH_ID = "c2222222-2222-2222-2222-222222222222";
    private static final String SEEDED_DISH_ID = "b2222222-2222-2222-2222-222222222222";
    private static final String SEEDED_VARIANT_ID = "b3333333-3333-3333-3333-333333333333";
    private static final String WRONG_HOUSEHOLD_ID = "a1111111-1111-1111-1111-111111111111";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void patchDishRequiresAuth() throws Exception {
        mockMvc.perform(
                        patch("/api/v1/dishes/" + PERSONAL_DISH_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"Renamed\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Authentication required"));
    }

    @Test
    void patchDishWrongHouseholdReturns403() throws Exception {
        String access = loginAccessToken();

        MvcResult result = mockMvc.perform(
                        patch("/api/v1/dishes/" + SEEDED_DISH_ID)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", WRONG_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"Renamed\"}"))
                .andExpect(status().isForbidden())
                .andReturn();
        assertThat(result.getResponse().getHeader("X-Correlation-ID")).isNotBlank();
    }

    @Test
    void patchDishWithoutHouseholdScopeReturns403WithCorrelationId() throws Exception {
        String access = loginAccessToken();

        mockMvc.perform(
                        patch("/api/v1/dishes/" + SEEDED_DISH_ID)
                                .header("Authorization", "Bearer " + access)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"Renamed\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Household scope does not match this recipe library"))
                .andDo(this::assertCorrelationIdPresent);
    }

    @Test
    void patchDishUpdatesNameUnderHouseholdScope() throws Exception {
        String access = loginAccessToken();

        mockMvc.perform(
                        patch("/api/v1/dishes/" + SEEDED_DISH_ID)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"Creamy Pasta (updated)\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(SEEDED_DISH_ID))
                .andExpect(jsonPath("$.name").value("Creamy Pasta (updated)"));
    }

    @Test
    void patchDishNotFoundReturns404WithCorrelationId() throws Exception {
        String access = loginAccessToken();
        UUID missing = UUID.fromString("00000000-0000-0000-0000-000000000099");

        mockMvc.perform(
                        patch("/api/v1/dishes/" + missing)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"Ghost\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Dish not found"))
                .andDo(this::assertCorrelationIdPresent);
    }

    @Test
    void deleteDishRequiresAuth() throws Exception {
        mockMvc.perform(delete("/api/v1/dishes/" + PERSONAL_DISH_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Authentication required"));
    }

    @Test
    void deleteDishReturnsNoContentThenNotFound() throws Exception {
        String access = loginAccessToken();

        MvcResult created = mockMvc.perform(
                        post("/api/v1/dishes")
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("name", "Disposable dish", "tags", java.util.List.of()))))
                .andExpect(status().isCreated())
                .andReturn();
        String dishId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(
                        delete("/api/v1/dishes/" + dishId)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID))
                .andExpect(status().isNoContent());

        mockMvc.perform(
                        patch("/api/v1/dishes/" + dishId)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"Gone\"}"))
                .andExpect(status().isNotFound())
                .andDo(this::assertCorrelationIdPresent);
    }

    @Test
    void getVariantRequiresAuthForHouseholdScope() throws Exception {
        mockMvc.perform(
                        get("/api/v1/variants/" + SEEDED_VARIANT_ID)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getVariantWrongHouseholdReturns403() throws Exception {
        String access = loginAccessToken();

        MvcResult result = mockMvc.perform(
                        get("/api/v1/variants/" + SEEDED_VARIANT_ID)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", WRONG_HOUSEHOLD_ID))
                .andExpect(status().isForbidden())
                .andReturn();
        assertThat(result.getResponse().getHeader("X-Correlation-ID")).isNotBlank();
    }

    @Test
    void getVariantWithoutHouseholdScopeReturns403WithCorrelationId() throws Exception {
        String access = loginAccessToken();

        mockMvc.perform(
                        get("/api/v1/variants/" + SEEDED_VARIANT_ID)
                                .header("Authorization", "Bearer " + access))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Household scope does not match this recipe library"))
                .andDo(this::assertCorrelationIdPresent);
    }

    @Test
    void patchVariantWithoutHouseholdScopeReturns403WithCorrelationId() throws Exception {
        String access = loginAccessToken();

        mockMvc.perform(
                        patch("/api/v1/variants/" + SEEDED_VARIANT_ID)
                                .header("Authorization", "Bearer " + access)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"Updated title\"}"))
                .andExpect(status().isForbidden())
                .andDo(this::assertCorrelationIdPresent);
    }

    @Test
    void patchVariantUpdatesTitleUnderHouseholdScope() throws Exception {
        String access = loginAccessToken();

        mockMvc.perform(
                        patch("/api/v1/variants/" + SEEDED_VARIANT_ID)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"Classic creamy pasta (patched)\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(SEEDED_VARIANT_ID))
                .andExpect(jsonPath("$.title").value("Classic creamy pasta (patched)"))
                .andExpect(jsonPath("$.ingredients.length()").value(3));
    }

    @Test
    void patchVariantNotFoundReturns404WithCorrelationId() throws Exception {
        String access = loginAccessToken();
        UUID missing = UUID.fromString("00000000-0000-0000-0000-000000000098");

        mockMvc.perform(
                        patch("/api/v1/variants/" + missing)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"Ghost\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Variant not found"))
                .andDo(this::assertCorrelationIdPresent);
    }

    @Test
    void deleteVariantRequiresAuthForHouseholdScope() throws Exception {
        mockMvc.perform(delete("/api/v1/variants/" + SEEDED_VARIANT_ID)
                        .header("X-Household-Id", DEMO_HOUSEHOLD_ID))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteVariantRemovesVariant() throws Exception {
        String access = loginAccessToken();

        MvcResult created = mockMvc.perform(
                        post("/api/v1/dishes/" + SEEDED_DISH_ID + "/variants")
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        Map.of("title", "To delete", "canonical", false))))
                .andExpect(status().isCreated())
                .andReturn();
        String variantId =
                objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(
                        delete("/api/v1/variants/" + variantId)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID))
                .andExpect(status().isNoContent());

        mockMvc.perform(
                        patch("/api/v1/variants/" + variantId)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"Gone\"}"))
                .andExpect(status().isNotFound())
                .andDo(this::assertCorrelationIdPresent);
    }

    private String loginAccessToken() throws Exception {
        MvcResult loginResult = mockMvc.perform(
                        post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        Map.of("email", DEMO_EMAIL, "password", DEMO_PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode login = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        return login.get("accessToken").asText();
    }

    private void assertCorrelationIdPresent(MvcResult result) throws Exception {
        String headerId = result.getResponse().getHeader("X-Correlation-ID");
        assertThat(headerId).isNotBlank();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("correlationId").asText()).isEqualTo(headerId);
    }
}
