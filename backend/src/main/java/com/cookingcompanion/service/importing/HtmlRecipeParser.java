package com.cookingcompanion.service.importing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

@Component
public class HtmlRecipeParser {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public ParsedRecipe parse(String html, String sourceUrl) {
        var warnings = new ArrayList<String>();
        Document doc = Jsoup.parse(html);
        ParsedRecipe fromLd = tryJsonLd(doc, warnings);
        if (fromLd != null) {
            return fromLd;
        }
        return heuristicParse(doc, sourceUrl, warnings);
    }

    private ParsedRecipe tryJsonLd(Document doc, List<String> warnings) {
        for (Element script : doc.select("script[type=application/ld+json]")) {
            String data = script.data();
            if (data == null || data.isBlank()) {
                continue;
            }
            try {
                JsonNode root = objectMapper.readTree(data);
                JsonNode recipe = findRecipeNode(root);
                if (recipe == null) {
                    continue;
                }
                String name = text(recipe, "name");
                var ingredients = new ArrayList<String>();
                JsonNode ing = recipe.get("recipeIngredient");
                if (ing != null && ing.isArray()) {
                    for (JsonNode n : ing) {
                        if (n.isTextual()) {
                            ingredients.add(n.asText().trim());
                        }
                    }
                }
                var steps = new ArrayList<String>();
                JsonNode instructions = recipe.get("recipeInstructions");
                if (instructions != null && instructions.isArray()) {
                    for (JsonNode step : instructions) {
                        if (step.isTextual()) {
                            steps.add(step.asText().trim());
                        } else if (step.isObject()) {
                            String t = text(step, "text");
                            if (t != null) {
                                steps.add(t.trim());
                            }
                        }
                    }
                }
                if (name == null || name.isBlank()) {
                    warnings.add("JSON-LD Recipe missing name; falling back would lose structure — using heuristic title if needed");
                    continue;
                }
                double confidence = 0.85;
                if (ingredients.isEmpty()) {
                    confidence -= 0.25;
                    warnings.add("JSON-LD Recipe had no recipeIngredient array entries");
                }
                if (steps.isEmpty()) {
                    confidence -= 0.15;
                    warnings.add("JSON-LD Recipe had no usable recipeInstructions");
                }
                String dish = shortDishName(name);
                return new ParsedRecipe(name, dish, ingredients, steps, confidence, warnings);
            } catch (Exception e) {
                warnings.add("Skipped invalid JSON-LD block: " + e.getMessage());
            }
        }
        return null;
    }

    private JsonNode findRecipeNode(JsonNode root) {
        if (root == null) {
            return null;
        }
        if (root.isObject() && isRecipe(root)) {
            return root;
        }
        if (root.isArray()) {
            for (JsonNode n : root) {
                JsonNode found = findRecipeNode(n);
                if (found != null) {
                    return found;
                }
            }
        }
        if (root.isObject()) {
            JsonNode graph = root.get("@graph");
            if (graph != null && graph.isArray()) {
                for (JsonNode n : graph) {
                    if (isRecipe(n)) {
                        return n;
                    }
                }
            }
        }
        return null;
    }

    private boolean isRecipe(JsonNode node) {
        if (node == null || !node.isObject()) {
            return false;
        }
        JsonNode type = node.get("@type");
        if (type == null) {
            return false;
        }
        if (type.isTextual()) {
            return "Recipe".equalsIgnoreCase(type.asText());
        }
        if (type.isArray()) {
            for (JsonNode t : type) {
                if (t.isTextual() && "Recipe".equalsIgnoreCase(t.asText())) {
                    return true;
                }
            }
        }
        return false;
    }

    private String text(JsonNode obj, String field) {
        JsonNode n = obj.get(field);
        return n != null && n.isTextual() ? n.asText() : null;
    }

    private ParsedRecipe heuristicParse(Document doc, String sourceUrl, List<String> warnings) {
        String title = firstNonBlank(
                textOrNull(doc.selectFirst("h1")),
                textOrNull(doc.selectFirst("[itemprop=name]")),
                doc.title());
        if (title == null || title.isBlank()) {
            title = "Imported recipe";
            warnings.add("Could not detect title; using placeholder");
        }
        var ingredients = new ArrayList<String>();
        for (Element li : doc.select(".ingredients li, [itemprop=recipeIngredient], .wprm-recipe-ingredient")) {
            String t = li.text().trim();
            if (!t.isEmpty()) {
                ingredients.add(t);
            }
        }
        var steps = new ArrayList<String>();
        for (Element step : doc.select(".instructions li, [itemprop=recipeInstructions] li, .wprm-recipe-instruction")) {
            String t = step.text().trim();
            if (!t.isEmpty()) {
                steps.add(t);
            }
        }
        double confidence = 0.45;
        if (ingredients.isEmpty()) {
            confidence -= 0.2;
            warnings.add("Heuristic parse found no ingredient list");
        }
        if (steps.isEmpty()) {
            confidence -= 0.1;
            warnings.add("Heuristic parse found no steps");
        }
        if (sourceUrl != null) {
            warnings.add("Parsed using DOM heuristics; verify before commit");
        }
        String dish = shortDishName(title);
        return new ParsedRecipe(title, dish, ingredients, steps, Math.max(0, Math.min(1, confidence)), warnings);
    }

    private String shortDishName(String title) {
        String t = title.trim();
        int pipe = t.indexOf('|');
        if (pipe > 0) {
            t = t.substring(0, pipe).trim();
        }
        int dash = t.indexOf(" - ");
        if (dash > 0) {
            t = t.substring(0, dash).trim();
        }
        return t;
    }

    private String textOrNull(Element el) {
        return el == null ? null : el.text();
    }

    private String firstNonBlank(String... vals) {
        if (vals == null) {
            return null;
        }
        for (String v : vals) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }

    public boolean looksLikeRecipeHtml(String html) {
        if (html == null) {
            return false;
        }
        String h = html.toLowerCase(Locale.ROOT);
        return h.contains("recipeingredient")
                || h.contains("schema.org/recipe")
                || h.contains("wprm-recipe")
                || h.contains("ingredients");
    }
}
