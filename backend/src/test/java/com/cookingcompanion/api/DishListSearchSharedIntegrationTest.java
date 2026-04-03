package com.cookingcompanion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.Sql.ExecutionPhase;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/dish-list-search-shared.sql", executionPhase = ExecutionPhase.BEFORE_TEST_METHOD)
@Sql(scripts = "/dish-list-search-shared-teardown.sql", executionPhase = ExecutionPhase.AFTER_TEST_METHOD)
class DishListSearchSharedIntegrationTest extends AbstractImportApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void unscopedListSearchMatchesTitleSubstring() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/dishes").param("q", "curry")).andExpect(status().isOk()).andReturn();
        JsonNode arr = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(arr).hasSize(1);
        assertThat(arr.get(0).get("name").asText()).isEqualTo("Alpha Curry Bowl");
    }

    @Test
    void unscopedListWithoutQueryReturnsAllShared() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/dishes")).andExpect(status().isOk()).andReturn();
        JsonNode arr = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(arr).hasSize(2);
        List<String> names = new ArrayList<>();
        arr.forEach(n -> names.add(n.get("name").asText()));
        assertThat(names).containsExactlyInAnyOrder("Alpha Curry Bowl", "Beta Salad");
    }
}
