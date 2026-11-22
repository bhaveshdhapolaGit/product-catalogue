import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { CatalogueService } from '../catalogue/CatalogueService';
import type { Product } from '../domain/product';
import { enquirySchema } from '../enquiry/enquirySchema';
import type { EnquiryService } from '../enquiry/EnquiryService';
import { HttpError } from './errors';

// Rules for checking values that come in from the browser.
const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Enter a search term').max(100),
});
const idParam = z.string().trim().min(1).max(64); // product IDs: any short text
const slugParam = z.string().regex(/^[a-z0-9-]{1,64}$/); // category slugs, e.g. "mens-clothing"

/** Tells browsers to keep product images for 1 day. */
const IMAGE_CACHE_CONTROL = 'public, max-age=86400';

/**
 * Prepares a product to send to the browser. We replace the image address with our own
 * image route, so the browser never contacts Fake Store directly. Later this route could
 * point to S3/CloudFront without any change to the client.
 */
function toApiProduct(product: Product): Product {
  return { ...product, imageUrl: `/api/products/${encodeURIComponent(product.id)}/image` };
}

export interface RouteDependencies {
  catalogue: CatalogueService;
  enquiries: EnquiryService;
  enquiryRateLimiter: RequestHandler;
}

/**
 * All the /api endpoints. Each one checks its input, asks a service for the answer and sends
 * it back. Business rules live in the services, not here.
 */
export function createApiRouter({
  catalogue,
  enquiries,
  enquiryRateLimiter,
}: RouteDependencies): Router {
  const router = Router();

  // Health check: Docker (and a load balancer on AWS) uses this to see if the API is up.
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Home page: the 5 featured products.
  // Must come before /products/:id, otherwise "featured" would be treated as a product ID.
  router.get('/products/featured', async (_req, res) => {
    const products = await catalogue.getFeaturedProducts();
    res.json({ products: products.map(toApiProduct) });
  });

  // Search, e.g. GET /api/products?q=jacket
  router.get('/products', async (req, res) => {
    const { q } = searchQuerySchema.parse(req.query);
    const products = await catalogue.searchProducts(q);
    res.json({ products: products.map(toApiProduct) });
  });

  // One product (product page)
  router.get('/products/:id', async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const product = id.success ? await catalogue.getProduct(id.data) : null;
    if (!product) throw new HttpError(404, 'Product not found');
    res.json({ product: toApiProduct(product) });
  });

  // One product's image
  router.get('/products/:id/image', async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const image = id.success ? await catalogue.getProductImage(id.data) : null;
    if (!image) throw new HttpError(404, 'Image not found');
    res.set({ 'Content-Type': image.contentType, 'Cache-Control': IMAGE_CACHE_CONTROL });
    res.send(image.data);
  });

  // All categories (for the category menu)
  router.get('/categories', async (_req, res) => {
    res.json({ categories: await catalogue.listCategories() });
  });

  // Category page: top-rated products, then the rest of the category
  router.get('/categories/:slug/products', async (req, res) => {
    const slug = slugParam.safeParse(req.params.slug);
    const page = slug.success ? await catalogue.getCategoryPage(slug.data) : null;
    if (!page) throw new HttpError(404, 'Category not found');
    res.json({
      category: page.category,
      topRated: page.topRated.map(toApiProduct),
      others: page.others.map(toApiProduct),
    });
  });

  // Send an enquiry (rate limited to protect against spam)
  router.post('/enquiries', enquiryRateLimiter, async (req, res) => {
    const enquiry = enquirySchema.parse(req.body ?? {});
    await enquiries.submit(enquiry);
    res.status(201).json({ status: 'received' });
  });

  return router;
}
