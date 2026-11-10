-- Undo 012_colombia_submissions.sql. The deck files stay in the bucket under
-- COL-team-*/; delete them from Storage separately if needed.

begin;

drop table if exists public.aspire_colombia_submissions;

commit;
