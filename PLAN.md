# Plan / Spec

The spec the AI built against. It was agreed before coding and updated as decisions changed during
review; [DECISIONS.md](DECISIONS.md) explains why each decision was made.

## Goal

A product catalogue proof of concept that can grow, not a throwaway. The brief says the product data
source, look and feel, and email provider are expected to change, so each one gets a **swap point**:
one place where it can be replaced without changing the rest of the app.

## Stack

- **Client:** React 18 + TypeScript (Vite), React Router.
- **Server:** Node.js 22 + TypeScript, Express 5, zod (input checking), nodemailer (email).
- **Repo:** npm workspaces monorepo (`client/`, `server/`) with one install and one lockfile.
- **Local run:** Docker Compose with three containers: the client (nginx serves the app and forwards `/api`),
  the server, and Mailpit (a local email inbox).

## Architecture

```
Browser ──/api──▶ nginx ──▶ routes ──▶ services ──▶ ProductSource (swap point)
                         (check input)    │            └ FakeStoreProductSource: 5-minute cache,
                                          │              saved snapshot if Fake Store is down
                                          ▼
                                    EmailSender (swap point)
                                          └ SmtpEmailSender ──▶ Mailpit locally (SES in production)
```

- The browser only talks to our API (same address, so no CORS), including for product images.
- The server converts Fake Store's data into our own `Product` type, so the client never sees Fake Store's format.
- `server/src/container.ts` is the one place where the product source and email sender are chosen.

## API

| Method | Path | Response |
|---|---|---|
| GET | `/api/health` | `{ status: "ok" }` |
| GET | `/api/products/featured` | `{ products }`: the 5 featured ("top rated") products |
| GET | `/api/products?q=term` | `{ products }`: search results |
| GET | `/api/products/:id` | `{ product }`, or 404 |
| GET | `/api/products/:id/image` | The product image (PNG, JPEG, WebP or GIF), or 404 / 502 |
| GET | `/api/categories` | `{ categories }` |
| GET | `/api/categories/:slug/products` | `{ category, topRated, others }`, or 404 |
| POST | `/api/enquiries` | 201 `{ status: "received" }`; 400 invalid input; 422 unknown product; 429 too many enquiries |

## Pages

`/` (home), `/category/:slug`, `/search?q=`, `/product/:id` (with Enquire → form → "Thank you"), and a "not found" page.

## Key rules (details and reasons in DECISIONS.md)

- **Featured:** the owner's chosen product IDs (`FEATURED_PRODUCT_IDS`), topped up with the highest rated if fewer than 5 are valid.
- **Category page:** the 3 highest-rated products in the category, then the rest.
- **Search:** case-insensitive "contains" match on the product title and category name. A blank search is rejected.
- **Enquiry:** name and email required, phone and message optional. A plain-text email goes to `SALES_INBOX_EMAIL`.

## Testing

- **Server** (Vitest + Supertest): business rules, Fake Store data conversion, caching and the snapshot fallback, the image route, and every API endpoint including errors.
- **Client** (Vitest + Testing Library): each acceptance criterion through the real pages and links.

## Out of scope

Admin screen for featured products, login, cart, pagination, deployment, and end-to-end browser tests.
