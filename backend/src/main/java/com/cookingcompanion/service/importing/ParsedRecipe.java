package com.cookingcompanion.service.importing;

import java.util.ArrayList;
import java.util.List;

public record ParsedRecipe(
        String title,
        String suggestedDishName,
        List<String> ingredientLines,
        List<String> stepTexts,
        double confidence,
        List<String> warnings) {

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
    }
}
