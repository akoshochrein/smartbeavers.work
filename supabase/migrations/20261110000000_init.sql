-- smartbeavers.work initial schema
--
-- A "colony" is one Timberborn save/settlement a player connects to the site.
-- Each colony gets an unguessable webhook token; the game's HTTP Adapters call
--   https://smartbeavers.work/hook/<token>/on/{name}
--   https://smartbeavers.work/hook/<token>/off/{name}
-- and the Worker records those calls through public.record_adapter_event().

create table public.colonies (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  -- Where the player's browser can reach the game's local HTTP API.
  api_base_url  text not null default 'http://localhost:8080',
  webhook_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at    timestamptz not null default now()
);

create index colonies_owner_id_idx on public.colonies (owner_id);

-- Latest known state per adapter, kept current by webhooks.
create table public.adapter_states (
  colony_id  uuid not null references public.colonies (id) on delete cascade,
  name       text not null,
  state      boolean not null,
  updated_at timestamptz not null default now(),
  primary key (colony_id, name)
);

-- Append-only history of webhook calls.
create table public.adapter_events (
  id           bigint generated always as identity primary key,
  colony_id    uuid not null references public.colonies (id) on delete cascade,
  adapter_name text not null,
  state        boolean not null,
  received_at  timestamptz not null default now()
);

create index adapter_events_colony_received_idx
  on public.adapter_events (colony_id, received_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.colonies       enable row level security;
alter table public.adapter_states enable row level security;
alter table public.adapter_events enable row level security;

create policy "Owners can read their colonies"
  on public.colonies for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can create colonies"
  on public.colonies for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their colonies"
  on public.colonies for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their colonies"
  on public.colonies for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can read adapter states"
  on public.adapter_states for select to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners can read adapter events"
  on public.adapter_events for select to authenticated
  using (exists (
    select 1 from public.colonies c
    where c.id = colony_id and c.owner_id = (select auth.uid())
  ));

-- Adapter rows are written only by record_adapter_event (service role), so
-- there are deliberately no insert/update policies on them.

-- ---------------------------------------------------------------------------
-- Webhook ingestion (called by the Cloudflare Worker with the secret key)
-- ---------------------------------------------------------------------------

create function public.record_adapter_event(p_token text, p_adapter text, p_state boolean)
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

-- Owners can invalidate a leaked webhook URL.
create function public.rotate_webhook_token(p_colony uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  update public.colonies
     set webhook_token = encode(extensions.gen_random_bytes(24), 'hex')
   where id = p_colony
  returning webhook_token;
$$;

-- Live dashboard updates (Realtime respects the RLS policies above).
alter publication supabase_realtime add table public.adapter_states, public.adapter_events;
