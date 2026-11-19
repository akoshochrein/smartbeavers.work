-- The public list of live colonies shows what the colony page shows: the companion mod's values
-- while the mod is reporting, adapters otherwise.
--
-- Same rules as before for who is listed: only public profiles with a handle, only colonies
-- heard from in the last hour, only the columns below. "Heard from" now also means a request
-- from the mod, so a colony the mod reports for is listed while its game runs even if no number
-- changes. One column is new: pop_reading, the mod's exact population.

drop function public.colony_ladder();

create function public.colony_ladder()
returns table (
  -- Opaque and stable per colony, so the page can follow a row as the order changes.
  key text,
  handle text,
  -- The player's picture in the "avatars" bucket, if they have one, and when their profile last
  -- changed (so the page can tell a new picture from one it already has).
  avatar_path text,
  profile_updated_at timestamptz,
  colony_name text,
  faction text,
  -- The colony's latest adapter signal or request from the mod.
  last_signal_at timestamptz,
  -- Game date, if the colony has a game clock or the mod reports the date.
  cycle integer,
  day integer,
  -- When the colony's current cycle started: the last time temperate weather began.
  cycle_started_at timestamptz,
  -- 'temperate' | 'drought' | 'badtide', if the colony's weather is known.
  weather text,
  -- Population counters (threshold, on/off, when), if the colony tracks population with them.
  -- The page turns these into a number the same way the dashboard does.
  pop_comparison text,
  pop_steps jsonb,
  -- The mod's exact population (the game's total: beavers and bots). Set while the mod is
  -- reporting, or when there are no counters to fall back on; then it is the number to show.
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
         case when md.reporting then null else pop.steps end,
         case when md.reporting or pop.comparison is null then pr.value end
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
             exists (select 1 from public.weather_trackers t where t.colony_id = c.id) as stations,
             (select r.value from public.readings r
               where r.colony_id = c.id and r.metric = 'Weather'
               order by r.received_at desc, r.id desc limit 1) as weather_reading
    ) md
    left join lateral public.game_date(c.id) gd on true
    left join lateral (
      -- A cycle starts when temperate weather starts, whichever source saw it.
      select max(e.received_at) as last_cycle_at
        from public.colony_signals e
       where e.colony_id = c.id and e.adapter_name = 'WeatherTemperate' and e.state
         and (md.stations or md.weather_reading is not null)
    ) cyc on true
    left join lateral (
      select case
               -- The mod's weather while it is reporting, or when there are no stations.
               when md.weather_reading is not null and (md.reporting or not md.stations)
                 then public.weather_adapter(md.weather_reading)
               -- Otherwise the station that switched on most recently.
               when md.stations then (
                 select s.name
                   from public.adapter_states s
                  where s.colony_id = c.id
                    and s.name in ('WeatherTemperate', 'WeatherDrought', 'WeatherBadtide')
                  order by s.state desc, s.updated_at desc
                  limit 1)
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
               '[]'::jsonb) as steps
        from public.ladders l
       where l.colony_id = c.id and l.metric = 'Pop'
    ) pop on true
    left join lateral (
      select r.value
        from public.readings r
       where r.colony_id = c.id and r.metric = 'Pop'
       order by r.received_at desc, r.id desc
       limit 1
    ) pr on true
   where p.is_public and p.handle is not null
   -- The colony that most recently started a new cycle first; colonies whose weather isn't
   -- known follow, most recently active first.
   order by 10 desc nulls last, act.last_signal_at desc
   limit 200;
$$;

revoke execute on function public.colony_ladder() from public;
grant  execute on function public.colony_ladder() to anon, authenticated;
