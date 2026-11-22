import { useParams } from 'react-router-dom';
import { catalogueApi } from '../api/catalogueApi';
import { ProductGrid } from '../components/ProductGrid';
import { ErrorMessage, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';

/** Category page: the top-rated products first, then the rest of the category. */
export function CategoryPage() {
  const { slug = '' } = useParams();
  const page = useAsync(() => catalogueApi.getCategoryPage(slug), [slug]);

  if (page.status === 'loading') return <Loading />;
  if (page.status === 'error') return <ErrorMessage message={page.error.message} />;

  const { category, topRated, others } = page.data;
  return (
    <>
      <h1>{category.name}</h1>

      <section aria-labelledby="top-rated-heading">
        <h2 id="top-rated-heading">Top rated in {category.name}</h2>
        <ProductGrid products={topRated} />
      </section>

      {others.length > 0 && (
        <section aria-labelledby="more-heading">
          <h2 id="more-heading">More in {category.name}</h2>
          <ProductGrid products={others} />
        </section>
      )}
    </>
  );
}
