<p align="center">
  <img src="src/assets/brand/mark.svg" alt="The smartbeavers logo: a beaver's head inside a cog" width="120" />
</p>

<h1 align="center">smartbeavers</h1>

A web companion for Timberborn's **HTTP Adapter** automation building. It runs at [smartbeavers.work](https://smartbeavers.work),
and you can host your own copy.

Fan-made. Not affiliated with or endorsed by Mechanistry, the studio behind Timberborn.

## Why it exists

Timberborn's HTTP Adapter lets a colony talk to the outside world: it calls a web address when
a signal switches. Using it normally means writing and hosting your own code.

smartbeavers is that code, ready-made, so ordinary players can use the building:

- **See signals arrive.** Paste two links into an adapter and every on/off shows up live.
- **Turn signals into numbers.** A few Population Counters or Resource Counters become a
  population count, free beds, or how full your water storage is, with history charts.
- **Follow the weather and the game clock.** Which weather is on, how long droughts last,
  the current cycle and day.

The guiding rule: plain words, no jargon, and every setup step says exactly what to click in
the game.

## How it fits together

```
 Player's machine                                   Cloud
┌──────────────────────────┐              ┌───────────────────────────────┐
│ Timberborn               │   signals    │ Cloudflare Worker             │
│  HTTP Adapter ───────────┼─────────────▶│  /hook/:token/:on|off/:name   │──┐
│                          │              │  + the web app                │  │ secret key
└──────────────────────────┘              └───────────────────────────────┘  ▼
                                                                      ┌──────────────┐
                                                                      │  Supabase    │
                 ┌────────────────────────┐   auth, data, realtime    │  auth + PG   │
                 │ Browser                │◀─────────────────────────▶│  + realtime  │
                 └────────────────────────┘                           │  + storage   │
                                                                      └──────────────┘
```

- **The site only receives.** The game calls the site; neither the server nor the browser
  ever calls the game.
- **HTTP Adapters can call any URL.** Each colony gets two adapter links, one for on and one
  for off, that share a secret token. The server records each signal and the dashboard updates
  live through Supabase Realtime.
- **The game only sends on/off.** Numbers are rebuilt from several counters at different
  thresholds: an adapter named `Pop30` switching on means the population just reached 30
  (`src/shared/ladders.ts`).

## Stack

| Layer    | Choice                                                        |
| -------- | ------------------------------------------------------------- |
| Frontend | React 19, TanStack Router + Query, Tailwind CSS v4, shadcn/ui |
| Backend  | TanStack Start server routes on a Cloudflare Worker           |
| Data     | Supabase (Postgres + row level security, email + password sign-in, Realtime, Storage for profile pictures) |

## Run it locally

You need Node 22.18 or newer, [pnpm](https://pnpm.io) 11 and Docker (for the local Supabase).
The seed script is TypeScript that Node runs directly, which older Node versions can't do.

```sh
pnpm install
pnpm db:start                              # local Supabase; prints the two keys used below
cp .env.example .env.local                 # paste the publishable key
cp .dev.vars.example .dev.vars             # paste the secret key (server only)
cp wrangler.example.jsonc wrangler.jsonc   # fine as it is for local use
pnpm dev                                   # http://localhost:5173
```

Then:

- `pnpm db:seed` fills the local database with a realistic colony: the player
  `test-beaver@example.com`, a population tracker, a weather tracker, a game clock and about
  four months of simulated signals. It only ever writes to a local Supabase.
- Sign in with that address and the password `test-beaver`, or create a new account on the sign-in page.
- Supabase Studio: http://127.0.0.1:54323
- After changing SQL: `pnpm db:reset && pnpm db:types`. A reset empties the database, so run
  `pnpm db:seed` again afterwards.

Send a signal without the game (the token is part of the adapter links on the colony's
Signals tab):

```sh
curl -X POST "http://localhost:5173/hook/<token>/on/Pop30"
```

`pnpm build` builds the app and type-checks `src/`; `pnpm typecheck` runs the type check on
its own. Neither covers `scripts/`. There are no automated tests yet.

## Layout

```
src/
  routes/            One file per URL. api/ and hook/ are server routes; _app.* needs sign-in
  pages/             The page components the routes render
  components/        Shared interface pieces; components/ui is shadcn/ui
  lib/               Browser-side data: Supabase client, TanStack Query hooks
  server/            Server-only code: the Supabase client with the secret key
  shared/            Used by both: tracker maths, goods list, weather, game clock, adapter
                     link format, generated DB types. site.ts (who runs the site) is browser-only
  router.tsx         Router + TanStack Query client
  start.ts           Pages render in the browser only (sign-in lives there)
  server.ts          Server entry: adds security headers
supabase/migrations  The database: tables, row level security, functions
scripts/seed-dev.ts  Local demo data
```

## Host your own

You need a [Supabase](https://supabase.com) project and a [Cloudflare](https://cloudflare.com)
account. Both have free tiers that are enough for this.

1. **Database.** Create a Supabase project, then:
   ```sh
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --remote --dry-run   # review
   npx supabase db push --remote
   ```
   The Supabase CLI targets the local database unless you pass `--remote`.
2. **Sign-in.** Players sign in with an email address and a password. In the Supabase dashboard
   under Auth → Sign In / Providers → Email, turn off "Confirm email" so new accounts work straight
   away and no email is sent, and set the minimum password length to 8. Because no email is
   sent, there is no self-service password reset: the sign-in page sends players to your contact
   page, and you reset passwords and change email addresses yourself in the Supabase dashboard.
3. **Settings.** Two files hold your deployment's settings. Neither is committed.
   ```sh
   cp .env.production.example .env.production   # Supabase URL + publishable key, and who runs the site
   cp wrangler.example.jsonc wrangler.jsonc     # Supabase URL, and your domain if you have one
   ```
   The "who runs the site" values fill in the contact page, privacy policy and terms. Read
   those pages and adapt them: they describe how smartbeavers.work is run, and you are
   responsible for what your copy says.
4. **Deploy.**
   ```sh
   npx wrangler login
   npx wrangler secret put SUPABASE_SECRET_KEY   # the project's secret key
   pnpm deploy
   ```

| Value                           | Local dev    | Production            |
| ------------------------------- | ------------ | --------------------- |
| `VITE_SUPABASE_*` (browser)     | `.env.local` | `.env.production`     |
| `VITE_OPERATOR_*` (browser)     | not needed   | `.env.production`     |
| `SUPABASE_URL` (server)         | `.dev.vars`  | `wrangler.jsonc`      |
| `SUPABASE_SECRET_KEY` (server)  | `.dev.vars`  | `wrangler secret put` |

`pnpm preview` builds in production mode, so it talks to whatever `.env.production` points at.

After adding a server variable or secret, also add it to `src/server/env.d.ts`. After adding
a browser variable (`VITE_*`), also add it to `src/vite-env.d.ts`.

## Known limits

- **Rate limiting.** The database caps signals per colony, but there is no network-level limit
  on `/hook/*`. A Cloudflare rate-limiting rule is worth adding on a public deployment.
- **The game's API switches off when a save is loaded.** Players have to press "Start API" in
  the game after every load. Until they do, adapters send nothing.
- **Password resets are manual.** No email is ever sent, so a player who forgets their password
  has to contact the operator, who resets it in the Supabase dashboard. The same goes for
  changing an email address.
- **Signals are kept forever.** Nothing prunes old signals; charts show at most the last 180
  days, but the rows stay in the database.
- **Game data is checked by hand.** Building options and goods come from the game and its
  wiki; a game update can make a label wrong.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security problems privately as described in
[SECURITY.md](SECURITY.md).

## Built with AI

Most of this project, including the code, the icons, the documentation and the first drafts of
the privacy policy and terms, was written with [Claude Code](https://claude.com/claude-code),
directed and reviewed by a human. Two things follow from that:

- **Game details may be wrong.** Building options and goods were checked against the game and
  its wiki where possible, but not all of them. If a label doesn't match what the game shows,
  please open an issue.
- **The legal pages are drafts, not legal advice.** If you host your own copy, have them
  checked for your situation.

AI-assisted contributions are welcome on the same terms as any other: you understand what you
submit, and it builds.

## Licence

[MIT](LICENSE). The icons in `src/components/app/GoodIcon.tsx` and the logo were drawn for this
project and are covered by the same licence. Timberborn and its artwork belong to Mechanistry.
