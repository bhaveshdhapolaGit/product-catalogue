import { z } from 'zod';
import type { Category, Product } from '../domain/product';
import snapshot from './fakeStoreSnapshot.json';
import { ProductSourceError, type ProductImage, type ProductSource } from './ProductSource';

/**
 * Gets product data from the Fake Store API (https://fakestoreapi.com).
 *
 * - This is the only file that knows about Fake Store. It checks Fake Store's data and
 *   converts it into our own Product type.
 * - Fake Store has only about 20 products and no search, so we load them all at once, keep
 *   them for 5 minutes (a cache), and answer every request from that list.
 * - If Fake Store is down, we use a saved copy of its data (fakeStoreSnapshot.json),
 *   so the site keeps working.
 */

/** How long to keep the product list before fetching it again (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;
/** Give up on Fake Store if it doesn't answer within 5 seconds. */
const REQUEST_TIMEOUT_MS = 5000;
/** Refuse images over 5 MB (Fake Store's images are much smaller). */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/**
 * Only these image types are served. SVG is deliberately not allowed: an SVG file can contain
 * scripts, and we serve images from our own website address.
 */
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
/** Fake Store doesn't say which currency it uses. It's a US demo, so we assume US dollars. */
const CURRENCY = 'USD';

/** The data we expect from Fake Store. Anything that doesn't match is rejected. */
const fakeStoreProductsSchema = z.array(
  z.object({
    id: z.number().int(),
    title: z.string(),
    price: z.number().nonnegative(),
    description: z.string(),
    category: z.string().min(1),
    image: z.url(),
    rating: z.object({ rate: z.number(), count: z.number().int() }).optional(),
  }),
);

/** One product in Fake Store's own format. */
type FakeStoreProduct = z.infer<typeof fakeStoreProductsSchema>[number];

export class FakeStoreProductSource implements ProductSource {
  /** The saved product list and when it expires. */
  private cache: { products: Product[]; expiresAt: number } | null = null;

  constructor(
    private readonly baseUrl: string,
    /** The function used to make web requests. Tests pass in a fake one so they don't use the internet. */
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /** All products. Uses the saved list if it's less than 5 minutes old, otherwise loads it again. */
  async listProducts(): Promise<Product[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.products;
    }
    const products = await this.loadProducts();
    this.cache = { products, expiresAt: Date.now() + CACHE_TTL_MS };
    return products;
  }

  /** One product by ID, or null if there's no such product. */
  async getProduct(id: string): Promise<Product | null> {
    const products = await this.listProducts();
    return products.find((product) => product.id === id) ?? null;
  }

  /** Every category, without duplicates, sorted by name. */
  async listCategories(): Promise<Category[]> {
    const products = await this.listProducts();
    const categories = new Map<string, Category>();
    for (const product of products) {
      categories.set(product.category.slug, product.category);
    }
    return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** All products in one category. */
  async listProductsByCategory(categorySlug: string): Promise<Product[]> {
    const products = await this.listProducts();
    return products.filter((product) => product.category.slug === categorySlug);
  }

  /** Products whose title or category name contains the search term (ignoring upper/lower case). */
  async searchProducts(query: string): Promise<Product[]> {
    const term = query.trim().toLowerCase();
    if (term === '') return [];

    const products = await this.listProducts();
    return products.filter(
      (product) =>
        product.title.toLowerCase().includes(term) ||
        product.category.name.toLowerCase().includes(term),
    );
  }

  /**
   * Downloads the product's image from Fake Store. The image address comes from our own
   * product data, never from the request, so nobody can make our server download other URLs.
   */
  async getProductImage(id: string): Promise<ProductImage | null> {
    const product = await this.getProduct(id);
    if (!product) return null;

    let response: Response;
    try {
      response = await this.fetchFn(product.imageUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      throw new ProductSourceError(`Could not reach Fake Store for the image of product ${id}`);
    }

    // Make sure we got back an image of an allowed type ("image/png; charset=..." -> "image/png")
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!response.ok || !ALLOWED_IMAGE_TYPES.includes(contentType)) {
      throw new ProductSourceError(`Fake Store did not return an allowed image for product ${id}`);
    }

    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > MAX_IMAGE_BYTES) {
      throw new ProductSourceError(`Image for product ${id} is too large`);
    }
    return { data, contentType };
  }

  /** Gets the products from Fake Store, or from the saved copy if Fake Store fails. */
  private async loadProducts(): Promise<Product[]> {
    try {
      return await this.fetchFromApi();
    } catch (error) {
      console.warn('Fake Store unavailable, serving bundled snapshot:', String(error));
      return parseFakeStoreProducts(snapshot);
    }
  }

  /** Calls Fake Store's /products endpoint. */
  private async fetchFromApi(): Promise<Product[]> {
    const response = await this.fetchFn(new URL('/products', this.baseUrl), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new ProductSourceError(`Fake Store responded with HTTP ${response.status}`);
    }
    return parseFakeStoreProducts(await response.json());
  }
}

/** Checks data from Fake Store and converts it into our Product type. Throws if it's not in the expected format. */
export function parseFakeStoreProducts(data: unknown): Product[] {
  const result = fakeStoreProductsSchema.safeParse(data);
  if (!result.success) {
    throw new ProductSourceError('Fake Store returned data in an unexpected format');
  }
  return result.data.map(toProduct);
}

/** Converts one Fake Store product into our Product type. */
function toProduct(raw: FakeStoreProduct): Product {
  return {
    id: String(raw.id),
    title: raw.title.trim(),
    description: raw.description.trim(),
    price: raw.price,
    currency: CURRENCY,
    imageUrl: raw.image,
    category: toCategory(raw.category),
    rating: { average: raw.rating?.rate ?? 0, count: raw.rating?.count ?? 0 },
  };
}

/** "men's clothing" becomes { slug: "mens-clothing", name: "Men's clothing" }. */
export function toCategory(rawName: string): Category {
  const slug = rawName
    .toLowerCase()
    .replace(/'/g, '') // remove apostrophes: "men's" -> "mens"
    .replace(/[^a-z0-9]+/g, '-') // anything that isn't a letter or number becomes a dash
    .replace(/^-|-$/g, ''); // no dash at the start or end
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  return { slug, name };
}
