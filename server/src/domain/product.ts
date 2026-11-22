/**
 * Our own product and category types. Every data source converts its data into these,
 * so the rest of the app never depends on one provider's format.
 */
export interface Category {
  /** Used in URLs, e.g. "mens-clothing". */
  slug: string;
  /** Shown to users, e.g. "Men's clothing". */
  name: string;
}

export interface Product {
  /** Text rather than a number, because other providers use IDs like "gid://shop/Product/1" or UUIDs. */
  id: string;
  title: string;
  description: string;
  price: number;
  /** Currency code, e.g. "USD". */
  currency: string;
  /** Where the provider hosts the image. Only used on the server; the API sends our own image route instead. */
  imageUrl: string;
  category: Category;
  /** Average star rating and number of reviews. */
  rating: {
    average: number;
    count: number;
  };
}
