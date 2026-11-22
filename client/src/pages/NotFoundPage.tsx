import { Link } from 'react-router-dom';

/** Shown for any address that doesn't match a page. */
export function NotFoundPage() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to the home page</Link>
      </p>
    </>
  );
}
