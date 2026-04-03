package com.cookingcompanion.service.mapping;

import com.cookingcompanion.api.dto.DishResponse;
import com.cookingcompanion.api.dto.IngredientLineDto;
import com.cookingcompanion.api.dto.RecipeStepDto;
import com.cookingcompanion.api.dto.VariantDetailResponse;
import com.cookingcompanion.api.dto.VariantSummaryResponse;
import com.cookingcompanion.domain.Dish;
import com.cookingcompanion.domain.IngredientLine;
import com.cookingcompanion.domain.RecipeStep;
import com.cookingcompanion.domain.RecipeVariant;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class DtoMapper {

    public DishResponse toDish(Dish d) {
        return new DishResponse(
                d.getId(),
                d.getName(),
                List.copyOf(d.getTags()),
                d.getHeroImageUrl(),
                d.getOwnerUserId(),
                d.getCreatedAt(),
                d.getUpdatedAt());
    }

    public VariantSummaryResponse toSummary(RecipeVariant v) {
        return new VariantSummaryResponse(
                v.getId(),
                v.getDish().getId(),
                v.getTitle(),
                v.getYields(),
                v.getPrepTimeMin(),
                v.getCookTimeMin(),
                v.isCanonical(),
                v.getSource() != null ? v.getSource().getId() : null,
                v.getOwnerUserId(),
                v.getCreatedAt(),
                v.getUpdatedAt());
    }

    public VariantDetailResponse toDetail(RecipeVariant v, List<IngredientLine> lines, List<RecipeStep> steps) {
        return new VariantDetailResponse(
                v.getId(),
                v.getDish().getId(),
                v.getTitle(),
                v.getYields(),
                v.getPrepTimeMin(),
                v.getCookTimeMin(),
                v.isCanonical(),
                v.getSource() != null ? v.getSource().getId() : null,
                v.getOwnerUserId(),
                lines.stream().map(this::toIngredientDto).toList(),
                steps.stream().map(this::toStepDto).toList(),
                v.getCreatedAt(),
                v.getUpdatedAt());
    }

    public IngredientLineDto toIngredientDto(IngredientLine line) {
        return new IngredientLineDto(
                line.getId().toString(),
                line.getSortOrder(),
                line.getAmountNumeric(),
                line.getUnit(),
                line.getIngredientText(),
                line.getPreparationNote(),
                List.copyOf(line.getAlternates() == null ? List.of() : line.getAlternates()));
    }

    public RecipeStepDto toStepDto(RecipeStep step) {
        return new RecipeStepDto(
                step.getId().toString(),
                step.getSortOrder(),
                step.getText(),
                step.getTimerSeconds(),
                step.getLinkUrl());
    }
}
