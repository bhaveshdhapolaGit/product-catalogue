# AI usage

## Tools and models

- **Claude Code** (command-line tool, on Windows) with **Claude Opus 5.5** (`claude-opus-5-5`), used for planning, writing the code, tests and docs, and running the tests and Docker checks.
- **Claude chat** (claude.ai), used at the start for an initial planning prompt (see Plan / spec).
- No other AI tools were used.

## Agent instruction file

- [`CLAUDE.md`](CLAUDE.md), committed to the repo. It sets the architecture rules (the client only calls our API; Fake Store code stays in one file; implementations are chosen only in `container.ts`), the coding standards (strict TypeScript, zod for every outside input, keep it simple) and the workflow (run the tests and type checks before saying something is done; check current package versions and `npm audit` before adding a package).

## Plan / spec

- I started in Claude chat with this planning prompt:

  > *"Using React + TypeScript (client) and Node/Express + TypeScript (server) in a monorepo, propose the folder structure, API endpoints, product and category data model, and a local email setup that needs no real SMTP account."*

- In Claude Code, I then had the AI explain the whole brief, challenged its summary, discussed the approach and risks, and agreed [`PLAN.md`](PLAN.md) before any code was written. PLAN.md was updated as decisions changed during review.

## Key prompts and moments

1. **"Let me know everything here first, explain, and then we will proceed."** Before any code, the AI walked me through the whole brief. This surfaced requirements that are in the PDF but not in the recruiter's email: the open PR, DECISIONS.md, AI_USAGE.md and the time report.

2. **"What is a seam? Explain this."** I didn't accept the core design idea until the AI explained it with real code. ("Seam" was its word for a place where one part can be swapped for another; I later had it renamed to "swap point".) This led to adding interfaces *only* where the brief says change is expected: product data, email, and look and feel.

3. **"Let's make everything a bit simpler, so that it is easier to understand for everyone."** After reviewing the code line by line, I directed a simplification: four small product-data pieces became one class, the settings went from 14 to 10, and clever patterns were replaced with plain code. Everything the brief asks for stayed, and all tests and acceptance criteria were re-checked afterwards.

4. **"Are we following this?"** (the rule "do not call the Fake Store API directly from the client") The client code was clean, but the browser was still loading product images straight from Fake Store. I decided the rule should cover images too, so we added an image route (`/api/products/:id/image`) on our server.

5. **"Is the search not working correctly? When I search 'hard', a T-shirt is also coming up, and as the first result."** The search also looked at product descriptions, and this T-shirt's description says "die**hard** baseball fans". I decided search should match the product title and category only.

## Where the AI got something wrong and how I caught it

| What went wrong | How I caught it | What we did |
|---|---|---|
| It presented its own interpretations as if they were in the brief. | I asked "where is this written in the doc?" | It quoted the exact text and marked which parts were its own advice. |
| The first version worked but was over-engineered and hard to explain. | Line-by-line review. | Simplified it (key moment 3). |
| Search returned confusing results, and the tests didn't catch it, because they only checked that the right products appeared, not that wrong ones didn't. | Using the app myself. | Search now matches title and category only, and the tests check what must *not* match (key moment 5). |
| When I only asked *why* the T-shirt appeared, it answered **and** rewrote the search code without asking. | I pointed out that I'd asked a question, not requested a change. | I had it undo the change and apply my decision instead. |
| Product images were still loaded from Fake Store by the browser. | I asked whether we were really following the "no Fake Store from the client" rule. | Added the image route (key moment 4) and checked that no API response contains a Fake Store address. |
| It explained graceful shutdown too broadly. | I asked "how do I know this?" | It demonstrated the behaviour and corrected its statements. |
| It chose outdated, vulnerable versions of several packages from memory instead of checking current ones. `npm audit` showed **high**-severity issues in production packages (nodemailer, zod) and a moderate one in react-router. | My review prompt: *"Review this codebase as a senior engineer who is going to grade this assessment: look at everything (code, Dockerfiles, packages, types, error handling, security, README and docs) and rank everything."* | Upgraded to current versions (nodemailer 10, zod 4, React Router 7, Vitest 5, Vite 8), fixed the small code changes they needed, and re-ran everything: `npm audit` now finds 0 vulnerabilities and all tests pass. The same review also led to security headers on the web page and refusing SVG images. |

## Time spent

| Activity | Time |
|---|---|
| Planning | 1 hour |
| Building | 2 hours |
| Testing | 0.5 hours |
| Reviewing | 2 hours |
| **Total** | **5.5 hours** |

This is over the suggested 2–3 hours. Most of the extra time went into reviewing: walking through the code line by line, simplifying it so it's easier for everyone to understand, and checking every requirement in the brief against the finished app.
