package com.cookingcompanion.repo;

import com.cookingcompanion.domain.Dish;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DishRepository extends JpaRepository<Dish, UUID> {}
