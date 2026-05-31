# Board unblock — Option C preview build (MON-114)

Engineering is complete. **Only human steps remain.**

## Prerequisites

`EXPO_PUBLIC_API_BASE_URL` must be reachable from the **tester's phone** running the preview build:

| Setup | Example URL | Works when |
| ----- | ----------- | ---------- |
| Same Wi‑Fi as staging host | `http://192.168.1.100:8080` | Phone and API on same LAN |
| Public staging deploy | `https://staging-api.example.com` | Phone on any network |

`http://localhost:8080` does **not** work on a physical device.

Staging in this workspace: `./scripts/staging-up.sh` → `curl http://localhost:8080/health`

## Steps (GitHub Actions — recommended)

1. **Secrets** — [github.com/AnhLead/CookingCompanion/settings/secrets/actions](https://github.com/AnhLead/CookingCompanion/settings/secrets/actions)
   - `EXPO_TOKEN` — [expo.dev access token](https://expo.dev/settings/access-tokens)
   - `EXPO_PUBLIC_API_BASE_URL` — reachable staging URL (see table above)

2. **Run workflow** — [Actions → Preview Build](https://github.com/AnhLead/CookingCompanion/actions/workflows/preview-build.yml) → `android` or `ios`

3. **Hand back** — paste the **install URL** from the workflow log on Paperclip **MON-119** (board provisioning ticket)

## Demo login (after V5 seed)

- Email: `dev@example.com`
- Password: `password`
- Use household **Demo Kitchen** in the app for library/import smoke

## Unblock chain

MON-119 (board) → MON-118 (artifact) → MON-117 (QA smoke) → MON-114 close
