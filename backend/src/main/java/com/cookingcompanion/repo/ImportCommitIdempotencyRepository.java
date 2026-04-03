package com.cookingcompanion.repo;

import com.cookingcompanion.domain.ImportCommitIdempotency;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImportCommitIdempotencyRepository extends JpaRepository<ImportCommitIdempotency, UUID> {

    Optional<ImportCommitIdempotency> findByIdempotencyKey(String idempotencyKey);
}
