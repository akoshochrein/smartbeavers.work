-- Merge rules for the companion mod's readings and adapter signals.
--
-- Run with `pnpm test:db` against the local database. Everything happens inside one
-- transaction that is rolled back, so local data is untouched.
--
-- Times are written as minutes after a fixed base ten days ago. `history(metric, adapters)`
-- prints what tracker_history returns from the base onwards, one line per row:
--   "mod +60 30"                  the mod reported 30, an hour after the base
--   "adapter +30 Pop30 on"        an adapter signal
--   "... carried"                 a value already in place when that stretch began
begin;
select plan(27);

create temp table base on commit drop as select date_trunc('minute', now()) - interval '10 days' as t;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local');

insert into public.colonies (id, owner_id, name, webhook_token) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'Merge', repeat('a', 48)),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000a', 'Intake', repeat('b', 48));

create function pg_temp.at(p_minutes numeric) returns timestamptz language sql as
  $$ select t + make_interval(secs => p_minutes * 60) from base $$;

create function pg_temp.signal(p_minutes numeric, p_name text, p_state boolean) returns void language sql as $$
  insert into public.adapter_events (colony_id, adapter_name, state, received_at)
  values ('00000000-0000-0000-0000-0000000000c1', p_name, p_state, pg_temp.at(p_minutes));
$$;

create function pg_temp.session(p_from numeric, p_to numeric) returns void language sql as $$
  insert into public.mod_sessions (colony_id, started_at, last_seen_at)
  values ('00000000-0000-0000-0000-0000000000c1', pg_temp.at(p_from), pg_temp.at(p_to));
$$;

create function pg_temp.reading(p_minutes numeric, p_metric text, p_value integer) returns void language sql as $$
  insert into public.readings (colony_id, metric, value, received_at)
  values ('00000000-0000-0000-0000-0000000000c1', p_metric, p_value, pg_temp.at(p_minutes));
$$;

create function pg_temp.history(p_metric text, p_adapters text[]) returns setof text language sql as $$
  select concat_ws(' ',
           h.source,
           '+' || round(extract(epoch from h.at - (select t from base)) / 60),
           coalesce(h.value::text, h.adapter_name || case when h.state then ' on' else ' off' end),
           case when h.carried then 'carried' end)
    from public.tracker_history('00000000-0000-0000-0000-0000000000c1', p_metric, p_adapters, (select t from base), 0) h;
$$;

-- ---------------------------------------------------------------------------
-- A colony with only adapters behaves exactly as before.
-- ---------------------------------------------------------------------------
select pg_temp.signal(-30, 'Pop30', true);
select pg_temp.signal(30, 'Pop40', true);
select pg_temp.signal(200, 'Pop40', false);

select results_eq(
  $$ select * from pg_temp.history('Pop', array['Pop30', 'Pop40']) $$,
  $$ values ('adapter +0 Pop30 on carried'), ('adapter +30 Pop40 on'), ('adapter +200 Pop40 off') $$,
  'adapters only: every signal, with the state in place when the window opened'
);

-- ---------------------------------------------------------------------------
-- The mod wins while it is reporting; adapters fill the gaps.
-- The mod reported from +60 to +120 and again from +240 to +300.
-- ---------------------------------------------------------------------------
select pg_temp.session(60, 120);
select pg_temp.reading(60, 'Pop', 34);
select pg_temp.reading(90, 'Pop', 41);
select pg_temp.signal(80, 'Pop30', false);  -- during the session: must not show
select pg_temp.session(240, 300);           -- same value as before, so no new reading
select pg_temp.reading(270, 'Pop', 44);
select pg_temp.signal(400, 'Pop30', true);

select results_eq(
  $$ select * from pg_temp.history('Pop', array['Pop30', 'Pop40']) $$,
  $$ values
       ('adapter +0 Pop30 on carried'),
       ('adapter +30 Pop40 on'),
       ('mod +60 34'),
       ('mod +90 41'),
       -- five minutes after the last heartbeat the adapters take over, with the states they
       -- had by then (including the signal that arrived while the mod was reporting)
       ('adapter +125 Pop30 off carried'),
       ('adapter +125 Pop40 on carried'),
       ('adapter +200 Pop40 off'),
       -- the mod is back; its last known value still holds
       ('mod +240 41 carried'),
       ('mod +270 44'),
       ('adapter +305 Pop30 off carried'),
       ('adapter +305 Pop40 off carried'),
       ('adapter +400 Pop30 on')
  $$,
  'both sources: the mod''s values while it reported, adapter signals only in the gaps'
);

select results_eq(
  $$ select * from pg_temp.history('Pop', array[]::text[]) $$,
  $$ values ('mod +60 34'), ('mod +90 41'), ('mod +240 41 carried'), ('mod +270 44') $$,
  'no adapters for the metric: only the mod''s values'
);

-- A metric the mod has never reported is not hidden by the mod's sessions.
select pg_temp.signal(100, 'Jobs10', true);
select results_eq(
  $$ select * from pg_temp.history('Jobs', array['Jobs10']) $$,
  $$ values ('adapter +100 Jobs10 on') $$,
  'a metric the mod does not report keeps all its adapter signals'
);

-- The mod only hides adapters from its first value for that metric onwards.
select pg_temp.reading(280, 'Bots', 3);
select pg_temp.signal(250, 'Bots1', true);
select pg_temp.signal(290, 'Bots2', true);
select results_eq(
  $$ select * from pg_temp.history('Bots', array['Bots1', 'Bots2']) $$,
  $$ values
       ('adapter +250 Bots1 on'),
       ('mod +280 3'),
       ('adapter +305 Bots1 on carried'),
       ('adapter +305 Bots2 on carried')
  $$,
  'a metric first reported mid-session is taken over from that moment, not from the session start'
);

-- While the mod is reporting right now, nothing has taken over from it.
insert into public.mod_sessions (colony_id, started_at, last_seen_at)
values ('00000000-0000-0000-0000-0000000000c1', now() - interval '20 minutes', now() - interval '1 minute');
insert into public.readings (colony_id, metric, value, received_at)
values ('00000000-0000-0000-0000-0000000000c1', 'Pop', 50, now() - interval '10 minutes');
insert into public.adapter_events (colony_id, adapter_name, state, received_at)
values ('00000000-0000-0000-0000-0000000000c1', 'Pop40', true, now() - interval '5 minutes');

select is(
  (select array_agg(h.source || ' ' || coalesce(h.value::text, h.adapter_name) order by h.at, h.adapter_name)
     from public.tracker_history('00000000-0000-0000-0000-0000000000c1', 'Pop', array['Pop30', 'Pop40'], now() - interval '30 minutes', 0) h),
  array['adapter Pop30', 'adapter Pop40', 'mod 44', 'mod 50'],
  'live session: the mod''s values to the end, and the adapter signal sent meanwhile stays hidden'
);

select is(
  (select value || ' ' || reporting from public.latest_readings
    where colony_id = '00000000-0000-0000-0000-0000000000c1' and metric = 'Pop'),
  '50 true',
  'latest reading is marked as reporting while heartbeats are fresh'
);

update public.mod_sessions set last_seen_at = now() - interval '6 minutes'
 where colony_id = '00000000-0000-0000-0000-0000000000c1' and last_seen_at > now() - interval '5 minutes';
select is(
  (select value || ' ' || reporting from public.latest_readings
    where colony_id = '00000000-0000-0000-0000-0000000000c1' and metric = 'Pop'),
  '50 false',
  'five minutes without a heartbeat: the latest reading is no longer marked as reporting'
);

-- ---------------------------------------------------------------------------
-- Taking readings in: record_readings(token, {metric: value})
-- ---------------------------------------------------------------------------
select is(public.record_readings(repeat('f', 48), '{"Adults": 1}'), false, 'an unknown token is refused');

select is(public.record_readings(repeat('b', 48), '{"Adults": 30, "Children": 4}'), true, 'a known token is accepted');
select results_eq(
  $$ select metric, value from public.readings where colony_id = '00000000-0000-0000-0000-0000000000c2' order by metric $$,
  $$ values ('Adults', 30), ('Beavers', 34), ('Children', 4) $$,
  'adults and kits are stored, and beavers is worked out from them'
);

select public.record_readings(repeat('b', 48), '{"Adults": 30, "Children": 5, "Bots": 2}');
select results_eq(
  $$ select metric, array_agg(value order by id) from public.readings
      where colony_id = '00000000-0000-0000-0000-0000000000c2' group by metric order by metric $$,
  $$ values ('Adults', array[30]), ('Beavers', array[34, 35]), ('Bots', array[2]), ('Children', array[4, 5]), ('Pop', array[37]) $$,
  'only changed values are stored; population appears once adults, kits and bots are all known'
);

select public.record_readings(repeat('b', 48), '{}');
select is(
  (select count(*)::int from public.readings where colony_id = '00000000-0000-0000-0000-0000000000c2'),
  7, 'a heartbeat stores no reading');
select is(
  (select count(*)::int from public.mod_sessions where colony_id = '00000000-0000-0000-0000-0000000000c2'),
  1, 'heartbeats close together belong to one session');

update public.mod_sessions set started_at = now() - interval '2 hours', last_seen_at = now() - interval '1 hour'
 where colony_id = '00000000-0000-0000-0000-0000000000c2';
select public.record_readings(repeat('b', 48), '{}');
select is(
  (select count(*)::int from public.mod_sessions where colony_id = '00000000-0000-0000-0000-0000000000c2'),
  2, 'a heartbeat after a long silence starts a new session');

select public.record_readings(repeat('b', 48), '{"Adults": -1, "Well being!": 7, "Pop": 500, "Bots": "many", "Children": 2000000}');
select is(
  (select count(*)::int from public.readings where colony_id = '00000000-0000-0000-0000-0000000000c2'),
  7, 'badly named metrics, worked-out metrics sent directly, and values that are not sensible whole numbers are ignored');

-- 30 requests a minute per colony; the rest are answered as accepted and dropped.
update public.mod_requests set count = 30 where colony_id = '00000000-0000-0000-0000-0000000000c2';
select is(public.record_readings(repeat('b', 48), '{"Adults": 99}'), true, 'a request over the limit is answered as accepted');
select is(
  (select count(*)::int from public.readings where colony_id = '00000000-0000-0000-0000-0000000000c2' and value = 99),
  0, 'and what it carried is dropped');

-- The mod also says which faction the save is. It sets the colony's faction and nothing else.
update public.mod_requests set count = 0 where colony_id = '00000000-0000-0000-0000-0000000000c2';  -- back under the limit
select public.record_readings(repeat('b', 48), '{}', 'iron_teeth');
select is((select faction from public.colonies where id = '00000000-0000-0000-0000-0000000000c2'), 'iron_teeth',
  'a faction from the mod sets the colony''s faction');
select public.record_readings(repeat('b', 48), '{}', 'squirrels');
select is((select faction from public.colonies where id = '00000000-0000-0000-0000-0000000000c2'), 'iron_teeth',
  'a faction the site doesn''t know is ignored');
select public.record_readings(repeat('b', 48), '{}');
select is((select faction || ' ' || name from public.colonies where id = '00000000-0000-0000-0000-0000000000c2'), 'iron_teeth Intake',
  'a request without a faction leaves it alone, and the name is never touched');

-- ---------------------------------------------------------------------------
-- Pinned goods: which of the mod's storage readings a player shows on the colony page.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.pinned_metrics (colony_id, metric) values ('00000000-0000-0000-0000-0000000000c1', 'Water') $$,
  'an owner can pin a metric on their colony');
select is((select count(*)::int from public.pinned_metrics), 1, 'and sees it');
select lives_ok(
  $$ delete from public.pinned_metrics where colony_id = '00000000-0000-0000-0000-0000000000c1' and metric = 'Water' $$,
  'an owner can unpin it');
insert into public.pinned_metrics (colony_id, metric) values ('00000000-0000-0000-0000-0000000000c1', 'Logs');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.pinned_metrics), 0, 'another player sees no pins');
select throws_ok(
  $$ insert into public.pinned_metrics (colony_id, metric) values ('00000000-0000-0000-0000-0000000000c1', 'Planks') $$,
  '42501', null, 'and cannot pin on a colony that isn''t theirs');
reset role;

-- ---------------------------------------------------------------------------
-- Row level security: readings are the owner's.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.readings) + (select count(*)::int from public.mod_sessions) + (select count(*)::int from public.latest_readings),
  0, 'another player sees none of a colony''s readings or sessions');
reset role;

select * from finish();
rollback;
