package com.cookingcompanion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Fails CI when Springdoc runtime OpenAPI diverges from the committed contract at repo
 * {@code openapi/openapi.yaml} (mobile + docs source of truth).
 *
 * <p>We compare normalized {@code paths} only: stable routing + operation wiring (methods, params,
 * operationIds, media types, schema {@code $ref}s). Prose and extension keys are stripped; wildcard
 * produce media types in the doc JSON are normalized to {@code application/json} to match Springdoc.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiDriftIntegrationTest extends AbstractImportApiIntegrationTest {

    private static final Set<String> IGNORED_KEYS = Set.of(
            "description", "summary", "title", "example", "examples", "externalDocs");

    private static final ObjectMapper YAML_MAPPER = new ObjectMapper(new YAMLFactory());
    private static final ObjectMapper JSON_MAPPER = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @Test
    void committedOpenApiMatchesSpringdocExport() throws Exception {
        Path specPath = Path.of("..", "openapi", "openapi.yaml").toAbsolutePath().normalize();
        assertThat(specPath)
                .as("openapi/openapi.yaml must exist relative to backend module (run Gradle from backend/)")
                .exists();

        JsonNode committed =
                normalizePathsTree(YAML_MAPPER.readTree(specPath.toFile()).path("paths"));

        MvcResult docs = mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn();
        JsonNode runtime =
                normalizePathsTree(JSON_MAPPER.readTree(docs.getResponse().getContentAsString()).path("paths"));

        assertThat(runtime)
                .as("HTTP paths/operations differ — update openapi/openapi.yaml or controllers to match")
                .isEqualTo(committed);
    }

    private static JsonNode normalizePathsTree(JsonNode paths) {
        return sortObjectKeysRecursively(
                normalizeMediaTypes(deepStripIgnored(paths.deepCopy())));
    }

    /** Map Springdoc's wildcard JSON media key to {@code application/json} where needed. */
    private static JsonNode normalizeMediaTypes(JsonNode node) {
        if (node == null || node.isNull()) {
            return node;
        }
        if (node.isObject()) {
            ObjectNode o = (ObjectNode) node;
            if (o.has("*/*")) {
                JsonNode star = o.get("*/*");
                o.remove("*/*");
                if (!o.has("application/json")) {
                    o.set("application/json", star);
                }
            }
            Iterator<String> names = o.fieldNames();
            List<String> keys = new ArrayList<>();
            names.forEachRemaining(keys::add);
            for (String k : keys) {
                normalizeMediaTypes(o.get(k));
            }
            return o;
        }
        if (node.isArray()) {
            for (JsonNode n : node) {
                normalizeMediaTypes(n);
            }
        }
        return node;
    }

    private static JsonNode deepStripIgnored(JsonNode node) {
        if (node == null || node.isNull()) {
            return node;
        }
        if (node.isObject()) {
            ObjectNode in = (ObjectNode) node;
            ObjectNode out = JsonNodeFactory.instance.objectNode();
            Iterator<String> it = in.fieldNames();
            while (it.hasNext()) {
                String k = it.next();
                if (IGNORED_KEYS.contains(k) || k.startsWith("x-")) {
                    continue;
                }
                out.set(k, deepStripIgnored(in.get(k)));
            }
            return out;
        }
        if (node.isArray()) {
            ArrayNode in = (ArrayNode) node;
            ArrayNode out = JsonNodeFactory.instance.arrayNode();
            for (JsonNode n : in) {
                out.add(deepStripIgnored(n));
            }
            return out;
        }
        return node;
    }

    private static JsonNode sortObjectKeysRecursively(JsonNode node) {
        if (node == null || node.isNull()) {
            return node;
        }
        if (node.isObject()) {
            ObjectNode in = (ObjectNode) node;
            List<String> keys = new ArrayList<>();
            in.fieldNames().forEachRemaining(keys::add);
            keys.sort(String::compareTo);
            ObjectNode out = JsonNodeFactory.instance.objectNode();
            for (String k : keys) {
                out.set(k, sortObjectKeysRecursively(in.get(k)));
            }
            return out;
        }
        if (node.isArray()) {
            ArrayNode in = (ArrayNode) node;
            ArrayNode out = JsonNodeFactory.instance.arrayNode();
            for (JsonNode n : in) {
                out.add(sortObjectKeysRecursively(n));
            }
            return out;
        }
        return node;
    }
}
