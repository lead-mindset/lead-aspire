-- One-off cleanup: remove the load-test groups NYC-LOADTEST-01..18 and the
-- loadtestNN@test.lead accounts created by loadtest/create_test_users.py.
-- SQL version of `python loadtest/cleanup.py --delete-users`.
--
-- Only touches rows matching these exact patterns:
--   group_code ~ '^NYC-LOADTEST-[0-9]{2}$'
--   email      ~ '^loadtest[0-9]{2}@test\.lead$'
-- Real teams (NYC-G01..G18, Dallas) are not affected.
--
-- Not covered: Storage objects under NYC-LOADTEST-*/ in the
-- aspire-team-submissions bucket. Supabase blocks deleting storage.objects
-- from SQL; remove that folder in the dashboard (Storage) or with cleanup.py.
--
-- Run step 1 first to preview. Then run step 2 as a whole; it aborts and
-- rolls back if the counts look wrong.

-- ---------------------------------------------------------------------------
-- Step 1: preview (read-only)
-- ---------------------------------------------------------------------------
select id, group_code, group_name
from public.aspire_groups
where group_code ~ '^NYC-LOADTEST-[0-9]{2}$'
order by group_code;

select 'aspire_user_access' as table_name, count(*) from public.aspire_user_access
 where group_id in (select id from public.aspire_groups where group_code ~ '^NYC-LOADTEST-[0-9]{2}$')
union all
select 'aspire_submissions', count(*) from public.aspire_submissions
 where group_id in (select id from public.aspire_groups where group_code ~ '^NYC-LOADTEST-[0-9]{2}$')
union all
select 'aspire_team_progress', count(*) from public.aspire_team_progress
 where group_id in (select id from public.aspire_groups where group_code ~ '^NYC-LOADTEST-[0-9]{2}$')
union all
select 'aspire_group_logos', count(*) from public.aspire_group_logos
 where group_id in (select id from public.aspire_groups where group_code ~ '^NYC-LOADTEST-[0-9]{2}$')
union all
select 'aspire_login_events', count(*) from public.aspire_login_events
 where email ~ '^loadtest[0-9]{2}@test\.lead$'
union all
select 'auth.users', count(*) from auth.users
 where email ~ '^loadtest[0-9]{2}@test\.lead$';

-- ---------------------------------------------------------------------------
-- Step 2: delete
-- ---------------------------------------------------------------------------
begin;

do $$
declare
  group_count integer;
  user_count  integer;
  other_users integer;
begin
  select count(*) into group_count
  from public.aspire_groups
  where group_code ~ '^NYC-LOADTEST-[0-9]{2}$';

  select count(*) into user_count
  from auth.users
  where email ~ '^loadtest[0-9]{2}@test\.lead$';

  -- Real users must never be attached to a load-test group.
  select count(*) into other_users
  from public.aspire_user_access a
  join auth.users u on u.id = a.user_id
  where a.group_id in (select id from public.aspire_groups where group_code ~ '^NYC-LOADTEST-[0-9]{2}$')
    and u.email !~ '^loadtest[0-9]{2}@test\.lead$';

  if group_count > 18 or user_count > 90 then
    raise exception 'Unexpected counts: % groups, % users. Aborting.', group_count, user_count;
  end if;
  if other_users > 0 then
    raise exception '% non-test users are assigned to load-test groups. Aborting.', other_users;
  end if;

  raise notice 'Deleting % groups and % test users', group_count, user_count;
end $$;

-- Rows tied to the test groups (submissions/progress/logos cascade, but be explicit).
delete from public.aspire_submissions
where group_id in (select id from public.aspire_groups where group_code ~ '^NYC-LOADTEST-[0-9]{2}$');

delete from public.aspire_team_progress
where group_id in (select id from public.aspire_groups where group_code ~ '^NYC-LOADTEST-[0-9]{2}$');

delete from public.aspire_group_logos
where group_id in (select id from public.aspire_groups where group_code ~ '^NYC-LOADTEST-[0-9]{2}$');

-- Rows tied to the test accounts.
delete from public.aspire_login_events
where email ~ '^loadtest[0-9]{2}@test\.lead$';

delete from public.aspire_coach_messages
where user_id in (select id from auth.users where email ~ '^loadtest[0-9]{2}@test\.lead$');

-- aspire_user_access.group_id has no ON DELETE action, so these must go before the groups.
delete from public.aspire_user_access
where group_id in (select id from public.aspire_groups where group_code ~ '^NYC-LOADTEST-[0-9]{2}$')
   or user_id in (select id from auth.users where email ~ '^loadtest[0-9]{2}@test\.lead$');

-- Test accounts (cascades to aspire_profiles).
delete from auth.users
where email ~ '^loadtest[0-9]{2}@test\.lead$';

-- Finally the groups.
delete from public.aspire_groups
where group_code ~ '^NYC-LOADTEST-[0-9]{2}$';

commit;

-- ---------------------------------------------------------------------------
-- Step 3: verify (both should return 0)
-- ---------------------------------------------------------------------------
select count(*) as loadtest_groups_left
from public.aspire_groups where group_code ~ '^NYC-LOADTEST-[0-9]{2}$';

select count(*) as loadtest_users_left
from auth.users where email ~ '^loadtest[0-9]{2}@test\.lead$';
