package com.cookingcompanion.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

/**
 * Extracts {@code sub} from an unverified JWT payload (MVP only).
 */
public final class JwtSubjectParser {

    private JwtSubjectParser() {}

    public static UUID tryParseSubAsUuid(String bearerToken, ObjectMapper objectMapper) {
        if (bearerToken == null || bearerToken.isBlank()) {
            return null;
        }
        String[] parts = bearerToken.trim().split("\\.");
        if (parts.length != 3) {
            return null;
        }
        try {
            byte[] json = Base64.getUrlDecoder().decode(padBase64Url(parts[1]));
            JsonNode node = objectMapper.readTree(new String(json, StandardCharsets.UTF_8));
            if (!node.has("sub") || !node.get("sub").isTextual()) {
                return null;
            }
            return UUID.fromString(node.get("sub").asText());
        } catch (Exception e) {
            return null;
        }
    }

    private static String padBase64Url(String s) {
        StringBuilder b = new StringBuilder(s);
        while (b.length() % 4 != 0) {
            b.append('=');
        }
        return b.toString();
    }
}
