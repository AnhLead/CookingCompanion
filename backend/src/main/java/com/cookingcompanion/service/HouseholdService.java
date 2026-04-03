package com.cookingcompanion.service;

import com.cookingcompanion.api.dto.HouseholdSummaryResponse;
import com.cookingcompanion.domain.Household;
import com.cookingcompanion.domain.HouseholdMember;
import com.cookingcompanion.domain.HouseholdMember.HouseholdMemberId;
import com.cookingcompanion.repo.HouseholdMemberRepository;
import com.cookingcompanion.repo.HouseholdRepository;
import com.cookingcompanion.web.ApiException;
import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HouseholdService {

    private static final SecureRandom INVITE_RNG = new SecureRandom();
    private static final char[] INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int INVITE_CODE_LENGTH = 12;
    private static final int INVITE_ALLOCATION_ATTEMPTS = 16;

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
                    return summaryResponse(h, m.getRole());
                })
                .toList();
    }

    @Transactional
    public HouseholdSummaryResponse create(UUID userId, String rawName) {
        String name = rawName.trim();
        if (name.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Name required");
        }
        Household h = new Household();
        h.setName(name);
        h.setInviteCode(newUniqueInviteCode());
        householdRepository.save(h);
        HouseholdMember m = new HouseholdMember();
        m.setId(new HouseholdMemberId(h.getId(), userId));
        m.setRole("owner");
        householdMemberRepository.save(m);
        return summaryResponse(h, m.getRole());
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
        return summaryResponse(h, m.getRole());
    }

    private HouseholdSummaryResponse summaryResponse(Household h, String membershipRole) {
        String invite =
                membershipRole != null && membershipRole.equalsIgnoreCase("owner") ? h.getInviteCode() : null;
        return new HouseholdSummaryResponse(h.getId(), h.getName(), membershipRole, invite);
    }

    private String newUniqueInviteCode() {
        for (int attempt = 0; attempt < INVITE_ALLOCATION_ATTEMPTS; attempt++) {
            StringBuilder sb = new StringBuilder(INVITE_CODE_LENGTH);
            for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
                sb.append(INVITE_ALPHABET[INVITE_RNG.nextInt(INVITE_ALPHABET.length)]);
            }
            String code = sb.toString();
            if (!householdRepository.existsByInviteCodeIgnoreCase(code)) {
                return code;
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate invite code");
    }
}
