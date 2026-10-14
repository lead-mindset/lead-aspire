-- Dallas challenge: the phases become Team Setup, Discover, Strategize,
-- Design Your Solution and Pitch & Submit. Run after 010 in the Supabase SQL
-- Editor, and deploy the backend that uses the same list
-- (app/dallas_challenge.py, PHASES) right after.
-- Rollback: 011_dallas_new_phases_rollback.sql.
--
-- Rows of the removed phases (brief, diagnose, advise, respond, deliver) are
-- deleted: their answers have no screen any more. Team names, roles and
-- Discover timers are kept.

begin;

delete from public.aspire_dallas_team_phases
where phase not in ('team', 'discover', 'strategize', 'design', 'pitch');

alter table public.aspire_dallas_team_phases
  drop constraint aspire_dallas_team_phases_phase_check;

alter table public.aspire_dallas_team_phases
  add constraint aspire_dallas_team_phases_phase_check
  check (phase in ('team', 'discover', 'strategize', 'design', 'pitch'));

commit;
