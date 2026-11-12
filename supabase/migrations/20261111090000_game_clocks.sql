-- Game clock: counts in-game days with a Chronometer.
--
-- The player sets one Chronometer to 00:00-00:25 (its shortest window) and wires it to an HTTP Adapter named GameDay
-- that only calls "on", so every GameDay signal is the start of a new game day. The game shows the
-- date as "Cycle X, Day Y" and the day restarts when a new cycle begins; a cycle begins when
-- temperate weather starts, which the weather tracker (WeatherTemperate) reports.
--
-- The player tells us the date the game showed at one moment (the anchor). Everything else is
-- counted from signals, here in the database, so day signals never have to be downloaded.

create table public.game_clocks (
  colony_id    uuid primary key references public.colonies (id) on delete cascade,
  anchor_at    timestamptz not null default now(),
  anchor_cycle integer not null check (anchor_cycle between 1 and 100000),
  anchor_day   integer not null check (anchor_day between 1 and 1000),
  created_at   timestamptz not null default now()
);

alter table public.game_clocks enable row level security;

create policy "Owners can read their game clock"
  on public.game_clocks for select to authenticated
  using (exists (select 1 from public.colonies c where c.id = colony_id and c.owner_id = (select auth.uid())));

create policy "Owners can add a game clock"
  on public.game_clocks for insert to authenticated
  with check (exists (select 1 from public.colonies c where c.id = colony_id and c.owner_id = (select auth.uid())));

create policy "Owners can correct their game clock"
  on public.game_clocks for update to authenticated
  using (exists (select 1 from public.colonies c where c.id = colony_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.colonies c where c.id = colony_id and c.owner_id = (select auth.uid())));

create policy "Owners can remove their game clock"
  on public.game_clocks for delete to authenticated
  using (exists (select 1 from public.colonies c where c.id = colony_id and c.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------------------------------------
-- The current game date and whether the game seems to be running.
--
-- A day signal that lands within a few seconds after a temperate start is the same boundary
-- (the new cycle's day 1), so it isn't counted again.

create function public.game_date(p_colony uuid)
returns table (
  cycle integer,
  day integer,
  cycles_tracked boolean,
  days_counted integer,
  first_day_at timestamptz,
  last_day_at timestamptz,
  seconds_per_day real
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  clk public.game_clocks;
  grace constant interval := interval '20 seconds';
  new_cycles integer;
  last_cycle_start timestamptz;
begin
  select * into clk from public.game_clocks g where g.colony_id = p_colony;
  if not found then
    return;
  end if;

  cycles_tracked := exists (select 1 from public.weather_trackers w where w.colony_id = p_colony);

  select count(*)::integer, max(e.received_at)
    into new_cycles, last_cycle_start
    from public.adapter_events e
   where e.colony_id = p_colony and e.adapter_name = 'WeatherTemperate' and e.state and e.received_at > clk.anchor_at;

  cycle := clk.anchor_cycle + new_cycles;

  if last_cycle_start is null then
    select clk.anchor_day + count(*)::integer into day
      from public.adapter_events e
     where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state and e.received_at > clk.anchor_at;
  else
    select 1 + count(*)::integer into day
      from public.adapter_events e
     where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state and e.received_at > last_cycle_start + grace;
  end if;

  select count(*)::integer, min(e.received_at), max(e.received_at)
    into days_counted, first_day_at, last_day_at
    from public.adapter_events e
   where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state;

  -- typical real-time length of a game day: median gap between the last 11 day signals,
  -- ignoring gaps over 30 minutes (the game was paused or closed then)
  select percentile_cont(0.5) within group (order by g.gap)::real
    into seconds_per_day
    from (
      select extract(epoch from r.received_at - lag(r.received_at) over (order by r.received_at)) as gap
        from (
          select e.received_at
            from public.adapter_events e
           where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state
           order by e.received_at desc
           limit 11
        ) r
    ) g
   where g.gap is not null and g.gap < 1800;

  return next;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- How many "on" signals one adapter sent within each consecutive pair of p_bounds.
-- With the GameDay adapter this is "how many game days passed between these moments".

create function public.signal_counts(p_colony uuid, p_adapter text, p_bounds timestamptz[])
returns table (idx integer, n integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.i,
         (select count(*)::integer
            from public.adapter_events e
           where e.colony_id = p_colony
             and e.adapter_name = p_adapter
             and e.state
             and e.received_at >= p_bounds[b.i]
             and e.received_at < p_bounds[b.i + 1])
    from generate_subscripts(p_bounds, 1) as b(i)
   where b.i < array_length(p_bounds, 1)
   order by b.i;
$$;

grant execute on function public.game_date(uuid) to authenticated;
grant execute on function public.signal_counts(uuid, text, timestamptz[]) to authenticated;
