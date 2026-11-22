import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeStoreProductSource, parseFakeStoreProducts, toCategory } from '../src/products/FakeStoreProductSource';
import snapshot from '../src/products/fakeStoreSnapshot.json';
import { ProductSourceError } from '../src/products/ProductSource';

/** Products in Fake Store's own format. */
const backpack = {
  id: 1,
  title: ' Laptop Backpack ',
  price: 109.95,
  description: 'Fits 15 inch laptops',
  category: "men's clothing",
  image: 'https://fakestoreapi.com/img/1.png',
  rating: { rate: 3.9, count: 120 },
};
const ring = {
  id: 5,
  title: 'Gold Ring',
  price: 695,
  description: 'Solid gold',
  category: 'jewelery',
  image: 'https://fakestoreapi.com/img/5.png',
  rating: { rate: 4.6, count: 400 },
};

/** A fake fetch that always returns this JSON. It makes a new response each time, because a response can only be read once. */
function respondWith(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

function sourceWith(fetchFn: unknown) {
  return new FakeStoreProductSource('https://fakestore.test', fetchFn as unknown as typeof fetch);
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('mapping Fake Store data into our Product', () => {
  it('maps every field', async () => {
    const [product] = await sourceWith(respondWith([backpack])).listProducts();

    expect(product).toEqual({
      id: '1',
      title: 'Laptop Backpack',
      description: 'Fits 15 inch laptops',
      price: 109.95,
      currency: 'USD',
      imageUrl: 'https://fakestoreapi.com/img/1.png',
      category: { slug: 'mens-clothing', name: "Men's clothing" },
      rating: { average: 3.9, count: 120 },
    });
  });

  it('builds URL-safe category slugs', () => {
    expect(toCategory("women's clothing")).toEqual({ slug: 'womens-clothing', name: "Women's clothing" });
    expect(toCategory('electronics')).toEqual({ slug: 'electronics', name: 'Electronics' });
  });

  it('rejects data in an unexpected format', () => {
    expect(() => parseFakeStoreProducts([{ ...backpack, price: 'free' }])).toThrow('unexpected format');
    expect(() => parseFakeStoreProducts({ error: 'nope' })).toThrow('unexpected format');
  });

  it('can parse the bundled snapshot', () => {
    expect(parseFakeStoreProducts(snapshot)).toHaveLength(20);
  });
});

describe('queries', () => {
  const source = () => sourceWith(respondWith([backpack, ring]));

  it('lists categories sorted by name', async () => {
    expect(await source().listCategories()).toEqual([
      { slug: 'jewelery', name: 'Jewelery' },
      { slug: 'mens-clothing', name: "Men's clothing" },
    ]);
  });

  it('lists products in a category', async () => {
    const products = await source().listProductsByCategory('jewelery');
    expect(products.map((p) => p.id)).toEqual(['5']);
  });

  it('finds a product by id, or returns null', async () => {
    expect((await source().getProduct('5'))?.title).toBe('Gold Ring');
    expect(await source().getProduct('999')).toBeNull();
  });
});

describe('search', () => {
  // backpack's description is "Fits 15 inch laptops" and its category is "men's clothing".
  const search = async (query: string) =>
    (await sourceWith(respondWith([backpack, ring])).searchProducts(query)).map((p) => p.title);

  it('matches the title, ignoring case', async () => {
    expect(await search('BACKPACK')).toEqual(['Laptop Backpack']);
    expect(await search('gold')).toEqual(['Gold Ring']);
  });

  it('also matches the category name', async () => {
    expect(await search("MEN'S")).toEqual(['Laptop Backpack']); // category "men's clothing"
    expect(await search('jewel')).toEqual(['Gold Ring']); // category "jewelery"
  });

  it('does not search the description', async () => {
    expect(await search('laptops')).toEqual([]); // only in the backpack's description
  });

  it('returns nothing for a blank or unknown term', async () => {
    expect(await search('   ')).toEqual([]);
    expect(await search('zzz')).toEqual([]);
  });
});

describe('caching', () => {
  it('calls Fake Store once, then reuses the result for 5 minutes', async () => {
    vi.useFakeTimers();
    const fetchFn = respondWith([backpack]);
    const source = sourceWith(fetchFn);

    await source.listProducts();
    await source.searchProducts('backpack');
    await source.getProduct('1');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await source.listProducts();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('product images', () => {
  /** A fake fetch: the product list request gets `backpack`; any other URL (the image) gets `image()`. */
  function fetchWithImage(image: () => Response | Promise<Response>) {
    return vi.fn(async (url: string | URL) =>
      String(url).endsWith('/products') ? new Response(JSON.stringify([backpack])) : image(),
    );
  }

  it("fetches the image from the product's own image URL", async () => {
    const fetchFn = fetchWithImage(
      () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }),
    );
    const image = await sourceWith(fetchFn).getProductImage('1');

    expect(image).toEqual({ data: Buffer.from([1, 2, 3]), contentType: 'image/png' });
    expect(fetchFn).toHaveBeenLastCalledWith('https://fakestoreapi.com/img/1.png', expect.any(Object));
  });

  it('returns null for an unknown product without fetching any image', async () => {
    const fetchFn = fetchWithImage(() => new Response(''));
    expect(await sourceWith(fetchFn).getProductImage('999')).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1); // only the product list
  });

  it.each([
    ['is not an image', () => new Response('<html>blocked</html>', { headers: { 'Content-Type': 'text/html' } })],
    ['is an SVG (which can contain scripts)', () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })],
    ['is an HTTP error', () => new Response('', { status: 404, headers: { 'Content-Type': 'image/png' } })],
    ['cannot be reached', () => Promise.reject(new TypeError('fetch failed'))],
  ])('throws ProductSourceError when the image response %s', async (_case, image) => {
    await expect(sourceWith(fetchWithImage(image)).getProductImage('1')).rejects.toThrow(ProductSourceError);
  });
});

describe('fallback to the bundled snapshot', () => {
  // Each case creates its own fake fetch, so one case can't affect another.
  it.each([
    ['an HTTP error', () => respondWith({}, 503), 'HTTP 503'],
    ['a network failure', () => vi.fn(async () => Promise.reject(new TypeError('fetch failed'))), 'fetch failed'],
    ['a non-JSON response', () => vi.fn(async () => new Response('<html>blocked</html>')), 'JSON'],
    ['data in the wrong format', () => respondWith([{ id: 'not-a-number' }]), 'unexpected format'],
  ])('serves the snapshot and logs a warning on %s', async (_case, makeFetch, expectedReason) => {
    const products = await sourceWith(makeFetch()).listProducts();

    expect(products).toHaveLength(20);
    // Checking the logged reason proves the saved copy was used because of this particular failure.
    expect(console.warn).toHaveBeenCalledWith(
      'Fake Store unavailable, serving bundled snapshot:',
      expect.stringContaining(expectedReason),
    );
  });
});
