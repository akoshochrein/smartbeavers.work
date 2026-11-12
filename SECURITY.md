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

- **Row level security** in Postgres is the only thing between a signed-in player and other
  players' data. The browser talks to Supabase directly with a public key, so every table has
  policies, and they are the most important code to review (`supabase/migrations`).
- **Adapter links** carry a 192-bit random token per colony. Whoever has a link can send
  signals to that colony and nothing else. Owners can replace the links at any time.
- **The secret database key** exists only on the server, in `src/server` and the routes under
  `src/routes/api` and `src/routes/hook`. It must never be imported from browser code.
- **Limits** in the database cap colonies per player, adapter names per colony and signals
  per minute.
