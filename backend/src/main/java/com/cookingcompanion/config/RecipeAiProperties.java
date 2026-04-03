package com.cookingcompanion.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.recipe-ai")
public class RecipeAiProperties {

    /**
     * When false, {@code useGenerative} on apply-profile returns 403 and flags report disabled.
     */
    private boolean generativeAdjustmentsEnabled = false;

    /** OpenAI API key; empty means generative path returns 503 when requested. */
    private String openaiApiKey = "";

    private String openaiBaseUrl = "https://api.openai.com";

    private String openaiModel = "gpt-4o-mini";

    public boolean isGenerativeAdjustmentsEnabled() {
        return generativeAdjustmentsEnabled;
    }

    public void setGenerativeAdjustmentsEnabled(boolean generativeAdjustmentsEnabled) {
        this.generativeAdjustmentsEnabled = generativeAdjustmentsEnabled;
    }

    public String getOpenaiApiKey() {
        return openaiApiKey;
    }

    public void setOpenaiApiKey(String openaiApiKey) {
        this.openaiApiKey = openaiApiKey;
    }

    public String getOpenaiBaseUrl() {
        return openaiBaseUrl;
    }

    public void setOpenaiBaseUrl(String openaiBaseUrl) {
        this.openaiBaseUrl = openaiBaseUrl;
    }

    public String getOpenaiModel() {
        return openaiModel;
    }

    public void setOpenaiModel(String openaiModel) {
        this.openaiModel = openaiModel;
    }
}
