-- Keeps the companion mod's readings fast to read back as they pile up.
--
-- A colony the mod reports for gathers on the order of a thousand readings per hour of play.
-- Three questions were answered by scanning them all: "what is the latest value of each metric",
-- "when did the mod first report this metric" and "was the mod reporting this metric at this
-- moment". The last one is asked once per weather or day signal, which made the game date time
-- out for a colony with a few months of readings.
--
-- reading_metrics holds the answer to the first two, one row per colony and metric, kept current
-- by a trigger. Nothing about what is stored or shown changes.

create table public.reading_metrics (
  colony_id   uuid not null references public.colonies (id) on delete cascade,
  metric      text not null,
  -- When the mod first reported this metric: from then on its sessions count for it.
  first_at    timestamptz not null,
  -- The latest value and when it arrived.
  value       integer not null,
  received_at timestamptz not null,
  primary key (colony_id, metric)
);

alter table public.reading_metrics enable row level security;

revoke all on public.reading_metrics from anon, authenticated;
grant select on public.reading_metrics to authenticated;

create policy "Owners can read their reading metrics"
  on public.reading_metrics for select to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

insert into public.reading_metrics (colony_id, metric, first_at, value, received_at)
select l.colony_id, l.metric, f.first_at, l.value, l.received_at
  from (
    select distinct on (r.colony_id, r.metric) r.colony_id, r.metric, r.value, r.received_at
      from public.readings r
     order by r.colony_id, r.metric, r.received_at desc, r.id desc
  ) l
  join (
    select r.colony_id, r.metric, min(r.received_at) as first_at
      from public.readings r
     group by r.colony_id, r.metric
  ) f using (colony_id, metric);

create function public.track_reading()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reading_metrics as m (colony_id, metric, first_at, value, received_at)
  values (new.colony_id, new.metric, new.received_at, new.value, new.received_at)
  on conflict (colony_id, metric) do update
     set first_at    = least(m.first_at, excluded.first_at),
         value       = case when excluded.received_at >= m.received_at then excluded.value else m.value end,
         received_at = greatest(m.received_at, excluded.received_at);
  return null;
end;
$$;

revoke execute on function public.track_reading() from public, anon, authenticated;

create trigger readings_track
  after insert on public.readings
  for each row execute function public.track_reading();

-- Same columns and meaning as before, read from the summary.
create or replace view public.latest_readings
with (security_invoker = true)
as
  select m.colony_id,
         m.metric,
         m.value,
         m.received_at,
         exists (
           select 1 from public.mod_sessions s
            where s.colony_id = m.colony_id and s.last_seen_at > now() - interval '5 minutes'
         ) as reporting
    from public.reading_metrics m;

-- Was the mod reporting this metric at this moment? Same rule as before (from its first value
-- for the metric, or the session's start if later, until five minutes after the session's last
-- heartbeat), answered with two index lookups.
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
       and s.last_seen_at > p_at - interval '5 minutes'
  );
$$;

-- The view is the one from the weather and date migration; only the way it finds the mod's
-- first day reading changed.
create or replace view public.colony_signals
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
    join public.reading_metrics m on m.colony_id = r.colony_id and m.metric = 'Day'
   where r.metric = 'Day'
     and r.received_at > m.first_at;

drop view public.mod_stretches;

-- The intake reads the summary too, instead of looking the last value up in the readings.
create or replace function public.store_reading(p_colony uuid, p_metric text, p_value integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last integer;
begin
  select m.value into v_last
    from public.reading_metrics m
   where m.colony_id = p_colony and m.metric = p_metric;

  if found then
    if v_last = p_value then
      return;
    end if;
  -- A new metric for this colony: at most 100 different ones.
  elsif (select count(*) from public.reading_metrics m where m.colony_id = p_colony) >= 100 then
    return;
  end if;

  insert into public.readings (colony_id, metric, value) values (p_colony, p_metric, p_value);
end;
$$;
