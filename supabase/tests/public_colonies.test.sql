-- Public colonies: who can read what, and that nothing private comes out.
--
-- Run with `pnpm test:db` against the local database. Everything happens inside one
-- transaction that is rolled back, so local data is untouched.
begin;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'shows@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'hides@test.local');
insert into public.profiles (user_id, handle, is_public) values
  ('00000000-0000-0000-0000-0000000000b1', 'Shows', true),
  ('00000000-0000-0000-0000-0000000000b2', 'hides', false);

insert into public.colonies (id, owner_id, name, webhook_token, is_public, created_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'Hódvár, the 1st!', repeat('1', 48), true, now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', 'Kept private', repeat('2', 48), false, now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', 'hodvar the 1st', repeat('3', 48), true, now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000b2', 'Public colony, private profile', repeat('4', 48), true, now());

-- The first colony: a lever with a telling name, population counters, the mod's goods, a
-- clock that has counted three days, and a drought that started before the last two of them.
insert into public.ladders (colony_id, metric) values ('00000000-0000-0000-0000-0000000000d1', 'Pop');
insert into public.adapter_states (colony_id, name, state, updated_at) values
  ('00000000-0000-0000-0000-0000000000d1', 'SecretVaultDoor', true, now() - interval '50 minutes'),
  ('00000000-0000-0000-0000-0000000000d1', 'Pop30', true, now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-0000000000d1', 'Pop40', false, now() - interval '20 minutes');
insert into public.game_clocks (colony_id, anchor_at, anchor_cycle, anchor_day) values
  ('00000000-0000-0000-0000-0000000000d1', now() - interval '2 hours', 4, 1);
insert into public.weather_trackers (colony_id) values ('00000000-0000-0000-0000-0000000000d1');
insert into public.adapter_events (colony_id, adapter_name, state, received_at) values
  ('00000000-0000-0000-0000-0000000000d1', 'GameDay', true, now() - interval '60 minutes'),
  ('00000000-0000-0000-0000-0000000000d1', 'Pop30', true, now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-0000000000d1', 'WeatherDrought', true, now() - interval '35 minutes'),
  ('00000000-0000-0000-0000-0000000000d1', 'GameDay', true, now() - interval '30 minutes'),
  ('00000000-0000-0000-0000-0000000000d1', 'Pop40', true, now() - interval '25 minutes'),
  ('00000000-0000-0000-0000-0000000000d1', 'Pop40', false, now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-0000000000d1', 'GameDay', true, now() - interval '10 minutes');

create function pg_temp.key(p_slug text) returns text language sql as
  $$ select key from public.public_colony('shows', p_slug) $$;

-- ---------------------------------------------------------------------------
-- Addresses
-- ---------------------------------------------------------------------------
select is(public.colony_slug('Hódvár, the 1st!'), 'hodvar-the-1st', 'slug: lower case, accents folded, everything else a hyphen');
select is(public.colony_slug('!!!'), 'colony', 'slug: a name with nothing usable still gets an address');
select results_eq(
  $$ select slug from public.colony_addresses where owner_id = '00000000-0000-0000-0000-0000000000b1' order by slug $$,
  $$ values ('hodvar-the-1st'), ('hodvar-the-1st-2'), ('kept-private') $$,
  'addresses: the later of two colonies with the same slug gets a number');

-- ---------------------------------------------------------------------------
-- Who can read: asked as a visitor who isn't signed in
-- ---------------------------------------------------------------------------
set local role anon;

select is((select colony_name from public.public_colony('SHOWS', 'hodvar-the-1st')), 'Hódvár, the 1st!',
  'lookup: a public colony is found by handle and slug, whatever the handle''s capitals');
select is((select count(*)::integer from public.public_colony('shows', 'kept-private')), 0,
  'lookup: a colony with its switch off is not found');
select is((select count(*)::integer from public.public_colony('hides', 'public-colony-private-profile')), 0,
  'lookup: a public colony of a private profile is not found');
select is((select count(*)::integer from public.public_colony('shows', 'no-such-colony')), 0,
  'lookup: an address that matches nothing looks the same as a private colony');
select throws_ok($$ select public.public_colony_id('anything') $$, '42501', null,
  'the function that returns a real colony id cannot be called directly');
select is(public.public_colony_overview('not-a-key'), null, 'overview: nothing for a key that is not a public colony');

-- ---------------------------------------------------------------------------
-- What comes out
-- ---------------------------------------------------------------------------
select is(
  (select (o->'date'->>'cycle') || ' ' || (o->'date'->>'day') || ' ' || (o->>'days') || ' ' || (o->'weather'->>'now') || ' ' || (o->'weather'->>'days')
     from (select public.public_colony_overview(pg_temp.key('hodvar-the-1st')) o) q),
  '4 4 3 WeatherDrought 2',
  'overview: the date, the days in the window, and the weather with the game days it has lasted');
select is(
  (select public.public_colony_overview(pg_temp.key('hodvar-the-1st'))->'periods'),
  '[{"days": 2, "ongoing": true, "weather": "WeatherDrought"}]'::jsonb,
  'overview: weather periods are measured in game days');
select is(
  (select n->'steps' from jsonb_array_elements(public.public_colony_overview(pg_temp.key('hodvar-the-1st'))->'numbers') n where n->>'metric' = 'Pop'),
  '[{"on": true, "order": 1, "threshold": 30}, {"on": false, "order": 2, "threshold": 40}]'::jsonb,
  'overview: counters come out as their number, whether they are on, and the order they switched in');
select ok(
  (select bool_and(h.x >= 0 and h.x <= 3) and count(*) >= 3 and bool_and(h.threshold in (30, 40))
     from public.public_colony_history(pg_temp.key('hodvar-the-1st'), 'Pop') h),
  'history: rows sit at positions inside the window''s game days, with counters as numbers');
select is((select count(*)::integer from public.public_colony_history(pg_temp.key('hodvar-the-1st'), 'Pop; drop')), 0,
  'history: a metric that isn''t a plain name returns nothing');

-- Nothing private: not the token, not an adapter's own name, not an id, and no clock time but one.
select ok(
  (select t !~ '1{48}' and t !~* 'SecretVaultDoor' and t !~* '00000000-0000-0000-0000' and t !~* 'webhook'
     from (select public.public_colony_overview(pg_temp.key('hodvar-the-1st'))::text
               || (select coalesce(string_agg(h::text, ''), '') from public.public_colony_history(pg_temp.key('hodvar-the-1st'), 'Pop') h)
               || (select string_agg(c::text, '') from public.public_colony('shows', 'hodvar-the-1st') c)
               || (select string_agg(l::text, '') from public.colony_ladder() l) as t) q),
  'no output holds the token, an adapter''s own name, or a colony or owner id');
select is(
  (select count(*)::integer
     from regexp_matches(public.public_colony_overview(pg_temp.key('hodvar-the-1st'))::text, '\d{4}-\d{2}-\d{2}T', 'g')),
  1,
  'overview: the only clock time is when the colony was last heard from');

reset role;

-- ---------------------------------------------------------------------------
-- Switching the profile off closes every page; switching it on restores them
-- ---------------------------------------------------------------------------
update public.profiles set is_public = false where user_id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set is_public = true where user_id = '00000000-0000-0000-0000-0000000000b1';
select is((select count(*)::integer from public.public_colony('shows', 'hodvar-the-1st')), 1,
  'a colony''s own switch is remembered while its player''s profile is private');

-- ---------------------------------------------------------------------------
-- The switch is the owner's: they can use it, and nobody else can
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
update public.colonies set is_public = true where id = '00000000-0000-0000-0000-0000000000d2';
select is((select is_public from public.colonies where id = '00000000-0000-0000-0000-0000000000d2'), true,
  'a player can switch their own colony public');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
update public.colonies set is_public = false where id = '00000000-0000-0000-0000-0000000000d2';
reset role;
select is((select is_public from public.colonies where id = '00000000-0000-0000-0000-0000000000d2'), true,
  'another player cannot switch it');

select * from finish();
rollback;
