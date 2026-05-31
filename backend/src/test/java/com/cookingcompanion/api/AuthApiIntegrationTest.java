package com.cookingcompanion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cookingcompanion.domain.RefreshToken;
import com.cookingcompanion.repo.RefreshTokenRepository;
import com.cookingcompanion.service.auth.RefreshTokenService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthApiIntegrationTest extends AbstractImportApiIntegrationTest {

    private static final String DEMO_EMAIL = "dev@example.com";
    private static final String DEMO_PASSWORD = "password";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Test
    void loginRefreshAndMeHappyPath() throws Exception {
        JsonNode login = loginTokens();
        String access = login.get("accessToken").asText();
        String refresh = login.get("refreshToken").asText();
        assertThat(login.has("accessToken")).isTrue();
        assertThat(login.has("refreshToken")).isTrue();
        assertThat(login.has("expiresIn")).isTrue();
        assertThat(login.has("tokenType")).isTrue();
        assertThat(login.get("expiresIn").asInt()).isPositive();
        assertThat(login.get("tokenType").asText()).isEqualTo("Bearer");

        MvcResult refreshResult = mockMvc.perform(
                        post("/api/v1/auth/refresh")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("refreshToken", refresh))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn();

        JsonNode rotated = objectMapper.readTree(refreshResult.getResponse().getContentAsString());
        assertThat(rotated.get("refreshToken").asText()).isNotEqualTo(refresh);

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + rotated.get("accessToken").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(DEMO_EMAIL))
                .andExpect(jsonPath("$.userId").value("dddddddd-dddd-dddd-dddd-dddddddddddd"));

        mockMvc.perform(
                        post("/api/v1/auth/refresh")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("refresh_token", refresh))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk());
    }

    @Test
    void refreshRejectsInvalidToken() throws Exception {
        mockMvc.perform(
                        post("/api/v1/auth/refresh")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"refreshToken\":\"not-a-valid-token\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid refresh token"));
    }

    @Test
    void refreshRejectsExpiredToken() throws Exception {
        JsonNode login = loginTokens();
        String refresh = login.get("refreshToken").asText();
        String hash = RefreshTokenService.hashToken(refresh);
        RefreshToken row = refreshTokenRepository.findByTokenHash(hash).orElseThrow();
        row.setExpiresAt(Instant.now().minusSeconds(60));
        refreshTokenRepository.save(row);

        mockMvc.perform(
                        post("/api/v1/auth/refresh")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("refreshToken", refresh))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Refresh token expired"));
    }

    @Test
    void loginRejectsBadPassword() throws Exception {
        mockMvc.perform(
                        post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        Map.of("email", DEMO_EMAIL, "password", "wrong"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid credentials"))
                .andExpect(jsonPath("$.status").value(401))
                .andDo(result -> assertCorrelationIdPresent(result));
    }

    @Test
    void authErrorsIncludeCorrelationId() throws Exception {
        mockMvc.perform(
                        post("/api/v1/auth/refresh")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"refreshToken\":\"not-a-valid-token\"}"))
                .andExpect(status().isUnauthorized())
                .andDo(result -> assertCorrelationIdPresent(result));

        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andDo(result -> assertCorrelationIdPresent(result));
    }

    private void assertCorrelationIdPresent(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        String headerId = result.getResponse().getHeader("X-Correlation-ID");
        assertThat(headerId).isNotBlank();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("correlationId").asText()).isEqualTo(headerId);
    }

    private JsonNode loginTokens() throws Exception {
        MvcResult result = mockMvc.perform(
                        post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        Map.of("email", DEMO_EMAIL, "password", DEMO_PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
