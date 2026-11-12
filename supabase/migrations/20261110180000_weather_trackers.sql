-- Weather trackers.
--
-- The player builds one Weather Station per weather type (temperate, drought, badtide), each
-- wired to an HTTP Adapter with a fixed name: WeatherTemperate, WeatherDrought, WeatherBadtide.
-- The station whose adapter switched on most recently is the active weather. Signals are stored
-- in adapter_events like every other adapter; this table only records that the colony tracks
-- weather, so the dashboard can show the tracker (and its setup guide) before any signal arrives.

create table public.weather_trackers (
  colony_id  uuid primary key references public.colonies (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.weather_trackers enable row level security;

create policy "Owners can read their weather tracker"
  on public.weather_trackers for select to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners can add a weather tracker"
  on public.weather_trackers for insert to authenticated
  with check (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners can remove their weather tracker"
  on public.weather_trackers for delete to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

-- Per-weather counters need all-time counts of "switched on" events; keep them cheap.
create index adapter_events_colony_adapter_state_idx
  on public.adapter_events (colony_id, adapter_name, state);
