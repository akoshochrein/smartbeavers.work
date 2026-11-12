-- Profile pictures, and profiles that have a picture but no handle yet.

alter table public.profiles alter column handle drop not null;

-- Where the picture is in the "avatars" bucket: always <user id>/avatar.webp. Null = no picture.
alter table public.profiles
  add column avatar_path text check (avatar_path = user_id::text || '/avatar.webp');

-- updated_at is kept by the database, so the app can use it to tell a new picture from a cached one.
create function public.touch_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_profile();

revoke insert, update on public.profiles from authenticated;
grant insert (handle, avatar_path), update (handle, avatar_path) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Storage. The bucket is private: a picture is only ever served to the player it belongs to,
-- so the site can't be used to host images for the public. The app shrinks pictures to a small
-- WebP before uploading; the limits below hold even if someone bypasses the app.
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 262144, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A player may only touch the one file <their user id>/avatar.webp.
create policy "Players can read their own picture"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.webp');

create policy "Players can upload their own picture"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.webp');

create policy "Players can replace their own picture"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.webp')
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.webp');

create policy "Players can remove their own picture"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.webp');
