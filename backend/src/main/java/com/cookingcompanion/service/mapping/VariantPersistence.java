package com.cookingcompanion.service.mapping;

import com.cookingcompanion.api.dto.CreateVariantRequest;
import com.cookingcompanion.api.dto.IngredientLineDto;
import com.cookingcompanion.api.dto.RecipeStepDto;
import com.cookingcompanion.domain.Dish;
import com.cookingcompanion.domain.IngredientLine;
import com.cookingcompanion.domain.RecipeStep;
import com.cookingcompanion.domain.RecipeVariant;
import com.cookingcompanion.domain.Source;
import com.cookingcompanion.repo.IngredientLineRepository;
import com.cookingcompanion.repo.RecipeStepRepository;
import com.cookingcompanion.repo.RecipeVariantRepository;
import java.util.ArrayList;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VariantPersistence {

    private final RecipeVariantRepository recipeVariantRepository;
    private final IngredientLineRepository ingredientLineRepository;
    private final RecipeStepRepository recipeStepRepository;

    public VariantPersistence(
            RecipeVariantRepository recipeVariantRepository,
            IngredientLineRepository ingredientLineRepository,
            RecipeStepRepository recipeStepRepository) {
        this.recipeVariantRepository = recipeVariantRepository;
        this.ingredientLineRepository = ingredientLineRepository;
        this.recipeStepRepository = recipeStepRepository;
    }

    @Transactional
    public RecipeVariant createVariant(
            Dish dish, CreateVariantRequest req, Source source, UUID ownerUserId, boolean enforceSingleCanonical) {
        if (enforceSingleCanonical && req.canonical()) {
            clearCanonicalForDish(dish.getId());
        }
        RecipeVariant v = new RecipeVariant();
        v.setDish(dish);
        applyScalars(v, req, source, ownerUserId);
        v = recipeVariantRepository.save(v);
        persistChildren(v, req.ingredients(), req.steps());
        return v;
    }

    @Transactional
    public void replaceLinesAndSteps(RecipeVariant v, java.util.List<IngredientLineDto> ingredients, java.util.List<RecipeStepDto> steps) {
        ingredientLineRepository.deleteByVariantId(v.getId());
        recipeStepRepository.deleteByVariantId(v.getId());
        persistChildren(v, ingredients, steps);
    }

    public void clearCanonicalForDish(UUID dishId) {
        for (RecipeVariant rv : recipeVariantRepository.findByDishIdOrderByCreatedAtAsc(dishId)) {
            if (rv.isCanonical()) {
                rv.setCanonical(false);
                recipeVariantRepository.save(rv);
            }
        }
    }

    private void applyScalars(RecipeVariant v, CreateVariantRequest req, Source source, UUID ownerUserId) {
        v.setTitle(req.title().trim());
        v.setYields(req.yields());
        v.setPrepTimeMin(req.prepTimeMin());
        v.setCookTimeMin(req.cookTimeMin());
        v.setCanonical(req.canonical());
        v.setOwnerUserId(ownerUserId != null ? ownerUserId : req.ownerUserId());
        if (source != null) {
            v.setSource(source);
        }
    }

    public void applyPatchScalars(RecipeVariant v, com.cookingcompanion.api.dto.PatchVariantRequest req, Source source) {
        if (req.title() != null) {
            v.setTitle(req.title().trim());
        }
        if (req.yields() != null) {
            v.setYields(req.yields());
        }
        if (req.prepTimeMin() != null) {
            v.setPrepTimeMin(req.prepTimeMin());
        }
        if (req.cookTimeMin() != null) {
            v.setCookTimeMin(req.cookTimeMin());
        }
        if (req.canonical() != null) {
            v.setCanonical(req.canonical());
        }
        if (req.sourceId() != null) {
            v.setSource(source);
        }
    }

    private void persistChildren(RecipeVariant v, java.util.List<IngredientLineDto> ingredients, java.util.List<RecipeStepDto> steps) {
        if (ingredients != null) {
            for (IngredientLineDto dto : ingredients) {
                IngredientLine line = new IngredientLine();
                line.setVariant(v);
                line.setSortOrder(dto.sortOrder());
                line.setAmountNumeric(dto.amountNumeric());
                line.setUnit(dto.unit());
                line.setIngredientText(dto.ingredientText());
                line.setPreparationNote(dto.preparationNote());
                line.setAlternates(new ArrayList<>(dto.alternates()));
                ingredientLineRepository.save(line);
            }
        }
        if (steps != null) {
            for (RecipeStepDto dto : steps) {
                RecipeStep step = new RecipeStep();
                step.setVariant(v);
                step.setSortOrder(dto.sortOrder());
                step.setText(dto.text());
                step.setTimerSeconds(dto.timerSeconds());
                step.setLinkUrl(dto.linkUrl());
                recipeStepRepository.save(step);
            }
        }
    }

    public record PersistedImport(UUID dishId, UUID variantId) {}
}
