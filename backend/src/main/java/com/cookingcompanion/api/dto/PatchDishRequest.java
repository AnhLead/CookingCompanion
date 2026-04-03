package com.cookingcompanion.api.dto;

import java.util.List;

public record PatchDishRequest(String name, List<String> tags, String heroImageUrl) {

    public PatchDishRequest {
        if (tags != null && tags.isEmpty()) {
            tags = List.of();
        }
    }
}
