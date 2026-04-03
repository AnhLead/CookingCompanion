package com.cookingcompanion.service.importing;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HtmlRecipeParserTest {

    private final HtmlRecipeParser parser = new HtmlRecipeParser();

    @Test
    void parsesSchemaOrgRecipeJsonLd() {
        String html =
                """
                <html><head><script type="application/ld+json">
                {"@type":"Recipe","name":"Test Chili","recipeIngredient":["2 cups beans","1 onion"],"recipeInstructions":[{"@type":"HowToStep","text":"Simmer."}]}
                </script></head></html>
                """;
        ParsedRecipe r = parser.parse(html, null);
        assertThat(r.title()).isEqualTo("Test Chili");
        assertThat(r.ingredientLines()).containsExactly("2 cups beans", "1 onion");
        assertThat(r.stepTexts()).containsExactly("Simmer.");
        assertThat(r.confidence()).isGreaterThan(0.5);
    }

    @Test
    void heuristicFallbackFindsLists() {
        String html =
                """
                <html><head><title>Page</title></head><body>
                <h1>Great Soup</h1>
                <ul class="ingredients"><li>water</li><li>salt</li></ul>
                <ol class="instructions"><li>Boil.</li></ol>
                </body></html>
                """;
        ParsedRecipe r = parser.parse(html, "https://example.com/r");
        assertThat(r.suggestedDishName()).contains("Great Soup");
        assertThat(r.ingredientLines()).contains("water", "salt");
        assertThat(r.stepTexts()).contains("Boil.");
    }
}
