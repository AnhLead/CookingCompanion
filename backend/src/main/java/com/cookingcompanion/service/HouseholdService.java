package com.cookingcompanion.service;

import com.cookingcompanion.api.dto.HouseholdSummaryResponse;
import com.cookingcompanion.domain.Household;
import com.cookingcompanion.domain.HouseholdMember;
import com.cookingcompanion.domain.HouseholdMember.HouseholdMemberId;
import com.cookingcompanion.repo.HouseholdMemberRepository;
import com.cookingcompanion.repo.HouseholdRepository;
import com.cookingcompanion.web.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HouseholdService {

    private final HouseholdRepository householdRepository;
    private final HouseholdMemberRepository householdMemberRepository;

    public HouseholdService(
            HouseholdRepository householdRepository, HouseholdMemberRepository householdMemberRepository) {
        this.householdRepository = householdRepository;
        this.householdMemberRepository = householdMemberRepository;
    }

    @Transactional(readOnly = true)
    public List<HouseholdSummaryResponse> listForUser(UUID userId) {
        return householdMemberRepository.findByUserIdOrderByHouseholdName(userId).stream()
                .map(m -> {
                    Household h = householdRepository
                            .findById(m.getId().getHouseholdId())
                            .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Household missing"));
                    return new HouseholdSummaryResponse(h.getId(), h.getName(), m.getRole());
                })
                .toList();
    }

    @Transactional
    public HouseholdSummaryResponse join(UUID userId, String code) {
        String trimmed = code.trim();
        Household h = householdRepository
                .findByInviteCodeIgnoreCase(trimmed)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Invalid invite code"));
        if (householdMemberRepository.existsByIdHouseholdIdAndIdUserId(h.getId(), userId)) {
            return summary(h.getId(), userId);
        }
        HouseholdMember m = new HouseholdMember();
        m.setId(new HouseholdMemberId(h.getId(), userId));
        m.setRole("member");
        householdMemberRepository.save(m);
        return summary(h.getId(), userId);
    }

    private HouseholdSummaryResponse summary(UUID householdId, UUID userId) {
        Household h = householdRepository.findById(householdId).orElseThrow();
        HouseholdMemberId id = new HouseholdMemberId(householdId, userId);
        HouseholdMember m = householdMemberRepository
                .findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Membership missing"));
        return new HouseholdSummaryResponse(h.getId(), h.getName(), m.getRole());
    }
}
