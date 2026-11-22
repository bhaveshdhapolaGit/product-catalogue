import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalogueApi } from '../api/catalogueApi';
import { EnquiryForm } from '../components/EnquiryForm';
import { ErrorMessage, Loading } from '../components/Status';
import { formatPrice } from '../format';
import { useAsync } from '../hooks/useAsync';

/** Product details page, with an Enquire button that opens the enquiry form. */
export function ProductPage() {
  const { id = '' } = useParams();
  const result = useAsync(() => catalogueApi.getProduct(id), [id]);
  const [enquiring, setEnquiring] = useState(false);

  if (result.status === 'loading') return <Loading />;
  if (result.status === 'error') return <ErrorMessage message={result.error.message} />;

  const product = result.data;
  return (
    <article className="product-detail">
      <div className="product-detail__image">
        <img src={product.imageUrl} alt={product.title} />
      </div>

      <div className="product-detail__info">
        <Link to={`/category/${product.category.slug}`} className="muted">
          {product.category.name}
        </Link>
        <h1>{product.title}</h1>
        <p className="product-detail__price">{formatPrice(product.price, product.currency)}</p>
        <p className="muted">
          ★ {product.rating.average.toFixed(1)} ({product.rating.count} reviews)
        </p>
        <p>{product.description}</p>

        {enquiring ? (
          <EnquiryForm productId={product.id} productTitle={product.title} />
        ) : (
          <button type="button" onClick={() => setEnquiring(true)}>
            Enquire
          </button>
        )}
      </div>
    </article>
  );
}
