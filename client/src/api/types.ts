/**
 * The shape of the data our API sends and receives. These match the server's types.
 * They are copied rather than shared between client and server; see DECISIONS.md for why.
 */
export interface Category {
  slug: string;
  name: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  /** Always our own image route (/api/products/:id/image), never Fake Store's address. */
  imageUrl: string;
  category: Category;
  rating: { average: number; count: number };
}

export interface CategoryPage {
  category: Category;
  topRated: Product[];
  others: Product[];
}

export interface EnquiryRequest {
  productId: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
}

/** Error messages per form field, e.g. { email: ['Enter a valid email address'] }. */
export type FieldErrors = Partial<Record<keyof EnquiryRequest, string[]>>;
