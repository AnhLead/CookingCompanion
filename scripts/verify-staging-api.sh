#!/usr/bin/env bash
# Staging API smoke checks from docs/API_DEPLOY.md (health, login, auth/me).
# Prerequisite: ./scripts/staging-up.sh (or API listening on BASE).
set -euo pipefail

BASE="${STAGING_API_URL:-${BASE_URL:-http://localhost:8080}}"
DEMO_EMAIL="${DEMO_EMAIL:-dev@example.com}"
DEMO_PASSWORD="${DEMO_PASSWORD:-password}"
DEMO_USER_ID="dddddddd-dddd-dddd-dddd-dddddddddddd"

die() {
  echo "verify-staging-api: $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1 (install it and retry)"
}

need_cmd curl
need_cmd jq

echo "Verifying staging API at $BASE ..."

health_body="$(curl -sf "$BASE/health")" || die "GET $BASE/health failed — is staging up? Run: ./scripts/staging-up.sh"
health_status="$(echo "$health_body" | jq -r '.status // empty')"
[[ "$health_status" == "UP" ]] || die "GET /health expected status UP, got: ${health_status:-<missing>}"

login_body="$(curl -sf -X POST "$BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}")" \
  || die "POST /api/v1/auth/login failed — is V5 demo seed applied?"
access_token="$(echo "$login_body" | jq -r '.accessToken // empty')"
[[ -n "$access_token" && "$access_token" != "null" ]] || die "login response missing accessToken"

me_body="$(curl -sf -H "Authorization: Bearer $access_token" "$BASE/api/v1/auth/me")" \
  || die "GET /api/v1/auth/me failed"
me_user_id="$(echo "$me_body" | jq -r '.userId // empty')"
me_email="$(echo "$me_body" | jq -r '.email // empty')"
[[ "$me_user_id" == "$DEMO_USER_ID" ]] \
  || die "auth/me userId expected $DEMO_USER_ID, got: ${me_user_id:-<missing>}"
[[ "$me_email" == "$DEMO_EMAIL" ]] \
  || die "auth/me email expected $DEMO_EMAIL, got: ${me_email:-<missing>}"

echo "OK: health=UP, login and auth/me verified for $DEMO_EMAIL"
