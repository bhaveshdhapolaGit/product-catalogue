import { Link } from 'react-router-dom';
import type { Product } from '../api/types';
import { formatPrice } from '../format';

/** A product card (image, title, price, rating). Clicking it opens the product page. */
export function ProductTile({ product }: { product: Product }) {
  return (
    <Link to={`/product/${encodeURIComponent(product.id)}`} className="product-tile">
      <div className="product-tile__image">
        <img src={product.imageUrl} alt="" loading="lazy" />
      </div>
      <h3 className="product-tile__title">{product.title}</h3>
      <p className="product-tile__price">{formatPrice(product.price, product.currency)}</p>
      <p className="product-tile__rating" aria-label={`Rated ${product.rating.average} out of 5`}>
        ★ {product.rating.average.toFixed(1)}
      </p>
    </Link>
  );
}
