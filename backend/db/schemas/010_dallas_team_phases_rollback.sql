-- Rollback of 010_dallas_team_phases.sql: drops only aspire_dallas_* objects.
-- New York and the 009 Dallas login tables are not touched.
--
-- This deletes every team's answers, timers and progress.

begin;

-- Functions first: they return the table's row type. No CASCADE, so the drop
-- fails instead of removing anything else that depends on these.
drop function if exists public.aspire_dallas_save_answers(bigint, text, jsonb, uuid);
drop function if exists public.aspire_dallas_open_phase(bigint, text);
drop function if exists public.aspire_dallas_complete_phase(bigint, text, uuid);

drop table if exists public.aspire_dallas_team_phases;

commit;
