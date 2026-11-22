import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { CatalogueService } from '../src/catalogue/CatalogueService';
import { EmailDeliveryError } from '../src/email/EmailSender';
import { EnquiryService } from '../src/enquiry/EnquiryService';
import { ProductSourceError, type ProductSource } from '../src/products/ProductSource';
import { FakeEmailSender, FakeProductSource } from './helpers';

/** Builds the real app with fake products and a fake email sender. */
function setup(options: { source?: ProductSource; enquiryLimit?: number } = {}) {
  const source = options.source ?? new FakeProductSource();
  const email = new FakeEmailSender();
  const catalogue = new CatalogueService(source, ['5', '1', '2', '3', '4']);
  const enquiries = new EnquiryService(source, email, 'sales@shop.test');
  const app = createApp({ catalogue, enquiries, enquiryLimit: options.enquiryLimit ?? 100 });
  return { app, email };
}

beforeEach(() => {
  // The error handler logs server problems; hide those logs so the test output stays clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  return () => vi.restoreAllMocks();
});

const validEnquiry = {
  productId: '5',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+61 400 000 000',
  message: 'Is this available in size 7?',
};

describe('catalogue endpoints', () => {
  it('GET /api/products/featured returns the 5 chosen products', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/products/featured').expect(200);
    expect(res.body.products.map((p: { id: string }) => p.id)).toEqual(['5', '1', '2', '3', '4']);
  });

  it('GET /api/categories lists categories', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/categories').expect(200);
    expect(res.body.categories).toHaveLength(2);
  });

  it('GET /api/categories/:slug/products returns top rated and other products', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/categories/electronics/products').expect(200);
    expect(res.body.category.name).toBe('Electronics');
    expect(res.body.topRated).toHaveLength(3);
    expect(res.body.others).toHaveLength(2);
  });

  it('GET /api/categories/:slug/products returns 404 for an unknown category', async () => {
    const { app } = setup();
    await request(app).get('/api/categories/garden/products').expect(404);
    await request(app).get('/api/categories/NOT%20A%20SLUG/products').expect(404);
  });

  it('GET /api/products?q= returns only matching products', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/products').query({ q: 'ring' }).expect(200);
    expect(res.body.products.map((p: { id: string }) => p.id)).toEqual(['5']);
  });

  it('GET /api/products without a search term is a 400', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/products').query({ q: '   ' }).expect(400);
    expect(res.body.fields.q).toBeDefined();
  });

  it('GET /api/products/:id returns the product or 404', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/products/3').expect(200);
    expect(res.body.product.title).toBe('Monitor');
    await request(app).get('/api/products/999').expect(404);
  });

  it('returns 502 without leaking details when the product source fails', async () => {
    const failing = new FakeProductSource();
    failing.listProducts = async () => {
      throw new ProductSourceError('upstream exploded: secret-host:1234');
    };
    const { app } = setup({ source: failing });

    const res = await request(app).get('/api/products/featured').expect(502);
    expect(res.body).toEqual({ error: 'The product catalogue is temporarily unavailable' });
  });

  it('returns 404 JSON for unknown API routes and sets security headers', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('product images', () => {
  it("gives the client our own image URLs, never the provider's", async () => {
    const { app } = setup();
    const responses = await Promise.all([
      request(app).get('/api/products/featured'),
      request(app).get('/api/products').query({ q: 'ring' }),
      request(app).get('/api/products/5'),
      request(app).get('/api/categories/electronics/products'),
    ]);

    expect(responses[2]?.body.product.imageUrl).toBe('/api/products/5/image');
    for (const res of responses) {
      expect(JSON.stringify(res.body)).not.toContain('images.example.com'); // the source's image host
    }
  });

  it('GET /api/products/:id/image returns the image with cache headers', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/products/5/image').buffer(true).expect(200);

    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
    expect(Buffer.from(res.body).toString()).toBe('image-5');
  });

  it('GET /api/products/:id/image returns 404 for an unknown product', async () => {
    const { app } = setup();
    await request(app).get('/api/products/999/image').expect(404);
  });

  it('GET /api/products/:id/image returns 502 when the image cannot be loaded', async () => {
    const failing = new FakeProductSource();
    failing.getProductImage = async () => {
      throw new ProductSourceError('image host down');
    };
    const { app } = setup({ source: failing });

    const res = await request(app).get('/api/products/5/image').expect(502);
    expect(res.body).toEqual({ error: 'The product catalogue is temporarily unavailable' });
  });
});

describe('POST /api/enquiries', () => {
  it('emails the sales inbox with product details from the server and returns 201', async () => {
    const { app, email } = setup();
    const res = await request(app)
      .post('/api/enquiries')
      .send({ ...validEnquiry, productTitle: 'Tampered title' })
      .expect(201);

    expect(res.body).toEqual({ status: 'received' });
    expect(email.sent).toHaveLength(1);
    const [message] = email.sent;
    expect(message?.to).toBe('sales@shop.test');
    expect(message?.replyTo).toBe('ada@example.com');
    expect(message?.subject).toBe('Product enquiry: Gold Ring');
    expect(message?.text).toContain('Name: Ada Lovelace');
    expect(message?.text).toContain('Phone: +61 400 000 000');
    expect(message?.text).toContain('Is this available in size 7?');
    expect(message?.text).not.toContain('Tampered title');
  });

  it('accepts an enquiry with only the required fields', async () => {
    const { app, email } = setup();
    await request(app)
      .post('/api/enquiries')
      .send({ productId: '5', name: 'Ada', email: 'ada@example.com', phone: '', message: '' })
      .expect(201);
    expect(email.sent[0]?.text).toContain('Phone: Not provided');
  });

  it('returns 400 with field errors for invalid input and sends nothing', async () => {
    const { app, email } = setup();
    const res = await request(app)
      .post('/api/enquiries')
      .send({ productId: '5', name: '  ', email: 'not-an-email', phone: 'call me' })
      .expect(400);

    expect(Object.keys(res.body.fields).sort()).toEqual(['email', 'name', 'phone']);
    expect(email.sent).toHaveLength(0);
  });

  it('returns 400 for malformed JSON', async () => {
    const { app } = setup();
    await request(app)
      .post('/api/enquiries')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
  });

  it('returns 422 for a product that does not exist', async () => {
    const { app, email } = setup();
    await request(app).post('/api/enquiries').send({ ...validEnquiry, productId: '999' }).expect(422);
    expect(email.sent).toHaveLength(0);
  });

  it('returns 502 when the email provider fails', async () => {
    const { app, email } = setup();
    email.failWith = new EmailDeliveryError('smtp down');
    const res = await request(app).post('/api/enquiries').send(validEnquiry).expect(502);
    expect(res.body.error).toMatch(/could not send your enquiry/);
  });

  it('rate limits repeated enquiries', async () => {
    const { app } = setup({ enquiryLimit: 2 });
    await request(app).post('/api/enquiries').send(validEnquiry).expect(201);
    await request(app).post('/api/enquiries').send(validEnquiry).expect(201);
    await request(app).post('/api/enquiries').send(validEnquiry).expect(429);
  });
});
