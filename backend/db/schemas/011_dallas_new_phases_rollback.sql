-- Rollback of 011_dallas_new_phases.sql: restores the 010 phase list.
-- Deploy the backend with the old PHASES list together with this.
--
-- Rows of strategize, design and pitch are deleted. The answers removed by
-- 011 (brief to deliver) cannot be restored.

begin;

delete from public.aspire_dallas_team_phases
where phase in ('strategize', 'design', 'pitch');

alter table public.aspire_dallas_team_phases
  drop constraint aspire_dallas_team_phases_phase_check;

alter table public.aspire_dallas_team_phases
  add constraint aspire_dallas_team_phases_phase_check
  check (phase in ('team', 'brief', 'discover', 'diagnose', 'advise', 'respond', 'deliver'));

commit;
