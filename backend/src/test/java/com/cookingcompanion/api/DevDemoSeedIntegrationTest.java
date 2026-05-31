package com.cookingcompanion.api;

import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.transaction.annotation.Transactional;

/**
 * Validates Flyway dev demo seed (V5) — login → library → variant → apply-profile smoke path.
 *
 * <p>QA reference IDs (also in {@code V5__dev_demo_seed.sql}):
 * <ul>
 *   <li>Demo user: {@code dddddddd-dddd-dddd-dddd-dddddddddddd} / dev@example.com / password
 *   <li>Demo household: {@code b1111111-1111-1111-1111-111111111111} (invite {@code DEMOKIT1})
 *   <li>Seeded dish: {@code b2222222-2222-2222-2222-222222222222} ("Creamy Pasta")
 *   <li>Canonical variant: {@code b3333333-3333-3333-3333-333333333333}
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DevDemoSeedIntegrationTest extends AbstractImportApiIntegrationTest {

    private static final String DEMO_EMAIL = "dev@example.com";
    private static final String DEMO_PASSWORD = "password";
    private static final String DEMO_HOUSEHOLD_ID = "b1111111-1111-1111-1111-111111111111";
    private static final String SEEDED_DISH_ID = "b2222222-2222-2222-2222-222222222222";
    private static final String SEEDED_VARIANT_ID = "b3333333-3333-3333-3333-333333333333";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void loginListsSeededDishAndApplyProfilePreview() throws Exception {
        MvcResult loginResult = mockMvc.perform(
                        post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        Map.of("email", DEMO_EMAIL, "password", DEMO_PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode login = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String access = login.get("accessToken").asText();

        mockMvc.perform(get("/api/v1/dishes").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(empty()));

        mockMvc.perform(get("/api/v1/households").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(DEMO_HOUSEHOLD_ID)))
                .andExpect(jsonPath("$[*].name", hasItem("Demo Kitchen")))
                .andExpect(jsonPath("$[*].inviteCode", hasItem("DEMOKIT1")));

        mockMvc.perform(
                        get("/api/v1/dishes")
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(SEEDED_DISH_ID)))
                .andExpect(jsonPath("$[*].name", hasItem("Creamy Pasta")));

        mockMvc.perform(
                        get("/api/v1/variants/" + SEEDED_VARIANT_ID)
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(SEEDED_VARIANT_ID))
                .andExpect(jsonPath("$.ingredients.length()").value(3));

        mockMvc.perform(
                        post("/api/v1/variants/" + SEEDED_VARIANT_ID + "/apply-profile")
                                .header("Authorization", "Bearer " + access)
                                .header("X-Household-Id", DEMO_HOUSEHOLD_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("dairyMode", "omit"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").isNotEmpty())
                .andExpect(jsonPath("$.adjustedIngredients").isArray());
    }
}
