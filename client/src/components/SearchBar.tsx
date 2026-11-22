import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * The search box in the header. Searching opens /search?q=<term>, so a search
 * can be bookmarked or shared like any other page.
 */
export function SearchBar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentQuery = searchParams.get('q') ?? '';
  const [term, setTerm] = useState(currentQuery);

  // Keep the box in step with the URL (e.g. when the user presses the back button).
  useEffect(() => setTerm(currentQuery), [currentQuery]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault(); // stop the browser reloading the page
    const query = term.trim();
    if (!query) return; // ignore empty searches
    navigate(`/search?${new URLSearchParams({ q: query })}`);
  }

  return (
    <form role="search" className="search-bar" onSubmit={handleSubmit}>
      <label htmlFor="search-input" className="visually-hidden">
        Search products
      </label>
      <input
        id="search-input"
        type="search"
        placeholder="Search products"
        value={term}
        maxLength={100}
        onChange={(event) => setTerm(event.target.value)}
      />
      <button type="submit">Search</button>
    </form>
  );
}
