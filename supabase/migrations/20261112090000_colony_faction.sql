-- Which faction a colony plays. Narrows the goods offered when adding a resource tracker.
-- Null for colonies created before this existed: they see both factions' goods until one is set.

alter table public.colonies
  add column faction text check (faction in ('folktails', 'iron_teeth'));
