package com.cookingcompanion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
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
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@Sql(scripts = "/household-it.sql", executionPhase = ExecutionPhase.BEFORE_TEST_METHOD)
@Sql(scripts = "/household-it-teardown.sql", executionPhase = ExecutionPhase.AFTER_TEST_METHOD)
class HouseholdApiIntegrationTest extends AbstractImportApiIntegrationTest {

    private static final String OWNER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    private static final String JOINER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    private static final String HOUSE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    private static final String CREATOR = "ffffffff-ffff-ffff-ffff-ffffffffffff";

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
                .andExpect(jsonPath("$[0].membershipRole").value("owner"))
                .andExpect(jsonPath("$[0].inviteCode").value("JOINIT01"));
    }

    @Test
    void listHouseholdsOmitsInviteCodeForMembers() throws Exception {
        mockMvc.perform(get("/api/v1/households").header("X-User-Id", JOINER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(HOUSE))
                .andExpect(jsonPath("$[0].membershipRole").value("member"))
                .andExpect(jsonPath("$[0].inviteCode").value(nullValue()));
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
                .andExpect(jsonPath("$.membershipRole").value("member"))
                .andExpect(jsonPath("$.inviteCode").value(nullValue()));
    }

    @Test
    void joinIsIdempotentWhenAlreadyMember() throws Exception {
        mockMvc.perform(
                        post("/api/v1/households/join")
                                .header("X-User-Id", JOINER)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(java.util.Map.of("code", "JOINIT01"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(HOUSE))
                .andExpect(jsonPath("$.membershipRole").value("member"));
        mockMvc.perform(
                        post("/api/v1/households/join")
                                .header("X-User-Id", JOINER)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(java.util.Map.of("code", "JOINIT01"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(HOUSE))
                .andExpect(jsonPath("$.membershipRole").value("member"));
    }

    @Test
    void createHouseholdRequiresAuth() throws Exception {
        mockMvc.perform(post("/api/v1/households")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("name", "Solo Home"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createHouseholdReturnsOwnerRoleAndInviteCode() throws Exception {
        mockMvc.perform(post("/api/v1/households")
                        .header("X-User-Id", CREATOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("name", "Chef Collective"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Chef Collective"))
                .andExpect(jsonPath("$.membershipRole").value("owner"))
                .andExpect(jsonPath("$.inviteCode", matchesPattern("[A-Z2-9]{12}")));
    }

    @Test
    void createHouseholdRejectsWhitespaceOnlyName() throws Exception {
        mockMvc.perform(post("/api/v1/households")
                        .header("X-User-Id", CREATOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("name", "  \t "))))
                .andExpect(status().isBadRequest());
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
