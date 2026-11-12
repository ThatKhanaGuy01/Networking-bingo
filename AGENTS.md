# Project requirements and architecture

## Required platform

- Build a small mobile-first networking bingo web app with React, TypeScript, Vite, Tailwind CSS, Hono, Cloudflare Workers, D1 (SQLite), Drizzle ORM, and `vite-plugin-pwa`.
- Deploy the frontend and API together on one Cloudflare Worker, using one D1 database. Target Cloudflare's free tier.
- Do not add Express, PostgreSQL, Railway, paid services, OAuth, or third-party authentication.
- Implement the product in small stages. Do not fill in all game and admin features in one change.
- Use the official Cloudflare Vite plugin and its local Worker runtime for React/Vite development.

## Product requirements

- Later game work must support seeded random cards from the global task pool, grid sizes 3–7, optional free centre on odd grids, deterministic generation, manual custom-card placement, immutable shared snapshots, one active browser-stored card, offline play, bingo-line and full-card celebrations, and task CRUD in password-protected `/admin`.
- There are no player accounts. Admin credentials must stay server-side.
- Validate every untrusted API payload on the Worker. Protect admin access with server-side password checks and signed, secure sessions. Apply Cloudflare-compatible rate limiting to login and write routes.
- Never expose passwords, session secrets, or D1 credentials to client code.

## Routing and deployment

- `/admin`, `/play`, and `/c/:id` must load directly and after refresh.
- Keep `/health` and `/api/*` on the Worker. Unknown API routes must return JSON 404s and must never receive the SPA document.
- Keep D1 migrations checked in and apply them explicitly before deployment.
- Use Wrangler config and scripts for local D1 migrations and deployment. Store secrets with Wrangler; do not commit local secret files.

## Architecture boundaries

- `src/game/`: pure deterministic game functions and domain logic only. No React, browser globals, network, Worker, or database imports.
- `src/persistence/`: browser-only localStorage adapter, active-card slot, versioning, and local migrations. It must not call the API or import server/database code.
- `src/api/`: browser HTTP client and request/response handling. No localStorage or direct DB imports.
- `shared/`: serializable types safe on both sides. Do not add browser or server runtime dependencies here.
- `src/worker/`: Hono routes, validation, auth/session/rate-limit middleware, and orchestration. Worker code must use Web APIs supported by Cloudflare.
- `src/worker/db/`: Drizzle schema, D1 connection helpers, and database operations. Never import this directory from browser code.
- Custom shared cards are immutable snapshots: create a new snapshot for edits; never update or delete a shared snapshot row in place. Reapply the immutability triggers after any generated migration that rebuilds `shared_cards`.

## Quality requirements

- Keep the primary player flow usable at narrow mobile widths, keyboard accessible, and respectful of reduced-motion settings.
- Add deterministic unit tests for game rules and API tests for route validation/security as features are implemented. Add Playwright coverage for direct route loads and key flows.
- Before handoff, run typecheck, unit tests, and production build. Run browser tests when the relevant environment is available.
