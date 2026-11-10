-- Threshold ladders ("trackers" in the UI).
--
-- The game only sends on/off signals, so a number such as the population is tracked with
-- several in-game counters at different thresholds, each wired to its own HTTP Adapter.
-- A ladder records which thresholds the player built so the dashboard can turn adapter
-- states back into a range ("30–39 beavers") and show steps still waiting for data.
--
-- Adapter names are derived, not stored: <metric><threshold>, e.g. "Pop30".

create table public.ladders (
  id          uuid primary key default gen_random_uuid(),
  colony_id   uuid not null references public.colonies (id) on delete cascade,
  -- Adapter name prefix, e.g. "Pop", "Adults", "Bots". Letters only so names stay URL-safe.
  metric      text not null check (metric ~ '^[A-Za-z]{1,20}$'),
  -- In-game counter comparison: 'gte' (greater or equal) or 'gt' (strictly greater).
  comparison  text not null default 'gte' check (comparison in ('gte', 'gt')),
  thresholds  integer[] not null check (
    cardinality(thresholds) between 1 and 50
    and 0 <= all (thresholds)
    and 100000 >= all (thresholds)
  ),
  created_at  timestamptz not null default now(),
  unique (colony_id, metric)
);

create index ladders_colony_id_idx on public.ladders (colony_id);

alter table public.ladders enable row level security;

create policy "Owners can read their ladders"
  on public.ladders for select to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners can create ladders"
  on public.ladders for insert to authenticated
  with check (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners can update their ladders"
  on public.ladders for update to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners can delete their ladders"
  on public.ladders for delete to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));
