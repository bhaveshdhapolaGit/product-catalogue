import { describe, expect, it } from 'vitest';
import { CatalogueService } from '../src/catalogue/CatalogueService';
import { FakeProductSource } from './helpers';

const ids = (products: { id: string }[]) => products.map((product) => product.id);

describe('CatalogueService.getFeaturedProducts', () => {
  it('returns exactly the 5 chosen products in the chosen order', async () => {
    const service = new CatalogueService(new FakeProductSource(), ['6', '3', '1', '7', '5']);
    expect(ids(await service.getFeaturedProducts())).toEqual(['6', '3', '1', '7', '5']);
  });

  it('only shows the first 5 when more are configured', async () => {
    const service = new CatalogueService(new FakeProductSource(), ['1', '2', '3', '4', '5', '6']);
    expect(ids(await service.getFeaturedProducts())).toEqual(['1', '2', '3', '4', '5']);
  });

  it('skips unknown and duplicate IDs, then tops up with the highest rated', async () => {
    const service = new CatalogueService(new FakeProductSource(), ['6', '999', '6']);
    // 6 is chosen; then by rating: 2 (4.8, 300 reviews) beats 4 (4.8, 100 reviews), then 5, then 7.
    expect(ids(await service.getFeaturedProducts())).toEqual(['6', '2', '4', '5', '7']);
  });

  it('shows the top 5 by rating when nothing is configured', async () => {
    const service = new CatalogueService(new FakeProductSource(), []);
    expect(ids(await service.getFeaturedProducts())).toEqual(['2', '4', '5', '7', '1']);
  });
});

describe('CatalogueService.getCategoryPage', () => {
  const service = new CatalogueService(new FakeProductSource(), []);

  it('returns the top 3 rated products, then the rest of the category without duplicates', async () => {
    const page = await service.getCategoryPage('electronics');

    expect(page?.category).toEqual({ slug: 'electronics', name: 'Electronics' });
    expect(ids(page!.topRated)).toEqual(['2', '4', '7']);
    expect(ids(page!.others)).toEqual(['1', '3']);
  });

  it('puts every product in top rated when the category is small', async () => {
    const page = await service.getCategoryPage('jewelery');
    expect(ids(page!.topRated)).toEqual(['5', '6']);
    expect(page!.others).toEqual([]);
  });

  it('returns null for an unknown category', async () => {
    expect(await service.getCategoryPage('garden')).toBeNull();
  });
});
