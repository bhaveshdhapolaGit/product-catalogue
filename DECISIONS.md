# Decisions and assumptions

## Assumptions where the acceptance criteria were unclear

| Area | Assumption | Why |
|---|---|---|
| **"I have chosen 5 products to be top rated"** | "Chosen" means the owner hand-picks them. The picks are configured as `FEATURED_PRODUCT_IDS` and shown in that order. | The wording describes a merchandising decision, not a computed score. |
| Featured config is missing or stale | Valid chosen IDs are shown first. Unknown or duplicate IDs are skipped, and the list is topped up with the highest-rated other products to make 5. | The home page never shows a half-empty row because of a config mistake. |
| **Category "top rated"** | The top 3 products by average rating in that category (more reviews breaks a tie). Everything else in the category is listed underneath as "additional", with no duplicates. | The criteria don't define it, and the owner's 5 home-page picks span categories. The number 3 is a single constant (`CATEGORY_TOP_RATED_COUNT` in `CatalogueService.ts`). |
| **Search: "text matching that search term"** | A case-insensitive "contains" match on the **product title and category name** (not the description), in catalogue order. A blank term is rejected with a 400. Terms are limited to 100 characters. | Searching descriptions as well gave confusing results: searching "hard" returned a T-shirt because its description mentions "die**hard** baseball fans". Customers search for what a product *is* (the title) or the kind of product (the category, e.g. "electronics"). That's simple, predictable and easy to explain. Known quirk: because it's a "contains" match, "men's" also matches the "Women's clothing" category. Searching descriptions, relevance ranking and fuzzy matching would be the job of a real search engine (see "Next"). |
| Search UI | Search runs when the button is clicked (or Enter is pressed), per the criterion, and the results page lives at `/search?q=` so it can be shared and bookmarked. | Searching as you type wasn't asked for, and it would add an API call on every keystroke. |
| **Enquiry form fields** | Name and email are required. Phone and message are optional. | "Contact details" implies a way to reply. Email is the minimum. |
| Enquiry content | The client sends only the `productId`. The server looks up the product and puts its title, ID and price in the email. The customer's email is set as Reply-To. | The customer can't change what the sales team sees, and sales can reply directly. |
| "Sales inbox will receive an email" | Locally, Mailpit at http://localhost:8025 stands in for the sales inbox. | The brief rules out paid services and reviewer accounts. Mailpit is a real SMTP server, so the send path is real. |
| Prices | Fake Store doesn't state a currency, so prices are treated as USD. The currency is part of our `Product`, so a future source can state its own. | Showing AUD would be inventing information. |
| Product IDs | Stored as strings, even though Fake Store uses numbers. | Future sources (Shopify, UUIDs) won't be numeric. |
| **"Do not call the Fake Store API directly from the client"**, including images | The rule covers images too. The API never sends Fake Store's image URLs. Each product's `imageUrl` is our own `/api/products/:id/image` route, which fetches the image on the server. | Product data alone going through the backend would leave the browser still contacting Fake Store for every image. The proxy makes the client completely provider-independent, and later the same route can redirect to S3 or CloudFront without any client change. |
| Category URLs | Slugs are derived from the Fake Store names (`men's clothing` becomes `mens-clothing`). Fake Store's own spelling "jewelery" is kept. | The names come from the data source. Fixing them belongs in a real catalogue. |

## Requirements dropped or simplified

| What | Why |
|---|---|
| No admin UI for choosing featured products. They're set in config. | It meets the criterion without building authentication and persistence. An admin screen is the natural next step. |
| No pagination or sorting controls | Fake Store has 20 products. The API wraps lists in objects (`{ products }`) so pagination fields can be added without breaking clients. |
| No spam protection beyond rate limiting (no CAPTCHA) | CAPTCHA services need accounts. Instead, enquiries are rate limited per IP (10 per 15 minutes), bodies are limited to 10 KB and every field is validated. |
| No end-to-end browser test (Playwright) | The time-box. Client tests render the whole app through the real router, and I checked every acceptance criterion by hand on the running Docker stack. |
| No production deployment or infrastructure-as-code | Not required. Everything is in containers and the config is environment variables, so it can be deployed on AWS ECS/Fargate or App Runner. |
| No HTML email | Plain text means user input is never rendered as HTML, which removes a whole class of injection problems. |

## How the design supports growth beyond the PoC

The brief names three things that will change: the data source, the look and feel, and the email
provider. Each has one **swap point**: an interface (or, for the look and feel, one CSS file) where one implementation can be replaced by another. The rest of the code doesn't know which implementation is behind it.

```
React client ──/api──▶ routes (validate) ──▶ CatalogueService / EnquiryService ──▶ ProductSource ──▶ Fake Store | snapshot | (future)
                                                                    └──────────▶ EmailSender  ──▶ SMTP/Mailpit | (future SES)
```

1. **Product data source: `ProductSource` interface** (`server/src/products/ProductSource.ts`).
   - `FakeStoreProductSource` is the only file that knows about Fake Store. It validates Fake Store's data and converts it into our `Product` type, so neither the client nor the services ever see Fake Store's fields.
   - Search and filtering by category are part of the interface, not done by callers. That means a future Postgres, Shopify or OpenSearch source can run them itself instead of loading everything. `FakeStoreProductSource` does them in memory, which only suits a small catalogue like Fake Store's 20 products.
   - To swap the source, write a new class that implements `ProductSource` and change one line in `container.ts`.
2. **Email provider: `EmailSender` interface.** The enquiry logic composes the message and calls `send()`. It doesn't know about SMTP. In production, point the SMTP settings at Amazon SES SMTP with no code change, or add an `SesEmailSender` that uses the SES API.
3. **Look and feel: design tokens** (`client/src/theme/tokens.css`). Components use only CSS variables, so the agency's brand goes into one file.
4. **Clear boundaries:**
   - The client only calls our API, on the same origin through nginx, so there are no CORS rules to maintain. That includes images, which come from `/api/products/:id/image`.
   - The image route looks the product up **by ID** and fetches the image URL from our own validated data, never a URL from the request, so it can't be abused to make the server fetch arbitrary addresses (SSRF). Fetching images is part of the `ProductSource` interface (`getProductImage`), so an S3-backed source would serve its own images.
   - Routes only parse input and shape responses. The business rules live in the services, which have no dependency on HTTP.
   - Every concrete class is created in `container.ts`.
   - One repo using npm workspaces: the client and server are separate packages (separate dependencies, tests and Docker images) but share one install, one lockfile and root scripts. New pieces, such as a shared types package or an admin app, become new workspaces.
5. **Resilience:**
   - The catalogue is fetched once and cached in memory for 5 minutes, so Fake Store is called at most every 5 minutes.
   - If Fake Store is down, times out (5 seconds) or returns unexpected data, the API serves a bundled snapshot and logs a warning instead of breaking the site.
   - Server-side failures become a generic error message (502 or 500) and internal details are never shown to users.
6. **Operational basics:**
   - Config is validated when the server starts, so it fails fast with a readable message.
   - Security headers: helmet adds them to API responses (and removes the `x-powered-by` header); nginx adds them to the web page, including a Content-Security-Policy that only allows scripts, styles, images and data from our own site, and blocks other sites from embedding it.
   - The image route only serves PNG, JPEG, WebP and GIF. SVG is refused, because an SVG file can contain scripts.
   - Dependencies are on current versions, and `npm audit` reports no known vulnerabilities.
   - The API container runs as a non-root user and has a health check. The web container uses the standard nginx image, whose main process runs as root; the unprivileged nginx image would be the production choice.
   - The API isn't published to the host. It's only reachable through the proxy, which also means the client IP seen by rate limiting can't be spoofed.

**Known trade-offs I'd revisit:**
- If the snapshot fallback is used, it's cached for the full 5 minutes, so the site can keep serving snapshot data for up to 5 minutes after Fake Store recovers. That keeps pages fast during an outage, at the cost of slightly stale data.
- Images go through our server, which costs bandwidth and adds a hop. Browsers cache each image for a day, so each visitor fetches it only once. In production, images would live in S3 behind CloudFront, and the image route would redirect there or the API would return the CDN URL directly.
- During a Fake Store outage, the snapshot keeps product data working, but images still come from Fake Store, so they fail (the route returns 502). Bundling the 20 images, or caching them on the server, would fix this. I left it out to keep the code small.
- When the cache expires, two requests arriving at the same moment can both call Fake Store. That's harmless at this scale, and I chose it over more complex locking code.
- Featured products: `getFeaturedProducts` loads the whole catalogue to find 5 products. That's fine in memory. A database-backed source would need a "get these IDs" query.
- Logging is plain `console` output, which keeps the code simple. A production system would use structured logs (e.g. JSON with request IDs) that a tool like CloudWatch can search.
- The in-memory cache and rate limiter are per process. With more than one instance they'd move to Redis or ElastiCache.
- The API types are written twice, once in `server/src/domain` and once in `client/src/api/types.ts`. Now that the repo is an npm workspaces monorepo, a shared `packages/api-types` workspace would be cheap to add. An OpenAPI spec with a generated client is the stronger fix, because it also documents and validates the contract.

## What I'd do next with another day

1. **OpenAPI spec and a generated client.** One contract, which removes the duplicated types and can be checked in CI.
2. **CI pipeline (GitHub Actions):** type check, tests, Docker build, and a Playwright smoke test of the five acceptance criteria against `docker compose up`.
3. **A real product store** (Postgres via a `PostgresProductSource`) with an admin screen for curating featured products and categories. Search would move to Postgres full-text search or OpenSearch.
4. **Production email:** an `SesEmailSender`, a stored record of every enquiry (so a failed email doesn't lose a lead), and a confirmation email to the customer.
5. **Observability:** structured logs with request IDs, metrics on upstream failures and fallback usage, and alerts when the snapshot is being served.
6. **UX:** loading skeletons, image fallbacks, an accessibility audit, and applying the agency's design tokens once they arrive.
