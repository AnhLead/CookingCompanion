package com.cookingcompanion.service.ai;

import com.cookingcompanion.api.dto.IngredientLineDto;
import com.cookingcompanion.api.dto.RecipeStepDto;
import com.cookingcompanion.config.RecipeAiProperties;
import com.cookingcompanion.web.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class OpenAiGenerativeRecipeAdjustmentClient implements GenerativeRecipeAdjustmentClient {

    private static final Logger log = LoggerFactory.getLogger(OpenAiGenerativeRecipeAdjustmentClient.class);

    private final RecipeAiProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public OpenAiGenerativeRecipeAdjustmentClient(RecipeAiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    }

    @Override
    public GenerativeResult adjust(
            UUID variantId,
            Optional<UUID> actorUserId,
            List<IngredientLineDto> baseIngredients,
            List<RecipeStepDto> baseSteps,
            Map<String, Object> profile) {
        String key = properties.getOpenaiApiKey();
        if (key == null || key.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Generative recipe adjustment is not configured");
        }
        String base = properties.getOpenaiBaseUrl().trim();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        URI uri = URI.create(base + "/v1/chat/completions");

        ObjectNode userPayload = objectMapper.createObjectNode();
        userPayload.set("ingredients", ingredientArray(baseIngredients));
        userPayload.set("steps", stepArray(baseSteps));
        userPayload.set("profile", objectMapper.valueToTree(profile));

        String userContent;
        try {
            userContent = objectMapper.writeValueAsString(userPayload);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to serialise adjustment request");
        }

        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", properties.getOpenaiModel());
        ArrayNode messages = root.putArray("messages");
        ObjectNode sys = messages.addObject();
        sys.put("role", "system");
        sys.put(
                "content",
                """
                You adjust recipes for dietary constraints using the provided profile only.
                Return ONLY valid JSON (no markdown) with this exact shape:
                {"summary":"one short sentence","adjustedIngredients":[{"id":string or null,"sortOrder":number,"amountNumeric":number or null,"unit":string or null,"ingredientText":string,"preparationNote":string or null,"alternates":string array}],"adjustedSteps":[{"id":string or null,"sortOrder":number,"text":string,"timerSeconds":number or null,"linkUrl":string or null}]}
                Preserve sortOrder values from the input when sensible. Keep ingredientText and step text kitchen-realistic.
                Do not invent allergens; prefer substitutions aligned with dairyMode and omitTokens in profile.""");

        ObjectNode userMsg = messages.addObject();
        userMsg.put("role", "user");
        userMsg.put("content", userContent);

        ObjectNode responseFormat = objectMapper.createObjectNode();
        responseFormat.put("type", "json_object");
        root.set("response_format", responseFormat);

        byte[] jsonBody;
        try {
            jsonBody = objectMapper.writeValueAsBytes(root);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to build OpenAI request");
        }

        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(55))
                .header("Authorization", "Bearer " + key.trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(jsonBody))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn(
                    "recipeAi.openaiTransport variantId={} userId={} error={}",
                    variantId,
                    actorUserId.map(UUID::toString).orElse("none"),
                    e.toString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Generative provider request failed");
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            log.warn(
                    "recipeAi.openaiHttp variantId={} userId={} status={}",
                    variantId,
                    actorUserId.map(UUID::toString).orElse("none"),
                    response.statusCode());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Generative provider returned an error");
        }

        String contentJson;
        try {
            JsonNode envelope = objectMapper.readTree(response.body());
            contentJson = envelope.path("choices").path(0).path("message").path("content").asText("");
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Generative provider response was not valid JSON");
        }
        if (contentJson.isBlank()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Generative provider returned empty content");
        }
        contentJson = stripMarkdownFence(contentJson);

        JsonNode parsed;
        try {
            parsed = objectMapper.readTree(contentJson);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Generative model output was not valid JSON");
        }

        String summary = parsed.path("summary").asText("AI-assisted adjustment");
        List<IngredientLineDto> ingredients = parseIngredients(parsed.path("adjustedIngredients"));
        List<RecipeStepDto> steps = parseSteps(parsed.path("adjustedSteps"));
        if (ingredients.isEmpty() && steps.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Generative model returned no recipe lines");
        }
        return new GenerativeResult(summary, ingredients, steps);
    }

    private static String stripMarkdownFence(String raw) {
        String t = raw.trim();
        if (t.startsWith("```")) {
            int firstNl = t.indexOf('\n');
            if (firstNl > 0) {
                t = t.substring(firstNl + 1);
            }
            int endFence = t.lastIndexOf("```");
            if (endFence >= 0) {
                t = t.substring(0, endFence).trim();
            }
        }
        return t;
    }

    private ArrayNode ingredientArray(List<IngredientLineDto> lines) {
        ArrayNode arr = objectMapper.createArrayNode();
        for (IngredientLineDto line : lines) {
            ObjectNode n = arr.addObject();
            if (line.id() != null) {
                n.put("id", line.id());
            } else {
                n.putNull("id");
            }
            n.put("sortOrder", line.sortOrder());
            if (line.amountNumeric() != null) {
                n.put("amountNumeric", line.amountNumeric());
            } else {
                n.putNull("amountNumeric");
            }
            if (line.unit() != null) {
                n.put("unit", line.unit());
            } else {
                n.putNull("unit");
            }
            n.put("ingredientText", line.ingredientText());
            if (line.preparationNote() != null) {
                n.put("preparationNote", line.preparationNote());
            } else {
                n.putNull("preparationNote");
            }
            ArrayNode alts = n.putArray("alternates");
            for (String a : line.alternates()) {
                alts.add(a);
            }
        }
        return arr;
    }

    private ArrayNode stepArray(List<RecipeStepDto> steps) {
        ArrayNode arr = objectMapper.createArrayNode();
        for (RecipeStepDto s : steps) {
            ObjectNode n = arr.addObject();
            if (s.id() != null) {
                n.put("id", s.id());
            } else {
                n.putNull("id");
            }
            n.put("sortOrder", s.sortOrder());
            n.put("text", s.text());
            if (s.timerSeconds() != null) {
                n.put("timerSeconds", s.timerSeconds());
            } else {
                n.putNull("timerSeconds");
            }
            if (s.linkUrl() != null) {
                n.put("linkUrl", s.linkUrl());
            } else {
                n.putNull("linkUrl");
            }
        }
        return arr;
    }

    private List<IngredientLineDto> parseIngredients(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<IngredientLineDto> out = new ArrayList<>();
        for (Iterator<JsonNode> it = node.elements(); it.hasNext(); ) {
            JsonNode n = it.next();
            if (!n.path("ingredientText").isTextual()) {
                continue;
            }
            String text = n.path("ingredientText").asText();
            if (text.isBlank()) {
                continue;
            }
            int order = n.path("sortOrder").asInt(out.size() + 1);
            String id = n.path("id").isTextual() ? n.path("id").asText() : null;
            BigDecimal amt = n.path("amountNumeric").isNumber()
                    ? n.path("amountNumeric").decimalValue()
                    : null;
            String unit = n.path("unit").isTextual() ? n.path("unit").asText() : null;
            String prep = n.path("preparationNote").isTextual() ? n.path("preparationNote").asText() : null;
            List<String> alts = new ArrayList<>();
            JsonNode an = n.path("alternates");
            if (an.isArray()) {
                for (JsonNode a : an) {
                    if (a.isTextual()) {
                        alts.add(a.asText());
                    }
                }
            }
            out.add(new IngredientLineDto(id, order, amt, unit, text, prep, alts));
        }
        return out;
    }

    private List<RecipeStepDto> parseSteps(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<RecipeStepDto> out = new ArrayList<>();
        for (Iterator<JsonNode> it = node.elements(); it.hasNext(); ) {
            JsonNode n = it.next();
            if (!n.path("text").isTextual()) {
                continue;
            }
            String text = n.path("text").asText();
            if (text.isBlank()) {
                continue;
            }
            int order = n.path("sortOrder").asInt(out.size() + 1);
            String id = n.path("id").isTextual() ? n.path("id").asText() : null;
            Integer timer = n.path("timerSeconds").isNumber()
                    ? n.path("timerSeconds").asInt()
                    : null;
            String link = n.path("linkUrl").isTextual() ? n.path("linkUrl").asText() : null;
            out.add(new RecipeStepDto(id, order, text, timer, link));
        }
        return out;
    }
}
