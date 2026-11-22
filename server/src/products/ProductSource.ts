import type { Category, Product } from '../domain/product';

/**
 * What every product data source must be able to do: Fake Store today, a database or a
 * platform like Shopify later. This is the swap point for product data: the rest of the app
 * only uses this interface, so changing the data source means writing one new class that
 * follows it and choosing it in container.ts.
 *
 * Search and category filtering are part of the interface, so a database-backed source can
 * do them with fast database queries instead of loading every product.
 */
export interface ProductSource {
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  listCategories(): Promise<Category[]>;
  listProductsByCategory(categorySlug: string): Promise<Product[]>;
  searchProducts(query: string): Promise<Product[]>;
  /**
   * The product's image (null if the product doesn't exist). The server serves images itself,
   * so the browser never loads them from the provider.
   */
  getProductImage(id: string): Promise<ProductImage | null>;
}

/** An image's raw bytes and its type, e.g. "image/png". */
export interface ProductImage {
  data: Buffer;
  contentType: string;
}

/** Thrown when the product data provider fails or sends data we can't read. */
export class ProductSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductSourceError';
  }
}
