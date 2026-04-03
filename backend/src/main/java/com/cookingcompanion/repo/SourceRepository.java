package com.cookingcompanion.repo;

import com.cookingcompanion.domain.Source;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SourceRepository extends JpaRepository<Source, UUID> {

    Optional<Source> findByOwnerUserIdAndUrl(UUID ownerUserId, String url);

    Optional<Source> findByUrlAndOwnerUserIdIsNull(String url);
}
