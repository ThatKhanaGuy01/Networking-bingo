# Networking Bingo

A mobile-first networking bingo app built as one React/Vite frontend and one Hono Worker API, backed by Cloudflare D1 and Drizzle ORM.

## Stack

- React, TypeScript, Vite, Tailwind CSS, React Router, and `vite-plugin-pwa`
- Hono on Cloudflare Workers through the official Cloudflare Vite plugin
- Cloudflare D1 (SQLite) with Drizzle ORM and checked-in migrations
- Vitest and Playwright

## Local setup

Use a current Node.js release supported by Vite and Wrangler.

```sh
npm install
npm run db:migrate:local
npm run dev
```

Open `http://localhost:5173`. The local migration seeds the existing 80 sample prompts and uses the `bingotasks` D1 binding. `/health` is the Worker health endpoint. Add tasks at `/admin` if you need more for a larger board.

### Local admin secrets

Create `.dev.vars` once, with a password hash and a separate session-signing secret:

```sh
umask 077
touch .dev.vars
chmod 600 .dev.vars
npm run auth:hash-password >> .dev.vars
printf 'SESSION_SECRET=%s\n' "$(openssl rand -base64 48)" >> .dev.vars
```

The password command prompts twice without echoing input and emits `ADMIN_PASSWORD_HASH` using PBKDF2-HMAC-SHA-256 (600,000 iterations, 16-byte random salt, 256-bit result). Enter that password on `/admin`. Do not commit `.dev.vars`.

## Database and deployment

The repository already points at the existing D1 database. Do not create another database or replace its ID. Local migrations use Wrangler's local D1 and do not touch the remote database. Apply remote migrations explicitly before deploying; deployment does not apply migrations automatically.

```sh
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
npm run db:migrate:remote
npm run deploy
```

## Checks

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
```

## Current functionality

`/random` creates deterministic seeded cards from the public D1 task pool. `/create` builds a custom card. `/play` stores progress in localStorage and celebrates completed lines and full cards. `/admin` supports password login and task search, add, edit, and delete. `/c/:id` reads an immutable task-text snapshot from D1 and opens an unmarked copy; player progress is never stored on the server.

## Architecture

- `src/game/`: pure deterministic game rules; no UI, storage, network, Worker, or database imports.
- `src/persistence/`: browser-only localStorage and active-card records.
- `src/api/`: browser HTTP client; does not use localStorage or direct DB imports.
- `shared/`: serializable types shared by browser and Worker code.
- `src/worker/`: Hono API, validation, authentication, rate limiting, and orchestration.
- `src/worker/db/`: Drizzle schema and D1 access; never imported by browser code.

See [AGENTS.md](./AGENTS.md) for project requirements and security boundaries.
