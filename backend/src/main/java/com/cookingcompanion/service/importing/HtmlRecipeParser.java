package com.cookingcompanion.service.importing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.Duration;
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
        Document doc = Jsoup.parse(html, sourceUrl == null ? "" : sourceUrl);
        ParsedRecipe fromLd = tryJsonLd(doc, sourceUrl, warnings);
        if (fromLd != null) {
            return fromLd;
        }
        ParsedRecipe fromMicro = tryMicrodata(doc, sourceUrl, warnings);
        if (fromMicro != null) {
            return fromMicro;
        }
        return heuristicParse(doc, sourceUrl, warnings);
    }

    private ParsedRecipe tryJsonLd(Document doc, String sourceUrl, List<String> warnings) {
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
                collectIngredients(recipe.get("recipeIngredient"), ingredients);
                var steps = new ArrayList<String>();
                collectInstructionSteps(recipe.get("recipeInstructions"), steps, warnings);
                if (name == null || name.isBlank()) {
                    warnings.add("JSON-LD Recipe missing name; falling back would lose structure — using heuristic title if needed");
                    continue;
                }
                String hero = sanitizeHttpUrl(absolutize(sourceUrl, extractImageUrl(recipe.get("image"))));
                String yields = flattenYield(recipe.get("recipeYield"));
                Integer prep = durationToMinutes(text(recipe, "prepTime"));
                Integer cook = durationToMinutes(text(recipe, "cookTime"));
                double confidence = 0.88;
                if (ingredients.isEmpty()) {
                    confidence -= 0.25;
                    warnings.add("JSON-LD Recipe had no recipeIngredient array entries");
                }
                if (steps.isEmpty()) {
                    confidence -= 0.15;
                    warnings.add("JSON-LD Recipe had no usable recipeInstructions");
                }
                if (hero != null) {
                    confidence += 0.02;
                }
                if (yields != null) {
                    confidence += 0.02;
                }
                String dish = shortDishName(name);
                return new ParsedRecipe(
                        name,
                        dish,
                        ingredients,
                        steps,
                        Math.max(0, Math.min(1, confidence)),
                        warnings,
                        hero,
                        yields,
                        prep,
                        cook,
                        "json_ld");
            } catch (Exception e) {
                warnings.add("Skipped invalid JSON-LD block: " + e.getMessage());
            }
        }
        return null;
    }

    private void collectIngredients(JsonNode node, List<String> out) {
        if (node == null) {
            return;
        }
        if (node.isTextual()) {
            String t = node.asText().trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
            return;
        }
        if (node.isArray()) {
            for (JsonNode n : node) {
                collectIngredients(n, out);
            }
        }
    }

    private void collectInstructionSteps(JsonNode instructions, List<String> steps, List<String> warnings) {
        if (instructions == null || instructions.isNull()) {
            return;
        }
        if (instructions.isTextual()) {
            steps.addAll(splitInstructionText(instructions.asText()));
            return;
        }
        if (instructions.isArray()) {
            for (JsonNode step : instructions) {
                if (step == null || step.isNull()) {
                    continue;
                }
                if (step.isTextual()) {
                    String t = step.asText().trim();
                    if (!t.isEmpty()) {
                        steps.add(t);
                    }
                } else if (step.isObject()) {
                    String type = typeName(step.get("@type"));
                    if ("HowToSection".equalsIgnoreCase(type)) {
                        collectInstructionSteps(step.get("itemListElement"), steps, warnings);
                        continue;
                    }
                    if ("HowToStep".equalsIgnoreCase(type) || step.has("text")) {
                        String t = text(step, "text");
                        if (t != null && !t.isBlank()) {
                            steps.add(t.trim());
                        }
                        continue;
                    }
                    JsonNode itemList = step.get("itemListElement");
                    if (itemList != null) {
                        collectInstructionSteps(itemList, steps, warnings);
                    }
                }
            }
            return;
        }
        if (instructions.isObject()) {
            String type = typeName(instructions.get("@type"));
            if ("HowTo".equalsIgnoreCase(type) || "Recipe".equalsIgnoreCase(type)) {
                collectInstructionSteps(instructions.get("step"), steps, warnings);
            }
        }
    }

    private static String typeName(JsonNode typeNode) {
        if (typeNode == null || typeNode.isNull()) {
            return null;
        }
        if (typeNode.isTextual()) {
            return typeNode.asText();
        }
        if (typeNode.isArray() && typeNode.size() > 0 && typeNode.get(0).isTextual()) {
            return typeNode.get(0).asText();
        }
        return null;
    }

    private static List<String> splitInstructionText(String text) {
        var out = new ArrayList<String>();
        if (text == null) {
            return out;
        }
        for (String line : text.split("\\R+")) {
            String t = line.trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }

    private static String extractImageUrl(JsonNode image) {
        if (image == null || image.isNull()) {
            return null;
        }
        if (image.isTextual()) {
            return image.asText().trim();
        }
        if (image.isArray() && image.size() > 0) {
            return extractImageUrl(image.get(0));
        }
        if (image.isObject()) {
            String u = text(image, "url");
            if (u != null) {
                return u.trim();
            }
            JsonNode content = image.get("contentUrl");
            if (content != null && content.isTextual()) {
                return content.asText().trim();
            }
        }
        return null;
    }

    private static String flattenYield(JsonNode yieldNode) {
        if (yieldNode == null || yieldNode.isNull()) {
            return null;
        }
        if (yieldNode.isTextual()) {
            String t = yieldNode.asText().trim();
            return t.isEmpty() ? null : t;
        }
        if (yieldNode.isArray()) {
            var parts = new ArrayList<String>();
            for (JsonNode n : yieldNode) {
                if (n != null && n.isTextual()) {
                    String t = n.asText().trim();
                    if (!t.isEmpty()) {
                        parts.add(t);
                    }
                }
            }
            return parts.isEmpty() ? null : String.join(", ", parts);
        }
        if (yieldNode.isObject()) {
            return text(yieldNode, "name");
        }
        return null;
    }

    private static Integer durationToMinutes(String iso) {
        if (iso == null || iso.isBlank()) {
            return null;
        }
        try {
            return (int) Duration.parse(iso.trim()).toMinutes();
        } catch (Exception e) {
            return null;
        }
    }

    private static String absolutize(String base, String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String u = url.trim();
        if (u.startsWith("http://") || u.startsWith("https://")) {
            return u;
        }
        if (base == null || base.isBlank()) {
            return u;
        }
        try {
            return URI.create(base).resolve(u).normalize().toString();
        } catch (Exception e) {
            return u;
        }
    }

    private static String sanitizeHttpUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String u = url.trim();
        if (u.startsWith("http://") || u.startsWith("https://")) {
            return u;
        }
        return null;
    }

    private ParsedRecipe tryMicrodata(Document doc, String sourceUrl, List<String> warnings) {
        Element scope = doc.selectFirst("[itemscope][itemtype*=schema.org/Recipe], [itemscope][itemtype*=schema.org/recipe]");
        if (scope == null) {
            return null;
        }
        String name = firstNonBlank(
                microProp(scope, "name"),
                textOrNull(scope.selectFirst("[itemprop=name]")));
        var ingredients = new ArrayList<String>();
        for (Element el : scope.select("[itemprop=recipeIngredient]")) {
            String t = el.text().trim();
            if (!t.isEmpty()) {
                ingredients.add(t);
            }
        }
        var steps = new ArrayList<String>();
        Element instrRoot = scope.selectFirst("[itemprop=recipeInstructions]");
        if (instrRoot != null) {
            for (Element li : instrRoot.select("li")) {
                String t = li.text().trim();
                if (!t.isEmpty()) {
                    steps.add(t);
                }
            }
            if (steps.isEmpty()) {
                String block = instrRoot.text().trim();
                if (!block.isEmpty()) {
                    steps.addAll(splitInstructionText(block));
                }
            }
        }
        if (name == null || name.isBlank()) {
            warnings.add("Microdata Recipe missing name");
            return null;
        }
        String rawImg = null;
        Element imgEl = scope.selectFirst("[itemprop=image]");
        if (imgEl != null) {
            rawImg = imgEl.hasAttr("src") ? imgEl.absUrl("src") : imgEl.hasAttr("href") ? imgEl.absUrl("href") : null;
            if (rawImg == null || rawImg.isBlank()) {
                rawImg = imgEl.text().trim();
            }
        }
        String hero = sanitizeHttpUrl(absolutize(sourceUrl, rawImg));
        double confidence = 0.72;
        if (ingredients.isEmpty()) {
            confidence -= 0.2;
            warnings.add("Microdata had no recipeIngredient entries");
        }
        if (steps.isEmpty()) {
            confidence -= 0.12;
            warnings.add("Microdata had no recipeInstructions steps");
        }
        String dish = shortDishName(name);
        return new ParsedRecipe(
                name,
                dish,
                ingredients,
                steps,
                Math.max(0, Math.min(1, confidence)),
                warnings,
                hero,
                null,
                null,
                null,
                "microdata");
    }

    private static String microProp(Element scope, String prop) {
        Element el = scope.selectFirst("[itemprop=" + prop + "]");
        return el == null ? null : el.text().trim();
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

    private static String text(JsonNode obj, String field) {
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
        String hero = null;
        Element og = doc.selectFirst("meta[property=og:image]");
        if (og == null) {
            og = doc.selectFirst("meta[name=twitter:image], meta[name=twitter:image:src]");
        }
        if (og != null) {
            String content = og.attr("content");
            if (!content.isBlank()) {
                hero = sanitizeHttpUrl(absolutize(sourceUrl, content.trim()));
            }
        }
        return new ParsedRecipe(
                title,
                dish,
                ingredients,
                steps,
                Math.max(0, Math.min(1, confidence)),
                warnings,
                hero,
                null,
                null,
                null,
                "heuristic");
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
