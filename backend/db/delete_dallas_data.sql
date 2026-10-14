-- One-off reset of the Dallas challenge: removes every Dallas student account
-- and everything the teams saved, so the event starts from zero.
--
-- Deletes:
--   * auth.users marked by the Dallas login (app_metadata.aspire_city = 'DFW'),
--     plus any user that has an aspire_dallas_students row. This cascades to
--     aspire_dallas_students and aspire_profiles.
--   * aspire_dallas_team_phases: all answers, team names, timers and progress.
--   * aspire_login_events and aspire_coach_messages rows of those users.
--   * aspire_dallas_teams rows other than the default Team 1 to Team 30.
--
-- Keeps:
--   * aspire_dallas_teams 1 to 30.
--   * aspire_dallas_event_codes (deactivate the code separately if needed).
--   * Everything New York uses, including the student.dallas@leadmindset.org
--     account from 002 (it is not a Dallas-login user).
--
-- Run step 1 first to preview. Then run step 2 as a whole; it aborts and
-- rolls back if a Dallas user is also tied to New York data.

-- ---------------------------------------------------------------------------
-- Step 1: preview (read-only)
-- ---------------------------------------------------------------------------
select u.id, u.email, s.first_name, s.last_name, t.name as team, u.created_at
from auth.users u
left join public.aspire_dallas_students s on s.user_id = u.id
left join public.aspire_dallas_teams t on t.id = s.team_id
where u.raw_app_meta_data ->> 'aspire_city' = 'DFW'
   or u.id in (select user_id from public.aspire_dallas_students)
order by t.team_number nulls last, u.email;

select 'auth.users (Dallas)' as table_name, count(*) from auth.users
 where raw_app_meta_data ->> 'aspire_city' = 'DFW'
    or id in (select user_id from public.aspire_dallas_students)
union all
select 'aspire_dallas_students', count(*) from public.aspire_dallas_students
union all
select 'aspire_dallas_team_phases', count(*) from public.aspire_dallas_team_phases
union all
select 'aspire_dallas_teams beyond 1-30', count(*) from public.aspire_dallas_teams
 where team_number not between 1 and 30
union all
select 'aspire_login_events (Dallas users)', count(*) from public.aspire_login_events
 where user_id in (
   select id from auth.users
   where raw_app_meta_data ->> 'aspire_city' = 'DFW'
      or id in (select user_id from public.aspire_dallas_students)
 )
union all
select 'aspire_coach_messages (Dallas users)', count(*) from public.aspire_coach_messages
 where user_id in (
   select id from auth.users
   where raw_app_meta_data ->> 'aspire_city' = 'DFW'
      or id in (select user_id from public.aspire_dallas_students)
 );

-- ---------------------------------------------------------------------------
-- Step 2: delete
-- ---------------------------------------------------------------------------
begin;

create temporary table dallas_users on commit drop as
select id
from auth.users
where raw_app_meta_data ->> 'aspire_city' = 'DFW'
   or id in (select user_id from public.aspire_dallas_students);

do $$
declare
  user_count  integer;
  ny_access   integer;
  ny_logos    integer;
begin
  select count(*) into user_count from dallas_users;

  -- A Dallas-login user should never have New York access or uploads.
  select count(*) into ny_access
  from public.aspire_user_access
  where user_id in (select id from dallas_users);

  select count(*) into ny_logos
  from public.aspire_group_logos
  where uploaded_by in (select id from dallas_users);

  if ny_access > 0 or ny_logos > 0 then
    raise exception '% access rows and % logos of Dallas users belong to New York. Aborting.',
      ny_access, ny_logos;
  end if;

  raise notice 'Deleting % Dallas users', user_count;
end $$;

-- Team answers first: their completed_by/updated_by point at the students.
delete from public.aspire_dallas_team_phases;

delete from public.aspire_login_events
where user_id in (select id from dallas_users);

-- Dallas coach chats (user_id would only be set to null otherwise).
delete from public.aspire_coach_messages
where user_id in (select id from dallas_users);

-- Cascades to aspire_dallas_students and aspire_profiles.
delete from auth.users
where id in (select id from dallas_users);

-- Students are gone, so extra teams are no longer referenced.
delete from public.aspire_dallas_teams
where team_number not between 1 and 30;

commit;

-- ---------------------------------------------------------------------------
-- Step 3: verify (all should be 0, teams_left should be 30)
-- ---------------------------------------------------------------------------
select
  (select count(*) from auth.users where raw_app_meta_data ->> 'aspire_city' = 'DFW') as dallas_users_left,
  (select count(*) from public.aspire_dallas_students) as students_left,
  (select count(*) from public.aspire_dallas_team_phases) as team_phases_left,
  (select count(*) from public.aspire_dallas_teams) as teams_left;
