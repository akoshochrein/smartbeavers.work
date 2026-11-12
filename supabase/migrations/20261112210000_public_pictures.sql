-- Profile pictures of public profiles are shown on the colony ladder.
--
-- The "avatars" bucket stays private. Instead, one extra rule lets anyone read a picture while
-- its owner's profile is public. A private profile's picture is still only served to its owner,
-- and making a profile private again takes the picture out of public reach at once.

-- Whether a stored picture belongs to a public profile. Runs with the owner's rights because
-- visitors can't read the profiles table themselves; it answers yes or no and nothing more.
create function public.is_public_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.avatar_path = p_name and p.is_public
  );
$$;

revoke execute on function public.is_public_avatar(text) from public;
grant  execute on function public.is_public_avatar(text) to anon, authenticated;

create policy "Anyone can see pictures of public profiles"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars' and public.is_public_avatar(name));

-- The ladder now also says where each player's picture is. Same rules as before: only public
-- profiles, only recently active colonies, only the columns listed here.
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
         p.avatar_path,
         p.updated_at,
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
   order by 10 desc nulls last, act.last_signal_at desc
   limit 200;
$$;

revoke execute on function public.colony_ladder() from public;
grant  execute on function public.colony_ladder() to anon, authenticated;
