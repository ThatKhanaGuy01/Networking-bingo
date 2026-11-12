# Networking Bingo

A mobile-first networking game scaffold. The app is a React/Vite SPA and a Hono API running as one Cloudflare Worker, with one Cloudflare D1 SQLite database. It uses the official Cloudflare Vite plugin for local Worker development and deployment.

## Stack

- React, TypeScript, Vite, Tailwind CSS, React Router, and `vite-plugin-pwa`
- Hono on Cloudflare Workers
- Cloudflare D1 with Drizzle ORM and checked-in SQL migrations
- Vitest for Worker and game-logic tests; Playwright for browser route checks

## Local setup

Use a current Node.js release supported by Vite and Wrangler.

```sh
npm install
npm run dev
```

Vite runs the Worker locally with the Cloudflare Vite plugin. The worker health endpoints are `/health` and `/api/health`. D1 is available through the local Wrangler binding; local migrations run with:

```sh
npm run db:migrate:local
```

## D1 and deployment

Create the single D1 database, then copy the returned ID into `wrangler.jsonc`:

```sh
npx wrangler d1 create networking-bingo
```

Apply migrations and deploy the one Worker:

```sh
npm run db:migrate:remote
npm run deploy
```

`npm run deploy` builds the frontend and Worker before calling Wrangler. Cloudflare serves frontend assets and sends `/api/*` plus `/health` to the Worker. SPA fallback supports direct navigation and reloads at `/admin`, `/play`, and `/c/:id`; unknown API routes remain JSON 404s.

## Checks

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
```

## Current application scope

The current stage provides a playable, device-local bingo experience. `/random` creates reproducible boards from a replaceable mock task source, `/create` builds a custom board, and `/play` tracks progress with line and full-card celebrations. The active board and progress are stored in browser localStorage. Share links for random boards carry their size and seed; custom-card server sharing is not implemented yet. At least 80 varied sample prompts are available in `src/data/mockTasks.ts`.

The `/admin` route and `/c/:id` shared-card route remain placeholders. D1 migrations and Worker wiring are scaffolded, but the current game reads its task pool from the mock provider and does not persist cards to D1. Admin authentication, task CRUD, API validation/rate limiting, and server-side immutable custom-card snapshots are reserved for a later stage.

## Architecture boundaries

- `src/game/` contains deterministic game rules only. It has no UI, storage, network, Hono, or database imports.
- `src/persistence/` contains browser storage only. It owns the one-active-card rule and versioned localStorage record; it does not call the API or import server modules.
- `src/data/` provides the task source. The current mock provider can later be replaced with an API-backed source without changing the engine.
- `src/api/` contains browser API calls. UI routes use this client rather than calling `fetch` directly.
- `shared/` contains serializable types shared across browser and Worker code.
- `src/worker/` contains Hono routing, request validation, session/rate-limit middleware, and API orchestration.
- `src/worker/db/` contains Drizzle schema, D1 access, and persistence queries. Browser code must never import it.

See [AGENTS.md](./AGENTS.md) for project constraints and security requirements.
