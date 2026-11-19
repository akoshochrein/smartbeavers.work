-- Retention: every colony gets the same bounded footprint, however much it is played.
-- The decision and its reasons are in docs/adr/0001-bounded-history-per-colony.md.
--
--   * Readings are thinned as they age: every value at first, then the last of each hour, then
--     the last of each day, then nothing.
--   * Day, cycle and weather changes and adapter signals are never thinned, only deleted when
--     they are too old. What the site counts from them is kept as totals first.
--   * A colony not heard from for a long time loses its history but keeps its latest values.
--   * What comes in is capped, so the database can't fill up between two cleanups.
--
-- The numbers are settings, one row, read by everything below and by the privacy page.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

-- An empty (null) setting means no limit. Change them in the SQL editor, for example:
--   update public.retention_settings set keep_days = 365;
create table public.retention_settings (
  id                  boolean primary key default true check (id),  -- there is exactly one row
  -- Readings younger than this are kept in full.
  full_detail_hours   integer default 48    check (full_detail_hours > 0),
  -- Until this age, the last reading of each hour is kept; after it, the last of each day.
  hourly_days         integer default 30    check (hourly_days > 0),
  -- Readings, signals and sessions older than this are deleted.
  keep_days           integer default 180   check (keep_days > 0),
  -- A colony not heard from for this long loses its history.
  silent_months       integer default 12    check (silent_months > 0),
  -- A metric stores at most one reading per this many seconds.
  reading_gap_seconds integer default 10    check (reading_gap_seconds > 0),
  -- A colony stores at most this many readings per hour.
  readings_per_hour   integer default 6000  check (readings_per_hour > 0)
);

insert into public.retention_settings default values;

alter table public.retention_settings enable row level security;
revoke all on public.retention_settings from anon, authenticated;

-- The policy, for anyone to read: the privacy page states it from here.
create function public.retention_policy()
returns public.retention_settings
language sql
stable
security definer
set search_path = ''
as $$
  select s from public.retention_settings s;
$$;

revoke execute on function public.retention_policy() from public;
grant  execute on function public.retention_policy() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Totals: what the site counts from history, kept when that history is deleted
-- ---------------------------------------------------------------------------

-- How many times each weather had started in the history that has since been deleted.
create table public.weather_totals (
  colony_id    uuid not null references public.colonies (id) on delete cascade,
  adapter_name text not null,
  starts       integer not null default 0,
  primary key (colony_id, adapter_name)
);

alter table public.weather_totals enable row level security;
revoke all on public.weather_totals from anon, authenticated;
grant select on public.weather_totals to authenticated;

create policy "Owners can read their weather totals"
  on public.weather_totals for select to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

-- All-time number of times each weather has started: the totals plus what is still in history.
-- Runs as the caller, so row level security limits it to the caller's own colonies.
create function public.weather_counts(p_colony uuid)
returns table (adapter_name text, n integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select w.adapter_name,
         (coalesce((select t.starts from public.weather_totals t
                     where t.colony_id = p_colony and t.adapter_name = w.adapter_name), 0)
          + (select count(*) from public.colony_signals e
              where e.colony_id = p_colony and e.adapter_name = w.adapter_name and e.state))::integer
    from unnest(array['WeatherTemperate', 'WeatherDrought', 'WeatherBadtide']) as w(adapter_name);
$$;

revoke execute on function public.weather_counts(uuid) from public, anon;
grant  execute on function public.weather_counts(uuid) to authenticated;

-- The game date at a moment: counted on from the newest date known by then, which is either the
-- one the player set (game_clocks) or the cycle and day the mod last reported. p_at null means
-- now. This is the counting that game_date() did itself until now; the cleanup needs it for a
-- moment in the past, to move a clock forward before the days behind it are deleted.
create function public.date_as_of(p_colony uuid, p_at timestamptz)
returns table (cycle integer, day integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  clk public.game_clocks;
  grace constant interval := interval '20 seconds';
  v_until timestamptz := coalesce(p_at, 'infinity'::timestamptz);
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
  if clk.anchor_at > v_until then
    clk := null;
  end if;

  if p_at is null then
    -- Now: the latest values are kept even after the readings behind them are deleted.
    select c.value, d.value, greatest(c.received_at, d.received_at)
      into mod_cycle, mod_day, mod_at
      from public.reading_metrics c, public.reading_metrics d
     where c.colony_id = p_colony and c.metric = 'Cycle'
       and d.colony_id = p_colony and d.metric = 'Day';
  else
    select c.value, d.value, greatest(c.received_at, d.received_at)
      into mod_cycle, mod_day, mod_at
      from (select r.value, r.received_at from public.readings r
             where r.colony_id = p_colony and r.metric = 'Cycle' and r.received_at <= p_at
             order by r.received_at desc, r.id desc limit 1) c,
           (select r.value, r.received_at from public.readings r
             where r.colony_id = p_colony and r.metric = 'Day' and r.received_at <= p_at
             order by r.received_at desc, r.id desc limit 1) d;
  end if;

  if mod_at is not null and (clk.colony_id is null or mod_at >= clk.anchor_at) then
    known_at := mod_at; known_cycle := mod_cycle; known_day := mod_day;
  elsif clk.colony_id is not null then
    known_at := clk.anchor_at; known_cycle := clk.anchor_cycle; known_day := clk.anchor_day;
  else
    return;
  end if;

  select count(*)::integer, max(e.received_at)
    into new_cycles, last_cycle_start
    from public.colony_signals e
   where e.colony_id = p_colony and e.adapter_name = 'WeatherTemperate' and e.state
     and e.received_at > known_at and e.received_at <= v_until;

  cycle := known_cycle + new_cycles;

  if last_cycle_start is null then
    select known_day + count(*)::integer into day
      from public.colony_signals e
     where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state
       and e.received_at > known_at and e.received_at <= v_until;
  else
    -- A day signal within a few seconds of a temperate start is the same boundary (the new
    -- cycle's day 1), so it isn't counted again.
    select 1 + count(*)::integer into day
      from public.colony_signals e
     where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state
       and e.received_at > last_cycle_start + grace and e.received_at <= v_until;
  end if;

  return next;
end;
$$;

revoke execute on function public.date_as_of(uuid, timestamptz) from public, anon;
grant  execute on function public.date_as_of(uuid, timestamptz) to authenticated;

-- game_date() as before, with the counting moved into date_as_of().
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
begin
  select d.cycle, d.day into cycle, day from public.date_as_of(p_colony, null) d;
  if cycle is null then
    return;
  end if;

  cycles_tracked := exists (select 1 from public.weather_trackers w where w.colony_id = p_colony)
                 or exists (select 1 from public.reading_metrics m where m.colony_id = p_colony and m.metric = 'Weather');

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

-- ---------------------------------------------------------------------------
-- What comes in
-- ---------------------------------------------------------------------------

alter table public.mod_requests
  add column hour timestamptz,
  add column readings integer not null default 0;

-- Stores a value if it differs from the last one for that colony and metric, within the caps:
--   * a second value for the same metric within reading_gap_seconds replaces the first instead
--     of adding a row (day, cycle and weather are exempt: the site counts each of them);
--   * over readings_per_hour for the colony, the latest value is still updated but no history
--     is stored.
-- Either way the colony's latest values stay right, which matters because the mod only sends a
-- value again when it changes.
create or replace function public.store_reading(p_colony uuid, p_metric text, p_value integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.retention_settings;
  v_last integer;
  v_last_at timestamptz;
  v_known boolean;
  v_stored integer;
begin
  select * into cfg from public.retention_settings;

  select m.value, m.received_at into v_last, v_last_at
    from public.reading_metrics m
   where m.colony_id = p_colony and m.metric = p_metric;
  v_known := found;

  if v_known then
    if v_last = p_value then
      return;
    end if;

    if cfg.reading_gap_seconds is not null
       and p_metric not in ('Day', 'Cycle', 'Weather')
       and v_last_at > now() - make_interval(secs => cfg.reading_gap_seconds) then
      update public.readings r
         set value = p_value
       where r.id = (
         select l.id from public.readings l
          where l.colony_id = p_colony and l.metric = p_metric
          order by l.received_at desc, l.id desc
          limit 1
       );
      update public.reading_metrics m
         set value = p_value
       where m.colony_id = p_colony and m.metric = p_metric;
      return;
    end if;
  -- A new metric for this colony: at most 100 different ones.
  elsif (select count(*) from public.reading_metrics m where m.colony_id = p_colony) >= 100 then
    return;
  end if;

  if cfg.readings_per_hour is not null then
    insert into public.mod_requests as q (colony_id, minute, count, hour, readings)
    values (p_colony, date_trunc('minute', now()), 0, date_trunc('hour', now()), 1)
    on conflict (colony_id) do update
       set readings = case when q.hour = excluded.hour then q.readings + 1 else 1 end,
           hour     = excluded.hour
    returning q.readings into v_stored;

    if v_stored > cfg.readings_per_hour then
      insert into public.reading_metrics as m (colony_id, metric, first_at, value, received_at)
      values (p_colony, p_metric, now(), p_value, now())
      on conflict (colony_id, metric) do update
         set value = excluded.value, received_at = excluded.received_at;
      return;
    end if;
  end if;

  insert into public.readings (colony_id, metric, value) values (p_colony, p_metric, p_value);
end;
$$;

-- ---------------------------------------------------------------------------
-- The cleanup
-- ---------------------------------------------------------------------------

-- Applies the settings to everything stored. Safe to run at any time and as often as you like:
-- a second run straight after the first changes nothing. Returns what it did.
create function public.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.retention_settings;
  v_cutoff timestamptz;
  v_hourly_from timestamptz;
  v_daily_from timestamptz;
  v_colony record;
  v_date record;
  n_signals bigint := 0;
  n_readings bigint := 0;
  n_thinned bigint := 0;
  n_sessions bigint := 0;
  n_silent bigint := 0;
  n bigint;
begin
  select * into cfg from public.retention_settings;

  -- 1. Too old to keep. First keep what the site counts from it.
  if cfg.keep_days is not null then
    v_cutoff := now() - make_interval(days => cfg.keep_days);

    -- Move each clock forward to the cutoff, so the date no longer depends on older days.
    for v_colony in select g.colony_id from public.game_clocks g where g.anchor_at < v_cutoff loop
      select d.cycle, d.day into v_date from public.date_as_of(v_colony.colony_id, v_cutoff) d;
      if v_date.cycle is not null then
        update public.game_clocks
           set anchor_at = v_cutoff, anchor_cycle = v_date.cycle, anchor_day = v_date.day
         where colony_id = v_colony.colony_id;
      end if;
    end loop;

    -- Add the weather starts about to be deleted to the totals.
    insert into public.weather_totals as t (colony_id, adapter_name, starts)
    select e.colony_id, e.adapter_name, count(*)
      from public.colony_signals e
     where e.adapter_name in ('WeatherTemperate', 'WeatherDrought', 'WeatherBadtide')
       and e.state
       and e.received_at < v_cutoff
     group by e.colony_id, e.adapter_name
    on conflict (colony_id, adapter_name) do update set starts = t.starts + excluded.starts;

    delete from public.adapter_events e where e.received_at < v_cutoff;
    get diagnostics n_signals = row_count;
    delete from public.readings r where r.received_at < v_cutoff;
    get diagnostics n_readings = row_count;
    delete from public.mod_sessions s where public.session_end(s) < v_cutoff;
    get diagnostics n_sessions = row_count;
  end if;

  -- 2. Thinning. Day, cycle and weather readings are counted by the site, so they stay whole.
  if cfg.full_detail_hours is not null then
    v_hourly_from := now() - make_interval(hours => cfg.full_detail_hours);
    v_daily_from := case when cfg.hourly_days is not null then now() - make_interval(days => cfg.hourly_days) end;

    -- Older than the hourly tier: the last reading of each day.
    if v_daily_from is not null then
      delete from public.readings r
       using (
         select x.id,
                row_number() over (partition by x.colony_id, x.metric, date_trunc('day', x.received_at at time zone 'utc')
                                   order by x.received_at desc, x.id desc) as place
           from public.readings x
          where x.received_at < v_daily_from and x.metric not in ('Day', 'Cycle', 'Weather')
       ) d
       where r.id = d.id and d.place > 1;
      get diagnostics n = row_count;
      n_thinned := n_thinned + n;
    end if;

    -- Older than full detail: the last reading of each hour.
    delete from public.readings r
     using (
       select x.id,
              row_number() over (partition by x.colony_id, x.metric, date_trunc('hour', x.received_at)
                                 order by x.received_at desc, x.id desc) as place
         from public.readings x
        where x.received_at < v_hourly_from
          and (v_daily_from is null or x.received_at >= v_daily_from)
          and x.metric not in ('Day', 'Cycle', 'Weather')
     ) d
     where r.id = d.id and d.place > 1;
    get diagnostics n = row_count;
    n_thinned := n_thinned + n;
  end if;

  -- 3. Colonies nobody has heard from in a long time: history, sessions and totals go; the
  --    colony, its trackers and its latest values stay.
  if cfg.silent_months is not null then
    for v_colony in
      select c.id
        from public.colonies c
        cross join lateral (
          select greatest(
                   (select max(s.updated_at) from public.adapter_states s where s.colony_id = c.id),
                   (select max(m.last_seen_at) from public.mod_sessions m where m.colony_id = c.id),
                   (select max(r.received_at) from public.reading_metrics r where r.colony_id = c.id)
                 ) as last_heard
        ) h
       where h.last_heard < now() - make_interval(months => cfg.silent_months)
         and (exists (select 1 from public.adapter_events e where e.colony_id = c.id)
           or exists (select 1 from public.readings r where r.colony_id = c.id)
           or exists (select 1 from public.mod_sessions m where m.colony_id = c.id)
           or exists (select 1 from public.weather_totals t where t.colony_id = c.id))
    loop
      delete from public.adapter_events where colony_id = v_colony.id;
      delete from public.readings where colony_id = v_colony.id;
      delete from public.mod_sessions where colony_id = v_colony.id;
      delete from public.weather_totals where colony_id = v_colony.id;
      n_silent := n_silent + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'signals_deleted', n_signals,
    'readings_deleted', n_readings,
    'readings_thinned', n_thinned,
    'sessions_deleted', n_sessions,
    'silent_colonies_cleared', n_silent);
end;
$$;

revoke execute on function public.apply_retention() from public, anon, authenticated;
grant  execute on function public.apply_retention() to service_role;

-- Every night at 04:17 UTC, inside the database.
create extension if not exists pg_cron;
select cron.schedule('smartbeavers-retention', '17 4 * * *', $cron$ select public.apply_retention(); $cron$);
