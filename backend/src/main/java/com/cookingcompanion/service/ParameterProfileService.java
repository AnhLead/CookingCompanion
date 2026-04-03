package com.cookingcompanion.service;

import com.cookingcompanion.api.dto.ApplyProfileResponse;
import com.cookingcompanion.api.dto.IngredientLineDto;
import com.cookingcompanion.api.dto.RecipeStepDto;
import com.cookingcompanion.domain.VariantAdjustment;
import com.cookingcompanion.repo.IngredientLineRepository;
import com.cookingcompanion.repo.RecipeStepRepository;
import com.cookingcompanion.repo.VariantAdjustmentRepository;
import com.cookingcompanion.security.CurrentRecipeRequestContext;
import com.cookingcompanion.service.ai.GenerativeRecipeAdjustmentClient;
import com.cookingcompanion.service.mapping.DtoMapper;
import com.cookingcompanion.config.RecipeAiProperties;
import com.cookingcompanion.web.ApiException;
import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParameterProfileService {

    private static final Logger log = LoggerFactory.getLogger(ParameterProfileService.class);

    private static final List<String> DAIRY_TOKENS = List.of(
            "milk", "cream", "butter", "cheese", "yogurt", "yoghurt", "parmesan", "mozzarella", "cheddar", "ghee");

    private final VariantService variantService;
    private final IngredientLineRepository ingredientLineRepository;
    private final RecipeStepRepository recipeStepRepository;
    private final VariantAdjustmentRepository variantAdjustmentRepository;
    private final DtoMapper dtoMapper;
    private final RecipeAccessService recipeAccessService;
    private final RecipeAiProperties recipeAiProperties;
    private final GenerativeRecipeAdjustmentClient generativeRecipeAdjustmentClient;
    private final CurrentRecipeRequestContext currentRecipeRequestContext;
    private final RateLimiter generativeRateLimiter;

    public ParameterProfileService(
            VariantService variantService,
            IngredientLineRepository ingredientLineRepository,
            RecipeStepRepository recipeStepRepository,
            VariantAdjustmentRepository variantAdjustmentRepository,
            DtoMapper dtoMapper,
            RecipeAccessService recipeAccessService,
            RecipeAiProperties recipeAiProperties,
            GenerativeRecipeAdjustmentClient generativeRecipeAdjustmentClient,
            CurrentRecipeRequestContext currentRecipeRequestContext,
            RateLimiterRegistry rateLimiterRegistry) {
        this.variantService = variantService;
        this.ingredientLineRepository = ingredientLineRepository;
        this.recipeStepRepository = recipeStepRepository;
        this.variantAdjustmentRepository = variantAdjustmentRepository;
        this.dtoMapper = dtoMapper;
        this.recipeAccessService = recipeAccessService;
        this.recipeAiProperties = recipeAiProperties;
        this.generativeRecipeAdjustmentClient = generativeRecipeAdjustmentClient;
        this.currentRecipeRequestContext = currentRecipeRequestContext;
        this.generativeRateLimiter = rateLimiterRegistry.rateLimiter("recipeGenerativeAdjust");
    }

    @Transactional
    public ApplyProfileResponse apply(UUID variantId, Map<String, Object> profile) {
        var v = variantService.loadVariant(variantId);
        recipeAccessService.assertCanWriteDish(v.getDish());
        var baseLines =
                ingredientLineRepository.findByVariantIdOrderBySortOrderAsc(variantId).stream()
                        .map(dtoMapper::toIngredientDto)
                        .toList();
        var baseSteps =
                recipeStepRepository.findByVariantIdOrderBySortOrderAsc(variantId).stream()
                        .map(dtoMapper::toStepDto)
                        .toList();

        if (truthyGenerative(profile)) {
            return applyGenerativePreview(variantId, v, profile, baseLines, baseSteps);
        }

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

    private ApplyProfileResponse applyGenerativePreview(
            UUID variantId,
            com.cookingcompanion.domain.RecipeVariant v,
            Map<String, Object> profile,
            List<IngredientLineDto> baseLines,
            List<RecipeStepDto> baseSteps) {
        if (!recipeAiProperties.isGenerativeAdjustmentsEnabled()) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "AI-assisted recipe adjustments are disabled on this server");
        }
        var actor = currentRecipeRequestContext.userId();
        log.info(
                "recipeAi.generative.request variantId={} userId={}",
                variantId,
                actor.map(UUID::toString).orElse("anonymous"));
        GenerativeRecipeAdjustmentClient.GenerativeResult gen;
        try {
            gen = generativeRateLimiter.executeCallable(
                    () -> generativeRecipeAdjustmentClient.adjust(variantId, actor, baseLines, baseSteps, profile));
        } catch (io.github.resilience4j.ratelimiter.RequestNotPermitted e) {
            log.warn("recipeAi.generative.rateLimited variantId={}", variantId);
            throw e;
        } catch (ApiException e) {
            log.warn(
                    "recipeAi.generative.failed variantId={} status={} detail={}",
                    variantId,
                    e.getStatus().value(),
                    e.getMessage());
            throw e;
        } catch (Exception e) {
            log.warn("recipeAi.generative.unexpected variantId={} error={}", variantId, e.toString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Generative adjustment failed");
        }
        log.info(
                "recipeAi.generative.success variantId={} userId={} ingredientLines={} steps={}",
                variantId,
                actor.map(UUID::toString).orElse("anonymous"),
                gen.adjustedIngredients().size(),
                gen.adjustedSteps().size());

        VariantAdjustment adj = new VariantAdjustment();
        adj.setVariant(v);
        adj.setProfileJson(new HashMap<>(profile));
        adj.setResultSummary(gen.summary());
        adj = variantAdjustmentRepository.save(adj);

        return new ApplyProfileResponse(adj.getId(), profile, gen.summary(), gen.adjustedIngredients(), gen.adjustedSteps());
    }

    private static boolean truthyGenerative(Map<String, Object> profile) {
        Object v = profile.get("useGenerative");
        if (v instanceof Boolean b) {
            return b;
        }
        if (v instanceof String s) {
            return "true".equalsIgnoreCase(s.trim());
        }
        return false;
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
