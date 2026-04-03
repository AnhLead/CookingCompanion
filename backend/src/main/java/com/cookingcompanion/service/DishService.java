package com.cookingcompanion.service;

import com.cookingcompanion.api.dto.CreateDishRequest;
import com.cookingcompanion.api.dto.DishResponse;
import com.cookingcompanion.api.dto.PatchDishRequest;
import com.cookingcompanion.domain.Dish;
import com.cookingcompanion.repo.DishRepository;
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

    public DishService(DishRepository dishRepository, DtoMapper dtoMapper) {
        this.dishRepository = dishRepository;
        this.dtoMapper = dtoMapper;
    }

    @Transactional(readOnly = true)
    public List<DishResponse> list() {
        return dishRepository.findAll().stream().map(dtoMapper::toDish).toList();
    }

    @Transactional(readOnly = true)
    public DishResponse get(UUID id) {
        return dtoMapper.toDish(load(id));
    }

    @Transactional
    public DishResponse create(CreateDishRequest req) {
        Dish d = new Dish();
        d.setName(req.name().trim());
        d.setTags(new ArrayList<>(req.tags()));
        d.setHeroImageUrl(req.heroImageUrl());
        d.setOwnerUserId(req.ownerUserId());
        d = dishRepository.save(d);
        return dtoMapper.toDish(d);
    }

    @Transactional
    public DishResponse patch(UUID id, PatchDishRequest req) {
        Dish d = load(id);
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
        dishRepository.delete(load(id));
    }

    Dish load(UUID id) {
        return dishRepository.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Dish not found"));
    }
}
