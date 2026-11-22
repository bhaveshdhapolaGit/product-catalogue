import { Link, NavLink, Outlet } from 'react-router-dom';
import { catalogueApi } from '../api/catalogueApi';
import { useAsync } from '../hooks/useAsync';
import { SearchBar } from './SearchBar';

/** The category links in the header, loaded from the API. */
function CategoryNav() {
  const state = useAsync(() => catalogueApi.getCategories(), []);
  if (state.status !== 'success') return null;

  return (
    <nav aria-label="Categories" className="category-nav">
      <ul>
        {state.data.map((category) => (
          <li key={category.slug}>
            <NavLink to={`/category/${category.slug}`}>{category.name}</NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The frame around every page: a header with the search bar and category menu. The page goes in <Outlet />. */
export function Layout() {
  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand">
            Product Catalogue
          </Link>
          <SearchBar />
        </div>
        <div className="container">
          <CategoryNav />
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
