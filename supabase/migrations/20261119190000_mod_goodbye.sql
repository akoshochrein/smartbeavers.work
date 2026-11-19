-- The mod says goodbye.
--
-- Until now the site only learned that a game had stopped by not hearing from the mod for five
-- minutes, so a colony still showed as "reporting" for five minutes after its player left the
-- save. The mod now sends a last message when a save is unloaded, and the session ends there.
-- A game that crashes or loses its connection still falls back on the five minutes.
--
-- A session's end is ended_at if the mod said goodbye, otherwise five minutes after it was last
-- heard from. Everything that asked "was the mod reporting then?" now asks session_end().
-- The views and functions below are otherwise unchanged from the earlier migrations.

alter table public.mod_sessions add column ended_at timestamptz;

create function public.session_end(s public.mod_sessions)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select coalesce(s.ended_at, s.last_seen_at + interval '5 minutes');
$$;

revoke execute on function public.session_end(public.mod_sessions) from public, anon;
grant  execute on function public.session_end(public.mod_sessions) to authenticated;

-- Ends the colony's current session, if it has one. Called by the Worker when the mod says
-- goodbye. Returns false for an unknown token.
create function public.end_mod_session(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_colony uuid;
begin
  select id into v_colony from public.colonies where webhook_token = p_token;
  if v_colony is null then
    return false;
  end if;

  update public.mod_sessions s
     set ended_at = now()
   where s.colony_id = v_colony
     and s.ended_at is null
     and s.last_seen_at > now() - interval '5 minutes';

  return true;
end;
$$;

revoke execute on function public.end_mod_session(text) from public, anon, authenticated;
grant  execute on function public.end_mod_session(text) to service_role;

-- A request after a goodbye (the player loaded the save again within five minutes) carries the
-- same session on, so it is no longer ended.
create or replace function public.record_readings(p_token text, p_readings jsonb, p_faction text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_colony   uuid;
  v_count    integer;
  v_metric   text;
  v_raw      jsonb;
  v_adults   integer;
  v_children integer;
  v_bots     integer;
begin
  select id into v_colony from public.colonies where webhook_token = p_token;
  if v_colony is null then
    return false;
  end if;

  insert into public.mod_requests as q (colony_id, minute, count)
  values (v_colony, date_trunc('minute', now()), 1)
  on conflict (colony_id) do update
     set count  = case when q.minute = excluded.minute then q.count + 1 else 1 end,
         minute = excluded.minute
  returning q.count into v_count;
  if v_count > 30 then
    return true;
  end if;

  update public.mod_sessions
     set last_seen_at = now(), ended_at = null
   where id = (
     select s.id from public.mod_sessions s
      where s.colony_id = v_colony and s.last_seen_at > now() - interval '5 minutes'
      order by s.last_seen_at desc
      limit 1
   );
  if not found then
    insert into public.mod_sessions (colony_id) values (v_colony);
  end if;

  if p_faction in ('folktails', 'iron_teeth') then
    update public.colonies set faction = p_faction where id = v_colony and faction is distinct from p_faction;
  end if;

  if jsonb_typeof(p_readings) = 'object' then
    for v_metric, v_raw in select e.key, e.value from jsonb_each(p_readings) e limit 100 loop
      continue when v_metric !~ '^[A-Za-z]{1,20}$' or v_metric in ('Beavers', 'Pop');
      continue when jsonb_typeof(v_raw) <> 'number' or v_raw::text !~ '^[0-9]{1,7}$';
      continue when v_raw::text::integer > 1000000;
      perform public.store_reading(v_colony, v_metric, v_raw::text::integer);
    end loop;
  end if;

  select
    (select r.value from public.readings r where r.colony_id = v_colony and r.metric = 'Adults'   order by r.received_at desc, r.id desc limit 1),
    (select r.value from public.readings r where r.colony_id = v_colony and r.metric = 'Children' order by r.received_at desc, r.id desc limit 1),
    (select r.value from public.readings r where r.colony_id = v_colony and r.metric = 'Bots'     order by r.received_at desc, r.id desc limit 1)
    into v_adults, v_children, v_bots;
  if v_adults is not null and v_children is not null then
    perform public.store_reading(v_colony, 'Beavers', v_adults + v_children);
    if v_bots is not null then
      perform public.store_reading(v_colony, 'Pop', v_adults + v_children + v_bots);
    end if;
  end if;

  return true;
end;
$$;

create or replace view public.latest_readings
with (security_invoker = true)
as
  select m.colony_id,
         m.metric,
         m.value,
         m.received_at,
         exists (
           select 1 from public.mod_sessions s
            where s.colony_id = m.colony_id and public.session_end(s) > now()
         ) as reporting
    from public.reading_metrics m;

create or replace function public.mod_reporting_at(p_colony uuid, p_metric text, p_at timestamptz)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
      from public.reading_metrics m
      join public.mod_sessions s on s.colony_id = m.colony_id
     where m.colony_id = p_colony
       and m.metric = p_metric
       and p_at >= m.first_at
       and s.last_seen_at >= m.first_at
       and s.started_at <= p_at
       and public.session_end(s) > p_at
  );
$$;

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
           public.session_end(s) as to_at
      from public.mod_sessions s
      cross join first_reading f
     where s.colony_id = p_colony
       and s.last_seen_at >= f.t
       and public.session_end(s) > p_since
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
                      where m.colony_id = c.id and public.session_end(m) > now()) as reporting,
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

-- An open colony page hears about a session starting, continuing or ending as it happens.
alter publication supabase_realtime add table public.mod_sessions;
