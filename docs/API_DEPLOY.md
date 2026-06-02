# API deploy runbook (Spring Boot / PostgreSQL)

Cooking Companion API lives in `backend/`. This doc is copy-pasteable for standing up **staging** or **production** without k8s/terraform.

## Quick start (staging via Docker Compose)

From repo root — builds the API image, starts Postgres, runs Flyway, exposes staging on port 8080:

```bash
./scripts/staging-up.sh
# or: docker compose up -d --build
curl -s http://localhost:8080/health
```

Set a unique `JWT_SECRET` before starting in shared environments:

```bash
export JWT_SECRET="$(openssl rand -base64 48)"
docker compose up -d --build
```

For preview mobile builds on the same LAN, use `http://<host-ip>:8080` as `EXPO_PUBLIC_API_BASE_URL` (devices must reach the host).

## Build

```bash
cd backend
./gradlew bootJar
ls build/libs/*.jar
```

Docker (optional):

```bash
cd backend
./gradlew bootJar
docker build -t cooking-companion-api:local .
docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e DATABASE_URL=jdbc:postgresql://host.docker.internal:5432/cooking_companion \
  -e DATABASE_USER=postgres \
  -e DATABASE_PASSWORD=postgres \
  cooking-companion-api:local
```

Run the jar without Docker:

```bash
export SPRING_PROFILES_ACTIVE=prod
export JWT_SECRET="$(openssl rand -base64 48)"
export DATABASE_URL=jdbc:postgresql://localhost:5432/cooking_companion
export DATABASE_USER=postgres
export DATABASE_PASSWORD=postgres
java -jar backend/build/libs/cooking-companion-backend-0.0.1-SNAPSHOT.jar
```

## Profiles

| Profile | `SPRING_PROFILES_ACTIVE` | Auth shortcuts | OpenAPI UI |
| ------- | ------------------------ | -------------- | ---------- |
| Local dev | *(default)* | `X-User-Id`, unverified JWT parse allowed | enabled |
| Staging | `staging` | disabled (signed JWT only) | enabled |
| Production | `prod` | disabled | disabled |

Production **fails startup** if `JWT_SECRET` is missing, shorter than 32 characters, or equals the dev default in `application.yml` (`dev-only-change-me-in-production-min-32-chars!!`).

## Environment variables

| Variable | Dev default | Staging / prod | Notes |
| -------- | ----------- | -------------- | ----- |
| `SPRING_PROFILES_ACTIVE` | — | `staging` or `prod` | Required for non-dev deploys |
| `PORT` | `8080` | `8080` | HTTP listen port |
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/cooking_companion` | **required** | JDBC URL |
| `DATABASE_USER` | `postgres` | **required** | |
| `DATABASE_PASSWORD` | `postgres` | **required** | |
| `JWT_SECRET` | dev placeholder in YAML | **required** | Min 32 chars; unique per env |
| `JWT_ACCESS_TTL` | `15m` | optional | Access token lifetime |
| `JWT_REFRESH_TTL` | `7d` | optional | Refresh token lifetime |
| `CORS_ALLOWED_ORIGIN_PATTERNS` | localhost patterns | empty or explicit | Comma-separated; empty = no browser CORS |
| `APP_SECURITY_ALLOW_X_USER_ID` | `true` | `false` in staging/prod | Set only for local debugging |
| `APP_SECURITY_PARSE_JWT_SUBJECT_WITHOUT_VERIFICATION` | `true` | `false` in staging/prod | |
| `RECIPE_AI_GENERATIVE_ENABLED` | `false` | optional | |
| `OPENAI_API_KEY` | — | if generative on | |
| `OPENAI_BASE_URL` | OpenAI default | optional | |
| `OPENAI_MODEL` | `gpt-4o-mini` | optional | |
| `IMPORT_PREVIEW_RATE_LIMIT_PER_MINUTE` | 120 (dev) | `30` (staging/prod default) | Resilience4j |
| `IMPORT_COMMIT_RATE_LIMIT_PER_MINUTE` | 60 (dev) | `15` (staging/prod default) | Resilience4j |

## Health and version

| Endpoint | Purpose |
| -------- | ------- |
| `GET /health` | Liveness JSON `{"status":"UP"}` — use behind load balancers |
| `GET /version` | Build metadata (`name`, `version`, `time`) from Spring Boot build-info |
| `GET /actuator/health` | Actuator aggregate health |
| `GET /actuator/health/liveness` | Kubernetes-style liveness probe |
| `GET /actuator/health/readiness` | Readiness probe (DB connectivity) |

Mobile API contract routes are under `/api/v1/**`. OpenAPI/Swagger is enabled in dev and staging only.

## Database (Flyway)

- Migrations: `backend/src/main/resources/db/migration/V*.sql`
- Applied automatically on startup when `spring.flyway.enabled=true` (default).
- JPA `ddl-auto=validate` — schema is owned by Flyway, not Hibernate auto-DDL.

### Demo seed (local / QA)

Migration `V5__dev_demo_seed.sql` inserts a demo user and sample library:

| Field | Value |
| ----- | ----- |
| Email | `dev@example.com` |
| Password | `password` |
| User UUID | `dddddddd-dddd-dddd-dddd-dddddddddddd` |
| Household | `Demo Kitchen` (invite code `DEMOKIT1`) |

Use `POST /api/v1/auth/login` with that email/password to obtain access and refresh tokens. **Do not rely on this account in production** unless you intentionally keep the seed migration; rotate credentials if the DB is internet-facing.

## Staging smoke checklist

1. PostgreSQL reachable; empty DB or migrated instance.
2. `SPRING_PROFILES_ACTIVE=staging`, strong `JWT_SECRET` (≥ 32 chars, not the dev default).
3. Start jar or container; confirm `GET /health` → 200.
4. `POST /api/v1/auth/login` with demo credentials (if V5 applied).
5. `GET /api/v1/auth/me` with `Authorization: Bearer <accessToken>`.
6. Optional: open `/swagger-ui` on staging for contract QA.

Automate steps 3–5 after `./scripts/staging-up.sh`:

```bash
./scripts/verify-staging-api.sh               # health, login, auth/me
./scripts/verify-staging-api.sh --auth-negative  # + dish/variant list+create 401/403 probes
./scripts/verify-staging-api.sh --full        # auth-negative + households, dishes CRUD, variant, import
```

The verifier prints a compact `RESULT | CHECK` pass/fail table and exits with code `1` if any check fails.

| Variable | Default |
| -------- | ------- |
| `STAGING_API_URL` or `BASE_URL` | `http://localhost:8080` |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | `dev@example.com` / `password` |
| `DEMO_HOUSEHOLD_ID` | Demo Kitchen UUID (`b1111111-…`) |
| `SEEDED_VARIANT_ID` | Creamy Pasta variant (`b3333333-…`) |
| `SEEDED_DISH_ID` | Creamy Pasta dish (`b2222222-…`; `--auth-negative`) |
| `WRONG_HOUSEHOLD_ID` | Non-member household (`a1111111-…`; `--auth-negative`) |

`--auth-negative` checks: `GET /dishes/{id}` and `GET|POST /dishes/{id}/variants` without Bearer → 401; same routes with wrong `X-Household-Id` + Bearer → 403 (list routes only for the 403 case).

Off-host staging: `STAGING_API_URL=https://your-host:8080 ./scripts/verify-staging-api.sh --full`

Extended curl table and mobile journey: [RELEASE_SMOKE.md](/docs/RELEASE_SMOKE.md).

## Production notes

- Set `SPRING_PROFILES_ACTIVE=prod` and a unique `JWT_SECRET`.
- Leave `CORS_ALLOWED_ORIGIN_PATTERNS` empty unless browser clients need CORS.
- Swagger/OpenAPI UI is disabled in prod (`application-prod.yml`).
- Import rate limits are lower than local dev; tune with `IMPORT_*_RATE_LIMIT_PER_MINUTE` if needed.
