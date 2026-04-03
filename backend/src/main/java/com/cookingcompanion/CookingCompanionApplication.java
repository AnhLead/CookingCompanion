package com.cookingcompanion;

import com.cookingcompanion.config.AppSecurityProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppSecurityProperties.class)
public class CookingCompanionApplication {

    public static void main(String[] args) {
        SpringApplication.run(CookingCompanionApplication.class, args);
    }
}
