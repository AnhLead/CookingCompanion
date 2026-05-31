#!/usr/bin/env bash
# Expose local staging API (port 8080) via Cloudflare quick tunnel for off-LAN preview QA.
# Tunnel stops when this script exits. Requires: cloudflared, staging API up.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${STAGING_PORT:-8080}"
LOG="${STAGING_TUNNEL_LOG:-/tmp/cooking-companion-staging-tunnel.log}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
  exit 1
fi

if ! curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
  echo "Staging API not healthy on :${PORT}. Run: ./scripts/staging-up.sh" >&2
  exit 1
fi

echo "Starting quick tunnel to http://localhost:${PORT} (log: ${LOG})..."
# Avoid named-tunnel credentials from ~/.cloudflared/config.yml
cloudflared tunnel --url "http://127.0.0.1:${PORT}" --logfile "$LOG" --loglevel info &
TUNNEL_PID=$!

cleanup() {
  kill "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Waiting for public URL..."
for _ in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1 || true)
  if [[ -n "$URL" ]]; then
    echo ""
    echo "Public staging URL (use for EXPO_PUBLIC_API_BASE_URL):"
    echo "  ${URL}"
    echo ""
    echo "Verify: curl -s ${URL}/health"
    echo "Tunnel runs until Ctrl+C. Keep this terminal open during preview QA."
    # Hold tunnel open
    wait "$TUNNEL_PID"
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for tunnel URL — see ${LOG}" >&2
exit 1
