# Mobile release checklist (Expo / EAS)

## Profiles (`eas.json`)

| Profile       | Use case              | EAS Update channel | `EXPO_PUBLIC_APP_ENV` |
| ------------- | --------------------- | ------------------ | --------------------- |
| `development` | Dev client            | —                  | local default         |
| `preview`     | Internal testers, QA  | `preview`          | `preview`             |
| `production`  | App Store / Play      | `production`       | `production`          |

Build examples:

```bash
npx eas-cli build --profile preview --platform all
npx eas-cli build --profile production --platform all
```

## EAS Secrets checklist (preview + production)

Set these per profile in the [EAS dashboard](https://expo.dev) (**Project → Secrets**) or via `eas secret:create`. Do **not** commit API URLs or tokens to git.

| Secret / env var              | Preview | Production | Notes |
| ----------------------------- | ------- | ---------- | ----- |
| `EXPO_PUBLIC_API_BASE_URL`    | **Required** | **Required** | Staging API for preview; prod API for production. No trailing slash. |
| `EXPO_PUBLIC_APP_ENV`         | set in `eas.json` | set in `eas.json` | Drives fail-fast guard in `src/lib/config.ts`. |

Preview and production release builds **fail fast** at startup if `EXPO_PUBLIC_APP_ENV` is `preview` or `production` and the API base URL is missing (`assertReleaseApiConfig` in root layout).

Example (replace with your staging host from [API deploy runbook](/docs/API_DEPLOY.md)):

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value "https://staging-api.example.com" --type string
```

For profile-specific values, use EAS environment variables on the `preview` / `production` build profiles in the dashboard.

## Board one-command EAS setup (after `EXPO_TOKEN` is set)

Staging API (same machine or LAN):

```bash
./scripts/staging-up.sh
# health: curl http://localhost:8080/health
```

Link Expo project + set preview API URL (requires [Expo access token](https://expo.dev/settings/access-tokens)):

```bash
export EXPO_TOKEN="..."
./scripts/eas-preview-setup.sh http://192.168.1.100:8080
```

Replace the URL with your reachable staging host (LAN IP or public deploy).

## Board quick start

See **[BOARD_OPTION_C.md](/docs/BOARD_OPTION_C.md)** for the full unblock checklist (reachable staging URL + GitHub secrets + handback).

## Option C — GitHub Actions (no agent workspace token)

If `EXPO_TOKEN` cannot be set on the agent workspace, board can trigger a preview build from GitHub:

1. Add repo secrets (**Settings → Secrets and variables → Actions**):
   - `EXPO_TOKEN` — [Expo access token](https://expo.dev/settings/access-tokens)
   - `EXPO_PUBLIC_API_BASE_URL` — staging API URL (e.g. `http://192.168.1.100:8080` for LAN QA)
2. Open **Actions → Preview Build → Run workflow** (choose `android` or `ios`).
3. Copy the build URL from the workflow log and post it on the preview build / QA ticket to unblock device smoke.

First run may link the repo to an Expo project via `eas init` inside the workflow.

## Preview build (internal QA)

1. Confirm staging API is up ([API deploy runbook](/docs/API_DEPLOY.md)).
2. Set `EXPO_PUBLIC_API_BASE_URL` EAS Secret to the staging URL.
3. Build:

```bash
npx eas-cli build --profile preview --platform android
# or
npx eas-cli build --profile preview --platform ios
```

4. Install the artifact on a physical device (internal distribution).
5. On-device smoke (minimum):
   - Cold start → login screen (not a blank crash)
   - Sign in with demo credentials against staging API
   - Library loads; open a dish → variant → cook mode
   - If startup shows an error about missing API URL, the EAS Secret was not applied to that build profile

Record build ID, API base URL, device/OS, and pass/fail in the QA release smoke ticket.

## Version bump (store submission)

1. Bump `expo.version` in `app.json` for user-facing version strings.
2. For native store builds, follow [EAS app version](https://docs.expo.dev/build-reference/app-versions/) (`cli.appVersionSource` is `remote` in this repo).
3. Run production build, then `npx eas-cli submit --profile production`.

## OTA vs store

- **OTA (EAS Update):** ships JavaScript/assets to installs that already match a compatible native binary. Use `eas update --branch <channel>` (channels align with `preview` / `production` in `eas.json`). OTA cannot change native code or `app.json` permissions; those need a new store build.
- **Store build:** required for native changes, version bumps customers see in the store, or when the update runtime is incompatible.

## Sanity before tagging a release

- [ ] `EXPO_PUBLIC_API_BASE_URL` set for the target profile (EAS dashboard or secrets).
- [ ] Smoke test on a release build (not only Expo Go) against the intended API.
- [ ] `npm test` passes in CI.
- [ ] If using EAS Update, confirm the correct channel/branch for the binary you shipped.
