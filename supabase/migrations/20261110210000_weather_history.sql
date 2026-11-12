-- Timeline data for weather (or any "the adapter that switched on last is the active one"
-- tracker), summarised per time slot instead of shipping every signal.
--
-- Each "on" signal starts a period that lasts until the next "on" signal (or now). Periods are cut
-- into p_bucket_seconds slots, and each slot reports the adapter that was active for most of it.
-- That's at most one row per slot (~360 for a chart), and unlike sampling the slot's last signal
-- it doesn't skew towards whatever happened to be on when the slot ended.
-- Runs as the caller, so row level security limits it to the caller's own colonies.

create function public.weather_history(
  p_colony uuid,
  p_adapters text[],
  p_since timestamptz,
  p_bucket_seconds integer
)
returns table (adapter_name text, slot_start timestamptz, share real)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select greatest(p_bucket_seconds, 60) as bucket
  ),
  -- the last "on" before the window, so the window starts with a known weather
  first_on as (
    select coalesce(max(e.received_at), p_since) as t
      from public.adapter_events e
     where e.colony_id = p_colony
       and e.adapter_name = any (p_adapters)
       and e.state
       and e.received_at < p_since
  ),
  periods as (
    select e.adapter_name,
           greatest(e.received_at, p_since) as t0,
           coalesce(lead(e.received_at) over (order by e.received_at, e.id), now()) as t1
      from public.adapter_events e, first_on f
     where e.colony_id = p_colony
       and e.adapter_name = any (p_adapters)
       and e.state
       and e.received_at >= f.t
  ),
  pieces as (
    select p.adapter_name,
           s.slot,
           extract(epoch from least(p.t1, to_timestamp((s.slot + 1) * pr.bucket))
                            - greatest(p.t0, to_timestamp(s.slot * pr.bucket))) as secs
      from periods p
     cross join params pr
     cross join lateral generate_series(
       floor(extract(epoch from p.t0) / pr.bucket)::bigint,
       floor(extract(epoch from p.t1) / pr.bucket)::bigint
     ) as s(slot)
     where p.t1 > p.t0
  ),
  per_slot as (
    select adapter_name, slot, sum(secs) as secs
      from pieces
     where secs > 0
     group by adapter_name, slot
  )
  select distinct on (ps.slot)
         ps.adapter_name,
         to_timestamp(ps.slot * pr.bucket) as slot_start,
         (ps.secs / pr.bucket)::real as share
    from per_slot ps
   cross join params pr
   order by ps.slot, ps.secs desc;
$$;

grant execute on function public.weather_history(uuid, text[], timestamptz, integer) to authenticated;
