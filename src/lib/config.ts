import Constants from 'expo-constants';

export type AppEnvironment = 'development' | 'preview' | 'production';

type ExpoExtra = {
  apiBase?: string;
  appEnv?: string;
};

function readExtra(): ExpoExtra {
  return (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
}

export function getAppEnvironment(): AppEnvironment {
  const raw = readExtra().appEnv?.trim().toLowerCase();
  if (raw === 'preview' || raw === 'production') return raw;
  return 'development';
}

export function isProductionAppEnvironment(): boolean {
  return getAppEnvironment() === 'production';
}

export function getApiBaseUrl(): string | undefined {
  const extra = readExtra();
  const raw = extra.apiBase?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, '') : undefined;
}

export function getMobileConfigSummary(): {
  appEnv: AppEnvironment;
  apiBaseConfigured: boolean;
} {
  return {
    appEnv: getAppEnvironment(),
    apiBaseConfigured: Boolean(getApiBaseUrl()),
  };
}

/**
 * Fail fast in release builds when production profile is used without an API base URL.
 * Safe to call once at app startup (e.g. root layout).
 */
export function assertReleaseApiConfig(): void {
  // Metro sets `__DEV__` in app bundles; omit the check in Node (tests) and in dev.
  if (typeof __DEV__ === 'undefined' || __DEV__) return;
  if (!isProductionAppEnvironment()) return;
  if (getApiBaseUrl()) return;
  throw new Error(
    'Production build is missing EXPO_PUBLIC_API_BASE_URL. Set it in eas.json env, EAS Secrets, or the EAS dashboard for the production profile.'
  );
}
