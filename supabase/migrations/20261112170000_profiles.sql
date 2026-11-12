-- A player's handle: the name they go by on the site instead of their email address.
-- Optional. One row per account, created the first time a handle is set.

create table public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- 3 to 20 letters, digits, underscores or hyphens, starting with a letter or digit.
  handle     text not null check (
    handle ~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$'
    and lower(handle) not in ('admin', 'administrator', 'moderator', 'support', 'staff', 'smartbeavers', 'mechanistry', 'timberborn')
  ),
  updated_at timestamptz not null default now()
);

-- Handles are unique whatever the capitals: "Beaver" and "beaver" are the same handle.
create unique index profiles_handle_lower_idx on public.profiles (lower(handle));

alter table public.profiles enable row level security;

-- Players only ever see and change their own profile. Whether a handle is taken shows up as
-- a unique violation when saving, so nobody needs to read other players' rows.
create policy "Players can read their profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players can create their profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Players can update their profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Players can remove their profile"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.profiles from anon;
revoke insert, update on public.profiles from authenticated;
grant insert (handle), update (handle, updated_at) on public.profiles to authenticated;
