import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { Product } from '../api/types';
import { App } from '../App';

export function makeProduct(overrides: Partial<Product> & { id: string }): Product {
  return {
    title: `Product ${overrides.id}`,
    description: 'A product',
    price: 19.99,
    currency: 'USD',
    imageUrl: `https://images.example.com/${overrides.id}.png`,
    category: { slug: 'electronics', name: 'Electronics' },
    rating: { average: 4.2, count: 10 },
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

/** Renders the whole app at a URL, so tests exercise real routing and links. */
export function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}
