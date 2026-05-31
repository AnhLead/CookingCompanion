package com.cookingcompanion.config;

import java.util.UUID;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth")
public class AppAuthProperties {

    private UUID demoUserId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");

    private String demoEmail = "dev@example.com";

    public UUID getDemoUserId() {
        return demoUserId;
    }

    public void setDemoUserId(UUID demoUserId) {
        this.demoUserId = demoUserId;
    }

    public String getDemoEmail() {
        return demoEmail;
    }

    public void setDemoEmail(String demoEmail) {
        this.demoEmail = demoEmail;
    }
}
