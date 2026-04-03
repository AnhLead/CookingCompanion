package com.cookingcompanion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cookingcompanion.api.dto.IngredientLineDto;
import com.cookingcompanion.api.dto.RecipeStepDto;
import com.cookingcompanion.service.ai.GenerativeRecipeAdjustmentClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.Sql.ExecutionPhase;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {"app.recipe-ai.generative-adjustments-enabled=true"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/recipe-ai-it.sql", executionPhase = ExecutionPhase.BEFORE_TEST_METHOD)
@Sql(scripts = "/recipe-ai-it-teardown.sql", executionPhase = ExecutionPhase.AFTER_TEST_METHOD)
class RecipeAiGenerativeApplyIntegrationTest extends AbstractImportApiIntegrationTest {

    private static final String OWNER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    private static final String VARIANT = "f2222222-2222-2222-2222-222222222222";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private GenerativeRecipeAdjustmentClient generativeRecipeAdjustmentClient;

    @Test
    void flagsReflectEnabledProperty() throws Exception {
        mockMvc.perform(get("/api/v1/recipe-ai/flags"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generativeAdjustmentsEnabled").value(true));
    }

    @Test
    void applyProfilePersistsAdjustmentAndReturnsPreview() throws Exception {
        UUID variantUuid = UUID.fromString(VARIANT);
        when(generativeRecipeAdjustmentClient.adjust(
                        eq(variantUuid),
                        any(),
                        any(),
                        any(),
                        any()))
                .thenReturn(
                        new GenerativeRecipeAdjustmentClient.GenerativeResult(
                                "Swapped milk for oat milk per profile.",
                                List.of(new IngredientLineDto(
                                        "f3333333-3333-3333-3333-333333333333",
                                        1,
                                        new BigDecimal("2"),
                                        "cup",
                                        "oat milk",
                                        null,
                                        List.of())),
                                List.of(new RecipeStepDto(
                                        "f4444444-4444-4444-4444-444444444444",
                                        1,
                                        "Warm the oat milk gently.",
                                        null,
                                        null))));

        MvcResult res = mockMvc.perform(
                        post("/api/v1/variants/" + VARIANT + "/apply-profile")
                                .header("X-User-Id", OWNER)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        Map.of("useGenerative", true, "dairyMode", "substitute_oat"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value("Swapped milk for oat milk per profile."))
                .andExpect(jsonPath("$.adjustedIngredients[0].ingredientText").value("oat milk"))
                .andReturn();

        JsonNode body = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(body.path("adjustmentId").asText()).isNotBlank();

        verify(generativeRecipeAdjustmentClient).adjust(eq(variantUuid), any(), any(), any(), any());
    }
}
