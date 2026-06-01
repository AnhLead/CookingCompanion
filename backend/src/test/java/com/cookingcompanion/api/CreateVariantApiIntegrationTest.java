package com.cookingcompanion.api;

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
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.Sql.ExecutionPhase;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * Contract lock for {@code POST /api/v1/dishes/{dishId}/variants} — auth, validation, and summary response.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@Sql(scripts = "/create-variant-it.sql", executionPhase = ExecutionPhase.BEFORE_TEST_METHOD)
class CreateVariantApiIntegrationTest extends AbstractImportApiIntegrationTest {

    private static final String DEMO_EMAIL = "dev@example.com";
    private static final String DEMO_PASSWORD = "password";
    private static final String DEMO_USER_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    private static final String DEMO_HOUSEHOLD_ID = "b1111111-1111-1111-1111-111111111111";
    private static final String PERSONAL_DISH_ID = "c2222222-2222-2222-2222-222222222222";
    private static final String SEEDED_DISH_ID = "b2222222-2222-2222-2222-222222222222";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createVariantRequiresAuthForHouseholdScope() throws Exception {
        mockMvc.perform(
                        post("/api/v1/dishes/" + SEEDED_DISH_ID + "/variants")
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        Map.of("title", "New variant", "canonical", false))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createVariantRequiresAuth() throws Exception {
        mockMvc.perform(
                        post("/api/v1/dishes/" + PERSONAL_DISH_ID + "/variants")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        Map.of("title", "New variant", "canonical", false))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Authentication required"));
    }

    @Test
    void createVariantReturnsSummaryUnderSeededDish() throws Exception {
        String access = loginAccessToken();

        mockMvc.perform(
                        post("/api/v1/dishes/" + SEEDED_DISH_ID + "/variants")
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of(
                                        "title", "Weeknight twist",
                                        "yields", "2 servings",
                                        "prepTimeMin", 5,
                                        "cookTimeMin", 15,
                                        "canonical", false))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.dishId").value(SEEDED_DISH_ID))
                .andExpect(jsonPath("$.title").value("Weeknight twist"))
                .andExpect(jsonPath("$.yields").value("2 servings"))
                .andExpect(jsonPath("$.prepTimeMin").value(5))
                .andExpect(jsonPath("$.cookTimeMin").value(15))
                .andExpect(jsonPath("$.canonical").value(false))
                .andExpect(jsonPath("$.ownerUserId").value(DEMO_USER_ID))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
    }

    @Test
    void createVariantRejectsBlankTitle() throws Exception {
        String access = loginAccessToken();

        mockMvc.perform(
                        post("/api/v1/dishes/" + SEEDED_DISH_ID + "/variants")
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"   \",\"canonical\":false}"))
                .andExpect(status().isBadRequest());
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
}
