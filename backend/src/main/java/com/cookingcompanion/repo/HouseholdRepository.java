package com.cookingcompanion.repo;

import com.cookingcompanion.domain.Household;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HouseholdRepository extends JpaRepository<Household, UUID> {

    Optional<Household> findByInviteCodeIgnoreCase(String inviteCode);
}
