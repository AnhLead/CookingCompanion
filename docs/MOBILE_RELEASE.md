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

Set `EXPO_PUBLIC_API_BASE_URL` (and any secrets) per profile using EAS Secrets or `env` blocks in `eas.json`. Production release builds **fail fast** at startup if `EXPO_PUBLIC_APP_ENV=production` and the API base URL is missing (`src/lib/config.ts`).

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
