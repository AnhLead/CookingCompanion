package com.cookingcompanion.api;

import io.swagger.v3.oas.annotations.Hidden;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Root-level ops endpoints for load balancers and mobile sanity checks. Actuator remains under
 * {@code /actuator} (readiness/liveness, etc.).
 */
@Hidden
@RestController
public class OperationalController {

    private final BuildProperties buildProperties;

    public OperationalController(ObjectProvider<BuildProperties> buildProperties) {
        this.buildProperties = buildProperties.getIfAvailable();
    }

    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }

    @GetMapping(value = "/version", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> version() {
        Map<String, Object> body = new LinkedHashMap<>();
        if (buildProperties != null) {
            body.put("name", buildProperties.getName());
            body.put("version", buildProperties.getVersion());
            body.put("time", buildProperties.getTime() != null ? buildProperties.getTime().toString() : null);
        } else {
            body.put("version", "unknown");
        }
        return body;
    }
}
