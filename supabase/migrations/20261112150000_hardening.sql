-- Hardening before the source went public. Nothing here changes what a normal player can do.

-- ---------------------------------------------------------------------------------------------
-- 1. Players may only set the columns the app lets them edit.
--
-- Row level security decides WHICH rows a player can touch; these column grants decide WHICH
-- columns. Before this, a player could write any column of their own colony through the API,
-- including webhook_token (choosing a weak or known one), id and created_at.
-- ---------------------------------------------------------------------------------------------

revoke insert, update on public.colonies from authenticated, anon;
grant insert (name, faction, api_base_url) on public.colonies to authenticated;
grant update (name, faction, api_base_url) on public.colonies to authenticated;

-- New links are made by this function, so it now runs with the owner's rights and checks
-- ownership itself (it can no longer rely on the caller being allowed to update the column).
create or replace function public.rotate_webhook_token(p_colony uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  update public.colonies
     set webhook_token = encode(extensions.gen_random_bytes(24), 'hex')
   where id = p_colony
     and owner_id = (select auth.uid())
  returning webhook_token;
$$;

revoke execute on function public.rotate_webhook_token(uuid) from public, anon;
grant  execute on function public.rotate_webhook_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Limits, so one account or one leaked link can't fill the database.
-- ---------------------------------------------------------------------------------------------

-- At most 25 colonies per player.
create function public.enforce_colony_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.colonies where owner_id = new.owner_id) >= 25 then
    raise exception 'You can have at most 25 colonies.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_colony_limit() from public, anon, authenticated;

create trigger colonies_limit
  before insert on public.colonies
  for each row execute function public.enforce_colony_limit();

-- Webhook ingestion, now with two caps per colony:
--   * at most 600 signals a minute (a busy colony sends a handful), and
--   * at most 500 different adapter names.
-- Signals over a cap are dropped and still answered as accepted, so a flood learns nothing.
create or replace function public.record_adapter_event(p_token text, p_adapter text, p_state boolean)
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

  if (select count(*) from public.adapter_events
       where colony_id = v_colony and received_at > now() - interval '1 minute') >= 600 then
    return true;
  end if;

  if not exists (select 1 from public.adapter_states where colony_id = v_colony and name = p_adapter)
     and (select count(*) from public.adapter_states where colony_id = v_colony) >= 500 then
    return true;
  end if;

  insert into public.adapter_events (colony_id, adapter_name, state)
  values (v_colony, p_adapter, p_state);

  insert into public.adapter_states (colony_id, name, state, updated_at)
  values (v_colony, p_adapter, p_state, now())
  on conflict (colony_id, name)
  do update set state = excluded.state, updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke execute on function public.record_adapter_event(text, text, boolean) from public, anon, authenticated;
grant  execute on function public.record_adapter_event(text, text, boolean) to service_role;
