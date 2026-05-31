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

import { deleteVariant } from './client';

describe('deleteVariant', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('DELETEs with optional X-Household-Id and no body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => '' },
    });
    vi.stubGlobal('fetch', fetchMock);

    await deleteVariant('var-1', { householdId: 'house-99' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test.local/api/v1/variants/var-1');
    expect(init.method).toBe('DELETE');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Household-Id']).toBe('house-99');
    expect(init.body).toBeUndefined();
  });
});
