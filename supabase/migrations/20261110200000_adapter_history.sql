-- History for one tracker, shaped for charts instead of shipping every raw signal.
--
-- Returns, for the given adapters:
--   1. each adapter's state when the window opens (carried = true, received_at = p_since), so a
--      chart starts from a known value instead of "unknown";
--   2. inside the window, the last signal per adapter per p_bucket_seconds slot. A chart a few
--      hundred pixels wide can't show finer detail. Pass 0 to get every signal (for rare ones
--      such as weather).
-- Runs as the caller, so row level security limits it to the caller's own colonies.

create index if not exists adapter_events_colony_adapter_time_idx
  on public.adapter_events (colony_id, adapter_name, received_at desc);

create function public.adapter_history(
  p_colony uuid,
  p_adapters text[],
  p_since timestamptz,
  p_bucket_seconds integer default 0
)
returns table (adapter_name text, state boolean, received_at timestamptz, carried boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from (
    (
      select distinct on (e.adapter_name)
             e.adapter_name, e.state, p_since as received_at, true as carried
        from public.adapter_events e
       where e.colony_id = p_colony
         and e.adapter_name = any (p_adapters)
         and e.received_at < p_since
       order by e.adapter_name, e.received_at desc, e.id desc
    )
    union all
    (
      select distinct on (e.adapter_name, slot)
             e.adapter_name, e.state, e.received_at, false as carried
        from public.adapter_events e
        cross join lateral (
          select case
                   when p_bucket_seconds > 0 then floor(extract(epoch from e.received_at) / p_bucket_seconds)::bigint
                   else e.id
                 end as slot
        ) s
       where e.colony_id = p_colony
         and e.adapter_name = any (p_adapters)
         and e.received_at >= p_since
       order by e.adapter_name, slot, e.received_at desc, e.id desc
    )
  ) h
  order by h.received_at, h.carried desc;
$$;

grant execute on function public.adapter_history(uuid, text[], timestamptz, integer) to authenticated;
