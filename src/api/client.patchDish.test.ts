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

import { patchDish } from './client';

describe('patchDish', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects whitespace-only name before calling the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(patchDish('dish-1', { name: '   ' })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Dish name is required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PATCHes JSON body and optional X-Household-Id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : '') },
      json: async () => ({ id: 'dish-1', name: 'Renamed curry' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const dish = await patchDish('dish-1', { name: '  Renamed curry  ' }, { householdId: 'house-99' });

    expect(dish).toEqual({ id: 'dish-1', name: 'Renamed curry' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test.local/api/v1/dishes/dish-1');
    expect(init.method).toBe('PATCH');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Household-Id']).toBe('house-99');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Renamed curry' });
  });
});
