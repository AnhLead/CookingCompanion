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
        assertThat(r.parseMethod()).isEqualTo("json_ld");
    }

    @Test
    void jsonLdExtractsImageYieldAndDurations() {
        String html =
                """
                <html><head><script type="application/ld+json">
                {"@type":"Recipe","name":"Cake","image":"https://cdn.example.com/cake.jpg","recipeYield":"8 servings","prepTime":"PT15M","cookTime":"PT1H","recipeIngredient":["flour"],"recipeInstructions":"Line one.\\nLine two."}
                </script></head></html>
                """;
        ParsedRecipe r = parser.parse(html, "https://recipes.example.com/cake");
        assertThat(r.heroImageUrl()).isEqualTo("https://cdn.example.com/cake.jpg");
        assertThat(r.yields()).isEqualTo("8 servings");
        assertThat(r.prepTimeMin()).isEqualTo(15);
        assertThat(r.cookTimeMin()).isEqualTo(60);
        assertThat(r.stepTexts()).containsExactly("Line one.", "Line two.");
        assertThat(r.parseMethod()).isEqualTo("json_ld");
    }

    @Test
    void microdataFallbackParsesRecipe() {
        String html =
                """
                <html><body>
                <div itemscope itemtype="https://schema.org/Recipe">
                  <h1 itemprop="name">Stew</h1>
                  <span itemprop="recipeIngredient">beef</span>
                  <span itemprop="recipeIngredient">carrots</span>
                  <div itemprop="recipeInstructions"><ol><li>Brown meat.</li><li>Simmer.</li></ol></div>
                </div>
                </body></html>
                """;
        ParsedRecipe r = parser.parse(html, "https://example.com/stew");
        assertThat(r.title()).isEqualTo("Stew");
        assertThat(r.ingredientLines()).containsExactly("beef", "carrots");
        assertThat(r.stepTexts()).containsExactly("Brown meat.", "Simmer.");
        assertThat(r.parseMethod()).isEqualTo("microdata");
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
        assertThat(r.parseMethod()).isEqualTo("heuristic");
    }

    @Test
    void heuristicPicksOgImage() {
        String html =
                """
                <html><head>
                <meta property="og:image" content="https://img.example.com/food.png" />
                <title>Page</title></head><body>
                <h1>Salad</h1>
                <ul class="ingredients"><li>greens</li></ul>
                <ol class="instructions"><li>Toss.</li></ol>
                </body></html>
                """;
        ParsedRecipe r = parser.parse(html, "https://example.com/salad");
        assertThat(r.heroImageUrl()).isEqualTo("https://img.example.com/food.png");
        assertThat(r.parseMethod()).isEqualTo("heuristic");
    }
}
