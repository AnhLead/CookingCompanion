package com.cookingcompanion.repo;

import com.cookingcompanion.domain.VariantAdjustment;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VariantAdjustmentRepository extends JpaRepository<VariantAdjustment, UUID> {}
