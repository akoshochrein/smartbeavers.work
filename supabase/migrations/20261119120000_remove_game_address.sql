-- The site no longer talks to the game. Switching levers from the browser is gone, so a colony
-- has no use for the game's address.
--
-- Dropping the column also drops its column grants. Players can still write a colony's name and
-- faction, as granted in the hardening migration; nothing else.
alter table public.colonies drop column api_base_url;
