import { describe, expect, it, vi } from 'vitest';
import { ApiError, catalogueApi } from './catalogueApi';

function mockFetch(body: unknown, status = 200) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe('catalogueApi', () => {
  it('calls our own API with an encoded search term', async () => {
    const fetchSpy = mockFetch({ products: [] });
    await catalogueApi.searchProducts('rings & things');
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/products?q=rings+%26+things');
  });

  it('posts enquiries as JSON', async () => {
    const fetchSpy = mockFetch({ status: 'received' }, 201);
    await catalogueApi.submitEnquiry({ productId: '1', name: 'Ada', email: 'ada@example.com' });

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('/api/enquiries');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      productId: '1',
      name: 'Ada',
      email: 'ada@example.com',
    });
  });

  it('turns error responses into ApiError with the server message and field errors', async () => {
    mockFetch({ error: 'Invalid request', fields: { email: ['Enter a valid email address'] } }, 400);
    const error = await catalogueApi.submitEnquiry({ productId: '1', name: 'A', email: 'x' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: 'Invalid request',
      fields: { email: ['Enter a valid email address'] },
    });
  });

  it('reports a friendly message when the server cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(catalogueApi.getFeaturedProducts()).rejects.toMatchObject({
      status: 0,
      message: expect.stringMatching(/Unable to reach the server/),
    });
  });
});
