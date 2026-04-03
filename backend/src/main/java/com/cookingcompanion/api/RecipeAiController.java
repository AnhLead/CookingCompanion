package com.cookingcompanion.api;

import com.cookingcompanion.api.dto.RecipeAiFlagsResponse;
import com.cookingcompanion.config.RecipeAiProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recipe-ai")
@Tag(name = "Recipe AI")
public class RecipeAiController {

    private final RecipeAiProperties recipeAiProperties;

    public RecipeAiController(RecipeAiProperties recipeAiProperties) {
        this.recipeAiProperties = recipeAiProperties;
    }

    @GetMapping("/flags")
    @Operation(
            operationId = "getRecipeAiFlags",
            summary = "Recipe AI feature flags",
            description =
                    "Clients gate optional generative adjustment UX before calling apply-profile with `useGenerative: true`. "
                            + "When deployed, always returns 200 with generativeAdjustmentsEnabled true or false. "
                            + "Mobile clients treat 404/501 on this path as generative unavailable (same as disabled).")
    public RecipeAiFlagsResponse flags() {
        return new RecipeAiFlagsResponse(recipeAiProperties.isGenerativeAdjustmentsEnabled());
    }
}
