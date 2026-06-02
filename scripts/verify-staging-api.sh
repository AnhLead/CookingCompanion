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
SEEDED_DISH_ID="${SEEDED_DISH_ID:-b2222222-2222-2222-2222-222222222222}"
WRONG_HOUSEHOLD_ID="${WRONG_HOUSEHOLD_ID:-a1111111-1111-1111-1111-111111111111}"

FULL=0
AUTH_NEGATIVE=0
declare -a CHECK_RESULTS=()
declare -i FAILURES=0

die() {
  echo "verify-staging-api: $*" >&2
  exit 1
}

run_check() {
  local name="$1"
  shift
  if "$@"; then
    CHECK_RESULTS+=("PASS|$name")
    return 0
  fi
  CHECK_RESULTS+=("FAIL|$name")
  FAILURES+=1
  return 1
}

print_summary() {
  local status name
  echo
  printf "%-6s | %s\n" "RESULT" "CHECK"
  printf "%-6s-+-%s\n" "------" "----------------------------------------------"
  for row in "${CHECK_RESULTS[@]}"; do
    IFS='|' read -r status name <<<"$row"
    printf "%-6s | %s\n" "$status" "$name"
  done
  echo
  if (( FAILURES > 0 )); then
    echo "FAIL: $FAILURES check(s) failed."
    return 1
  fi
  echo "PASS: all checks passed."
  return 0
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [--full] [--auth-negative]

  Staging API smoke against \$BASE (default http://localhost:8080).

  Default: GET /health, POST /api/v1/auth/login, GET /api/v1/auth/me
  --full:  also households, library list/CRUD, variant cook payload, import preview/commit
  --auth-negative: dish + dish-variants list/create auth probes (401/403; login for 403)
                   (included automatically in --full)

Environment:
  STAGING_API_URL or BASE_URL   API base URL
  DEMO_EMAIL / DEMO_PASSWORD    demo login (V5 seed)
  DEMO_HOUSEHOLD_ID             Demo Kitchen UUID (full / auth-negative)
  SEEDED_DISH_ID                Creamy Pasta dish UUID (auth-negative)
  WRONG_HOUSEHOLD_ID            Non-member household UUID (auth-negative)
  SEEDED_VARIANT_ID             Creamy Pasta variant UUID (full mode)
EOF
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1 (install it and retry)"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) FULL=1; AUTH_NEGATIVE=1; shift ;;
    --auth-negative) AUTH_NEGATIVE=1; shift ;;
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
  health_body="$(curl -sf "$BASE/health")" || return 1
  health_status="$(echo "$health_body" | jq -r '.status // empty')"
  [[ "$health_status" == "UP" ]]
}

verify_login_and_me() {
  login_body="$(curl -sf -X POST "$BASE/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}")" \
    || return 1
  access_token="$(echo "$login_body" | jq -r '.accessToken // empty')"
  [[ -n "$access_token" && "$access_token" != "null" ]] || return 1

  me_body="$(curl -sf -H "$(auth_header)" "$BASE/api/v1/auth/me")" \
    || return 1
  me_user_id="$(echo "$me_body" | jq -r '.userId // empty')"
  me_email="$(echo "$me_body" | jq -r '.email // empty')"
  [[ "$me_user_id" == "$DEMO_USER_ID" ]] \
    || return 1
  [[ "$me_email" == "$DEMO_EMAIL" ]] \
    || return 1
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

verify_auth_negative() {
  code="$(http_code "$BASE/api/v1/dishes/$SEEDED_DISH_ID" -H "X-Household-Id: $DEMO_HOUSEHOLD_ID")"
  [[ "$code" == "401" ]] || return 1

  code="$(http_code "$BASE/api/v1/dishes/$SEEDED_DISH_ID" \
    -H "$(auth_header)" \
    -H "X-Household-Id: $WRONG_HOUSEHOLD_ID")"
  [[ "$code" == "403" ]] || return 1

  code="$(http_code "$BASE/api/v1/dishes/$SEEDED_DISH_ID/variants" \
    -H "X-Household-Id: $DEMO_HOUSEHOLD_ID")"
  [[ "$code" == "401" ]] || return 1

  code="$(http_code "$BASE/api/v1/dishes/$SEEDED_DISH_ID/variants" \
    -H "$(auth_header)" \
    -H "X-Household-Id: $WRONG_HOUSEHOLD_ID")"
  [[ "$code" == "403" ]] || return 1

  code="$(http_code -X POST "$BASE/api/v1/dishes/$SEEDED_DISH_ID/variants" \
    -H "Content-Type: application/json" \
    -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    -d '{"title":"Auth probe variant","canonical":false}')"
  [[ "$code" == "401" ]]
}

verify_full_smoke() {
  households_body="$(curl -sf -H "$(auth_header)" "$BASE/api/v1/households")" \
    || return 1
  echo "$households_body" | jq -e --arg id "$DEMO_HOUSEHOLD_ID" '.[] | select(.id == $id)' >/dev/null \
    || return 1
  echo "$households_body" | jq -e '.[] | select(.name == "Demo Kitchen")' >/dev/null \
    || return 1

  dishes_body="$(curl -sf -H "$(auth_header)" -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" "$BASE/api/v1/dishes")" \
    || return 1
  echo "$dishes_body" | jq -e '.[] | select(.name == "Creamy Pasta")' >/dev/null \
    || return 1

  create_body="$(curl -sf -X POST "$BASE/api/v1/dishes" \
    -H "$(auth_header)" \
    -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    -H 'Content-Type: application/json' \
    -d '{"name":"API smoke dish"}')" \
    || return 1
  dish_id="$(echo "$create_body" | jq -r '.id // empty')"
  [[ -n "$dish_id" && "$dish_id" != "null" ]] || return 1

  variant_body="$(curl -sf -H "$(auth_header)" -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    "$BASE/api/v1/variants/$SEEDED_VARIANT_ID")" \
    || return 1
  steps_len="$(echo "$variant_body" | jq '.steps | length')"
  [[ "$steps_len" =~ ^[0-9]+$ && "$steps_len" -gt 0 ]] \
    || return 1

  preview_body="$(curl -sf -X POST "$BASE/api/v1/import/preview" \
    -H "$(auth_header)" \
    -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    -H 'Content-Type: application/json' \
    -d '{"html":"{\"@type\":\"Recipe\",\"name\":\"API Soup\",\"recipeIngredient\":[\"water\"],\"recipeInstructions\":\"Boil.\"}"}')" \
    || return 1
  preview_id="$(echo "$preview_body" | jq -r '.previewId // empty')"
  [[ -n "$preview_id" && "$preview_id" != "null" ]] || return 1

  commit_body="$(curl -sf -X POST "$BASE/api/v1/import/commit" \
    -H "$(auth_header)" \
    -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    -H 'Content-Type: application/json' \
    -d "{\"previewId\":\"$preview_id\",\"dishName\":\"API Soup\"}")" \
    || return 1
  commit_dish_id="$(echo "$commit_body" | jq -r '.dishId // empty')"
  commit_variant_id="$(echo "$commit_body" | jq -r '.id // empty')"
  [[ -n "$commit_dish_id" && "$commit_dish_id" != "null" ]] || return 1
  [[ -n "$commit_variant_id" && "$commit_variant_id" != "null" ]] || return 1

  curl -sf -X DELETE "$BASE/api/v1/dishes/$dish_id" \
    -H "$(auth_header)" \
    -H "X-Household-Id: $DEMO_HOUSEHOLD_ID" \
    -o /dev/null \
    || return 1
}

echo "Verifying staging API at $BASE ..."
run_check "GET /health returns status=UP" verify_health
run_check "POST /auth/login + GET /auth/me (demo user)" verify_login_and_me

if [[ "$AUTH_NEGATIVE" -eq 1 ]]; then
  run_check "Auth-negative probes (401/403 on dish + variants)" verify_auth_negative
fi

if [[ "$FULL" -eq 1 ]]; then
  run_check "Full smoke: households, dishes CRUD, variant, import" verify_full_smoke
fi

if ! print_summary; then
  exit 1
fi
