package com.cookingcompanion.repo;

import com.cookingcompanion.domain.IngredientLine;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IngredientLineRepository extends JpaRepository<IngredientLine, UUID> {

    List<IngredientLine> findByVariantIdOrderBySortOrderAsc(UUID variantId);

    void deleteByVariantId(UUID variantId);
}
