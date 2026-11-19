-- Adapters take over from the companion mod only when they have something newer to say.
--
-- The rule so far was "five minutes after the mod's last heartbeat, adapters take over". That
-- is right while a player's counters are still wired up. It is wrong for a player who replaced
-- their counters with the mod: every time the game closed, the counters' last state from weeks
-- ago came back as the colony's number.
--
-- Now: when the mod isn't reporting, the newer of the two wins. In history, a stretch without
-- the mod shows adapter signals only if any arrived in it; otherwise the mod's last value
-- stands. The two functions below are otherwise the ones from the readings and live colonies
-- migrations.

create or replace function public.tracker_history(
  p_colony uuid,
  p_metric text,
  p_adapters text[],
  p_since timestamptz,
  p_bucket_seconds integer default 0
)
returns table (source text, at timestamptz, value integer, adapter_name text, state boolean, carried boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with first_reading as (
    select (select m.first_at from public.reading_metrics m where m.colony_id = p_colony and m.metric = p_metric) as t
  ),
  -- Stretches when the mod was reporting this metric, cut to the window. The mod takes a metric
  -- over from its first value for it, and keeps it until five minutes after its last heartbeat.
  reporting as (
    select greatest(s.started_at, f.t, p_since) as from_at,
           s.last_seen_at + interval '5 minutes' as to_at
      from public.mod_sessions s
      cross join first_reading f
     where s.colony_id = p_colony
       and s.last_seen_at >= f.t
       and s.last_seen_at + interval '5 minutes' > p_since
  ),
  -- Everything in between. It belongs to the adapters if they sent anything in it.
  gaps as (
    select g.from_at, g.to_at, g.opening
      from (
        select p_since as from_at,
               coalesce((select min(r.from_at) from reporting r), 'infinity'::timestamptz) as to_at,
               true as opening
        union all
        select r.to_at,
               coalesce(lead(r.from_at) over (order by r.from_at), 'infinity'::timestamptz),
               false
          from reporting r
      ) g
     where g.from_at < g.to_at and g.from_at <= now()
  ),
  -- What was known when the window opened, if it opened outside a stretch of the mod's: the
  -- latest adapter signal and the latest reading before it. The newer one sets the scene.
  before_window as (
    select (select max(e.received_at) from public.adapter_events e
             where e.colony_id = p_colony and e.adapter_name = any (p_adapters) and e.received_at < p_since) as adapter_at,
           (select max(r.received_at) from public.readings r
             where r.colony_id = p_colony and r.metric = p_metric and r.received_at < p_since) as reading_at
  ),
  rows as (
    -- The mod's value when it started reporting.
    (
      select 'mod'::text as source, s.from_at as at, c.value, null::text as adapter_name, null::boolean as state, true as carried
        from reporting s
        cross join lateral (
          select r.value
            from public.readings r
           where r.colony_id = p_colony and r.metric = p_metric and r.received_at < s.from_at
           order by r.received_at desc, r.id desc
           limit 1
        ) c
    )
    union all
    -- The mod's last value, when the window opens after the mod stopped and no adapter has
    -- reported since.
    (
      select 'mod', g.from_at, c.value, null, null, true
        from gaps g
        cross join before_window b
        cross join lateral (
          select r.value
            from public.readings r
           where r.colony_id = p_colony and r.metric = p_metric and r.received_at < p_since
           order by r.received_at desc, r.id desc
           limit 1
        ) c
       where g.opening and b.reading_at is not null and (b.adapter_at is null or b.adapter_at <= b.reading_at)
    )
    union all
    -- The mod's values. Readings only arrive while the mod is reporting.
    (
      select distinct on (b.slot)
             'mod', r.received_at, r.value, null, null, false
        from public.readings r
        cross join lateral (
          select case
                   when p_bucket_seconds > 0 then floor(extract(epoch from r.received_at) / p_bucket_seconds)::bigint
                   else r.id
                 end as slot
        ) b
       where r.colony_id = p_colony and r.metric = p_metric and r.received_at >= p_since
       order by b.slot, r.received_at desc, r.id desc
    )
    union all
    -- Each adapter's state when the adapters' turn began: at the window's opening if an adapter
    -- was the last to report before it, and at any later stretch in which adapters reported.
    (
      select 'adapter', g.from_at, null, c.adapter_name, c.state, true
        from gaps g
        cross join before_window b
        cross join lateral (
          select distinct on (e.adapter_name) e.adapter_name, e.state
            from public.adapter_events e
           where e.colony_id = p_colony
             and e.adapter_name = any (p_adapters)
             and e.received_at < g.from_at
           order by e.adapter_name, e.received_at desc, e.id desc
        ) c
       where case
               when g.opening then b.reading_at is null or b.adapter_at > b.reading_at
               else exists (
                 select 1 from public.adapter_events e
                  where e.colony_id = p_colony
                    and e.adapter_name = any (p_adapters)
                    and e.received_at >= g.from_at and e.received_at < g.to_at)
             end
    )
    union all
    -- Adapter signals during the adapters' turns.
    (
      select distinct on (e.adapter_name, b.slot)
             'adapter', e.received_at, null, e.adapter_name, e.state, false
        from public.adapter_events e
        join gaps g on e.received_at >= g.from_at and e.received_at < g.to_at
        cross join lateral (
          select case
                   when p_bucket_seconds > 0 then floor(extract(epoch from e.received_at) / p_bucket_seconds)::bigint
                   else e.id
                 end as slot
        ) b
       where e.colony_id = p_colony
         and e.adapter_name = any (p_adapters)
         and e.received_at >= p_since
       order by e.adapter_name, b.slot, e.received_at desc, e.id desc
    )
  )
  select h.source, h.at, h.value, h.adapter_name, h.state, h.carried
    from rows h
   order by h.at, h.carried desc, h.source, h.adapter_name;
$$;

-- The list of live colonies. Same columns as before.
create or replace function public.colony_ladder()
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
  cycle_started_at timestamptz,
  weather text,
  pop_comparison text,
  pop_steps jsonb,
  -- The mod's exact population (the game's total: beavers and bots). Set while the mod is
  -- reporting, or when no population counter has reported since; then it is the number to show
  -- and pop_steps is empty.
  pop_reading integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select md5('ladder:' || c.id::text),
         p.handle,
         p.avatar_path,
         p.updated_at,
         c.name,
         c.faction,
         act.last_signal_at,
         gd.cycle,
         gd.day,
         cyc.last_cycle_at,
         case w.adapter
           when 'WeatherTemperate' then 'temperate'
           when 'WeatherDrought' then 'drought'
           when 'WeatherBadtide' then 'badtide'
         end,
         pop.comparison,
         case when pick.mod_pop then null else pop.steps end,
         case when pick.mod_pop then pr.value end
    from public.profiles p
    join public.colonies c on c.owner_id = p.user_id
    join lateral (
      select greatest(
               (select max(s.updated_at) from public.adapter_states s where s.colony_id = c.id),
               (select max(m.last_seen_at) from public.mod_sessions m where m.colony_id = c.id)
             ) as last_signal_at
    ) act on act.last_signal_at > now() - interval '1 hour'
    cross join lateral (
      select exists (select 1 from public.mod_sessions m
                      where m.colony_id = c.id and m.last_seen_at > now() - interval '5 minutes') as reporting,
             exists (select 1 from public.weather_trackers t where t.colony_id = c.id) as stations
    ) md
    left join public.reading_metrics wr on wr.colony_id = c.id and wr.metric = 'Weather'
    left join public.reading_metrics pr on pr.colony_id = c.id and pr.metric = 'Pop'
    left join lateral public.game_date(c.id) gd on true
    left join lateral (
      -- A cycle starts when temperate weather starts, whichever source saw it.
      select max(e.received_at) as last_cycle_at
        from public.colony_signals e
       where e.colony_id = c.id and e.adapter_name = 'WeatherTemperate' and e.state
         and (md.stations or wr.value is not null)
    ) cyc on true
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
             end as adapter
    ) w on true
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
   where p.is_public and p.handle is not null
   order by 10 desc nulls last, act.last_signal_at desc
   limit 200;
$$;
