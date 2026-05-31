import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { apiBase: 'http://test.local' } } },
}));

vi.mock('../lib/errorReporting', () => ({
  reportClientError: vi.fn(),
}));

const memoryStore: { access?: string; refresh?: string } = {};

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => {
    if (key.includes('access')) return memoryStore.access ?? null;
    if (key.includes('refresh')) return memoryStore.refresh ?? null;
    return null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    if (key.includes('access')) memoryStore.access = value;
    if (key.includes('refresh')) memoryStore.refresh = value;
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    if (key.includes('access')) delete memoryStore.access;
    if (key.includes('refresh')) delete memoryStore.refresh;
  }),
}));

import { resetRefreshState } from '../auth/session';
import { resetTokenStore } from '../auth/tokens';
import { listHouseholds } from './client';

function jsonResponse(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (h: string) => {
        const key = h.toLowerCase();
        if (key === 'content-type') return 'application/json';
        return extraHeaders[key] ?? '';
      },
    },
    json: async () => body,
  };
}

describe('API client auth refresh on 401', () => {
  beforeEach(() => {
    delete memoryStore.access;
    delete memoryStore.refresh;
    memoryStore.access = 'old-access';
    memoryStore.refresh = 'old-refresh';
    resetRefreshState();
    resetTokenStore();
    vi.stubEnv('EXPO_PUBLIC_API_BEARER', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetRefreshState();
  });

  it('refreshes tokens and retries the original request once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { title: 'Unauthorized', status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: 'new-access', refreshToken: 'new-refresh' })
      )
      .mockResolvedValueOnce(jsonResponse(200, [{ id: 'h1', name: 'Home' }]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listHouseholds();

    expect(result).toEqual({ items: [{ id: 'h1', name: 'Home' }], endpointAvailable: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const refreshCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(refreshCall[0]).toBe('http://test.local/api/v1/auth/refresh');
    expect(refreshCall[1].method).toBe('POST');
    expect(JSON.parse(refreshCall[1].body as string)).toEqual({ refreshToken: 'old-refresh' });

    const retryCall = fetchMock.mock.calls[2] as [string, RequestInit];
    const retryHeaders = retryCall[1].headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new-access');

    expect(memoryStore.access).toBe('new-access');
    expect(memoryStore.refresh).toBe('new-refresh');
  });

  it('clears session and does not retry when refresh fails', async () => {
    const sessionExpired = vi.fn();
    const { onSessionExpired } = await import('../auth/session');
    const unsub = onSessionExpired(sessionExpired);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { title: 'Unauthorized', status: 401 }))
      .mockResolvedValueOnce(jsonResponse(401, { title: 'Invalid refresh', status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listHouseholds()).rejects.toMatchObject({ name: 'ApiError', status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(memoryStore.access).toBeUndefined();
    expect(memoryStore.refresh).toBeUndefined();
    expect(sessionExpired).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('does not attempt refresh when only dev bearer is used (no stored refresh)', async () => {
    delete memoryStore.access;
    delete memoryStore.refresh;
    vi.stubEnv('EXPO_PUBLIC_API_BEARER', 'dev-only-token');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { title: 'Unauthorized', status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listHouseholds()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
