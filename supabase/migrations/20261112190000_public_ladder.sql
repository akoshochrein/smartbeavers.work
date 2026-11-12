-- Public profiles and the colony ladder.
--
-- A player can make their profile public. Their colonies then appear on the public ladder page
-- while they are being played (a signal within the last hour). Off by default.

alter table public.profiles
  add column is_public boolean not null default false,
  -- A public profile is shown under its handle, so it needs one.
  add constraint profiles_public_needs_handle check (not is_public or handle is not null);

revoke insert, update on public.profiles from authenticated;
grant insert (handle, avatar_path, is_public), update (handle, avatar_path, is_public) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------------------------
-- What the ladder page shows. This is the ONLY way anyone but the owner sees colony data, so
-- it returns exactly the public fields and nothing else: no ids, no adapter links, no email.
--
-- Runs with the owner's rights (it has to read across players), which is why every column is
-- listed by hand and why only public profiles and recently active colonies get through.
-- ---------------------------------------------------------------------------------------------

create function public.colony_ladder()
returns table (
  -- Opaque and stable per colony, so the page can follow a row as the order changes.
  key text,
  handle text,
  colony_name text,
  faction text,
  last_signal_at timestamptz,
  -- Game date, if the colony has a game clock.
  cycle integer,
  day integer,
  -- When the colony's current cycle started: the last time temperate weather began.
  cycle_started_at timestamptz,
  -- 'temperate' | 'drought' | 'badtide', if the colony tracks weather and a station has reported.
  weather text,
  -- Population counters (threshold, on/off, when), if the colony tracks population. The page
  -- turns these into a number the same way the dashboard does.
  pop_comparison text,
  pop_steps jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select md5('ladder:' || c.id::text),
         p.handle,
         c.name,
         c.faction,
         act.last_signal_at,
         gd.cycle,
         gd.day,
         cyc.last_cycle_at,
         w.weather,
         pop.comparison,
         pop.steps
    from public.profiles p
    join public.colonies c on c.owner_id = p.user_id
    join lateral (
      select max(s.updated_at) as last_signal_at
        from public.adapter_states s
       where s.colony_id = c.id
    ) act on act.last_signal_at > now() - interval '1 hour'
    left join lateral public.game_date(c.id) gd on true
    left join lateral (
      -- A cycle starts when temperate weather starts.
      select max(e.received_at) as last_cycle_at
        from public.adapter_events e
       where e.colony_id = c.id and e.adapter_name = 'WeatherTemperate' and e.state
         and exists (select 1 from public.weather_trackers t where t.colony_id = c.id)
    ) cyc on true
    left join lateral (
      -- The station that switched on most recently is the current weather.
      select case s.name
               when 'WeatherTemperate' then 'temperate'
               when 'WeatherDrought' then 'drought'
               when 'WeatherBadtide' then 'badtide'
             end as weather
        from public.adapter_states s
       where s.colony_id = c.id
         and s.name in ('WeatherTemperate', 'WeatherDrought', 'WeatherBadtide')
         and exists (select 1 from public.weather_trackers t where t.colony_id = c.id)
       order by s.state desc, s.updated_at desc
       limit 1
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
               '[]'::jsonb) as steps
        from public.ladders l
       where l.colony_id = c.id and l.metric = 'Pop'
    ) pop on true
   where p.is_public and p.handle is not null
   -- The colony that most recently started a new cycle first; colonies that don't track weather
   -- follow, most recently active first.
   order by 8 desc nulls last, act.last_signal_at desc
   limit 200;
$$;

revoke execute on function public.colony_ladder() from public;
grant  execute on function public.colony_ladder() to anon, authenticated;
