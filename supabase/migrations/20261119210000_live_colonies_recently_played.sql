-- The live colonies page stops being a ranking and stops being empty.
--
-- colony_ladder() now returns colonies of public profiles heard from in the last 7 days, not
-- the last hour: every one heard from in the last hour (the live ones), and the 20 most recently
-- played of the rest. The page tells the two groups apart by last_signal_at.
--
-- The order is simply most recently heard from. cycle_started_at, which the old order was built
-- on, is gone. weather_days is new: how many game days the current weather has lasted.
--
-- The return type changes, so the function is dropped and made again.
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
  pop_reading integer
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
         case when pick.mod_pop then pr.value end
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
