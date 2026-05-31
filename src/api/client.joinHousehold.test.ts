import { afterEach, describe, expect, it, vi } from 'vitest';

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
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { resetTokenStore } from '../auth/tokens';
import { ApiError, joinHouseholdErrorMessage, joinHouseholdWithCode } from './client';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : 'OK',
    headers: {
      get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : ''),
    },
    json: async () => body,
  };
}

describe('joinHouseholdWithCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete memoryStore.access;
    delete memoryStore.refresh;
    resetTokenStore();
  });

  it('rejects whitespace-only code before calling the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(joinHouseholdWithCode('   ')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Invite code is required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs trimmed code with bearer auth when tokens are stored', async () => {
    memoryStore.access = 'access-abc';
    memoryStore.refresh = 'refresh-xyz';

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 'house-1',
        name: 'Demo Kitchen',
        membershipRole: 'member',
        inviteCode: null,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const household = await joinHouseholdWithCode('  DEMOKIT1  ');

    expect(household).toEqual({
      id: 'house-1',
      name: 'Demo Kitchen',
      membershipRole: 'member',
      inviteCode: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test.local/api/v1/households/join');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ code: 'DEMOKIT1' });
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-abc');
  });
});

describe('joinHouseholdErrorMessage', () => {
  it('maps 401 to sign-in guidance', () => {
    expect(joinHouseholdErrorMessage(new ApiError('Unauthorized', 401))).toBe(
      'Sign in to join a household.'
    );
  });

  it('maps 403 to permission guidance', () => {
    expect(joinHouseholdErrorMessage(new ApiError('Forbidden', 403))).toBe(
      'You do not have permission to join this household.'
    );
  });

  it('maps 404 to invalid code guidance', () => {
    expect(joinHouseholdErrorMessage(new ApiError('Invalid invite code', 404))).toBe(
      'That invite code is not valid. Check with your household owner.'
    );
  });
});
