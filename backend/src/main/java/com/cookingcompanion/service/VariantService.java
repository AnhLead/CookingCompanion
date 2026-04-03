package com.cookingcompanion.service;

import com.cookingcompanion.api.dto.CreateVariantRequest;
import com.cookingcompanion.api.dto.PatchVariantRequest;
import com.cookingcompanion.api.dto.VariantDetailResponse;
import com.cookingcompanion.api.dto.VariantSummaryResponse;
import com.cookingcompanion.domain.RecipeVariant;
import com.cookingcompanion.domain.Source;
import com.cookingcompanion.security.CurrentRecipeRequestContext;
import com.cookingcompanion.repo.IngredientLineRepository;
import com.cookingcompanion.repo.RecipeStepRepository;
import com.cookingcompanion.repo.RecipeVariantRepository;
import com.cookingcompanion.repo.SourceRepository;
import com.cookingcompanion.service.mapping.DtoMapper;
import com.cookingcompanion.service.mapping.VariantPersistence;
import com.cookingcompanion.web.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VariantService {

    private final DishService dishService;
    private final RecipeVariantRepository recipeVariantRepository;
    private final IngredientLineRepository ingredientLineRepository;
    private final RecipeStepRepository recipeStepRepository;
    private final SourceRepository sourceRepository;
    private final VariantPersistence variantPersistence;
    private final DtoMapper dtoMapper;
    private final RecipeAccessService recipeAccessService;
    private final CurrentRecipeRequestContext requestContext;

    public VariantService(
            DishService dishService,
            RecipeVariantRepository recipeVariantRepository,
            IngredientLineRepository ingredientLineRepository,
            RecipeStepRepository recipeStepRepository,
            SourceRepository sourceRepository,
            VariantPersistence variantPersistence,
            DtoMapper dtoMapper,
            RecipeAccessService recipeAccessService,
            CurrentRecipeRequestContext requestContext) {
        this.dishService = dishService;
        this.recipeVariantRepository = recipeVariantRepository;
        this.ingredientLineRepository = ingredientLineRepository;
        this.recipeStepRepository = recipeStepRepository;
        this.sourceRepository = sourceRepository;
        this.variantPersistence = variantPersistence;
        this.dtoMapper = dtoMapper;
        this.recipeAccessService = recipeAccessService;
        this.requestContext = requestContext;
    }

    @Transactional(readOnly = true)
    public List<VariantSummaryResponse> listByDish(UUID dishId) {
        var dish = dishService.load(dishId);
        recipeAccessService.assertCanReadDish(dish);
        return recipeVariantRepository.findByDishIdOrderByCreatedAtAsc(dishId).stream()
                .map(dtoMapper::toSummary)
                .toList();
    }

    @Transactional
    public VariantSummaryResponse create(UUID dishId, CreateVariantRequest req) {
        var dish = dishService.load(dishId);
        recipeAccessService.assertCanWriteDish(dish);
        Source src = resolveSource(req.sourceId());
        UUID owner = req.ownerUserId();
        var principal = requestContext.userId();
        if (principal.isPresent()) {
            if (owner != null && !owner.equals(principal.get())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "ownerUserId does not match authenticated user");
            }
            owner = principal.get();
        }
        RecipeVariant v = variantPersistence.createVariant(dish, req, src, owner, true);
        return dtoMapper.toSummary(recipeVariantRepository.findById(v.getId()).orElseThrow());
    }

    @Transactional(readOnly = true)
    public VariantDetailResponse get(UUID variantId) {
        RecipeVariant v = loadVariant(variantId);
        recipeAccessService.assertCanReadVariant(v);
        return dtoMapper.toDetail(
                v,
                ingredientLineRepository.findByVariantIdOrderBySortOrderAsc(variantId),
                recipeStepRepository.findByVariantIdOrderBySortOrderAsc(variantId));
    }

    @Transactional
    public VariantDetailResponse patch(UUID variantId, PatchVariantRequest req) {
        RecipeVariant v = loadVariant(variantId);
        recipeAccessService.assertCanWriteDish(v.getDish());
        Source src = req.sourceId() != null ? resolveSource(req.sourceId()) : null;
        if (Boolean.TRUE.equals(req.canonical())) {
            variantPersistence.clearCanonicalForDish(v.getDish().getId());
        }
        variantPersistence.applyPatchScalars(v, req, src);
        if (req.ingredients() != null || req.steps() != null) {
            var ingredients = req.ingredients() != null ? req.ingredients() : mapExistingIngredients(variantId);
            var steps = req.steps() != null ? req.steps() : mapExistingSteps(variantId);
            variantPersistence.replaceLinesAndSteps(v, ingredients, steps);
        }
        v = recipeVariantRepository.save(v);
        return get(v.getId());
    }

    @Transactional
    public void delete(UUID variantId) {
        RecipeVariant v = loadVariant(variantId);
        recipeAccessService.assertCanWriteDish(v.getDish());
        recipeVariantRepository.delete(v);
    }

    @Transactional
    public VariantDetailResponse fork(UUID variantId) {
        RecipeVariant src = loadVariant(variantId);
        recipeAccessService.assertCanReadVariant(src);
        recipeAccessService.assertCanWriteDish(src.getDish());
        var lines = ingredientLineRepository.findByVariantIdOrderBySortOrderAsc(variantId);
        var steps = recipeStepRepository.findByVariantIdOrderBySortOrderAsc(variantId);
        var ingDtos = lines.stream().map(dtoMapper::toIngredientDto).toList();
        var stepDtos = steps.stream().map(dtoMapper::toStepDto).toList();
        var createReq = new CreateVariantRequest(
                src.getTitle() + " (fork)",
                src.getYields(),
                src.getPrepTimeMin(),
                src.getCookTimeMin(),
                false,
                src.getSource() != null ? src.getSource().getId() : null,
                src.getOwnerUserId(),
                ingDtos,
                stepDtos);
        RecipeVariant forked =
                variantPersistence.createVariant(src.getDish(), createReq, src.getSource(), src.getOwnerUserId(), false);
        return get(forked.getId());
    }

    RecipeVariant loadVariant(UUID id) {
        return recipeVariantRepository
                .findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Variant not found"));
    }

    private Source resolveSource(UUID id) {
        if (id == null) {
            return null;
        }
        return sourceRepository.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Source not found"));
    }

    private List<com.cookingcompanion.api.dto.IngredientLineDto> mapExistingIngredients(UUID variantId) {
        return ingredientLineRepository.findByVariantIdOrderBySortOrderAsc(variantId).stream()
                .map(dtoMapper::toIngredientDto)
                .toList();
    }

    private List<com.cookingcompanion.api.dto.RecipeStepDto> mapExistingSteps(UUID variantId) {
        return recipeStepRepository.findByVariantIdOrderBySortOrderAsc(variantId).stream()
                .map(dtoMapper::toStepDto)
                .toList();
    }
}
