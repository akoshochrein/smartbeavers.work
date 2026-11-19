## Agent skills

### Issue tracker

Issues live in GitHub Issues on `akoshochrein/smartbeavers.work` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Operations

- **Committing and pushing.** The maintainer commits and pushes to `main` themselves. Ask before committing; don't push.
- **Deploying.** Don't assume a push to `main` deploys: the Cloudflare Git-connected build has not reliably produced deployments. Live deploys are done with `pnpm deploy` (Wrangler) from a clean `main`. Check whether Git builds work before relying on them.
- **Database.** The Supabase CLI targets the local stack by default. Production changes need `npx supabase db push --remote`, with `--dry-run` first. Ship a migration before the code that depends on it.
- **Release order.** Migration, commit (maintainer), deploy, smoke test, then delete any test data.
