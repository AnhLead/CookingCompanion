package com.cookingcompanion.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "household_member")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class HouseholdMember {

    @EmbeddedId
    private HouseholdMemberId id;

    @Column(nullable = false, length = 32)
    private String role;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HouseholdMemberId implements Serializable {

        @Column(name = "household_id", nullable = false)
        private UUID householdId;

        @Column(name = "user_id", nullable = false)
        private UUID userId;

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (o == null || getClass() != o.getClass()) {
                return false;
            }
            HouseholdMemberId that = (HouseholdMemberId) o;
            return Objects.equals(householdId, that.householdId) && Objects.equals(userId, that.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(householdId, userId);
        }
    }
}
