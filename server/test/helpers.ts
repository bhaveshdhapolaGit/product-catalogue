import type { Category, Product } from '../src/domain/product';
import type { EmailMessage, EmailSender } from '../src/email/EmailSender';
import type { ProductSource } from '../src/products/ProductSource';

/** Creates a test product. Only the ID is required; pass any fields you want to change. */
export function makeProduct(overrides: Partial<Product> & { id: string }): Product {
  return {
    title: `Product ${overrides.id}`,
    description: 'A product',
    price: 10,
    currency: 'USD',
    imageUrl: `https://images.example.com/${overrides.id}.png`,
    category: { slug: 'electronics', name: 'Electronics' },
    rating: { average: 3, count: 10 },
    ...overrides,
  };
}

export const electronics = { slug: 'electronics', name: 'Electronics' };
export const jewellery = { slug: 'jewelery', name: 'Jewelery' };

/** A small set of test products. Each has a different rating, so the sort order is easy to check. */
export const catalogueFixture: Product[] = [
  makeProduct({ id: '1', title: 'Laptop Backpack', category: electronics, rating: { average: 3.9, count: 120 } }),
  makeProduct({ id: '2', title: 'SSD Drive', category: electronics, rating: { average: 4.8, count: 300 } }),
  makeProduct({ id: '3', title: 'Monitor', category: electronics, rating: { average: 2.2, count: 50 } }),
  makeProduct({ id: '4', title: 'USB Hub', category: electronics, rating: { average: 4.8, count: 100 } }),
  makeProduct({ id: '5', title: 'Gold Ring', category: jewellery, rating: { average: 4.6, count: 70 } }),
  makeProduct({ id: '6', title: 'Silver Bracelet', category: jewellery, rating: { average: 1.9, count: 20 } }),
  makeProduct({ id: '7', title: 'Keyboard', category: electronics, rating: { average: 4.0, count: 80 } }),
];

/** A fake product source for tests: answers from a list in memory, so tests never use the internet. */
export class FakeProductSource implements ProductSource {
  constructor(private readonly products: Product[] = catalogueFixture) {}

  async listProducts() {
    return this.products;
  }

  async getProduct(id: string) {
    return this.products.find((product) => product.id === id) ?? null;
  }

  async listCategories() {
    const categories = new Map<string, Category>();
    for (const product of this.products) categories.set(product.category.slug, product.category);
    return [...categories.values()];
  }

  async listProductsByCategory(slug: string) {
    return this.products.filter((product) => product.category.slug === slug);
  }

  async searchProducts(query: string) {
    return this.products.filter((product) => product.title.toLowerCase().includes(query.toLowerCase()));
  }

  async getProductImage(id: string) {
    const product = await this.getProduct(id);
    return product ? { data: Buffer.from(`image-${id}`), contentType: 'image/png' } : null;
  }
}

/** A fake email sender: keeps emails in a list instead of sending them. Set `failWith` to pretend the provider is down. */
export class FakeEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  failWith?: Error;

  async send(message: EmailMessage): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
  }
}
