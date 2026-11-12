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
4. Run `pnpm build`. It builds the app and type-checks it, and it must pass.
5. Open a pull request that says what changed and why. Add a screenshot for anything visible.

## Things to know

- **The goal is that ordinary players can use it.** Plain words in the interface, no jargon,
  and every setup step should say exactly what to click in the game.
- **In-game names must match the game.** If you add or rename a building option, good or
  setting, check it against the game itself, not from memory.
- **Database changes** go in a new file under `supabase/migrations`. Never edit a migration
  that has already been released. Every new table needs row level security policies.
- **Adapter URLs can't change.** Players have `/hook/<token>/<on|off>/<name>` pasted into
  their games.
- **No game artwork.** Icons are drawn for this project; Timberborn's own assets belong to
  Mechanistry.

By contributing you agree that your work is released under the project's [MIT licence](LICENSE).
