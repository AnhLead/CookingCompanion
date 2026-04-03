package com.cookingcompanion.repo;

import com.cookingcompanion.domain.Dish;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DishRepository extends JpaRepository<Dish, UUID> {

    List<Dish> findByHouseholdIdOrderByNameAsc(UUID householdId);

    @Query(
            """
            select d from Dish d where d.householdId is null
            and (d.ownerUserId is null or d.ownerUserId = :userId) order by d.name asc""")
    List<Dish> findPersonalVisible(@Param("userId") UUID userId);

    @Query("select d from Dish d where d.householdId is null order by d.name asc")
    List<Dish> findSharedUnscoped();
}
