package com.cookingcompanion.service;

import com.cookingcompanion.api.dto.ApplyProfileResponse;
import com.cookingcompanion.api.dto.IngredientLineDto;
import com.cookingcompanion.api.dto.RecipeStepDto;
import com.cookingcompanion.domain.VariantAdjustment;
import com.cookingcompanion.repo.IngredientLineRepository;
import com.cookingcompanion.repo.RecipeStepRepository;
import com.cookingcompanion.repo.VariantAdjustmentRepository;
import com.cookingcompanion.service.mapping.DtoMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParameterProfileService {

    private static final List<String> DAIRY_TOKENS = List.of(
            "milk", "cream", "butter", "cheese", "yogurt", "yoghurt", "parmesan", "mozzarella", "cheddar", "ghee");

    private final VariantService variantService;
    private final IngredientLineRepository ingredientLineRepository;
    private final RecipeStepRepository recipeStepRepository;
    private final VariantAdjustmentRepository variantAdjustmentRepository;
    private final DtoMapper dtoMapper;

    public ParameterProfileService(
            VariantService variantService,
            IngredientLineRepository ingredientLineRepository,
            RecipeStepRepository recipeStepRepository,
            VariantAdjustmentRepository variantAdjustmentRepository,
            DtoMapper dtoMapper) {
        this.variantService = variantService;
        this.ingredientLineRepository = ingredientLineRepository;
        this.recipeStepRepository = recipeStepRepository;
        this.variantAdjustmentRepository = variantAdjustmentRepository;
        this.dtoMapper = dtoMapper;
    }

    @Transactional
    public ApplyProfileResponse apply(UUID variantId, Map<String, Object> profile) {
        var v = variantService.loadVariant(variantId);
        var baseLines =
                ingredientLineRepository.findByVariantIdOrderBySortOrderAsc(variantId).stream()
                        .map(dtoMapper::toIngredientDto)
                        .toList();
        var baseSteps =
                recipeStepRepository.findByVariantIdOrderBySortOrderAsc(variantId).stream()
                        .map(dtoMapper::toStepDto)
                        .toList();

        String dairyMode = stringProp(profile, "dairyMode", "none");
        @SuppressWarnings("unchecked")
        List<String> rawOmit = (List<String>) profile.getOrDefault("omitTokens", List.of());
        final List<String> omitTokens = rawOmit == null ? List.of() : rawOmit;

        var adjustedIngredients = new ArrayList<>(baseLines);
        adjustedIngredients.removeIf(line -> matchesAnyToken(line.ingredientText(), omitTokens));

        if ("omit".equalsIgnoreCase(dairyMode)) {
            adjustedIngredients.removeIf(this::isDairyLine);
        } else if ("substitute_oat".equalsIgnoreCase(dairyMode)) {
            adjustedIngredients.replaceAll(this::substituteDairyOat);
        }

        List<RecipeStepDto> adjustedSteps = baseSteps.stream().map(this::copyStep).toList();
        if ("substitute_oat".equalsIgnoreCase(dairyMode)) {
            adjustedSteps = adjustedSteps.stream().map(this::substituteStepDairyOat).toList();
        }

        String summary = buildSummary(dairyMode, omitTokens, baseLines.size(), adjustedIngredients.size());

        VariantAdjustment adj = new VariantAdjustment();
        adj.setVariant(v);
        adj.setProfileJson(new HashMap<>(profile));
        adj.setResultSummary(summary);
        adj = variantAdjustmentRepository.save(adj);

        return new ApplyProfileResponse(adj.getId(), profile, summary, adjustedIngredients, adjustedSteps);
    }

    private static String stringProp(Map<String, Object> profile, String key, String def) {
        Object v = profile.get(key);
        if (v == null) {
            return def;
        }
        return String.valueOf(v);
    }

    private boolean matchesAnyToken(String text, List<String> tokens) {
        if (text == null || tokens.isEmpty()) {
            return false;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        return tokens.stream().anyMatch(t -> t != null && !t.isBlank() && lower.contains(t.toLowerCase(Locale.ROOT)));
    }

    private boolean isDairyLine(IngredientLineDto line) {
        return matchesAnyToken(line.ingredientText(), DAIRY_TOKENS);
    }

    private IngredientLineDto substituteDairyOat(IngredientLineDto line) {
        String t = line.ingredientText();
        if (t == null) {
            return line;
        }
        String lower = t.toLowerCase(Locale.ROOT);
        if (!containsDairy(lower)) {
            return line;
        }
        String replaced = t;
        replaced = replaceWordInsensitive(replaced, "whole milk", "oat milk");
        replaced = replaceWordInsensitive(replaced, "skim milk", "oat milk");
        replaced = replaceWordInsensitive(replaced, "milk", "oat milk");
        replaced = replaceWordInsensitive(replaced, "heavy cream", "oat cream");
        replaced = replaceWordInsensitive(replaced, "cream", "oat cream");
        replaced = replaceWordInsensitive(replaced, "butter", "vegan butter");
        if (replaced.equals(t)) {
            return line;
        }
        return new IngredientLineDto(
                line.id(),
                line.sortOrder(),
                line.amountNumeric(),
                line.unit(),
                replaced,
                line.preparationNote(),
                line.alternates());
    }

    private RecipeStepDto substituteStepDairyOat(RecipeStepDto step) {
        String t = step.text();
        if (t == null || !containsDairy(t.toLowerCase(Locale.ROOT))) {
            return step;
        }
        String replaced = replaceWordInsensitive(t, "milk", "oat milk");
        replaced = replaceWordInsensitive(replaced, "cream", "oat cream");
        replaced = replaceWordInsensitive(replaced, "butter", "vegan butter");
        return new RecipeStepDto(
                step.id(), step.sortOrder(), replaced, step.timerSeconds(), step.linkUrl());
    }

    private boolean containsDairy(String lower) {
        return DAIRY_TOKENS.stream().anyMatch(lower::contains);
    }

    private static String replaceWordInsensitive(String input, String needle, String replacement) {
        return input.replaceAll("(?i)\\b" + java.util.regex.Pattern.quote(needle) + "\\b", replacement);
    }

    private RecipeStepDto copyStep(RecipeStepDto s) {
        return new RecipeStepDto(s.id(), s.sortOrder(), s.text(), s.timerSeconds(), s.linkUrl());
    }

    private String buildSummary(String dairyMode, List<String> omitTokens, int before, int after) {
        return "dairyMode="
                + dairyMode
                + ", omitTokens="
                + omitTokens.size()
                + ", ingredients "
                + before
                + "→"
                + after;
    }
}
