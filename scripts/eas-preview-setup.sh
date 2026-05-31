#!/usr/bin/env bash
# Board / ops: link Expo project + set preview API secret after EXPO_TOKEN is available.
# Usage:
#   export EXPO_TOKEN="..."   # from expo.dev → Access tokens
#   ./scripts/eas-preview-setup.sh http://192.168.1.100:8080
#   # then: npx eas-cli build --profile preview --platform android
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${1:-}"
if [[ -z "$API_URL" ]]; then
  echo "Usage: $0 <staging-api-base-url>" >&2
  echo "Example: $0 http://192.168.1.100:8080" >&2
  exit 1
fi

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo "EXPO_TOKEN is not set. Create one at https://expo.dev/settings/access-tokens" >&2
  exit 1
fi

EAS="npx --yes eas-cli@latest"

echo "Checking Expo auth..."
$EAS whoami

if ! grep -qE '"projectId"|"eas"' app.json 2>/dev/null; then
  echo "Linking repo to Expo project (eas init)..."
  $EAS init --non-interactive
else
  echo "Expo project already linked in app.json"
fi

echo "Setting preview env var EXPO_PUBLIC_API_BASE_URL=$API_URL"
$EAS env:create preview \
  --name EXPO_PUBLIC_API_BASE_URL \
  --value "$API_URL" \
  --visibility plaintext \
  --force \
  --non-interactive

echo ""
echo "Ready for preview build:"
echo "  npx eas-cli build --profile preview --platform android"
echo "  npx eas-cli build --profile preview --platform ios"
echo ""
echo "Post build URL on MON-118 when complete."
