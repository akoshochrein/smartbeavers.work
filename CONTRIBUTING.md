# Contributing

Thanks for wanting to help. smartbeavers is a small hobby project, so the process is light.

## Before you start

- For anything bigger than a small fix, open an issue first and say what you'd like to change.
  It saves you building something that doesn't fit.
- Bugs: say what you did, what you expected and what happened. A screenshot helps.
- Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Making a change

1. Fork the repository and create a branch.
2. Set the project up locally (see [README.md](README.md#run-it-locally)).
3. Make your change. Keep it focused: one topic per pull request.
4. If you changed anything under `supabase/`, run `pnpm test:db`. It needs the local Supabase
   running and leaves its data alone. CI does not run it.
5. Run `pnpm build`. It builds the app and type-checks `src/`, and it must pass. `pnpm typecheck`
   runs the type check alone. Neither covers `scripts/`, so run `pnpm db:seed` if you changed
   the seed script.
6. Open a pull request that says what changed and why. Add a screenshot for anything visible.

## Things to know

- **The goal is that ordinary players can use it.** Plain words in the interface, no jargon,
  and every setup step should say exactly what to click in the game.
- **In-game names must match the game.** If you add or rename a building option, good or
  setting, check it against the game itself, not from memory.
- **Database changes** go in a new file under `supabase/migrations`. Never edit a migration
  that has already been released. Every new table needs row level security policies.
- **A column players can edit needs a column grant too.** Row level security decides which
  rows a player can touch; column grants decide which columns. `colonies` and `profiles` only
  let players write the columns listed in their grants, so a new editable column needs a
  `grant insert/update (...)` in a new migration.
- **Resetting the local database empties it.** After `pnpm db:reset`, run `pnpm db:types` and
  then `pnpm db:seed` to get the demo colony back.
- **The Supabase CLI targets the local database** unless you pass `--remote`
  (`npx supabase db push --remote`).
- **New environment variables need a type entry**: `src/vite-env.d.ts` for browser variables
  (`VITE_*`), `src/server/env.d.ts` for server ones.
- **Adapter URLs can't change.** Players have `/hook/<token>/<on|off>/<name>` pasted into
  their games. See [what the hook answers](#what-the-hook-answers) for the full contract.
- **The companion mod** lives in `mod/` and has its own [README](mod/README.md). It is C#,
  built with `dotnet build` against your own copy of the game. CI doesn't build it, so say in
  your pull request that you built it and loaded it in the game. What the mod sends and what
  the site accepts (`src/shared/mod.ts`) must change together.
- **No game artwork.** Icons are drawn for this project; Timberborn's own assets belong to
  Mechanistry.

## What the hook answers

`/hook/<token>/<on|off>/<name>` is the one part of the project that lives inside players'
saves, so its behaviour is a contract. It is implemented in
`src/routes/hook/$token/$signal/$.ts` and the `record_adapter_event` database function.

- **Methods.** GET and POST both work, because the adapter's Method dropdown offers both.
- **The name** is everything after `<on|off>/`, decoded once, at most 100 characters. If a link
  was pasted twice into the same field, the name is taken from the first copy.

| Answer | When                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| 204    | The signal was recorded                                                              |
| 204    | The colony is over a limit (600 signals a minute, or 500 adapter names) and the signal was dropped. The answer is the same on purpose, so a flood learns nothing |
| 404    | The token is malformed or unknown, or the part after it is neither `on` nor `off`    |
| 400    | The name is empty, longer than 100 characters, or can't be decoded                   |
| 500    | The database call failed                                                             |

By contributing you agree that your work is released under the project's [MIT licence](LICENSE).
