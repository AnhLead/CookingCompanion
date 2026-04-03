package com.cookingcompanion.repo;

import com.cookingcompanion.domain.RecipeStep;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeStepRepository extends JpaRepository<RecipeStep, UUID> {

    List<RecipeStep> findByVariantIdOrderBySortOrderAsc(UUID variantId);

    void deleteByVariantId(UUID variantId);
}
