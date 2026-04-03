package com.cookingcompanion.repo;

import com.cookingcompanion.domain.HouseholdMember;
import com.cookingcompanion.domain.HouseholdMember.HouseholdMemberId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HouseholdMemberRepository extends JpaRepository<HouseholdMember, HouseholdMemberId> {

    @Query(
            """
            select m from HouseholdMember m join Household h on h.id = m.id.householdId
            where m.id.userId = :userId order by h.name asc""")
    List<HouseholdMember> findByUserIdOrderByHouseholdName(@Param("userId") UUID userId);

    boolean existsByIdHouseholdIdAndIdUserId(UUID householdId, UUID userId);
}
