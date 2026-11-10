-- Rollback of 009_colombia_login.sql: drops only aspire_colombia_* objects.
-- New York tables, policies, functions and triggers are not touched.
--
-- This deletes every Colombia student, team and event code. The Colombia Auth
-- users (app_metadata.aspire_city = 'COL') and their inert aspire_profiles
-- rows stay; delete them from Authentication > Users if needed.

begin;

-- Dropping a table also drops its policies (aspire_colombia_*_select_*),
-- its trigger (aspire_colombia_students_before_update) and its index. No
-- CASCADE: if anything outside Colombia depended on these, the drop fails
-- instead of silently removing it. Safe to run twice.
drop table if exists public.aspire_colombia_students;
drop table if exists public.aspire_colombia_teams;
drop table if exists public.aspire_colombia_event_codes;

drop function if exists public.aspire_colombia_students_before_update();
drop function if exists public.aspire_colombia_is_student();
drop function if exists public.aspire_colombia_my_team();

commit;
