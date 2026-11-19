-- Weather and the game date from the companion mod.
--
-- Everything the site knows about weather and the date is worked out from four adapters with
-- fixed names: WeatherTemperate, WeatherDrought, WeatherBadtide and GameDay. The mod reports the
-- same facts as readings ("Weather", "Cycle", "Day"). Rather than teach every function and page
-- two sources, colony_signals presents both as one stream of signals:
--   * a change in the mod's weather appears as the signal the matching Weather Station sends;
--   * a change in the mod's day appears as a GameDay signal;
--   * the real signals from those four adapters are left out for the time the mod was
--     reporting, so nothing is counted twice.
-- Signals from every other adapter pass through as they are. Nothing is written to the adapter
-- tables: the mod's rows exist only in this view.
--
-- Weather is stored as a number: 0 temperate, 1 drought, 2 badtide.

-- When the mod was reporting each metric: from its first value for it (or the session's start,
-- if later) until five minutes after the session's last heartbeat. The same rule as
-- tracker_history; keep the two in step.
create view public.mod_stretches
with (security_invoker = true)
as
  select s.colony_id,
         f.metric,
         greatest(s.started_at, f.first_at) as from_at,
         s.last_seen_at + interval '5 minutes' as to_at
    from public.mod_sessions s
    join (
      select r.colony_id, r.metric, min(r.received_at) as first_at
        from public.readings r
       group by r.colony_id, r.metric
    ) f on f.colony_id = s.colony_id and s.last_seen_at >= f.first_at;

revoke all on public.mod_stretches from anon, authenticated;
grant select on public.mod_stretches to authenticated;

create function public.mod_reporting_at(p_colony uuid, p_metric text, p_at timestamptz)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.mod_stretches m
     where m.colony_id = p_colony and m.metric = p_metric and p_at >= m.from_at and p_at < m.to_at
  );
$$;

revoke execute on function public.mod_reporting_at(uuid, text, timestamptz) from public, anon;
grant  execute on function public.mod_reporting_at(uuid, text, timestamptz) to authenticated;

create function public.weather_adapter(p_value integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_value when 0 then 'WeatherTemperate' when 1 then 'WeatherDrought' when 2 then 'WeatherBadtide' end;
$$;

-- The mod's rows get negative ids (minus the reading's id) so they can't collide with real ones.
create view public.colony_signals
with (security_invoker = true)
as
  -- Real signals, except the weather and day adapters while the mod was reporting those.
  select e.id, e.colony_id, e.adapter_name, e.state, e.received_at
    from public.adapter_events e
   where not (
           e.adapter_name in ('WeatherTemperate', 'WeatherDrought', 'WeatherBadtide')
           and public.mod_reporting_at(e.colony_id, 'Weather', e.received_at)
         )
     and not (e.adapter_name = 'GameDay' and public.mod_reporting_at(e.colony_id, 'Day', e.received_at))
  union all
  -- The mod's weather changes. A reading that only confirms the weather a station last
  -- reported (the mod's first reading, or its first after a break) is not a change.
  select -r.id, r.colony_id, public.weather_adapter(r.value), true, r.received_at
    from public.readings r
    left join lateral (
      select e.adapter_name
        from public.adapter_events e
       where e.colony_id = r.colony_id
         and e.adapter_name in ('WeatherTemperate', 'WeatherDrought', 'WeatherBadtide')
         and e.state
         and e.received_at < r.received_at
         and e.received_at > coalesce(
               (select max(p.received_at) from public.readings p
                 where p.colony_id = r.colony_id and p.metric = 'Weather' and p.received_at < r.received_at),
               '-infinity'::timestamptz)
         and not public.mod_reporting_at(e.colony_id, 'Weather', e.received_at)
       order by e.received_at desc, e.id desc
       limit 1
    ) station on true
   where r.metric = 'Weather'
     and public.weather_adapter(r.value) is not null
     and station.adapter_name is distinct from public.weather_adapter(r.value)
  union all
  -- The mod's day changes. Its first day reading says which day it is, not that one began.
  select -r.id, r.colony_id, 'GameDay', true, r.received_at
    from public.readings r
   where r.metric = 'Day'
     and exists (
       select 1 from public.readings p
        where p.colony_id = r.colony_id and p.metric = 'Day'
          and (p.received_at, p.id) < (r.received_at, r.id)
     );

revoke all on public.colony_signals from anon, authenticated;
grant select on public.colony_signals to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The functions below are the ones from the weather and game clock migrations, reading
-- colony_signals instead of adapter_events. game_date also takes the mod's cycle and day.
-- ---------------------------------------------------------------------------------------------

create or replace function public.weather_history(
  p_colony uuid,
  p_adapters text[],
  p_since timestamptz,
  p_bucket_seconds integer
)
returns table (adapter_name text, slot_start timestamptz, share real)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select greatest(p_bucket_seconds, 60) as bucket
  ),
  signals as materialized (
    select e.id, e.adapter_name, e.received_at
      from public.colony_signals e
     where e.colony_id = p_colony
       and e.adapter_name = any (p_adapters)
       and e.state
  ),
  -- the last "on" before the window, so the window starts with a known weather
  first_on as (
    select coalesce(max(e.received_at), p_since) as t
      from signals e
     where e.received_at < p_since
  ),
  periods as (
    select e.adapter_name,
           greatest(e.received_at, p_since) as t0,
           coalesce(lead(e.received_at) over (order by e.received_at, e.id), now()) as t1
      from signals e, first_on f
     where e.received_at >= f.t
  ),
  pieces as (
    select p.adapter_name,
           s.slot,
           extract(epoch from least(p.t1, to_timestamp((s.slot + 1) * pr.bucket))
                            - greatest(p.t0, to_timestamp(s.slot * pr.bucket))) as secs
      from periods p
     cross join params pr
     cross join lateral generate_series(
       floor(extract(epoch from p.t0) / pr.bucket)::bigint,
       floor(extract(epoch from p.t1) / pr.bucket)::bigint
     ) as s(slot)
     where p.t1 > p.t0
  ),
  per_slot as (
    select adapter_name, slot, sum(secs) as secs
      from pieces
     where secs > 0
     group by adapter_name, slot
  )
  select distinct on (ps.slot)
         ps.adapter_name,
         to_timestamp(ps.slot * pr.bucket) as slot_start,
         (ps.secs / pr.bucket)::real as share
    from per_slot ps
   cross join params pr
   order by ps.slot, ps.secs desc;
$$;

create or replace function public.signal_counts(p_colony uuid, p_adapter text, p_bounds timestamptz[])
returns table (idx integer, n integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with signals as materialized (
    select e.received_at
      from public.colony_signals e
     where e.colony_id = p_colony and e.adapter_name = p_adapter and e.state
  )
  select b.i,
         (select count(*)::integer
            from signals e
           where e.received_at >= p_bounds[b.i]
             and e.received_at < p_bounds[b.i + 1])
    from generate_subscripts(p_bounds, 1) as b(i)
   where b.i < array_length(p_bounds, 1)
   order by b.i;
$$;

-- The current game date.
--
-- It is counted on from a known date: the one the player set (game_clocks), or the cycle and day
-- the mod last reported, whichever is newer. A colony the mod reports for therefore needs no
-- clock set up; and when the mod stops, a Chronometer and Weather Stations carry the date on.
create or replace function public.game_date(p_colony uuid)
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
  mod_cycle integer;
  mod_day integer;
  mod_at timestamptz;
  known_at timestamptz;
  known_cycle integer;
  known_day integer;
  new_cycles integer;
  last_cycle_start timestamptz;
begin
  select * into clk from public.game_clocks g where g.colony_id = p_colony;

  select c.value, d.value, greatest(c.received_at, d.received_at)
    into mod_cycle, mod_day, mod_at
    from (select r.value, r.received_at from public.readings r
           where r.colony_id = p_colony and r.metric = 'Cycle' order by r.received_at desc, r.id desc limit 1) c,
         (select r.value, r.received_at from public.readings r
           where r.colony_id = p_colony and r.metric = 'Day' order by r.received_at desc, r.id desc limit 1) d;

  if mod_at is not null and (clk.colony_id is null or mod_at >= clk.anchor_at) then
    known_at := mod_at; known_cycle := mod_cycle; known_day := mod_day;
  elsif clk.colony_id is not null then
    known_at := clk.anchor_at; known_cycle := clk.anchor_cycle; known_day := clk.anchor_day;
  else
    return;
  end if;

  cycles_tracked := exists (select 1 from public.weather_trackers w where w.colony_id = p_colony)
                 or exists (select 1 from public.readings r where r.colony_id = p_colony and r.metric = 'Weather');

  select count(*)::integer, max(e.received_at)
    into new_cycles, last_cycle_start
    from public.colony_signals e
   where e.colony_id = p_colony and e.adapter_name = 'WeatherTemperate' and e.state and e.received_at > known_at;

  cycle := known_cycle + new_cycles;

  if last_cycle_start is null then
    select known_day + count(*)::integer into day
      from public.colony_signals e
     where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state and e.received_at > known_at;
  else
    select 1 + count(*)::integer into day
      from public.colony_signals e
     where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state and e.received_at > last_cycle_start + grace;
  end if;

  select count(*)::integer, min(e.received_at), max(e.received_at)
    into days_counted, first_day_at, last_day_at
    from public.colony_signals e
   where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state;

  -- typical real-time length of a game day: median gap between the last 11 day signals,
  -- ignoring gaps over 30 minutes (the game was paused or closed then)
  select percentile_cont(0.5) within group (order by g.gap)::real
    into seconds_per_day
    from (
      select extract(epoch from r.received_at - lag(r.received_at) over (order by r.received_at)) as gap
        from (
          select e.received_at
            from public.colony_signals e
           where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state
           order by e.received_at desc
           limit 11
        ) r
    ) g
   where g.gap is not null and g.gap < 1800;

  return next;
end;
$$;
