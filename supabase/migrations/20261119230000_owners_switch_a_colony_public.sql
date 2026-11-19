-- A colony's owner can switch its public page on and off.
--
-- Players may only change named columns of their colonies (see the hardening migration), and
-- is_public was not among them, so the switch added with public colonies could not be used.
grant update (is_public) on public.colonies to authenticated;
