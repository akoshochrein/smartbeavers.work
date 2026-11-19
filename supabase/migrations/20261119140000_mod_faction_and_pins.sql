-- Two additions for the companion mod.
--
-- 1. The mod knows which faction a save is, so it sets the colony's faction. It never sets the
--    name: that is the player's choice and can show in public.
-- 2. The mod reports how full storage is for every good. That is too many cards to show
--    unasked, so the player pins the ones they want on the colony page.

-- record_readings gains the faction. The body is otherwise the one from the readings migration.
drop function public.record_readings(text, jsonb);

create function public.record_readings(p_token text, p_readings jsonb, p_faction text default null)
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

revoke execute on function public.record_readings(text, jsonb, text) from public, anon, authenticated;
grant  execute on function public.record_readings(text, jsonb, text) to service_role;

-- Metrics a player chose to show on a colony's page.
create table public.pinned_metrics (
  colony_id  uuid not null references public.colonies (id) on delete cascade,
  metric     text not null check (metric ~ '^[A-Za-z]{1,20}$'),
  created_at timestamptz not null default now(),
  primary key (colony_id, metric)
);

alter table public.pinned_metrics enable row level security;

-- Players pin and unpin; a pin is never edited. Only the colony and the metric can be written.
revoke all on public.pinned_metrics from anon, authenticated;
grant select, delete on public.pinned_metrics to authenticated;
grant insert (colony_id, metric) on public.pinned_metrics to authenticated;

create policy "Owners can read their pins"
  on public.pinned_metrics for select to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners can pin"
  on public.pinned_metrics for insert to authenticated
  with check (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners can unpin"
  on public.pinned_metrics for delete to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));
