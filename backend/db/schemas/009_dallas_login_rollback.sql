-- Rollback of 009_dallas_login.sql: drops only aspire_dallas_* objects.
-- New York tables, policies, functions and triggers are not touched.
--
-- This deletes every Dallas student, team and event code. The Dallas Auth
-- users (app_metadata.aspire_city = 'DFW') and their inert aspire_profiles
-- rows stay; delete them from Authentication > Users if needed.

begin;

-- Dropping a table also drops its policies (aspire_dallas_*_select_*),
-- its trigger (aspire_dallas_students_before_update) and its index. No
-- CASCADE: if anything outside Dallas depended on these, the drop fails
-- instead of silently removing it. Safe to run twice.
drop table if exists public.aspire_dallas_students;
drop table if exists public.aspire_dallas_teams;
drop table if exists public.aspire_dallas_event_codes;

drop function if exists public.aspire_dallas_students_before_update();
drop function if exists public.aspire_dallas_is_student();
drop function if exists public.aspire_dallas_my_team();

commit;
