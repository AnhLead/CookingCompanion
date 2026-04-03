package com.cookingcompanion.web;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String problemType;
    private final String problemDetailExtensionKey;
    private final String problemDetailExtensionValue;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
        this.problemType = null;
        this.problemDetailExtensionKey = null;
        this.problemDetailExtensionValue = null;
    }

    public ApiException(
            HttpStatus status,
            String message,
            String extensionKey,
            String extensionValue) {
        super(message);
        this.status = status;
        this.problemType = "about:blank";
        this.problemDetailExtensionKey = extensionKey;
        this.problemDetailExtensionValue = extensionValue;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getProblemType() {
        return problemType;
    }

    public String getProblemDetailExtensionKey() {
        return problemDetailExtensionKey;
    }

    public String getProblemDetailExtensionValue() {
        return problemDetailExtensionValue;
    }
}
