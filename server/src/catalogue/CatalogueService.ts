import type { Category, Product } from '../domain/product';
import type { ProductImage, ProductSource } from '../products/ProductSource';

/** Number of products on the home page (from the acceptance criteria). */
export const FEATURED_COUNT = 5;
/** Number of "top rated" products at the top of a category page (our assumption). */
export const CATEGORY_TOP_RATED_COUNT = 3;

/** What a category page shows: the category, its top-rated products, and the rest. */
export interface CategoryPage {
  category: Category;
  topRated: Product[];
  others: Product[];
}

/** Sort order: highest rating first. If two ratings are equal, the one with more reviews wins. */
export function byRating(a: Product, b: Product): number {
  return b.rating.average - a.rating.average || b.rating.count - a.rating.count;
}

/**
 * The catalogue's business rules. It doesn't know about HTTP or Fake Store;
 * it only uses the ProductSource interface.
 */
export class CatalogueService {
  constructor(
    private readonly source: ProductSource,
    /** Product IDs the owner chose for the home page, in display order. */
    private readonly featuredProductIds: string[],
  ) {}

  /**
   * The owner's chosen products, in their order. IDs that don't exist are skipped.
   * If fewer than 5 are left, the highest-rated other products fill the gaps,
   * so the home page always shows 5.
   */
  async getFeaturedProducts(): Promise<Product[]> {
    const products = await this.source.listProducts();

    // 1. The chosen products: duplicates removed, unknown IDs skipped, at most 5
    const chosen = [...new Set(this.featuredProductIds)]
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is Product => product !== undefined)
      .slice(0, FEATURED_COUNT);

    // 2. Fill any empty places with the best-rated products that aren't already chosen
    const chosenIds = new Set(chosen.map((product) => product.id));
    const topUp = products
      .filter((product) => !chosenIds.has(product.id))
      .sort(byRating)
      .slice(0, FEATURED_COUNT - chosen.length);

    return [...chosen, ...topUp];
  }

  /** The category's 3 best-rated products, then the rest of it. Returns null if the category doesn't exist. */
  async getCategoryPage(categorySlug: string): Promise<CategoryPage | null> {
    const categories = await this.source.listCategories();
    const category = categories.find((candidate) => candidate.slug === categorySlug);
    if (!category) return null;

    const products = await this.source.listProductsByCategory(category.slug);
    // Copy the list before sorting, because sort() changes the original list.
    const topRated = [...products].sort(byRating).slice(0, CATEGORY_TOP_RATED_COUNT);
    const others = products.filter((product) => !topRated.includes(product));

    return { category, topRated, others };
  }

  // The methods below simply pass through for now. Routes still call them through this
  // service, so future rules (e.g. hiding out-of-stock products) have one place to go.

  listCategories(): Promise<Category[]> {
    return this.source.listCategories();
  }

  getProduct(id: string): Promise<Product | null> {
    return this.source.getProduct(id);
  }

  searchProducts(query: string): Promise<Product[]> {
    return this.source.searchProducts(query);
  }

  getProductImage(id: string): Promise<ProductImage | null> {
    return this.source.getProductImage(id);
  }
}
