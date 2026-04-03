package com.cookingcompanion.repo;

import com.cookingcompanion.domain.ImportPreview;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImportPreviewRepository extends JpaRepository<ImportPreview, UUID> {}
