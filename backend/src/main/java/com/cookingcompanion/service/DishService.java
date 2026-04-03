package com.cookingcompanion.service;

import com.cookingcompanion.api.dto.CreateDishRequest;
import com.cookingcompanion.api.dto.DishResponse;
import com.cookingcompanion.api.dto.PatchDishRequest;
import com.cookingcompanion.domain.Dish;
import com.cookingcompanion.repo.DishRepository;
import com.cookingcompanion.security.CurrentRecipeRequestContext;
import com.cookingcompanion.service.mapping.DtoMapper;
import com.cookingcompanion.web.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DishService {

    private final DishRepository dishRepository;
    private final DtoMapper dtoMapper;
    private final CurrentRecipeRequestContext requestContext;
    private final RecipeAccessService recipeAccessService;

    public DishService(
            DishRepository dishRepository,
            DtoMapper dtoMapper,
            CurrentRecipeRequestContext requestContext,
            RecipeAccessService recipeAccessService) {
        this.dishRepository = dishRepository;
        this.dtoMapper = dtoMapper;
        this.requestContext = requestContext;
        this.recipeAccessService = recipeAccessService;
    }

    @Transactional(readOnly = true)
    public List<DishResponse> list(String q) {
        String needle = q == null ? null : q.trim();
        boolean filter = needle != null && !needle.isEmpty();

        var scope = requestContext.householdScopeId();
        if (scope.isPresent()) {
            List<Dish> dishes =
                    filter
                            ? dishRepository.findByHouseholdIdAndNameContainingIgnoreCaseOrderByNameAsc(
                                    scope.get(), needle)
                            : dishRepository.findByHouseholdIdOrderByNameAsc(scope.get());
            return dishes.stream().map(dtoMapper::toDish).toList();
        }
        var user = requestContext.userId();
        if (user.isPresent()) {
            List<Dish> dishes =
                    filter
                            ? dishRepository.findPersonalVisibleByNameContaining(user.get(), needle)
                            : dishRepository.findPersonalVisible(user.get());
            return dishes.stream().map(dtoMapper::toDish).toList();
        }
        List<Dish> dishes =
                filter ? dishRepository.findSharedUnscopedByNameContaining(needle) : dishRepository.findSharedUnscoped();
        return dishes.stream().map(dtoMapper::toDish).toList();
    }

    @Transactional(readOnly = true)
    public DishResponse get(UUID id) {
        Dish d = load(id);
        recipeAccessService.assertCanReadDish(d);
        return dtoMapper.toDish(d);
    }

    @Transactional
    public DishResponse create(CreateDishRequest req) {
        UUID owner = req.ownerUserId();
        var principal = requestContext.userId();
        if (principal.isPresent()) {
            if (owner != null && !owner.equals(principal.get())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "ownerUserId does not match authenticated user");
            }
            owner = principal.get();
        }
        Dish d = new Dish();
        d.setName(req.name().trim());
        d.setTags(new ArrayList<>(req.tags()));
        d.setHeroImageUrl(req.heroImageUrl());
        d.setOwnerUserId(owner);
        requestContext.householdScopeId().ifPresent(d::setHouseholdId);
        d = dishRepository.save(d);
        recipeAccessService.assertCanReadDish(d);
        return dtoMapper.toDish(d);
    }

    @Transactional
    public DishResponse patch(UUID id, PatchDishRequest req) {
        Dish d = load(id);
        recipeAccessService.assertCanWriteDish(d);
        if (req.name() != null) {
            d.setName(req.name().trim());
        }
        if (req.tags() != null) {
            d.setTags(new ArrayList<>(req.tags()));
        }
        if (req.heroImageUrl() != null) {
            d.setHeroImageUrl(req.heroImageUrl());
        }
        d = dishRepository.save(d);
        return dtoMapper.toDish(d);
    }

    @Transactional
    public void delete(UUID id) {
        Dish d = load(id);
        recipeAccessService.assertCanWriteDish(d);
        dishRepository.delete(d);
    }

    Dish load(UUID id) {
        return dishRepository.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Dish not found"));
    }
}
