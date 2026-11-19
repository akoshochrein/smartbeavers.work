-- Readings from the companion mod.
--
-- Until now a colony's numbers came only from HTTP Adapters: on/off signals that the site turns
-- back into a number. The companion mod reads the numbers in the game and sends them as they
-- are. A reading is one value the mod reported for one colony at one time.
--
-- The two sources are kept apart. Adapter tables and the hook are untouched. Where both report
-- the same metric, tracker_history() below decides which one applies at each moment:
--   * the mod wins for as long as it was reporting;
--   * adapter signals fill the stretches when it wasn't, and take over five minutes after the
--     mod's last heartbeat.
-- "Five minutes" appears three times in this file and must stay the same in all of them.

-- When the mod was reporting. A request from the mod within five minutes of the last one
-- extends the latest session; a later one starts a new session.
create table public.mod_sessions (
  id           bigint generated always as identity primary key,
  colony_id    uuid not null references public.colonies (id) on delete cascade,
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index mod_sessions_colony_seen_idx on public.mod_sessions (colony_id, last_seen_at desc);

-- One row each time a value changed. Metrics use the same names as adapter prefixes ("Pop",
-- "Adults", "FreeBeds", a good's name), so a reading and a number tracker meet on the name.
create table public.readings (
  id          bigint generated always as identity primary key,
  colony_id   uuid not null references public.colonies (id) on delete cascade,
  metric      text not null check (metric ~ '^[A-Za-z]{1,20}$'),
  value       integer not null check (value between 0 and 1000000),
  received_at timestamptz not null default now()
);

create index readings_colony_metric_time_idx on public.readings (colony_id, metric, received_at desc);

-- Requests from the mod in the current minute, per colony, for the limit below.
create table public.mod_requests (
  colony_id uuid primary key references public.colonies (id) on delete cascade,
  minute    timestamptz not null,
  count     integer not null
);

alter table public.mod_sessions enable row level security;
alter table public.readings     enable row level security;
alter table public.mod_requests enable row level security;

-- Players read their own colonies' readings and sessions and write nothing: rows are written
-- only by record_readings (service role). Nobody reads mod_requests.
revoke all on public.mod_sessions, public.readings, public.mod_requests from anon, authenticated;
grant select on public.mod_sessions, public.readings to authenticated;

create policy "Owners can read their mod sessions"
  on public.mod_sessions for select to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners can read their readings"
  on public.readings for select to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Taking readings in (called by the Cloudflare Worker with the secret key)
-- ---------------------------------------------------------------------------

-- Stores a value if it differs from the last one stored for that colony and metric.
create function public.store_reading(p_colony uuid, p_metric text, p_value integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last integer;
begin
  select r.value into v_last
    from public.readings r
   where r.colony_id = p_colony and r.metric = p_metric
   order by r.received_at desc, r.id desc
   limit 1;

  if found then
    if v_last = p_value then
      return;
    end if;
  -- A new metric for this colony: at most 100 different ones.
  elsif (select count(distinct r.metric) from public.readings r where r.colony_id = p_colony) >= 100 then
    return;
  end if;

  insert into public.readings (colony_id, metric, value) values (p_colony, p_metric, p_value);
end;
$$;

revoke execute on function public.store_reading(uuid, text, integer) from public, anon, authenticated;

-- One request from the mod: p_readings is {"<metric>": <whole number>, ...} with the values that
-- changed since its last request. An empty object is a heartbeat.
--
-- Returns false for an unknown token and true otherwise. Like the hook, a colony over its limit
-- (30 requests a minute) is answered as accepted and what it sent is dropped.
--
-- "Beavers" (adults + kits) and "Pop" (adults + kits + bots, the game's "Total population") are
-- worked out here from the latest parts, because the mod only sends the parts that changed.
create function public.record_readings(p_token text, p_readings jsonb)
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
     set last_seen_at = now()
   where id = (
     select s.id from public.mod_sessions s
      where s.colony_id = v_colony and s.last_seen_at > now() - interval '5 minutes'
      order by s.last_seen_at desc
      limit 1
   );
  if not found then
    insert into public.mod_sessions (colony_id) values (v_colony);
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

revoke execute on function public.record_readings(text, jsonb) from public, anon, authenticated;
grant  execute on function public.record_readings(text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Reading them back
-- ---------------------------------------------------------------------------

-- The latest reading per colony and metric, and whether the mod is reporting right now. While
-- it is, the reading is the colony's value; once it isn't, adapters (if any) take over.
-- Runs as the caller, so row level security limits it to the caller's own colonies.
create view public.latest_readings
with (security_invoker = true)
as
  select distinct on (r.colony_id, r.metric)
         r.colony_id,
         r.metric,
         r.value,
         r.received_at,
         exists (
           select 1 from public.mod_sessions s
            where s.colony_id = r.colony_id and s.last_seen_at > now() - interval '5 minutes'
         ) as reporting
    from public.readings r
   order by r.colony_id, r.metric, r.received_at desc, r.id desc;

revoke all on public.latest_readings from anon, authenticated;
grant select on public.latest_readings to authenticated;

-- History for one number tracker from both sources, already merged: for each moment it returns
-- rows from the source that applies and nothing from the other.
--
--   source = 'mod'      value is the number the mod reported.
--   source = 'adapter'  adapter_name and state are one signal, for the site to turn into a
--                       number as before.
--   carried = true      the row is not something that arrived at that moment: it is what was
--                       already in place when a stretch began (the window opening, the mod
--                       starting to report, or adapters taking over).
--
-- Like adapter_history, at most one row per adapter (or per metric, for the mod) is returned per
-- p_bucket_seconds slot; pass 0 for every row.
-- Runs as the caller, so row level security limits it to the caller's own colonies.
create function public.tracker_history(
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
    select min(r.received_at) as t
      from public.readings r
     where r.colony_id = p_colony and r.metric = p_metric
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
  -- Everything in between, which belongs to the adapters.
  gaps as (
    select g.from_at, g.to_at
      from (
        select p_since as from_at,
               coalesce((select min(r.from_at) from reporting r), 'infinity'::timestamptz) as to_at
        union all
        select r.to_at,
               coalesce(lead(r.from_at) over (order by r.from_at), 'infinity'::timestamptz)
          from reporting r
      ) g
     where g.from_at < g.to_at and g.from_at <= now()
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
    -- Each adapter's state when the adapters' turn began.
    (
      select 'adapter', g.from_at, null, c.adapter_name, c.state, true
        from gaps g
        cross join lateral (
          select distinct on (e.adapter_name) e.adapter_name, e.state
            from public.adapter_events e
           where e.colony_id = p_colony
             and e.adapter_name = any (p_adapters)
             and e.received_at < g.from_at
           order by e.adapter_name, e.received_at desc, e.id desc
        ) c
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

revoke execute on function public.tracker_history(uuid, text, text[], timestamptz, integer) from public, anon;
grant  execute on function public.tracker_history(uuid, text, text[], timestamptz, integer) to authenticated;

-- New readings reach an open colony page as they arrive (Realtime respects the policies above).
alter publication supabase_realtime add table public.readings;
