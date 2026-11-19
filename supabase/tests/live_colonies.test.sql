-- Who the live colonies list shows: colonies of public profiles heard from in the last 7 days,
-- every live one (last hour) and the 20 most recently played of the rest.
--
-- Run with `pnpm test:db` against the local database. Everything happens inside one
-- transaction that is rolled back, so local data is untouched. The list also holds whatever
-- colonies the local database has, so counts look only at this file's players.
begin;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'open@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'closed@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'more1@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'more2@test.local');
insert into public.profiles (user_id, handle, is_public) values
  ('00000000-0000-0000-0000-0000000000a1', 'open', true),
  ('00000000-0000-0000-0000-0000000000a2', 'closed', false),
  -- A player can have at most 25 colonies, so the many-colonies cases are spread over two more.
  ('00000000-0000-0000-0000-0000000000a3', 'more1', true),
  ('00000000-0000-0000-0000-0000000000a4', 'more2', true);

-- A colony last heard from `p_ago` ago, through one adapter.
create function pg_temp.colony(p_owner uuid, p_name text, p_ago interval) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into public.colonies (id, owner_id, name, webhook_token) values (v_id, p_owner, p_name, md5(p_name) || md5(p_name || 'x'));
  insert into public.adapter_states (colony_id, name, state, updated_at) values (v_id, 'Lever', true, now() - p_ago);
  return v_id;
end $$;

select pg_temp.colony('00000000-0000-0000-0000-0000000000a1', 'Live', interval '5 minutes');
select pg_temp.colony('00000000-0000-0000-0000-0000000000a1', 'Two hours', interval '2 hours');
select pg_temp.colony('00000000-0000-0000-0000-0000000000a1', 'Six days', interval '6 days');
select pg_temp.colony('00000000-0000-0000-0000-0000000000a1', 'Eight days', interval '8 days');
select pg_temp.colony('00000000-0000-0000-0000-0000000000a2', 'Private', interval '5 minutes');

select results_eq(
  $$ select colony_name from public.colony_ladder() where handle = 'open' $$,
  $$ values ('Live'), ('Two hours'), ('Six days') $$,
  'listed: heard from in the last 7 days, most recently heard from first');
select is((select count(*)::integer from public.colony_ladder() where colony_name = 'Eight days'), 0,
  'not listed: last heard from more than 7 days ago');
select is((select count(*)::integer from public.colony_ladder() where handle = 'closed'), 0,
  'not listed: a colony of a private profile, however recently played');

-- 25 more colonies played between 3 and 4 hours ago, and 3 more live ones.
select pg_temp.colony(case when n <= 13 then '00000000-0000-0000-0000-0000000000a3' else '00000000-0000-0000-0000-0000000000a4' end::uuid, 'Recent ' || n, interval '3 hours' + n * interval '1 minute') from generate_series(1, 25) n;
select pg_temp.colony('00000000-0000-0000-0000-0000000000a1', 'Live ' || n, n * interval '1 minute') from generate_series(1, 3) n;

select is((select count(*)::integer from public.colony_ladder() where handle in ('open', 'more1', 'more2') and last_signal_at <= now() - interval '1 hour'), 20,
  'recently played: capped at 20');
select is((select count(*)::integer from public.colony_ladder() where colony_name = 'Six days'), 0,
  'recently played: the cap keeps the most recently played and drops the oldest');
select is((select count(*)::integer from public.colony_ladder() where handle in ('open', 'more1', 'more2') and last_signal_at > now() - interval '1 hour'), 4,
  'live: every live colony is listed, whatever the cap on the rest');

-- How long the current weather has lasted, in game days: the weather started 30 minutes ago
-- with the clock already running, and three days have begun since.
do $$
declare v_id uuid := pg_temp.colony('00000000-0000-0000-0000-0000000000a1', 'Clocked', interval '1 minute');
begin
  insert into public.weather_trackers (colony_id) values (v_id);
  insert into public.game_clocks (colony_id, anchor_at, anchor_cycle, anchor_day) values (v_id, now() - interval '2 hours', 3, 1);
  insert into public.adapter_events (colony_id, adapter_name, state, received_at) values
    (v_id, 'GameDay', true, now() - interval '50 minutes'),
    (v_id, 'WeatherDrought', true, now() - interval '30 minutes'),
    (v_id, 'GameDay', true, now() - interval '25 minutes'),
    (v_id, 'GameDay', true, now() - interval '15 minutes'),
    (v_id, 'GameDay', true, now() - interval '5 minutes');
  insert into public.adapter_states (colony_id, name, state, updated_at) values (v_id, 'WeatherDrought', true, now() - interval '30 minutes');
end $$;
select is((select weather || ' ' || weather_days from public.colony_ladder() where colony_name = 'Clocked'), 'drought 3',
  'weather_days: game days begun since the current weather started');

select * from finish();
rollback;
