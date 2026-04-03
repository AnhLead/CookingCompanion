package com.cookingcompanion.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "ingredient_line")
@Getter
@Setter
public class IngredientLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "variant_id", nullable = false)
    private RecipeVariant variant;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "amount_numeric", precision = 12, scale = 4)
    private BigDecimal amountNumeric;

    @Column(length = 64)
    private String unit;

    @Column(name = "ingredient_text", nullable = false, length = 1024)
    private String ingredientText;

    @Column(name = "preparation_note", length = 512)
    private String preparationNote;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> alternates = new ArrayList<>();

    @PrePersist
    void prePersist() {
        if (alternates == null) {
            alternates = new ArrayList<>();
        }
    }
}
