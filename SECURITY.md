# Security

If you find a security problem in smartbeavers, please report it privately rather than opening
a public issue.

- Use **Report a vulnerability** on this repository's Security tab, or
- write to the address on the [contact page](https://smartbeavers.work/contact).

Please include what you found, how to reproduce it, and what it lets someone do. You'll get a
reply within a few days. Please don't test against other players' colonies or data; a local
setup (see the README) behaves the same.

## How the project is protected

Knowing the design helps when looking for holes in it:

- **Row level security** in Postgres decides which rows a signed-in player can touch. The
  browser talks to Supabase directly with a public key, so every table has policies, and they
  are the most important code to review (`supabase/migrations`).
- **Column grants** decide which columns a player can write. Players can only set a colony's
  name, faction and game address, and a profile's handle, picture and public/private choice.
  Everything else, such as the adapter token, changes only through database functions.
- **A few database functions run with the owner's rights** (`security definer`) and so bypass
  row level security. Each is narrow, and each is worth reviewing:
  - `colony_ladder()` and `is_public_avatar()` can be called **without signing in**. See below.
  - `rotate_webhook_token()` lets a signed-in owner replace their colony's adapter links.
  - `record_adapter_event()` records a signal and enforces the limits. Only the server can
    call it.
  - `enforce_colony_limit()` is a trigger and can't be called directly.
- **What visitors who aren't signed in can read.** Only what `colony_ladder()` returns, and
  only for players who made their profile public, for colonies that sent a signal in the last
  hour. Per colony that is: the player's handle and picture and when their profile last changed, the colony's name and faction,
  the exact time of its last signal, its game date, the exact time its current cycle started,
  its current weather, and its population counters (each counter's number, whether it is on,
  and the exact time it last switched). The live colonies page shows less than this, but the function
  returns it to anyone who asks. Colonies are identified by an opaque key, not their id.
- **Profile pictures** are in a private storage bucket. Owners can read and write their own.
  One extra policy lets anyone read a picture while its owner's profile is public;
  `is_public_avatar()` answers that question with yes or no and nothing more. Making a profile
  private again takes the picture out of public reach at once.
- **Adapter links** carry a 192-bit random token per colony. Whoever has a link can send
  signals to that colony and nothing else. Owners can replace the links at any time.
- **The secret database key** exists only on the server, in `src/server` and the routes under
  `src/routes/api` and `src/routes/hook`. It must never be imported from browser code. The
  local seed script (`scripts/seed-dev.ts`) also reads it from `.dev.vars`, and refuses to run
  against anything but a local Supabase.
- **Account deletion** runs on the server with the secret key. Who is being deleted comes only
  from the caller's own sign-in token.
- **Limits** in the database cap colonies per player, adapter names per colony and signals
  per minute.
