import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { apiBase: 'http://test.local' } } },
}));

vi.mock('../lib/errorReporting', () => ({
  reportClientError: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { authLogin } from './client';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'OK',
    headers: {
      get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : ''),
    },
    json: async () => body,
  };
}

describe('authLogin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns tokens on successful login', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        accessToken: 'access-jwt',
        refreshToken: 'refresh-opaque',
        expiresIn: 900,
        tokenType: 'Bearer',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await authLogin({ email: 'dev@example.com', password: 'password' });

    expect(tokens).toEqual({ accessToken: 'access-jwt', refreshToken: 'refresh-opaque' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test.local/api/v1/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'dev@example.com',
      password: 'password',
    });
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('throws ApiError on invalid credentials', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { title: 'Unauthorized', status: 401, detail: 'Bad creds' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authLogin({ email: 'dev@example.com', password: 'wrong' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    });
  });

  it('requires email and password', async () => {
    await expect(authLogin({ email: '  ', password: '' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    });
  });
});
