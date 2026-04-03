package com.cookingcompanion.service.importing;

import com.cookingcompanion.api.dto.CreateVariantRequest;
import com.cookingcompanion.api.dto.ImportCommitRequest;
import com.cookingcompanion.api.dto.ImportPreviewRequest;
import com.cookingcompanion.api.dto.IngredientLineDto;
import com.cookingcompanion.api.dto.RecipeDraftResponse;
import com.cookingcompanion.api.dto.RecipeStepDto;
import com.cookingcompanion.domain.Dish;
import com.cookingcompanion.domain.RecipeVariant;
import com.cookingcompanion.domain.Source;
import com.cookingcompanion.domain.SourceType;
import com.cookingcompanion.repo.DishRepository;
import com.cookingcompanion.repo.SourceRepository;
import com.cookingcompanion.service.mapping.VariantPersistence;
import com.cookingcompanion.web.ApiException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecipeImportService {

    private static final int MAX_BYTES = 2_000_000;

    private final HtmlRecipeParser parser;
    private final DishRepository dishRepository;
    private final SourceRepository sourceRepository;
    private final VariantPersistence variantPersistence;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public RecipeImportService(
            HtmlRecipeParser parser,
            DishRepository dishRepository,
            SourceRepository sourceRepository,
            VariantPersistence variantPersistence) {
        this.parser = parser;
        this.dishRepository = dishRepository;
        this.sourceRepository = sourceRepository;
        this.variantPersistence = variantPersistence;
    }

    public RecipeDraftResponse preview(ImportPreviewRequest req) {
        if ((req.url() == null || req.url().isBlank()) && (req.html() == null || req.html().isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "url or html is required");
        }
        String html;
        String resolvedUrl = null;
        if (req.html() != null && !req.html().isBlank()) {
            html = req.html();
            resolvedUrl = blankToNull(req.url());
        } else {
            resolvedUrl = req.url().trim();
            validateHttpUrl(resolvedUrl);
            html = fetchUrl(resolvedUrl);
        }
        ParsedRecipe parsed = parser.parse(html, resolvedUrl);
        CreateVariantRequest draft = toDraft(parsed, resolvedUrl);
        return new RecipeDraftResponse(
                parsed.suggestedDishName(),
                parsed.confidence(),
                parsed.warnings(),
                parsed.heroImageUrl(),
                parsed.parseMethod(),
                draft);
    }

    @Transactional
    public VariantPersistence.PersistedImport commit(ImportCommitRequest req) {
        String sourceUrl = blankToNull(req.sourceUrl());
        UUID owner = req.ownerUserId();
        if (sourceUrl != null && owner != null) {
            Optional<Source> existing = sourceRepository.findByOwnerUserIdAndUrl(owner, sourceUrl);
            if (existing.isPresent()) {
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "Source URL already imported for this owner",
                        "existingSourceId",
                        existing.get().getId().toString());
            }
        } else if (sourceUrl != null && owner == null) {
            Optional<Source> anon = sourceRepository.findByUrlAndOwnerUserIdIsNull(sourceUrl);
            if (anon.isPresent()) {
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "Source URL already imported (anonymous owner)",
                        "existingSourceId",
                        anon.get().getId().toString());
            }
        }

        Dish dish = new Dish();
        dish.setName(req.dishName().trim());
        dish.setTags(new ArrayList<>(req.dishTags()));
        dish.setHeroImageUrl(blankToNull(req.heroImageUrl()));
        dish.setOwnerUserId(owner);
        dish = dishRepository.save(dish);

        Source source = null;
        if (sourceUrl != null) {
            source = new Source();
            source.setType(SourceType.web);
            source.setUrl(sourceUrl);
            source.setRawPayload(null);
            source.setAttribution(null);
            source.setOwnerUserId(owner);
            source = sourceRepository.save(source);
        }

        RecipeVariant variant = variantPersistence.createVariant(
                dish,
                req.variant(),
                source,
                owner,
                true);

        return new VariantPersistence.PersistedImport(dish.getId(), variant.getId());
    }

    private CreateVariantRequest toDraft(ParsedRecipe parsed, String url) {
        var ingredients = new ArrayList<IngredientLineDto>();
        int i = 0;
        for (String line : parsed.ingredientLines()) {
            ingredients.add(new IngredientLineDto(null, i++, null, null, line, null, List.of()));
        }
        var steps = new ArrayList<RecipeStepDto>();
        int s = 0;
        for (String st : parsed.stepTexts()) {
            steps.add(new RecipeStepDto(null, s++, st, null, null));
        }
        return new CreateVariantRequest(
                parsed.title(),
                parsed.yields(),
                parsed.prepTimeMin(),
                parsed.cookTimeMin(),
                true,
                null,
                null,
                ingredients,
                steps);
    }

    private String fetchUrl(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(20))
                    .header(
                            "User-Agent",
                            "CookingCompanionBot/0.1 (+https://github.com/AnhLead/CookingCompanion)")
                    .GET()
                    .build();
            HttpResponse<byte[]> res = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (res.statusCode() < 200 || res.statusCode() >= 300) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "Fetch failed: HTTP " + res.statusCode());
            }
            byte[] body = res.body();
            if (body.length > MAX_BYTES) {
                throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Response exceeds size limit");
            }
            return new String(body, StandardCharsets.UTF_8);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not fetch URL: " + e.getMessage());
        }
    }

    private static void validateHttpUrl(String url) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid URL");
        }
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only http(s) URLs are allowed");
        }
    }

    private static String blankToNull(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim();
    }
}
