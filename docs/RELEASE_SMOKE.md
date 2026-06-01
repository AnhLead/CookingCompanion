# Release smoke runbook (pre-preview)

Runnable QA for **Expo Go / dev client + staging API** before EAS preview builds exist. Device APK/IPA smoke is tracked separately in [MON-117](/MON/issues/MON-117).

Related: [API deploy](/docs/API_DEPLOY.md) · [Mobile release](/docs/MOBILE_RELEASE.md) · [Board Option C (preview unblock)](/docs/BOARD_OPTION_C.md)

## Prerequisites

| Item | Value |
| ---- | ----- |
| Staging API | `./scripts/staging-up.sh` from repo root → `http://localhost:8080` |
| Health check | `curl -s http://localhost:8080/health` → `{"status":"UP"}` |
| Mobile `EXPO_PUBLIC_API_BASE_URL` | LAN IP (`http://192.168.x.x:8080`) or tunnel URL from `./scripts/staging-tunnel.sh` — **not** `localhost` on a physical device |
| Demo account (V5 seed) | `dev@example.com` / `password` |
| Demo household | **Demo Kitchen** (`inviteCode` `DEMOKIT1`, id `b1111111-1111-1111-1111-111111111111`) |
| Seed recipe | **Creamy Pasta** → variant `b3333333-3333-3333-3333-333333333333` |

Off-LAN phones: run `./scripts/staging-tunnel.sh` and point the app at the printed `https://*.trycloudflare.com` URL.

## Mobile journey (manual)

Set scope to **Demo Kitchen** (Household screen) before library/import steps. Record **Pass / Fail / Skip** and notes (device, OS, app env).

| # | Step | Expected result | P/F | Notes |
| - | ---- | --------------- | --- | ----- |
| 1 | **Login** — open app → Login → `dev@example.com` / `password` | Lands on Library; no auth error | | |
| 2 | **Household** — Household tab → select **Demo Kitchen** | Active scope label shows Demo Kitchen; library reloads | | |
| 3 | **Library read** — Library lists **Creamy Pasta** | Dish visible in household scope | | |
| 4 | **Library create** — tap add dish → name e.g. `QA Smoke <time>` → create | New dish appears in list | | |
| 5 | **Dish detail** — open the new dish | Empty or default variant shell; can add variant | | |
| 6 | **Import (URL)** — Import tab → paste a recipe URL → Preview → Save | Preview shows title/ingredients/steps; commit succeeds; dish appears in library | | |
| 7 | **Import (manual)** — Import → paste HTML or ingredient/step text (no URL) → Preview → Save | Preview + commit succeed; new dish in library | | |
| 8 | **Cook mode** — open **Creamy Pasta** → open canonical variant → **Cook** | Steps render; Next/Previous work; optional step timer if present | | |
| 9 | **Delete** — open QA dish from step 4 → delete dish | Dish removed from library; no 5xx | | |

**Import URL tip:** Use a page with `schema.org/Recipe` JSON-LD when possible. If preview fails, retry with manual HTML/text (step 7).

**Skip rules:** Mark **Skip** only when blocked by environment (no network, tunnel down). File product bugs as new issues; do not block this runbook on polish.

## API-only smoke (curl)

Use when mobile is blocked or to sanity-check backend before a device pass. Requires staging up and V5 seed applied.

```bash
export BASE=http://localhost:8080
export HH=b1111111-1111-1111-1111-111111111111

# Health
curl -sf "$BASE/health"

# Login (demo creds from API_DEPLOY.md)
TOKEN=$(curl -sf -X POST "$BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","password":"password"}' | jq -r .accessToken)
export AUTH="Authorization: Bearer $TOKEN"

# Me + households
curl -sf -H "$AUTH" "$BASE/api/v1/auth/me" | jq .
curl -sf -H "$AUTH" "$BASE/api/v1/households" | jq .

# Library (household-scoped)
curl -sf -H "$AUTH" -H "X-Household-Id: $HH" "$BASE/api/v1/dishes" | jq .

# Create dish
DISH=$(curl -sf -X POST "$BASE/api/v1/dishes" -H "$AUTH" -H "X-Household-Id: $HH" \
  -H 'Content-Type: application/json' -d '{"name":"API smoke dish"}' | jq -r .id)

# Cook data (seed variant)
curl -sf -H "$AUTH" -H "X-Household-Id: $HH" \
  "$BASE/api/v1/variants/b3333333-3333-3333-3333-333333333333" | jq '.title, (.steps|length)'

# Import preview + commit (manual HTML)
PREVIEW_ID=$(curl -sf -X POST "$BASE/api/v1/import/preview" -H "$AUTH" -H "X-Household-Id: $HH" \
  -H 'Content-Type: application/json' \
  -d '{"html":"{\"@type\":\"Recipe\",\"name\":\"API Soup\",\"recipeIngredient\":[\"water\"],\"recipeInstructions\":\"Boil.\"}"}' \
  | jq -r .previewId)
curl -sf -X POST "$BASE/api/v1/import/commit" -H "$AUTH" -H "X-Household-Id: $HH" \
  -H 'Content-Type: application/json' \
  -d "{\"previewId\":\"$PREVIEW_ID\",\"dishName\":\"API Soup\"}" | jq '.dishId, .id'

# Delete test dish
curl -sf -X DELETE "$BASE/api/v1/dishes/$DISH" -H "$AUTH" -H "X-Household-Id: $HH" -w '\n%{http_code}\n'
```

| Check | Endpoint | Expected |
| ----- | -------- | -------- |
| Liveness | `GET /health` | 200, `status: UP` |
| Auth | `POST /api/v1/auth/login` | `accessToken` present |
| Profile | `GET /api/v1/auth/me` | `userId` = demo UUID |
| Household | `GET /api/v1/households` | includes **Demo Kitchen** |
| List | `GET /api/v1/dishes` + `X-Household-Id` | includes **Creamy Pasta** |
| CRUD | `POST` / `DELETE /api/v1/dishes/{id}` | 201 / 204 |
| Cook payload | `GET /api/v1/variants/{id}` | `steps` non-empty |
| Import | `POST /import/preview` + `POST /import/commit` | `previewId` then `dishId` |

Contract reference: `/swagger-ui` on staging (enabled for `staging` profile).

## Reporting

Post on the QA ticket:

- Commit SHA (or `main` ref) tested against
- Staging URL (`http://localhost:8080` or tunnel/public URL)
- Mobile table (steps 1–9) with P/F
- API curl results if run
- Blockers for [MON-117](/MON/issues/MON-117) (preview install URL, secrets)

## Out of scope

- EAS preview APK/IPA install smoke ([MON-117](/MON/issues/MON-117))
- New product bug filing (open separate issues with repro)
