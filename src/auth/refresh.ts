import { getApiBaseUrl } from '../lib/config';
import type { RefreshTokenRequest, RefreshTokenResponse } from './types';

const REFRESH_PATH = '/api/v1/auth/refresh';

/**
 * Calls the refresh endpoint without going through the authenticated API client
 * (avoids 401 → refresh recursion).
 */
export async function postRefreshToken(
  body: RefreshTokenRequest,
  fetchImpl: typeof fetch = fetch
): Promise<RefreshTokenResponse> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('API base URL not configured');
  }
  const res = await fetchImpl(`${base}${REFRESH_PATH}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Refresh failed: HTTP ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as RefreshTokenResponse;
}
