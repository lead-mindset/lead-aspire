-- Rollback of 010_colombia_team_phases.sql: drops only aspire_colombia_* objects.
-- New York and the 009 Colombia login tables are not touched.
--
-- This deletes every team's answers, timers and progress.

begin;

-- Functions first: they return the table's row type. No CASCADE, so the drop
-- fails instead of removing anything else that depends on these.
drop function if exists public.aspire_colombia_save_answers(bigint, text, jsonb, uuid);
drop function if exists public.aspire_colombia_open_phase(bigint, text);
drop function if exists public.aspire_colombia_complete_phase(bigint, text, uuid);

drop table if exists public.aspire_colombia_team_phases;

commit;
