-- Retention: how history is thinned as it ages, what is deleted, and what must survive.
--
-- Run with `pnpm test:db`. Everything happens inside one transaction that is rolled back.
-- Rows are placed by age: `ago('10 days', '03:20')` is 03:20 UTC on the day ten days ago, so
-- which hour and which day a row falls in is always clear.
begin;
select plan(25);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'keeper@test.local');
insert into public.colonies (id, owner_id, name, webhook_token) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000aa', 'Old and busy', repeat('1', 48)),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000aa', 'Long silent', repeat('2', 48)),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000aa', 'Intake', repeat('3', 48));

create function pg_temp.ago(p_age interval, p_time time default '12:00') returns timestamptz language sql as
  $$ select (date_trunc('day', now() at time zone 'utc') - p_age + p_time) at time zone 'utc' $$;

create function pg_temp.reading(p_metric text, p_value integer, p_at timestamptz, p_colony uuid default '00000000-0000-0000-0000-0000000000d1')
returns void language sql as $$
  insert into public.readings (colony_id, metric, value, received_at) values (p_colony, p_metric, p_value, p_at);
$$;

create function pg_temp.signal(p_name text, p_at timestamptz, p_colony uuid default '00000000-0000-0000-0000-0000000000d1')
returns void language sql as $$
  insert into public.adapter_events (colony_id, adapter_name, state, received_at) values (p_colony, p_name, true, p_at);
$$;

create function pg_temp.kept(p_metric text) returns text language sql as $$
  select coalesce(string_agg(value::text, ',' order by received_at), 'none')
    from public.readings where colony_id = '00000000-0000-0000-0000-0000000000d1' and metric = p_metric;
$$;

-- ---------------------------------------------------------------------------
-- The settings
-- ---------------------------------------------------------------------------
select is(
  (select full_detail_hours || ' ' || hourly_days || ' ' || keep_days || ' ' || silent_months || ' ' || reading_gap_seconds || ' ' || readings_per_hour
     from public.retention_settings),
  '48 30 180 12 10 6000',
  'the defaults are the free-hosting policy');

set local role anon;
select is((select keep_days from public.retention_policy()), 180, 'anyone can read the policy, so the privacy page can state it');
select throws_ok($$ select * from public.retention_settings $$, '42501', null, 'but not the settings table itself');
select throws_ok($$ select public.apply_retention() $$, '42501', null, 'and nobody outside can run the cleanup');
reset role;

-- ---------------------------------------------------------------------------
-- Thinning. One metric, values named after where they sit.
-- ---------------------------------------------------------------------------
-- yesterday: full detail
select pg_temp.reading('Water', 11, pg_temp.ago('1 day', '03:10'));
select pg_temp.reading('Water', 12, pg_temp.ago('1 day', '03:20'));
select pg_temp.reading('Water', 13, pg_temp.ago('1 day', '03:50'));
-- ten days ago: one per hour
select pg_temp.reading('Water', 21, pg_temp.ago('10 days', '03:10'));
select pg_temp.reading('Water', 22, pg_temp.ago('10 days', '03:20'));
select pg_temp.reading('Water', 23, pg_temp.ago('10 days', '03:50'));
select pg_temp.reading('Water', 24, pg_temp.ago('10 days', '04:05'));
-- sixty days ago: one per day
select pg_temp.reading('Water', 31, pg_temp.ago('60 days', '03:10'));
select pg_temp.reading('Water', 32, pg_temp.ago('60 days', '09:00'));
select pg_temp.reading('Water', 33, pg_temp.ago('60 days', '21:30'));
select pg_temp.reading('Water', 34, pg_temp.ago('59 days', '00:30'));
-- two hundred days ago: gone
select pg_temp.reading('Water', 41, pg_temp.ago('200 days', '03:10'));

-- Days are counted, not sampled: they are never thinned.
select pg_temp.reading('Day', 1, pg_temp.ago('200 days', '01:00'));
select pg_temp.reading('Day', 2, pg_temp.ago('60 days', '03:10'));
select pg_temp.reading('Day', 3, pg_temp.ago('60 days', '03:20'));
select pg_temp.reading('Day', 4, pg_temp.ago('60 days', '03:30'));
select pg_temp.reading('Day', 5, pg_temp.ago('10 days', '03:10'));
select pg_temp.reading('Day', 6, pg_temp.ago('10 days', '03:20'));

-- The mod was reporting in three stretches; the oldest ended more than 180 days ago.
insert into public.mod_sessions (colony_id, started_at, last_seen_at) values
  ('00000000-0000-0000-0000-0000000000d1', pg_temp.ago('200 days', '01:00'), pg_temp.ago('200 days', '05:00')),
  ('00000000-0000-0000-0000-0000000000d1', pg_temp.ago('60 days', '01:00'), pg_temp.ago('59 days', '01:00')),
  ('00000000-0000-0000-0000-0000000000d1', pg_temp.ago('10 days', '01:00'), pg_temp.ago('1 day', '05:00'));

-- Adapter signals: weather stations and a chronometer from before the mod, and a counter.
-- The clock was set 300 days ago at cycle 3, day 2.
insert into public.weather_trackers (colony_id) values ('00000000-0000-0000-0000-0000000000d1');
insert into public.game_clocks (colony_id, anchor_at, anchor_cycle, anchor_day)
values ('00000000-0000-0000-0000-0000000000d1', pg_temp.ago('300 days'), 3, 2);
select pg_temp.signal('GameDay', pg_temp.ago('290 days'));
select pg_temp.signal('WeatherDrought', pg_temp.ago('280 days'));
select pg_temp.signal('GameDay', pg_temp.ago('270 days'));
select pg_temp.signal('WeatherTemperate', pg_temp.ago('260 days'));  -- cycle 4 begins
select pg_temp.signal('GameDay', pg_temp.ago('250 days'));
select pg_temp.signal('WeatherBadtide', pg_temp.ago('240 days'));
select pg_temp.signal('GameDay', pg_temp.ago('230 days'));
select pg_temp.signal('WeatherTemperate', pg_temp.ago('100 days'));  -- cycle 5 begins
select pg_temp.signal('GameDay', pg_temp.ago('90 days'));
select pg_temp.signal('Pop30', pg_temp.ago('220 days'));
select pg_temp.signal('Pop40', pg_temp.ago('80 days'));

create temp table before on commit drop as
  select (select cycle || ' ' || day from public.game_date('00000000-0000-0000-0000-0000000000d1')) as game_date,
         (select string_agg(adapter_name || '=' || n, ' ' order by adapter_name) from public.weather_counts('00000000-0000-0000-0000-0000000000d1')) as weather;

-- Cycle 5 began 100 days ago; since then one day from the chronometer and five from the mod.
select is((select game_date from before), '5 7', 'before: the date is counted from the day the clock was set');
select is((select weather from before), 'WeatherBadtide=1 WeatherDrought=1 WeatherTemperate=2', 'before: every weather start is counted');

-- A colony nobody has played for over a year.
select pg_temp.reading('Pop', 80, pg_temp.ago('400 days'), '00000000-0000-0000-0000-0000000000d2');
select pg_temp.reading('Pop', 85, pg_temp.ago('390 days'), '00000000-0000-0000-0000-0000000000d2');
select pg_temp.signal('WeatherDrought', pg_temp.ago('395 days'), '00000000-0000-0000-0000-0000000000d2');
insert into public.adapter_states (colony_id, name, state, updated_at)
values ('00000000-0000-0000-0000-0000000000d2', 'WeatherDrought', true, pg_temp.ago('395 days'));
insert into public.mod_sessions (colony_id, started_at, last_seen_at)
values ('00000000-0000-0000-0000-0000000000d2', pg_temp.ago('400 days'), pg_temp.ago('390 days'));
insert into public.ladders (colony_id, metric) values ('00000000-0000-0000-0000-0000000000d2', 'Pop');

select lives_ok($$ select public.apply_retention() $$, 'the cleanup runs');

select is(pg_temp.kept('Water'), '33,34,23,24,11,12,13',
  'readings: gone after 180 days, the last of each day until 30 days, the last of each hour until 48 hours, everything since');
select is(pg_temp.kept('Day'), '2,3,4,5,6', 'day changes are never thinned, only deleted after 180 days');
select is(
  (select string_agg(adapter_name, ',' order by received_at) from public.adapter_events where colony_id = '00000000-0000-0000-0000-0000000000d1'),
  'WeatherTemperate,GameDay,Pop40',
  'adapter signals are deleted after 180 days and otherwise left alone');
select is(
  (select count(*)::int from public.mod_sessions where colony_id = '00000000-0000-0000-0000-0000000000d1'), 2,
  'sessions that ended more than 180 days ago are deleted');

select is((select cycle || ' ' || day from public.game_date('00000000-0000-0000-0000-0000000000d1')), (select game_date from before),
  'the game date is the same after the days it was counted from are gone');
select is(
  (select string_agg(adapter_name || '=' || n, ' ' order by adapter_name) from public.weather_counts('00000000-0000-0000-0000-0000000000d1')),
  (select weather from before),
  'how often each weather has started is the same after the old starts are gone');
select is(
  (select value from public.latest_readings where colony_id = '00000000-0000-0000-0000-0000000000d1' and metric = 'Water'), 13,
  'the latest value is untouched');

select lives_ok($$ select public.apply_retention() $$, 'running it again');
select is(pg_temp.kept('Water'), '33,34,23,24,11,12,13', 'changes nothing');
select is(
  (select string_agg(adapter_name || '=' || n, ' ' order by adapter_name) from public.weather_counts('00000000-0000-0000-0000-0000000000d1')),
  (select weather from before),
  'and counts nothing twice');

-- The silent colony: history gone, the colony and what it last showed still there.
select is(
  (select count(*)::int from public.readings where colony_id = '00000000-0000-0000-0000-0000000000d2')
  + (select count(*)::int from public.adapter_events where colony_id = '00000000-0000-0000-0000-0000000000d2')
  + (select count(*)::int from public.mod_sessions where colony_id = '00000000-0000-0000-0000-0000000000d2')
  + (select count(*)::int from public.weather_totals where colony_id = '00000000-0000-0000-0000-0000000000d2'),
  0, 'a colony silent for over 12 months loses its history, sessions and totals');
select is(
  (select c.name || ' ' || (select count(*) from public.ladders l where l.colony_id = c.id) || ' ' ||
          (select value from public.reading_metrics m where m.colony_id = c.id and m.metric = 'Pop') || ' ' ||
          (select count(*) from public.adapter_states s where s.colony_id = c.id)
     from public.colonies c where c.id = '00000000-0000-0000-0000-0000000000d2'),
  'Long silent 1 85 1',
  'but keeps its name, its trackers and its latest values');
select is(
  (select extract(day from now() - received_at) > 380 from public.reading_metrics where colony_id = '00000000-0000-0000-0000-0000000000d2' and metric = 'Pop'),
  true, 'and those values still say how old they are');

-- ---------------------------------------------------------------------------
-- An empty setting means no limit.
-- ---------------------------------------------------------------------------
update public.retention_settings set full_detail_hours = null, hourly_days = null, keep_days = null, silent_months = null;
select pg_temp.reading('Logs', 1, pg_temp.ago('500 days', '03:10'));
select pg_temp.reading('Logs', 2, pg_temp.ago('500 days', '03:20'));
select public.apply_retention();
select is(pg_temp.kept('Logs'), '1,2', 'with the limits emptied, everything is kept');
update public.retention_settings set full_detail_hours = 48, hourly_days = 30, keep_days = 180, silent_months = 12;

-- ---------------------------------------------------------------------------
-- What comes in is capped (record_readings, as the Worker calls it).
-- ---------------------------------------------------------------------------
select public.record_readings(repeat('3', 48), '{"Water": 50, "Day": 1}');
select public.record_readings(repeat('3', 48), '{"Water": 51, "Day": 2}');
select is(
  (select string_agg(metric || ':' || value, ' ' order by metric, id) from public.readings where colony_id = '00000000-0000-0000-0000-0000000000d3'),
  'Day:1 Day:2 Water:51',
  'a second value for a metric within 10 seconds replaces the first instead of adding a row; days are exempt');

update public.retention_settings set reading_gap_seconds = null, readings_per_hour = 4;
select public.record_readings(repeat('3', 48), '{"Logs": 1, "Planks": 2, "Gears": 3}');
select is(
  (select count(*)::int from public.readings where colony_id = '00000000-0000-0000-0000-0000000000d3'), 4,
  'over the hourly limit no more history is stored');
select is(
  (select count(*)::int from public.latest_readings where colony_id = '00000000-0000-0000-0000-0000000000d3'), 5,
  'but the latest value of every metric is still kept, so the page stays right');

update public.retention_settings set readings_per_hour = null;
select public.record_readings(repeat('3', 48), '{"Logs": 9}');
select is(
  (select string_agg(value::text, ',' order by id) from public.readings where colony_id = '00000000-0000-0000-0000-0000000000d3' and metric = 'Logs'),
  '1,9', 'with the limit emptied, history is stored again');

select * from finish();
rollback;
