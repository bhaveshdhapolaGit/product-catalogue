# Product Catalogue: proof of concept

A product catalogue where customers browse by category, search, view product details and send an
enquiry to the sales team. It is built as a foundation to grow from rather than a throwaway prototype:
the product data source, look and feel, and email provider can each be swapped without rewriting the app.

- **Client:** React 18 + TypeScript (Vite)
- **Backend:** Node.js 22 + TypeScript (Express 5)
- **Local email inbox:** Mailpit (free, runs in Docker, no account needed)

Why this stack: see [Stack choice and why](#stack-choice-and-why).

Other docs:
- [DECISIONS.md](DECISIONS.md): assumptions, cuts, how it grows, and what's next
- [AI_USAGE.md](AI_USAGE.md): how AI was used
- [PLAN.md](PLAN.md): the spec
- [CLAUDE.md](CLAUDE.md): agent instructions

## Run it (about 2 minutes)

**You need:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine with Compose v2), and Git.
Nothing else: no Node.js, no accounts, no configuration.

### Quick start

1. **Get the code**

   ```bash
   git clone <repo-url>
   cd <repo-folder>
   ```

2. **Check Docker is running and the ports are free.** Start Docker Desktop if it isn't running.
   The app uses ports **8080** (web app), **8025** (email inbox) and **1025** (email server) on your machine.

3. **Start everything**

   ```bash
   docker compose up --build
   ```

   The first run downloads the base images and builds the app, which takes a minute or two.
   It's ready when the logs show `API listening on port 4000`.

4. **Open it**

   | What | URL |
   |---|---|
   | Catalogue app | http://localhost:8080 |
   | Sales inbox (Mailpit), where enquiry emails arrive | http://localhost:8025 |

5. **Stop it:** press `Ctrl+C`, then run `docker compose down`.

No configuration is needed; sensible defaults are built in. To change anything (for example the
featured products), copy `.env.example` to `.env`, edit it, and run `docker compose up --build` again.

**Offline or Fake Store down?** The API automatically falls back to a bundled snapshot of the Fake Store
catalogue and logs a warning, so the app still works.
## Try the acceptance criteria

| Criterion | How to check |
|---|---|
| Home page shows the 5 chosen "top rated" products | Open http://localhost:8080. The products come from `FEATURED_PRODUCT_IDS` (default `3,5,11,12,18`). |
| Category page shows top rated, then the rest | Click a category in the header, e.g. *Electronics*. |
| Search only shows matching products | Type `backpack` and click **Search**. |
| Clicking a tile opens the product page | Click any product tile. |
| Enquiry emails sales and thanks the customer | On a product page click **Enquire**, fill in the form, and submit. You'll see "Thank you", and the email appears at http://localhost:8025. |

## Run the tests

This is an npm workspaces monorepo: one install at the root covers both apps. Requires Node.js 22+.

```bash
npm ci              # installs client and server (one lockfile)
npm test            # runs both test suites
npm run typecheck   # type-checks both apps
```

- **Server (52 tests):** catalogue rules, Fake Store mapping, search (title and category), caching and snapshot fallback, the image proxy (including refusing SVG), config validation, and the HTTP API end to end (including validation errors, rate limiting, that no provider URLs reach the client, and the enquiry email content).
- **Client (15 tests):** each acceptance criterion through the real router, plus API-client error handling.

To run one app's tests only: `npm test -w server` or `npm test -w client`.

## Develop without Docker

```bash
npm ci
docker compose up -d mailpit   # local inbox on :8025, SMTP on :1025
npm run dev                    # API on :4000 and app on http://localhost:5173, with hot reload
```

The dev server proxies `/api` to the API, so the browser uses same-origin requests exactly as it does
behind nginx in Docker. Outside Docker, `.env` isn't loaded, so `FEATURED_PRODUCT_IDS` is unset and the
home page shows the top 5 by rating. Set it in your shell to try specific picks.

## Stack choice and why

**Client: React web app (TypeScript). Backend: Node.js (TypeScript).**

**Why:** React and Node.js are the stack I work with every day as a full stack developer. Choosing what
I know best means my judgement goes into the design, the trade-offs and reviewing the AI's output,
rather than into learning a framework. I can also explain and change every line confidently.

It's also a good fit for this brief:
- **TypeScript on both sides.** It's the brief's stated preference for each layer. One language across client and server keeps the codebase easy for one person to review and change.
- **Web over mobile.** A reviewer can run it with one command and no simulator, and the entrepreneur can share the proof of concept with a link.

Supporting choices:
- **Express:** the most widely known Node framework, which keeps the code easy to read and to change live. Validation is done with **zod** schemas, used for request bodies, query strings, config and the upstream Fake Store data.
- **Mailpit:** proves the email path with a real SMTP send, without needing a paid provider or account.
- **One repo, npm workspaces:** the client and server change together (an API change and its UI usually ship in one PR), so they live in one repo with one install, one lockfile and root scripts. npm workspaces are built into npm, so no extra tool (Nx, Turborepo) is needed at this size.

## Project structure

```
package.json                 Monorepo root: npm workspaces (client, server) and scripts that run both
package-lock.json            The single lockfile for both apps
client/                      React app (served by nginx in Docker; nginx proxies /api to the server)
  src/api/                   The only code that talks to the backend
  src/pages/, components/    UI
  src/theme/tokens.css       Design tokens: colours, fonts and spacing in one file (change the look here)
server/
  src/index.ts               Entry point: load config, build services, start listening
  src/config.ts              Environment variables, validated at startup
  src/container.ts           The one place that chooses concrete implementations
  src/app.ts                 Express app: security headers, JSON parsing, rate limit, routes
  src/http/                  Routes and error handling
  src/catalogue/             Business rules (featured products, category top rated)
  src/domain/                Our Product / Category types
  src/products/              ProductSource interface + FakeStoreProductSource (and its snapshot)
  src/enquiry/               Enquiry validation and email composition
  src/email/                 EmailSender interface + SMTP implementation
docker-compose.yml           client + server + mailpit (images build from the repo root to use the one lockfile)
```

## Configuration

All configuration is environment variables, validated at startup (see `server/src/config.ts`). See `.env.example` for the full list.

| Variable | Default | Purpose |
|---|---|---|
| `FEATURED_PRODUCT_IDS` | `3,5,11,12,18` | The owner's chosen home page products, in order |
| `FAKESTORE_BASE_URL` | `https://fakestoreapi.com` | Where product data comes from |
| `SALES_INBOX_EMAIL` | `sales@example.com` | Where enquiries are sent |
| `EMAIL_FROM` | `Product Catalogue <no-reply@example.com>` | Sender of enquiry emails |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Mailpit | Any SMTP server, e.g. Amazon SES SMTP in production (port 465 uses TLS) |

`PORT` (4000) and `TRUST_PROXY` (1, because nginx sits in front of the API) are set in `docker-compose.yml` and don't need changing.
