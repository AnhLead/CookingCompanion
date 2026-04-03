package com.cookingcompanion.repo;

import com.cookingcompanion.domain.RecipeVariant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeVariantRepository extends JpaRepository<RecipeVariant, UUID> {

    List<RecipeVariant> findByDishIdOrderByCreatedAtAsc(UUID dishId);
}
