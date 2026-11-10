# smartbeavers

A web companion for Timberborn's **HTTP Lever** and **HTTP Adapter** automation buildings.

## How it fits together

```
 Player's machine                                   Cloud
┌──────────────────────────┐              ┌───────────────────────────────┐
│ Timberborn               │  webhooks    │ Cloudflare Worker (Hono)      │
│  HTTP Adapter ───────────┼─────────────▶│  /hook/:token/:on|off/:name   │──┐
│                          │              │  + static React SPA           │  │ secret key
│  HTTP API :8080 ◀────┐   │              └───────────────────────────────┘  ▼
└──────────────────────┼───┘                                          ┌──────────────┐
                       │ fetch (levers, adapters)                     │  Supabase    │
                 ┌─────┴──────────────────┐   auth, data, realtime    │  auth + PG   │
                 │ Browser (React SPA)    │◀─────────────────────────▶│  + realtime  │
                 └────────────────────────┘                           └──────────────┘
```

- **The game's HTTP API only listens on the player's machine**, so lever control and live reads
  happen from the browser (`src/lib/timberborn.ts`). The Worker never calls the game.
- **HTTP Adapters can call any URL** when their signal switches on/off. Each colony gets a secret
  webhook URL; the Worker records hits via `record_adapter_event()` and the dashboard updates live
  through Supabase Realtime.

## Stack

| Layer    | Choice                                                       |
| -------- | ------------------------------------------------------------ |
| Frontend | React 19 + React Router (SPA), Tailwind CSS v4, Vite         |
| Backend  | Cloudflare Worker with Hono, serving the SPA as static assets |
| Data     | Supabase (Postgres + RLS, magic-link auth, Realtime)         |

## Layout

```
src/                 React SPA
  lib/timberborn.ts  Client for the game's local HTTP API
  lib/supabase.ts    Browser Supabase client (publishable key)
  pages/             Home, Login, AuthCallback, Dashboard, Colony
  shared/            Code shared with the Worker (webhook URL format, generated DB types)
worker/index.ts      Hono app: /api/*, /hook/*
supabase/            config.toml + SQL migrations
wrangler.jsonc       Worker + static assets config
```

## Local development

Requires Node, pnpm and Docker.

```sh
pnpm install
pnpm db:start                     # local Supabase; prints the keys below
cp .env.example .env.local        # VITE_SUPABASE_PUBLISHABLE_KEY
cp .dev.vars.example .dev.vars    # SUPABASE_SECRET_KEY (Worker only)
pnpm cf-typegen                   # regenerate Worker Env types after editing vars
pnpm dev                          # http://localhost:5173
```

- Magic-link emails land in Mailpit: http://127.0.0.1:54324
- Supabase Studio: http://127.0.0.1:54323
- After changing SQL: `pnpm db:reset && pnpm db:types`

Simulate an adapter without the game:

```sh
curl -X POST "http://localhost:5173/hook/<token>/on/HTTP%20Adapter%201"
```

## Deploying

Production Supabase project: `smartbeavers.work` (ref `zpxkocfjbeqjtofsmqti`, eu-central-1). It is already
linked (`npx supabase link --project-ref zpxkocfjbeqjtofsmqti`).

Where config lives:

| Value                           | Local dev               | Production                         |
| ------------------------------- | ----------------------- | ---------------------------------- |
| `VITE_SUPABASE_*` (browser)     | `.env.local`            | `.env.production` (committed)      |
| `SUPABASE_URL` (Worker)         | `.dev.vars`             | `wrangler.jsonc` → `vars`          |
| `SUPABASE_SECRET_KEY` (Worker)  | `.dev.vars`             | `wrangler secret put`              |

Database changes. Supabase CLI v3 targets the **local** stack unless you pass `--remote`:

```sh
npx supabase db push --remote --dry-run   # review
npx supabase db push --remote
```

First deploy:

1. `npx wrangler login`
2. `npx wrangler secret put SUPABASE_SECRET_KEY`, using the project's secret key from
   `npx supabase projects api-keys --project-ref zpxkocfjbeqjtofsmqti` or the dashboard
3. In the Supabase dashboard → Auth → URL configuration, set the site URL to `https://smartbeavers.work`
   and add `https://smartbeavers.work/auth/callback` to the redirect URLs. Configure custom SMTP, because
   the built-in mailer is heavily rate-limited.
4. `pnpm deploy`. The `smartbeavers.work` custom domain requires the zone to be on the same Cloudflare account.

Note: `pnpm preview` builds in production mode, so it talks to the **production** Supabase project.

## Known unknowns

- **CORS on the game API.** It isn't documented whether Timberborn sends `Access-Control-Allow-Origin`.
  Without it the browser can't *read* lever/adapter lists. Commands still go through as `no-cors`
  requests but can't be confirmed. Test this against a running game first.
- **Browser access to localhost from an https site.** Chrome/Edge ask the user for Local Network
  Access permission; Firefox allows `http://localhost`; Safari blocks mixed content. A small local
  bridge or a companion mod may be needed for Safari or for remote control.
- **Webhook abuse.** Tokens are 192-bit random values, but there is no rate limiting yet. Add a
  Cloudflare rate-limiting rule on `/hook/*` before launch.
