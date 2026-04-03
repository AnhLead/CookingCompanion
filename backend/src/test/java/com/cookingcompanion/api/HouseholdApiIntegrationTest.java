package com.cookingcompanion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/household-it.sql", executionPhase = ExecutionPhase.BEFORE_TEST_METHOD)
@Sql(scripts = "/household-it-teardown.sql", executionPhase = ExecutionPhase.AFTER_TEST_METHOD)
class HouseholdApiIntegrationTest extends AbstractImportApiIntegrationTest {

    private static final String OWNER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    private static final String JOINER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    private static final String HOUSE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void listHouseholdsRequiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/households")).andExpect(status().isUnauthorized());
    }

    @Test
    void listHouseholdsReturnsMemberships() throws Exception {
        mockMvc.perform(get("/api/v1/households").header("X-User-Id", OWNER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(HOUSE))
                .andExpect(jsonPath("$[0].name").value("Integration Home"))
                .andExpect(jsonPath("$[0].membershipRole").value("owner"));
    }

    @Test
    void joinWithInviteCode() throws Exception {
        String stranger = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
        mockMvc.perform(
                        post("/api/v1/households/join")
                                .header("X-User-Id", stranger)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(java.util.Map.of("code", "JOINIT01"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(HOUSE))
                .andExpect(jsonPath("$.membershipRole").value("member"));
    }

    @Test
    void householdScopedDishesRequireMembership() throws Exception {
        String stranger = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
        mockMvc.perform(
                        get("/api/v1/dishes")
                                .header("X-User-Id", stranger)
                                .header("X-Household-Id", HOUSE))
                .andExpect(status().isForbidden());
    }

    @Test
    void memberSeesHouseholdDishes() throws Exception {
        MvcResult res = mockMvc.perform(
                        get("/api/v1/dishes")
                                .header("X-User-Id", JOINER)
                                .header("X-Household-Id", HOUSE))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(arr).hasSize(2);
        List<String> names = new ArrayList<>();
        arr.forEach(n -> names.add(n.get("name").asText()));
        assertThat(names).containsExactlyInAnyOrder("Household scoped dish", "Another household plate");
    }

    @Test
    void listDishesSearchFiltersByTitleCaseInsensitive() throws Exception {
        MvcResult res = mockMvc.perform(
                        get("/api/v1/dishes")
                                .param("q", "SCOPED")
                                .header("X-User-Id", JOINER)
                                .header("X-Household-Id", HOUSE))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(arr).hasSize(1);
        assertThat(arr.get(0).get("name").asText()).isEqualTo("Household scoped dish");
    }

    @Test
    void listDishesBlankSearchParamReturnsFullList() throws Exception {
        MvcResult res = mockMvc.perform(
                        get("/api/v1/dishes")
                                .param("q", "  \t ")
                                .header("X-User-Id", JOINER)
                                .header("X-Household-Id", HOUSE))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(arr).hasSize(2);
    }
}
