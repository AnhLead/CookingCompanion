#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${JWT_SECRET:-}" ]]; then
  export JWT_SECRET="staging-compose-secret-at-least-32-chars!!"
fi

echo "Starting postgres + staging API (profile=staging)..."
docker compose up -d --build

echo "Waiting for API health..."
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:8080/health" >/dev/null; then
    echo "API ready: http://localhost:8080"
    echo "Demo login: dev@example.com / password"
    exit 0
  fi
  sleep 2
done

echo "API did not become healthy in time — check: docker compose logs api" >&2
exit 1
