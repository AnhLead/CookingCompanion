package com.cookingcompanion.web;

import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class RestExceptionHandler {

    @ExceptionHandler(RequestNotPermitted.class)
    public ResponseEntity<ProblemDetail> rateLimit(RequestNotPermitted ex) {
        HttpStatus st = HttpStatus.TOO_MANY_REQUESTS;
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(st, "Too many requests; try again later.");
        pd.setTitle(st.getReasonPhrase());
        return ResponseEntity.status(st).body(pd);
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ProblemDetail> api(ApiException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
        pd.setTitle(ex.getStatus().getReasonPhrase());
        if (ex.getProblemType() != null) {
            pd.setType(URI.create(ex.getProblemType()));
        }
        if (ex.getProblemDetailExtensionKey() != null) {
            pd.setProperty(ex.getProblemDetailExtensionKey(), ex.getProblemDetailExtensionValue());
        }
        return ResponseEntity.status(ex.getStatus()).body(pd);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> validation(MethodArgumentNotValidException ex) {
        HttpStatus st = HttpStatus.BAD_REQUEST;
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(st, "Validation failed");
        Map<String, String> fields = new HashMap<>();
        ex.getBindingResult()
                .getFieldErrors()
                .forEach(fe -> fields.put(fe.getField(), fe.getDefaultMessage()));
        pd.setProperty("fields", fields);
        return ResponseEntity.status(st).body(pd);
    }
}
