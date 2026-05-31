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

import { createDish } from './client';

describe('createDish', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects whitespace-only name before calling the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(createDish({ name: '   ' })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Dish name is required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs JSON body and optional X-Household-Id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : '') },
      json: async () => ({ id: 'dish-1', name: 'Curry' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const dish = await createDish({ name: '  Curry  ' }, { householdId: 'house-99' });

    expect(dish).toEqual({ id: 'dish-1', name: 'Curry' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Household-Id']).toBe('house-99');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Curry' });
  });
});
