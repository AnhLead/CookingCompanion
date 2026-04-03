package com.cookingcompanion.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(name = "PatchDish")
public record PatchDishRequest(String name, List<String> tags, String heroImageUrl) {

    public PatchDishRequest {
        if (tags != null && tags.isEmpty()) {
            tags = List.of();
        }
    }
}
