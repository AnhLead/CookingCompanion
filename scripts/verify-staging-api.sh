#!/usr/bin/env bash
# Staging API smoke checks from docs/API_DEPLOY.md and docs/RELEASE_SMOKE.md.
# Default: health, login, auth/me. --full: households, library CRUD, cook payload, import.
# Prerequisite: ./scripts/staging-up.sh (or API listening on BASE).
set -euo pipefail

BASE="${STAGING_API_URL:-${BASE_URL:-http://localhost:8080}}"
DEMO_EMAIL="${DEMO_EMAIL:-dev@example.com}"
DEMO_PASSWORD="${DEMO_PASSWORD:-password}"
DEMO_USER_ID="dddddddd-dddd-dddd-dddd-dddddddddddd"
DEMO_HOUSEHOLD_ID="${DEMO_HOUSEHOLD_ID:-b1111111-1111-1111-1111-111111111111}"
SEEDED_VARIANT_ID="${SEEDED_VARIANT_ID:-b3333333-3333-3333-3333-333333333333}"

FULL=0

die() {
  echo "verify-staging-api: $*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [--full]

  Staging API smoke against \$BASE (default http://localhost:8080).

  Default: GET /health, POST /api/v1/auth/login, GET /api/v1/auth/me
  --full:  also households, library list/CRUD, variant cook payload, import preview/commit

Environment:
  STAGING_API_URL or BASE_URL   API base URL
  DEMO_EMAIL / DEMO_PASSWORD    demo login (V5 seed)
  DEMO_HOUSEHOLD_ID             Demo Kitchen UUID (full mode)
  SEEDED_VARIANT_ID             Creamy Pasta variant UUID (full mode)
EOF
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1 (install it and retry)"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) FULL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
done

need_cmd curl
need_cmd jq

auth_header() {
  printf 'Authorization: Bearer %s' "$access_token"
}

verify_health() {
  health_body="$(curl -sf "$BASE/health")" || die "GET $BASE/health failed — is staging up? Run: ./scripts/staging-up.sh"
  health_status="$(echo "$health_body" | jq -r '.status // empty')"
  [[ "$health_status" == "UP" ]] || die "GET /health expected status UP, got: ${health_status:-<missing>}"
  echo "  OK health=UP"
}

verify_login_and_me() {
  login_body="$(curl -sf -X POST "$BASE/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}")" \
    || die "POST /api/v1/auth/login failed — is V5 demo seed applied?"
  access_token="$(echo "$login_body" | jq -r '.accessToken // empty')"
  [[ -n "$access_token" && "$access_token" != "null" ]] || die "login response missing accessToken"

  me_body="$(curl -sf -H "$(auth_header)" "$BASE/api/v1/auth/me")" \
    || die "GET /api/v1/auth/me failed"
  me_user_id="$(echo "$me_body" | jq -r '.userId // empty')"
  me_email="$(echo "$me_body" | jq -r '.email // empty')"
  [[ "$me_user_id" == "$DEMO_USER_ID" ]] \
    || die "auth/me userId expected $DEMO_USER_ID, got: ${me_user_id:-<missing>}"
  [[ "$me_email" == "$DEMO_EMAIL" ]] \
    || die "auth/me email expected $DEMO_EMAIL, got: ${me_email:-<missing>}"
  echo "  OK login + auth/me for $DEMO_EMAIL"
}

verify_full_smoke() {
  households_body="$(curl -sf -H "$(auth_header)" "$BASE/api/v1/households")" \
    || die "GET /api/v1/households failed"
  echo "$households_body" | jq -e --arg id "$DEMO_HOUSEHOLD_ID" '.[] | select(.id == $id)' >/dev/null \
    || die "households missing Demo Kitchen ($DEMO_HOUSEHOLD_ID)"
  echo "$households_body" | jq -e '.[] | select(.name == "Demo Kitchen")' >/dev/null \
    || die "households missing Demo Kitchen name"
  echo "  OK GET /households (Demo Kitchen)"

  dishes_body="$(curl -sf -H "$(auth_header)" -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" "$BASE/api/v1/dishes")" \
    || die "GET /api/v1/dishes failed"
  echo "$dishes_body" | jq -e '.[] | select(.name == "Creamy Pasta")' >/dev/null \
    || die "dishes list missing seeded Creamy Pasta"
  echo "  OK GET /dishes (Creamy Pasta)"

  create_body="$(curl -sf -X POST "$BASE/api/v1/dishes" \
    -H "$(auth_header)" \
    -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    -H 'Content-Type: application/json' \
    -d '{"name":"API smoke dish"}')" \
    || die "POST /api/v1/dishes failed"
  dish_id="$(echo "$create_body" | jq -r '.id // empty')"
  [[ -n "$dish_id" && "$dish_id" != "null" ]] || die "create dish response missing id"
  echo "  OK POST /dishes (id=$dish_id)"

  variant_body="$(curl -sf -H "$(auth_header)" -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    "$BASE/api/v1/variants/$SEEDED_VARIANT_ID")" \
    || die "GET /api/v1/variants/$SEEDED_VARIANT_ID failed"
  steps_len="$(echo "$variant_body" | jq '.steps | length')"
  [[ "$steps_len" =~ ^[0-9]+$ && "$steps_len" -gt 0 ]] \
    || die "variant $SEEDED_VARIANT_ID expected non-empty steps, got: ${steps_len:-<missing>}"
  echo "  OK GET /variants/$SEEDED_VARIANT_ID (steps=$steps_len)"

  preview_body="$(curl -sf -X POST "$BASE/api/v1/import/preview" \
    -H "$(auth_header)" \
    -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    -H 'Content-Type: application/json' \
    -d '{"html":"{\"@type\":\"Recipe\",\"name\":\"API Soup\",\"recipeIngredient\":[\"water\"],\"recipeInstructions\":\"Boil.\"}"}')" \
    || die "POST /api/v1/import/preview failed"
  preview_id="$(echo "$preview_body" | jq -r '.previewId // empty')"
  [[ -n "$preview_id" && "$preview_id" != "null" ]] || die "import preview missing previewId"

  commit_body="$(curl -sf -X POST "$BASE/api/v1/import/commit" \
    -H "$(auth_header)" \
    -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    -H 'Content-Type: application/json' \
    -d "{\"previewId\":\"$preview_id\",\"dishName\":\"API Soup\"}")" \
    || die "POST /api/v1/import/commit failed"
  commit_dish_id="$(echo "$commit_body" | jq -r '.dishId // empty')"
  commit_variant_id="$(echo "$commit_body" | jq -r '.id // empty')"
  [[ -n "$commit_dish_id" && "$commit_dish_id" != "null" ]] || die "import commit missing dishId"
  [[ -n "$commit_variant_id" && "$commit_variant_id" != "null" ]] || die "import commit missing variant id"
  echo "  OK import preview+commit (dishId=$commit_dish_id)"

  curl -sf -X DELETE "$BASE/api/v1/dishes/$dish_id" \
    -H "$(auth_header)" \
    -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    -o /dev/null \
    || die "DELETE /api/v1/dishes/$dish_id failed"
  echo "  OK DELETE /dishes/$dish_id"
}

echo "Verifying staging API at $BASE ..."
verify_health
verify_login_and_me

if [[ "$FULL" -eq 1 ]]; then
  echo "Running full smoke (library + import) ..."
  verify_full_smoke
  echo "OK: full staging smoke passed for $DEMO_EMAIL @ Demo Kitchen"
else
  echo "OK: minimal staging smoke passed for $DEMO_EMAIL (use --full for library + import)"
fi
