-- Live team progress: when one member marks a phase, the others' pages update.
-- Run after 007 in the Supabase SQL Editor.
--
-- Writes still go only through the backend. Members get read access to their
-- own team's rows so Supabase Realtime (which applies RLS) delivers the
-- changes to them; the page then refetches /api/team/progress.

begin;

drop policy if exists aspire_team_progress_select_member on public.aspire_team_progress;
create policy aspire_team_progress_select_member
on public.aspire_team_progress for select to authenticated
using (public.aspire_is_group_member(group_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'aspire_team_progress'
  ) then
    alter publication supabase_realtime add table public.aspire_team_progress;
  end if;
end;
$$;

commit;
