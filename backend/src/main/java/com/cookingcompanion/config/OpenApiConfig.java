package com.cookingcompanion.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI cookingCompanionOpenApi() {
        return new OpenAPI()
                .info(
                        new Info()
                                .title("Cooking Companion API")
                                .description(
                                        "MVP REST for dishes, recipe variants, import preview/commit, and parameter profiles. Version prefix: `/api/v1`.")
                                .version("v1"));
    }
}
