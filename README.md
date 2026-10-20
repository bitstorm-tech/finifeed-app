# Finifeed

*Your creator inbox.* A finite inbox for content from the creators you intentionally follow.

The product and architecture source of truth is [`FINIFEED_PRODUCT_TECH_SPEC.md`](FINIFEED_PRODUCT_TECH_SPEC.md).

## Prerequisites

- [Bun](https://bun.sh) 1.4.2 (pinned in `package.json`)
- An existing PostgreSQL 18+ database (user and database already created)
- Docker, only for `bun run test` (Testcontainers)

## Getting started

```sh
bun install
cp .env.example apps/server/.env   # then set DATABASE_URL
bun run dev
```

`bun run dev` starts the server on <http://localhost:3000> and the web client on <http://localhost:5173>. The client proxies `/api` to the server. Pending migrations are applied automatically when the server starts.

Health check: <http://localhost:3000/api/v1/health>

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Server (watch mode) + web client |
| `bun run migrate` | Apply pending migrations without starting the server |
| `bun run test` | All tests (integration tests start their own PostgreSQL via Testcontainers; Docker must be running) |
| `bun run typecheck` | Type-check all packages |
| `bun run build` | Production build of the web client |
| `bun run ci` | Typecheck + tests + build, as in CI |

## Configuration

The server reads environment variables (see [`.env.example`](.env.example)). Put them in `apps/server/.env`. `DATABASE_URL` is always required and points to an existing PostgreSQL database; the server does not create or start a database. All tables live in the schema `finifeed`, which the migrations create on server start (the database user needs the `CREATE` privilege on the database). In production `APP_ENV=production` and `YOUTUBE_API_KEY` are required as well.

To add YouTube creators locally, set `YOUTUBE_API_KEY` in `apps/server/.env` (a YouTube Data API v3 key from the Google Cloud console). Without it the server starts, but looking up a channel fails with "YouTube is temporarily unavailable". The same key is used to import subscriptions from a Google Takeout `subscriptions.csv` (Creators → Import your subscriptions). Automated tests never call YouTube; they use fixtures.

Until authentication exists (Slice 5), every request acts as a single development user (`dev@finifeed.local`), created on server start.

## Repository layout

```text
apps/server/       Bun + Hono backend
  migrations/      Plain SQL migrations (NNNN_description.sql), never edited once applied
  src/             Feature folders (health/, database/, config/, http/, …)
apps/web/          Vue 3 + Vite client
packages/shared/   API contract: types, Zod schemas, error codes
```

## Migrations

Add a new file `apps/server/migrations/NNNN_description.sql` with the next number. Each file runs in its own transaction. The runner stores a checksum and refuses to start if an applied migration was changed.
