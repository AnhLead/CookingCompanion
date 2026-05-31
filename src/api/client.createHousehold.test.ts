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

import { createHousehold } from './client';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 400 ? 'Bad Request' : 'OK',
    headers: {
      get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : ''),
    },
    json: async () => body,
  };
}

describe('createHousehold', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects whitespace-only name before calling the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHousehold('   ')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Household name is required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs trimmed name and returns household summary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 'house-1',
        name: 'Test Kitchen',
        membershipRole: 'owner',
        inviteCode: 'ABC123DEF456',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const household = await createHousehold('  Test Kitchen  ');

    expect(household).toEqual({
      id: 'house-1',
      name: 'Test Kitchen',
      membershipRole: 'owner',
      inviteCode: 'ABC123DEF456',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test.local/api/v1/households');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Test Kitchen' });
  });

  it('maps validation errors from problem details', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(400, {
        title: 'Bad Request',
        status: 400,
        detail: 'name must not be blank',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(createHousehold('x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'name must not be blank',
    });
  });
});
