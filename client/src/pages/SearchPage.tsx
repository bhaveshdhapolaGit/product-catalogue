import { useSearchParams } from 'react-router-dom';
import { catalogueApi } from '../api/catalogueApi';
import { ProductGrid } from '../components/ProductGrid';
import { ErrorMessage, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';

/** Search results page for /search?q=<term>. */
export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim();

  if (!query) {
    return (
      <>
        <h1>Search</h1>
        <p className="muted">Enter a search term above to find products.</p>
      </>
    );
  }

  return <SearchResults query={query} />;
}

/** The results are a separate component, so the search only runs when there is a search term. */
function SearchResults({ query }: { query: string }) {
  const results = useAsync(() => catalogueApi.searchProducts(query), [query]);

  return (
    <>
      <h1>Results for “{query}”</h1>
      {results.status === 'loading' && <Loading />}
      {results.status === 'error' && <ErrorMessage message={results.error.message} />}
      {results.status === 'success' && (
        <ProductGrid products={results.data} emptyMessage={`No products match “${query}”.`} />
      )}
    </>
  );
}
