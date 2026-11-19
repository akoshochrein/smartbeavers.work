-- Public colonies: a player can show one colony's page to everyone.
--
-- See docs/adr/0002-public-colony-pages-read-through-functions.md. No table is opened: the public
-- page reads through the functions below, which take the colony's opaque key and hand out a fixed
-- set of fields. They never return the token, a colony or owner id, or an adapter's name, and
-- they return no real clock time except when the colony was last heard from. Where the page
-- needs to place something in time, it gets a position in game days instead (see game_x below).

-- Off for every colony until its owner switches it on. A colony is public only while this is on
-- AND its owner's profile is public, so switching the profile off closes every page at once and
-- switching it back on restores them.
alter table public.colonies add column is_public boolean not null default false;

-- The last part of a colony's address, from its name: "Corntopia X" becomes "corntopia-x".
create function public.colony_slug(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(
      translate(lower(p_name), 'áàâäãåéèêëíìîïóòôöõőøúùûüűçñ', 'aaaaaaeeeeiiiiooooooouuuuucn'),
      '[^a-z0-9]+', '-', 'g')), ''),
    'colony');
$$;

-- Every colony's slug. Two colonies of one player that make the same slug are told apart by a
-- number on the later one: "corntopia-x", then "corntopia-x-2". Nothing is stored, so renaming a
-- colony changes its address and the old one stops working.
create view public.colony_addresses
with (security_invoker = true)
as
  select n.colony_id,
         n.owner_id,
         n.base || case when n.place > 1 then '-' || n.place::text else '' end as slug
    from (
      select c.id as colony_id,
             c.owner_id,
             public.colony_slug(c.name) as base,
             row_number() over (partition by c.owner_id, public.colony_slug(c.name) order by c.created_at, c.id) as place
        from public.colonies c
    ) n;

grant select on public.colony_addresses to authenticated;

-- The colony behind a public key, if it is public right now. For use inside the functions below
-- only: it returns a real id, so nobody may call it directly.
create function public.public_colony_id(p_key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
    from public.colonies c
    join public.profiles p on p.user_id = c.owner_id
   where c.is_public and p.is_public and p.handle is not null
     and md5('ladder:' || c.id::text) = p_key;
$$;

revoke all on function public.public_colony_id(text) from public, anon, authenticated;

-- A public colony by its address. Returns nothing for an address that matches no colony and for
-- a colony that is not public, so the two can't be told apart.
create function public.public_colony(p_handle text, p_slug text)
returns table (
  key text,
  colony_name text,
  faction text,
  handle text,
  avatar_path text,
  profile_updated_at timestamptz,
  last_signal_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select md5('ladder:' || c.id::text),
         c.name,
         c.faction,
         p.handle,
         p.avatar_path,
         p.updated_at,
         greatest(
           (select max(s.updated_at) from public.adapter_states s where s.colony_id = c.id),
           (select max(m.last_seen_at) from public.mod_sessions m where m.colony_id = c.id))
    from public.profiles p
    join public.colonies c on c.owner_id = p.user_id
    join public.colony_addresses a on a.colony_id = c.id
   where lower(p.handle) = lower(p_handle)
     and a.slug = p_slug
     and c.is_public and p.is_public;
$$;

revoke all on function public.public_colony(text, text) from public;
grant execute on function public.public_colony(text, text) to anon, authenticated;

-- Where a moment sits in a colony's game days: 0 at the start of the first day in `p_starts`
-- (the moments each day began, oldest first), 1 at the start of the second, and so on, with the
-- part of a day as the fraction. This is how the public page places things in time without
-- being told when they happened. A paused or closed game takes no room, and the last day is
-- measured against a usual day's length.
create function public.game_x(p_starts timestamptz[], p_at timestamptz, p_day_seconds double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case
           when k.n = 0 then 0
           else (k.n - 1) + least(1, extract(epoch from p_at - p_starts[k.n])
                                     / greatest(1, extract(epoch from coalesce(p_starts[k.n + 1], p_starts[k.n] + make_interval(secs => p_day_seconds)) - p_starts[k.n])))
         end
    from (select count(*)::integer as n from unnest(p_starts) s where s <= p_at) k;
$$;

-- The starts of a colony's most recent game days, oldest first: the window the public page shows.
create function public.recent_day_starts(p_colony uuid, p_days integer)
returns timestamptz[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(d.received_at order by d.received_at), '{}')
    from (
      select e.received_at
        from public.colony_signals e
       where e.colony_id = p_colony and e.adapter_name = 'GameDay' and e.state
       order by e.received_at desc
       limit p_days
    ) d;
$$;

revoke all on function public.recent_day_starts(uuid, integer) from public, anon;

-- Everything the public colony page shows apart from histories, as one document:
--
--   last_heard_at, running           when it was last heard from, and whether the game is sending now
--   date {cycle, day}                the game date, if the colony has one
--   days, now_x                      how many game days the window holds, and where "now" sits in it
--   weather {now, days}              the current weather and the game days it has lasted
--   weather_counts {adapter: n}      how many times each weather has started
--   periods [{weather, days, ongoing}]   weather periods in the window, oldest first, in game days
--   numbers [{metric, comparison, tracked, pinned, reading, steps [{threshold, on, order}]}]
--                                    each number shown: the mod's reading when that is the value,
--                                    otherwise its counters, with the order they last switched in
--
-- Null for a key that is not a public colony.
create function public.public_colony_overview(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.public_colony_id(p_key);
  gd record;
  v_starts timestamptz[];
  v_day_seconds double precision;
  v_reporting boolean;
  v_last_heard timestamptz;
  v_weather text;
  v_weather_since timestamptz;
  v_weather_days integer;
  v_periods jsonb;
  v_numbers jsonb;
  v_counts jsonb;
begin
  if v_id is null then
    return null;
  end if;

  select * into gd from public.game_date(v_id);
  v_starts := public.recent_day_starts(v_id, 180);
  v_day_seconds := coalesce(gd.seconds_per_day, 460);
  v_reporting := exists (select 1 from public.mod_sessions s where s.colony_id = v_id and public.session_end(s) > now());
  v_last_heard := greatest(
    (select max(s.updated_at) from public.adapter_states s where s.colony_id = v_id),
    (select max(m.last_seen_at) from public.mod_sessions m where m.colony_id = v_id));

  -- The weather that started most recently, whichever source saw it.
  select e.adapter_name, e.received_at into v_weather, v_weather_since
    from public.colony_signals e
   where e.colony_id = v_id and e.state
     and e.adapter_name in ('WeatherTemperate', 'WeatherDrought', 'WeatherBadtide')
   order by e.received_at desc
   limit 1;
  if v_weather_since >= gd.first_day_at then
    select nullif(count(*), 0)::integer into v_weather_days
      from unnest(v_starts) s where s >= v_weather_since;
  end if;

  -- Weather periods that started inside the window, each as long as the game days begun in it.
  select coalesce(jsonb_agg(jsonb_build_object(
           'weather', w.adapter_name,
           'days', (select count(*) from unnest(v_starts) s where s >= w.received_at and s < coalesce(w.until, 'infinity')),
           'ongoing', w.until is null) order by w.received_at), '[]'::jsonb)
    into v_periods
    from (
      select e.adapter_name, e.received_at, lead(e.received_at) over (order by e.received_at) as until
        from public.colony_signals e
       where e.colony_id = v_id and e.state
         and e.adapter_name in ('WeatherTemperate', 'WeatherDrought', 'WeatherBadtide')
    ) w
   where cardinality(v_starts) > 0 and w.received_at >= v_starts[1];

  select coalesce(jsonb_object_agg(c.adapter_name, c.n), '{}'::jsonb) into v_counts
    from public.weather_counts(v_id) c;

  -- Each number: what the mod reports, what the player tracks, or both.
  select coalesce(jsonb_agg(jsonb_build_object(
           'metric', n.metric,
           'comparison', coalesce(n.comparison, 'gte'),
           'tracked', n.comparison is not null,
           'pinned', n.pinned,
           -- The mod's number is the value while the mod is reporting, or when no counter has
           -- switched since it was reported. Otherwise the counters are.
           'reading', case when n.value is not null and (v_reporting or n.steps_at is null or n.steps_at <= n.received_at) then n.value end,
           'steps', n.steps) order by n.metric), '[]'::jsonb)
    into v_numbers
    from (
      select m.metric,
             l.comparison,
             r.value,
             r.received_at,
             exists (select 1 from public.pinned_metrics p where p.colony_id = v_id and p.metric = m.metric) as pinned,
             st.steps,
             st.steps_at
        from (
          select l.metric from public.ladders l where l.colony_id = v_id
          union
          select r.metric from public.reading_metrics r where r.colony_id = v_id
        ) m
        left join public.ladders l on l.colony_id = v_id and l.metric = m.metric
        left join public.reading_metrics r on r.colony_id = v_id and r.metric = m.metric
        left join lateral (
          -- This metric's counters: the adapters named <metric><number>. Only the number is
          -- handed out, and the order they last switched in instead of the time.
          select coalesce(jsonb_agg(jsonb_build_object(
                     'threshold', s.threshold, 'on', s.state, 'order', s.place) order by s.threshold), '[]'::jsonb) as steps,
                 max(s.updated_at) as steps_at
            from (
              select substring(a.name from char_length(m.metric) + 1)::integer as threshold,
                     a.state,
                     a.updated_at,
                     row_number() over (order by a.updated_at) as place
                from public.adapter_states a
               where l.metric is not null
                 and a.colony_id = v_id
                 and a.name ~ ('^' || m.metric || '(0|[1-9][0-9]{0,5})$')
            ) s
        ) st on true
       where m.metric not in ('Weather', 'Cycle', 'Day', 'FreeBeds', 'Beds')
    ) n;

  return jsonb_build_object(
    'last_heard_at', v_last_heard,
    'running', v_reporting or (gd.last_day_at is not null and now() - gd.last_day_at < make_interval(secs => greatest(90, v_day_seconds * 2.5))),
    'date', case when gd.cycle is not null then jsonb_build_object('cycle', gd.cycle, 'day', gd.day) end,
    'days', cardinality(v_starts),
    'now_x', case when cardinality(v_starts) > 0 then public.game_x(v_starts, now(), v_day_seconds) end,
    'weather', case when v_weather is not null then jsonb_build_object('now', v_weather, 'days', v_weather_days) end,
    'weather_counts', v_counts,
    'periods', v_periods,
    'numbers', v_numbers);
end;
$$;

revoke all on function public.public_colony_overview(text) from public;
grant execute on function public.public_colony_overview(text) to anon, authenticated;

-- One number's history for the public colony page: what tracker_history returns for the window,
-- with each row's time replaced by its position in game days (x) and each adapter's name by its
-- counter's number. Empty for a colony with no game days counted: without a game clock there is
-- nothing to place the history on that isn't a real time.
create function public.public_colony_history(p_key text, p_metric text)
returns table (source text, x double precision, value integer, threshold integer, state boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.public_colony_id(p_key);
  v_starts timestamptz[];
  v_day_seconds double precision;
  v_adapters text[];
begin
  if v_id is null or p_metric !~ '^[A-Za-z]{1,20}$' then
    return;
  end if;
  v_starts := public.recent_day_starts(v_id, 180);
  if cardinality(v_starts) = 0 then
    return;
  end if;
  select coalesce(g.seconds_per_day, 460) into v_day_seconds from public.game_date(v_id) g;
  select coalesce(array_agg(a.name), '{}') into v_adapters
    from public.adapter_states a
   where a.colony_id = v_id and a.name ~ ('^' || p_metric || '(0|[1-9][0-9]{0,5})$');

  return query
    select h.source,
           public.game_x(v_starts, h.at, coalesce(v_day_seconds, 460)),
           h.value,
           case when h.adapter_name is not null then substring(h.adapter_name from char_length(p_metric) + 1)::integer end,
           h.state
      from public.tracker_history(
             v_id, p_metric, v_adapters, v_starts[1],
             greatest(1, round(extract(epoch from now() - v_starts[1]) / 360))::integer) h
     order by h.at, h.carried desc, h.source, h.adapter_name;
end;
$$;

revoke all on function public.public_colony_history(text, text) from public;
grant execute on function public.public_colony_history(text, text) to anon, authenticated;

-- The live colonies list says which colonies can be opened, and at what address. Two more
-- columns, so the function is dropped and made again; the rest is unchanged.
drop function public.colony_ladder();

create function public.colony_ladder()
returns table (
  key text,
  handle text,
  avatar_path text,
  profile_updated_at timestamptz,
  colony_name text,
  faction text,
  last_signal_at timestamptz,
  cycle integer,
  day integer,
  weather text,
  -- Game days the current weather has lasted, when a game clock was running as it started.
  weather_days integer,
  pop_comparison text,
  pop_steps jsonb,
  -- The mod's exact population (the game's total: beavers and bots). Set while the mod is
  -- reporting, or when no population counter has reported since; then it is the number to show
  -- and pop_steps is empty.
  pop_reading integer,
  -- Its player switched on showing the colony's page to everyone; `slug` is then the last part of
  -- its address, /live/<handle>/<slug>. Null for a colony that is only listed.
  is_public boolean,
  slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  with active as (
    select c.id,
           act.last_signal_at,
           act.last_signal_at > now() - interval '1 hour' as live
      from public.profiles p
      join public.colonies c on c.owner_id = p.user_id
      join lateral (
        select greatest(
                 (select max(s.updated_at) from public.adapter_states s where s.colony_id = c.id),
                 (select max(m.last_seen_at) from public.mod_sessions m where m.colony_id = c.id)
               ) as last_signal_at
      ) act on act.last_signal_at > now() - interval '7 days'
     where p.is_public and p.handle is not null
  ),
  -- Every live colony (up to 200), and the 20 most recently played of the rest. Chosen before
  -- anything else is worked out, so the cost follows what is shown, not what was played all week.
  chosen as (
    select r.id, r.last_signal_at
      from (select a.*, row_number() over (partition by a.live order by a.last_signal_at desc) as place from active a) r
     where r.place <= case when r.live then 200 else 20 end
  )
  select md5('ladder:' || c.id::text),
         p.handle,
         p.avatar_path,
         p.updated_at,
         c.name,
         c.faction,
         act.last_signal_at,
         gd.cycle,
         gd.day,
         case w.adapter
           when 'WeatherTemperate' then 'temperate'
           when 'WeatherDrought' then 'drought'
           when 'WeatherBadtide' then 'badtide'
         end,
         nullif(wd.days, 0),
         pop.comparison,
         case when pick.mod_pop then null else pop.steps end,
         case when pick.mod_pop then pr.value end,
         c.is_public,
         case when c.is_public then (select a.slug from public.colony_addresses a where a.colony_id = c.id) end
    from chosen act
    join public.colonies c on c.id = act.id
    join public.profiles p on p.user_id = c.owner_id
    cross join lateral (
      select exists (select 1 from public.mod_sessions m
                      where m.colony_id = c.id and m.last_seen_at > now() - interval '5 minutes') as reporting,
             exists (select 1 from public.weather_trackers t where t.colony_id = c.id) as stations
    ) md
    left join public.reading_metrics wr on wr.colony_id = c.id and wr.metric = 'Weather'
    left join public.reading_metrics pr on pr.colony_id = c.id and pr.metric = 'Pop'
    left join lateral public.game_date(c.id) gd on true
    left join lateral (
      -- The station that switched on most recently, if the colony has stations.
      select s.name, s.updated_at
        from public.adapter_states s
       where md.stations
         and s.colony_id = c.id
         and s.name in ('WeatherTemperate', 'WeatherDrought', 'WeatherBadtide')
       order by s.state desc, s.updated_at desc
       limit 1
    ) station on true
    left join lateral (
      -- The mod's weather while it is reporting, or when no station has reported since.
      select case
               when wr.value is not null and (md.reporting or station.name is null or station.updated_at <= wr.received_at)
                 then public.weather_adapter(wr.value)
               else station.name
             end as adapter,
             case
               when wr.value is not null and (md.reporting or station.name is null or station.updated_at <= wr.received_at)
                 then wr.received_at
               else station.updated_at
             end as since
    ) w on true
    left join lateral (
      -- Day signals since the weather started. Only counted if the clock was already running
      -- then, as on the colony's own page; otherwise the number would start too low.
      select count(*)::integer as days
        from public.colony_signals e
       where e.colony_id = c.id and e.adapter_name = 'GameDay' and e.state
         and e.received_at >= w.since
         and w.since >= gd.first_day_at
    ) wd on true
    left join lateral (
      select l.comparison,
             coalesce(
               (select jsonb_agg(jsonb_build_object(
                         'threshold', substring(s.name from 4)::integer,
                         'state', s.state,
                         'updated_at', s.updated_at))
                  from public.adapter_states s
                 where s.colony_id = c.id and s.name ~ '^Pop(0|[1-9][0-9]{0,5})$'),
               '[]'::jsonb) as steps,
             (select max(s.updated_at) from public.adapter_states s
               where s.colony_id = c.id and s.name ~ '^Pop(0|[1-9][0-9]{0,5})$') as steps_at
        from public.ladders l
       where l.colony_id = c.id and l.metric = 'Pop'
    ) pop on true
    cross join lateral (
      -- The mod's population while it is reporting, or when no counter has reported since.
      select pr.value is not null
             and (md.reporting or pop.steps_at is null or pop.steps_at <= pr.received_at) as mod_pop
    ) pick
   order by act.last_signal_at desc;
$$;

revoke all on function public.colony_ladder() from public;
grant execute on function public.colony_ladder() to anon, authenticated;
