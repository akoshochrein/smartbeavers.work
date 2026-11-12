-- Number trackers no longer declare their counters up front.
--
-- A tracker is now just "this colony tracks <metric>". Its steps are discovered from the names
-- of the adapters that report (Pop30, Pop45, ...), so the player can add or remove counters in
-- the game without touching the site. `thresholds` is kept for old rows but no longer read.

alter table public.ladders drop constraint if exists ladders_thresholds_check;
alter table public.ladders alter column thresholds set default '{}';
