-- Undo 012_dallas_submissions.sql. The deck files stay in the bucket under
-- DFW-team-*/; delete them from Storage separately if needed.

begin;

drop table if exists public.aspire_dallas_submissions;

commit;
