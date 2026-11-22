# Agent instructions

Instructions for AI coding agents (Claude Code) working in this repo. The spec is in `PLAN.md`;
assumptions and trade-offs are in `DECISIONS.md`.

## Architecture rules

- The client only talks to our API (`/api/*`). Never call Fake Store or any other outside service from `client/`, including for images: the API returns `imageUrl` as our own `/api/products/:id/image` route.
- Only `server/src/products/FakeStoreProductSource.ts` knows Fake Store's data format. Everything else uses our own types in `server/src/domain/`.
- New product data sources implement `ProductSource`; new email providers implement `EmailSender`. Choose them in `server/src/container.ts` only.
- Business rules (featured products, category top rated, enquiry email) live in the services, not in the routes.
- Styling: components only use the CSS variables in `client/src/theme/tokens.css`. No hard-coded colours, fonts or sizes in components.

## Code standards

- TypeScript strict mode. No `any`.
- Check every outside input with zod: request bodies, query strings, environment settings, and data from Fake Store.
- Errors: throw the typed errors (`HttpError`, `ProductSourceError`, `EmailDeliveryError`, `UnknownProductError`) and let the error handler in `server/src/http/errors.ts` turn them into responses. Never show internal error details to users.
- Keep it small and easy to understand. Don't add abstractions the brief doesn't ask for. Prefer one clear class over many small helpers, and plain `if`/`else` over clever patterns.
- Write comments in plain English.

## Workflow

- This is an npm workspaces monorepo. Install from the root only (`npm install` / `npm ci`); never create a lockfile inside `client/` or `server/`. Add packages with `npm install <pkg> -w server` or `-w client`.
- Before adding or upgrading a package, check its current version (`npm view <pkg> version`) instead of relying on memory, and run `npm audit` afterwards. It must report 0 vulnerabilities.
- Run `npm test` and `npm run typecheck` from the root (they cover both apps) before saying work is done.
- Add or update tests with every change in behaviour. Server tests use `FakeProductSource` and `FakeEmailSender` from `server/test/helpers.ts`, never the internet.
- The Dockerfiles build from the repo root (see `docker-compose.yml`), so their `COPY` paths start from the root.
- Record new assumptions in `DECISIONS.md`.
