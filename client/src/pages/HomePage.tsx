import { catalogueApi } from '../api/catalogueApi';
import { ProductGrid } from '../components/ProductGrid';
import { ErrorMessage, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';

/** Home page: the 5 featured ("top rated") products. */
export function HomePage() {
  const featured = useAsync(() => catalogueApi.getFeaturedProducts(), []);

  return (
    <section aria-labelledby="featured-heading">
      <h1 id="featured-heading">Top rated</h1>
      {featured.status === 'loading' && <Loading />}
      {featured.status === 'error' && <ErrorMessage message={featured.error.message} />}
      {featured.status === 'success' && <ProductGrid products={featured.data} />}
    </section>
  );
}
