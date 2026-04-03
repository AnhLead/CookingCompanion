package com.cookingcompanion.service.importing;

import com.cookingcompanion.api.dto.CreateVariantRequest;
import com.cookingcompanion.api.dto.ImportCommitRequest;
import com.cookingcompanion.api.dto.ImportPreviewRequest;
import com.cookingcompanion.api.dto.IngredientLineDto;
import com.cookingcompanion.api.dto.RecipeDraftResponse;
import com.cookingcompanion.api.dto.RecipeStepDto;
import com.cookingcompanion.domain.Dish;
import com.cookingcompanion.domain.ImportCommitIdempotency;
import com.cookingcompanion.domain.ImportPreview;
import com.cookingcompanion.domain.RecipeVariant;
import com.cookingcompanion.domain.Source;
import com.cookingcompanion.domain.SourceType;
import com.cookingcompanion.repo.DishRepository;
import com.cookingcompanion.repo.ImportCommitIdempotencyRepository;
import com.cookingcompanion.repo.ImportPreviewRepository;
import com.cookingcompanion.repo.SourceRepository;
import com.cookingcompanion.service.mapping.VariantPersistence;
import com.cookingcompanion.web.ApiException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
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
    private static final Duration PREVIEW_TTL = Duration.ofHours(24);

    private final HtmlRecipeParser parser;
    private final DishRepository dishRepository;
    private final SourceRepository sourceRepository;
    private final ImportPreviewRepository importPreviewRepository;
    private final ImportCommitIdempotencyRepository importCommitIdempotencyRepository;
    private final VariantPersistence variantPersistence;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public RecipeImportService(
            HtmlRecipeParser parser,
            DishRepository dishRepository,
            SourceRepository sourceRepository,
            ImportPreviewRepository importPreviewRepository,
            ImportCommitIdempotencyRepository importCommitIdempotencyRepository,
            VariantPersistence variantPersistence,
            ObjectMapper objectMapper) {
        this.parser = parser;
        this.dishRepository = dishRepository;
        this.sourceRepository = sourceRepository;
        this.importPreviewRepository = importPreviewRepository;
        this.importCommitIdempotencyRepository = importCommitIdempotencyRepository;
        this.variantPersistence = variantPersistence;
        this.objectMapper = objectMapper;
    }

    @Transactional
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
        RecipeDraftResponse storable = new RecipeDraftResponse(
                parsed.suggestedDishName(),
                parsed.confidence(),
                parsed.warnings(),
                parsed.heroImageUrl(),
                parsed.parseMethod(),
                null,
                draft);
        String json;
        try {
            json = objectMapper.writeValueAsString(storable);
        } catch (JsonProcessingException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not serialize preview");
        }
        Instant now = Instant.now();
        ImportPreview row = new ImportPreview();
        row.setId(UUID.randomUUID());
        row.setCreatedAt(now);
        row.setExpiresAt(now.plus(PREVIEW_TTL));
        row.setOwnerUserId(null);
        row.setSourceUrl(resolvedUrl);
        row.setPayloadJson(json);
        importPreviewRepository.save(row);
        return new RecipeDraftResponse(
                storable.suggestedDishName(),
                storable.confidence(),
                storable.warnings(),
                storable.heroImageUrl(),
                storable.parseMethod(),
                row.getId(),
                storable.variantDraft());
    }

    @Transactional
    public VariantPersistence.PersistedImport commit(ImportCommitRequest req, String idempotencyKeyHeader) {
        String idemKey = normalizeIdempotencyKey(idempotencyKeyHeader);
        if (idemKey != null) {
            Optional<ImportCommitIdempotency> existing = importCommitIdempotencyRepository.findByIdempotencyKey(idemKey);
            if (existing.isPresent()) {
                return new VariantPersistence.PersistedImport(null, existing.get().getVariantId());
            }
        }

        ImportCommitRequest effective = req;
        ImportPreview previewRow = null;
        if (req.previewId() != null) {
            previewRow = importPreviewRepository
                    .findById(req.previewId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "preview not found"));
            if (previewRow.getConsumedAt() != null) {
                throw new ApiException(HttpStatus.CONFLICT, "preview already committed");
            }
            if (previewRow.getExpiresAt().isBefore(Instant.now())) {
                throw new ApiException(HttpStatus.GONE, "preview expired");
            }
            RecipeDraftResponse draft;
            try {
                draft = objectMapper.readValue(previewRow.getPayloadJson(), RecipeDraftResponse.class);
            } catch (Exception e) {
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "stored preview is corrupt");
            }
            effective = mergeCommit(req, draft, previewRow);
        }

        if (effective.dishName() == null || effective.dishName().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "dishName is required unless previewId is set");
        }
        if (effective.variant() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "variant is required unless previewId is set");
        }

        VariantPersistence.PersistedImport ids = commitNewImport(effective);

        if (previewRow != null) {
            previewRow.setConsumedAt(Instant.now());
            importPreviewRepository.save(previewRow);
        }
        if (idemKey != null) {
            ImportCommitIdempotency idem = new ImportCommitIdempotency();
            idem.setId(UUID.randomUUID());
            idem.setIdempotencyKey(idemKey);
            idem.setVariantId(ids.variantId());
            idem.setCreatedAt(Instant.now());
            importCommitIdempotencyRepository.save(idem);
        }
        return ids;
    }

    private static ImportCommitRequest mergeCommit(
            ImportCommitRequest req, RecipeDraftResponse draft, ImportPreview previewRow) {
        String dishName = req.dishName() != null && !req.dishName().isBlank()
                ? req.dishName().trim()
                : draft.suggestedDishName();
        String hero = req.heroImageUrl() != null && !req.heroImageUrl().isBlank()
                ? req.heroImageUrl()
                : draft.heroImageUrl();
        CreateVariantRequest variant = req.variant() != null ? req.variant() : draft.variantDraft();
        String sourceUrl = req.sourceUrl() != null && !req.sourceUrl().isBlank()
                ? req.sourceUrl().trim()
                : previewRow.getSourceUrl();
        return new ImportCommitRequest(null, dishName, req.dishTags(), hero, req.ownerUserId(), sourceUrl, variant);
    }

    private VariantPersistence.PersistedImport commitNewImport(ImportCommitRequest req) {
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

    private static String normalizeIdempotencyKey(String key) {
        if (key == null) {
            return null;
        }
        String t = key.trim();
        if (t.isEmpty()) {
            return null;
        }
        if (t.length() > 256) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Idempotency-Key exceeds 256 characters");
        }
        return t;
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
