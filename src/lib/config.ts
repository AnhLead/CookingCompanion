import Constants from 'expo-constants';

export function getApiBaseUrl(): string | undefined {
  const extra = Constants.expoConfig?.extra as { apiBase?: string } | undefined;
  const raw = extra?.apiBase?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, '') : undefined;
}
