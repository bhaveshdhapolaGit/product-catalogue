import type { Category, CategoryPage, EnquiryRequest, FieldErrors, Product } from './types';

/** An error from our API: the HTTP status, a message to show, and any per-field form errors. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: FieldErrors = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Sends a request to our own API (on the same website address, under /api).
 * The client never calls Fake Store or any other outside service.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    });
  } catch {
    // The request never reached the server (e.g. no internet connection)
    throw new ApiError(0, 'Unable to reach the server. Check your connection and try again.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Use the server's error message and field errors if it sent any
    const { error, fields } = (body ?? {}) as { error?: string; fields?: FieldErrors };
    throw new ApiError(response.status, error ?? 'Something went wrong', fields);
  }
  return body as T;
}

/** Every API call the app makes. Pages use these instead of calling fetch themselves. */
export const catalogueApi = {
  async getFeaturedProducts(): Promise<Product[]> {
    return (await request<{ products: Product[] }>('/products/featured')).products;
  },

  async getCategories(): Promise<Category[]> {
    return (await request<{ categories: Category[] }>('/categories')).categories;
  },

  getCategoryPage(slug: string): Promise<CategoryPage> {
    return request<CategoryPage>(`/categories/${encodeURIComponent(slug)}/products`);
  },

  async searchProducts(query: string): Promise<Product[]> {
    const params = new URLSearchParams({ q: query });
    return (await request<{ products: Product[] }>(`/products?${params}`)).products;
  },

  async getProduct(id: string): Promise<Product> {
    return (await request<{ product: Product }>(`/products/${encodeURIComponent(id)}`)).product;
  },

  async submitEnquiry(enquiry: EnquiryRequest): Promise<void> {
    await request('/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enquiry),
    });
  },
};
