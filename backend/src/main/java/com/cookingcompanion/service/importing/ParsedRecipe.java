package com.cookingcompanion.service.importing;

import java.util.ArrayList;
import java.util.List;

public record ParsedRecipe(
        String title,
        String suggestedDishName,
        List<String> ingredientLines,
        List<String> stepTexts,
        double confidence,
        List<String> warnings,
        String heroImageUrl,
        String yields,
        Integer prepTimeMin,
        Integer cookTimeMin,
        String parseMethod) {

    public ParsedRecipe {
        if (ingredientLines == null) {
            ingredientLines = List.of();
        }
        if (stepTexts == null) {
            stepTexts = List.of();
        }
        if (warnings == null) {
            warnings = new ArrayList<>();
        }
        if (heroImageUrl != null && heroImageUrl.isBlank()) {
            heroImageUrl = null;
        }
        if (yields != null && yields.isBlank()) {
            yields = null;
        }
        if (parseMethod == null || parseMethod.isBlank()) {
            parseMethod = "heuristic";
        }
    }
}
