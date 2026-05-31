import { postRefreshToken } from './refresh';
import { clearStoredTokens, getStoredTokens, setStoredTokens } from './tokens';

let refreshInFlight: Promise<string | null> | null = null;

export type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch {
      /* ignore listener errors */
    }
  }
}

/** Clears stored tokens and notifies listeners (e.g. navigate to login). */
export async function handleSessionExpired(): Promise<void> {
  await clearStoredTokens();
  notifySessionExpired();
}

/**
 * Exchanges the refresh token for a new access token (and optional rotated refresh).
 * Concurrent callers share one in-flight refresh.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefreshAccessToken(): Promise<string | null> {
  const stored = await getStoredTokens();
  if (!stored?.refreshToken) {
    return null;
  }
  try {
    const res = await postRefreshToken({ refreshToken: stored.refreshToken });
    const accessToken = res.accessToken?.trim();
    if (!accessToken) {
      await handleSessionExpired();
      return null;
    }
    const refreshToken = res.refreshToken.trim() || stored.refreshToken;
    await setStoredTokens({ accessToken, refreshToken });
    return accessToken;
  } catch {
    await handleSessionExpired();
    return null;
  }
}

/** Resets in-flight refresh state (tests only). */
export function resetRefreshState(): void {
  refreshInFlight = null;
}
