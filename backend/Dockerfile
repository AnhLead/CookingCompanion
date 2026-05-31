# Multi-stage build — no pre-built jar required (see docs/API_DEPLOY.md).
FROM eclipse-temurin:17-jdk-jammy AS build

WORKDIR /src

COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
COPY src ./src

RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:17-jre-jammy AS runtime

WORKDIR /app

RUN useradd --system --uid 10001 appuser
USER appuser

COPY --from=build /src/build/libs/cooking-companion-backend-*.jar /app/app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
