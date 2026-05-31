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

import { patchVariant } from './client';

describe('patchVariant', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects whitespace-only title before calling the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(patchVariant('var-1', { title: '   ' })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Variant title is required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PATCHes JSON body and optional X-Household-Id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : '') },
      json: async () => ({
        id: 'var-1',
        dishId: 'dish-1',
        title: 'Updated title',
        yields: '6 servings',
        prepTimeMin: 15,
        cookTimeMin: 30,
        canonical: true,
        ingredients: [],
        steps: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const variant = await patchVariant(
      'var-1',
      {
        title: '  Updated title  ',
        yields: '6 servings',
        prepTimeMin: 15,
        cookTimeMin: 30,
        canonical: true,
      },
      { householdId: 'house-99' }
    );

    expect(variant.title).toBe('Updated title');
    expect(variant.totalTimeMin).toBe(45);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test.local/api/v1/variants/var-1');
    expect(init.method).toBe('PATCH');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Household-Id']).toBe('house-99');
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'Updated title',
      yields: '6 servings',
      prepTimeMin: 15,
      cookTimeMin: 30,
      canonical: true,
    });
  });
});
