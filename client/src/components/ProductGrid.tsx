import type { Product } from '../api/types';
import { ProductTile } from './ProductTile';

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
}

/** A grid of product cards, or a message if there are no products. */
export function ProductGrid({ products, emptyMessage = 'No products found.' }: ProductGridProps) {
  if (products.length === 0) return <p className="muted">{emptyMessage}</p>;

  return (
    <ul className="product-grid">
      {products.map((product) => (
        <li key={product.id}>
          <ProductTile product={product} />
        </li>
      ))}
    </ul>
  );
}
