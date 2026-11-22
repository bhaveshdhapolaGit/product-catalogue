import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, catalogueApi } from './api/catalogueApi';
import { makeProduct, renderApp } from './test/utils';

const electronics = { slug: 'electronics', name: 'Electronics' };
const jewellery = { slug: 'jewelery', name: 'Jewelery' };
const featured = ['1', '2', '3', '4', '5'].map((id) => makeProduct({ id, title: `Featured ${id}` }));

beforeEach(() => {
  vi.spyOn(catalogueApi, 'getCategories').mockResolvedValue([electronics, jewellery]);
});

const tileTitles = (container: HTMLElement) =>
  within(container)
    .getAllByRole('link')
    .map((link) => within(link).getByRole('heading').textContent);

describe('Home page', () => {
  it('shows the 5 featured products', async () => {
    vi.spyOn(catalogueApi, 'getFeaturedProducts').mockResolvedValue(featured);
    renderApp('/');

    const section = await screen.findByRole('region', { name: 'Top rated' });
    await within(section).findByText('Featured 1');
    expect(tileTitles(section)).toEqual([
      'Featured 1',
      'Featured 2',
      'Featured 3',
      'Featured 4',
      'Featured 5',
    ]);
  });

  it('shows an error message if products cannot be loaded', async () => {
    vi.spyOn(catalogueApi, 'getFeaturedProducts').mockRejectedValue(
      new ApiError(502, 'The product catalogue is temporarily unavailable'),
    );
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
  });
});

describe('Category page', () => {
  it('opens from a category link and shows top rated then additional products', async () => {
    vi.spyOn(catalogueApi, 'getFeaturedProducts').mockResolvedValue([]);
    const getCategoryPage = vi.spyOn(catalogueApi, 'getCategoryPage').mockResolvedValue({
      category: electronics,
      topRated: [makeProduct({ id: '11', title: 'Best SSD' })],
      others: [makeProduct({ id: '13', title: 'Old Monitor' })],
    });
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Categories' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Electronics' }));

    expect(getCategoryPage).toHaveBeenCalledWith('electronics');
    const topRated = await screen.findByRole('region', { name: 'Top rated in Electronics' });
    expect(tileTitles(topRated)).toEqual(['Best SSD']);
    const more = screen.getByRole('region', { name: 'More in Electronics' });
    expect(tileTitles(more)).toEqual(['Old Monitor']);
  });
});

describe('Search', () => {
  it('searches for the entered term when the search button is clicked', async () => {
    vi.spyOn(catalogueApi, 'getFeaturedProducts').mockResolvedValue([]);
    const search = vi
      .spyOn(catalogueApi, 'searchProducts')
      .mockResolvedValue([makeProduct({ id: '9', title: 'Hard Drive' })]);
    renderApp('/');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search products' }), '  drive ');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=drive');
    expect(await screen.findByRole('heading', { name: 'Results for “drive”' })).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith('drive');
    expect(await screen.findByText('Hard Drive')).toBeInTheDocument();
  });

  it('tells the user when nothing matches', async () => {
    vi.spyOn(catalogueApi, 'searchProducts').mockResolvedValue([]);
    renderApp('/search?q=unicorn');
    expect(await screen.findByText('No products match “unicorn”.')).toBeInTheDocument();
  });

  it('does not search for a blank term', async () => {
    vi.spyOn(catalogueApi, 'getFeaturedProducts').mockResolvedValue([]);
    const search = vi.spyOn(catalogueApi, 'searchProducts');
    renderApp('/');

    await userEvent.type(screen.getByRole('searchbox'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(search).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });
});

describe('Product page and enquiry', () => {
  const product = makeProduct({ id: '5', title: 'Gold Ring', category: jewellery, price: 695 });

  beforeEach(() => {
    vi.spyOn(catalogueApi, 'getFeaturedProducts').mockResolvedValue([product]);
    vi.spyOn(catalogueApi, 'getProduct').mockResolvedValue(product);
  });

  it('opens the product details page when a product tile is clicked', async () => {
    renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: /Gold Ring/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/product/5');
    expect(await screen.findByRole('heading', { level: 1, name: 'Gold Ring' })).toBeInTheDocument();
    expect(catalogueApi.getProduct).toHaveBeenCalledWith('5');
  });

  it('submits an enquiry and shows a thank you message', async () => {
    const submit = vi.spyOn(catalogueApi, 'submitEnquiry').mockResolvedValue();
    renderApp('/product/5');

    await userEvent.click(await screen.findByRole('button', { name: 'Enquire' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Ada Lovelace');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Message (optional)'), 'Size 7?');
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(submit).toHaveBeenCalledWith({
      productId: '5',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '',
      message: 'Size 7?',
    });
    expect(await screen.findByRole('heading', { name: 'Thank you' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send enquiry' })).not.toBeInTheDocument();
  });

  it('shows validation errors from the server next to the fields', async () => {
    vi.spyOn(catalogueApi, 'submitEnquiry').mockRejectedValue(
      new ApiError(400, 'Invalid request', { email: ['Enter a valid email address'] }),
    );
    renderApp('/product/5');

    await userEvent.click(await screen.findByRole('button', { name: 'Enquire' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Ada');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example');
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Thank you')).not.toBeInTheDocument();
  });

  it('shows a general error and keeps the form when sending fails', async () => {
    vi.spyOn(catalogueApi, 'submitEnquiry').mockRejectedValue(
      new ApiError(502, 'We could not send your enquiry. Please try again shortly.'),
    );
    renderApp('/product/5');

    await userEvent.click(await screen.findByRole('button', { name: 'Enquire' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Ada');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('could not send your enquiry');
    expect(screen.getByLabelText('Name')).toHaveValue('Ada');
  });

  it('shows the API error for an unknown product', async () => {
    vi.spyOn(catalogueApi, 'getProduct').mockRejectedValue(new ApiError(404, 'Product not found'));
    renderApp('/product/999');
    expect(await screen.findByRole('alert')).toHaveTextContent('Product not found');
  });
});
