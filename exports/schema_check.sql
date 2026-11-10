-- LEAD Aspire: live schema check against exports/SCHEMA_MAP.md.
--
-- READ ONLY: every statement is a SELECT. Nothing is created or changed.
-- The Supabase SQL Editor shows only the last result, so run ONE query at a
-- time (select its text, then Run). No query returns emails, names or the
-- event code.


-- ===========================================================================
-- Q1. Tables: live vs repo, with row counts.
--     status = 'MISSING in database'    -> the code expects it, the DB lacks it
--     status = 'NOT referenced by code' -> in the DB, unknown to the repo
-- ===========================================================================
with expected(table_schema, table_name, edition) as (
  values
    ('auth',   'users',                     'shared'),
    ('public', 'aspire_profiles',           'shared'),
    ('public', 'aspire_cities',             'shared'),
    ('public', 'aspire_coach_messages',     'shared'),
    ('public', 'aspire_groups',             'NY'),
    ('public', 'aspire_user_access',        'NY'),
    ('public', 'aspire_team_progress',      'NY'),
    ('public', 'aspire_submissions',        'NY'),
    ('public', 'aspire_login_events',       'NY'),
    ('public', 'aspire_group_logos',        'NY (schema only, unused by code)'),
    ('public', 'aspire_dallas_event_codes', 'Dallas'),
    ('public', 'aspire_dallas_teams',       'Dallas'),
    ('public', 'aspire_dallas_students',    'Dallas'),
    ('public', 'aspire_dallas_team_phases', 'Dallas'),
    ('public', 'aspire_dallas_submissions', 'Dallas')
),
live as (
  select table_schema, table_name
  from information_schema.tables
  where table_type = 'BASE TABLE'
    and (table_schema = 'public' or (table_schema = 'auth' and table_name = 'users'))
)
select
  coalesce(l.table_schema, e.table_schema) as table_schema,
  coalesce(l.table_name, e.table_name)     as table_name,
  coalesce(e.edition, '?')                 as edition,
  case
    when l.table_name is null then 'MISSING in database'
    when e.table_name is null then 'NOT referenced by code'
    else 'ok'
  end as status,
  case when l.table_name is not null then
    (xpath('/row/c/text()', query_to_xml(
      format('select count(*) as c from %I.%I', l.table_schema, l.table_name),
      false, true, '')))[1]::text::bigint
  end as row_count
from live l
full outer join expected e
  on e.table_schema = l.table_schema and e.table_name = l.table_name
order by status desc, edition, table_name;


-- ===========================================================================
-- Q2. Columns of the public schema, compared with the repo.
--     status = 'MISSING in database' / 'NOT in repo' / 'ok'
-- ===========================================================================
with expected(table_name, column_name) as (
  values
    ('aspire_profiles','id'),('aspire_profiles','display_name'),('aspire_profiles','status'),
    ('aspire_profiles','created_at'),('aspire_profiles','updated_at'),('aspire_profiles','is_admin'),
    ('aspire_cities','id'),('aspire_cities','code'),('aspire_cities','name'),
    ('aspire_cities','is_active'),('aspire_cities','created_at'),
    ('aspire_groups','id'),('aspire_groups','group_code'),('aspire_groups','group_name'),
    ('aspire_groups','is_active'),('aspire_groups','created_at'),
    ('aspire_user_access','id'),('aspire_user_access','user_id'),('aspire_user_access','city_id'),
    ('aspire_user_access','group_id'),('aspire_user_access','access_role'),('aspire_user_access','created_at'),
    ('aspire_group_logos','id'),('aspire_group_logos','group_id'),('aspire_group_logos','storage_path'),
    ('aspire_group_logos','file_name'),('aspire_group_logos','content_type'),('aspire_group_logos','file_size_bytes'),
    ('aspire_group_logos','uploaded_by'),('aspire_group_logos','is_active'),('aspire_group_logos','created_at'),
    ('aspire_login_events','id'),('aspire_login_events','user_id'),('aspire_login_events','email'),
    ('aspire_login_events','city_id'),('aspire_login_events','group_id'),('aspire_login_events','succeeded'),
    ('aspire_login_events','failure_reason'),('aspire_login_events','created_at'),
    ('aspire_submissions','id'),('aspire_submissions','group_id'),('aspire_submissions','storage_path'),
    ('aspire_submissions','file_name'),('aspire_submissions','content_type'),('aspire_submissions','file_size_bytes'),
    ('aspire_submissions','demo_link'),('aspire_submissions','submitted_by'),('aspire_submissions','created_at'),
    ('aspire_submissions','updated_at'),
    ('aspire_coach_messages','id'),('aspire_coach_messages','user_id'),('aspire_coach_messages','group_id'),
    ('aspire_coach_messages','conversation_id'),('aspire_coach_messages','question'),('aspire_coach_messages','answer'),
    ('aspire_coach_messages','created_at'),('aspire_coach_messages','agent_name'),
    ('aspire_team_progress','group_id'),('aspire_team_progress','phase_key'),
    ('aspire_team_progress','completed_by'),('aspire_team_progress','completed_at'),
    ('aspire_dallas_event_codes','id'),('aspire_dallas_event_codes','code'),
    ('aspire_dallas_event_codes','is_active'),('aspire_dallas_event_codes','created_at'),
    ('aspire_dallas_teams','id'),('aspire_dallas_teams','team_number'),('aspire_dallas_teams','name'),
    ('aspire_dallas_teams','is_active'),('aspire_dallas_teams','created_at'),
    ('aspire_dallas_students','user_id'),('aspire_dallas_students','email'),('aspire_dallas_students','first_name'),
    ('aspire_dallas_students','last_name'),('aspire_dallas_students','team_id'),
    ('aspire_dallas_students','profile_completed_at'),('aspire_dallas_students','created_at'),
    ('aspire_dallas_students','updated_at'),
    ('aspire_dallas_team_phases','team_id'),('aspire_dallas_team_phases','phase'),('aspire_dallas_team_phases','answers'),
    ('aspire_dallas_team_phases','started_at'),('aspire_dallas_team_phases','completed_at'),
    ('aspire_dallas_team_phases','completed_by'),('aspire_dallas_team_phases','updated_by'),
    ('aspire_dallas_team_phases','updated_at'),
    ('aspire_dallas_submissions','id'),('aspire_dallas_submissions','team_id'),('aspire_dallas_submissions','storage_path'),
    ('aspire_dallas_submissions','file_name'),('aspire_dallas_submissions','content_type'),
    ('aspire_dallas_submissions','file_size_bytes'),('aspire_dallas_submissions','demo_link'),
    ('aspire_dallas_submissions','submitted_by'),('aspire_dallas_submissions','created_at'),
    ('aspire_dallas_submissions','updated_at')
),
live as (
  select table_name, column_name, ordinal_position, data_type, is_nullable
  from information_schema.columns
  where table_schema = 'public'
)
select
  coalesce(l.table_name, e.table_name)   as table_name,
  coalesce(l.column_name, e.column_name) as column_name,
  l.data_type,
  l.is_nullable,
  case
    when l.column_name is null then 'MISSING in database'
    when e.column_name is null then 'NOT in repo'
    else 'ok'
  end as status
from live l
full outer join expected e
  on e.table_name = l.table_name and e.column_name = l.column_name
order by status desc, table_name, l.ordinal_position nulls last;


-- ===========================================================================
-- Q3. Anything outside the repo: every table/view in a non-system schema
--     that is not one of the repo's tables (judging, prompts, surveys, ...
--     built directly in Supabase or by another app would show up here).
-- ===========================================================================
select n.nspname as table_schema,
       c.relname as object_name,
       case c.relkind when 'r' then 'table' when 'v' then 'view'
                      when 'm' then 'materialized view' when 'p' then 'partitioned table' end as kind,
       c.reltuples::bigint as approx_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'v', 'm', 'p')
  and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast', 'auth', 'storage',
                        'realtime', '_realtime', 'vault', 'extensions', 'graphql', 'graphql_public',
                        'supabase_functions', 'supabase_migrations', 'pgsodium', 'pgsodium_masks',
                        'net', 'cron', 'pgbouncer', '_analytics', 'pgmq')
  and not (n.nspname = 'public' and c.relname in (
        'aspire_profiles', 'aspire_cities', 'aspire_coach_messages', 'aspire_groups',
        'aspire_user_access', 'aspire_team_progress', 'aspire_submissions', 'aspire_login_events',
        'aspire_group_logos', 'aspire_dallas_event_codes', 'aspire_dallas_teams',
        'aspire_dallas_students', 'aspire_dallas_team_phases', 'aspire_dallas_submissions'))
order by 1, 2;


-- ===========================================================================
-- Q4. Columns anywhere (outside system schemas) whose names suggest data the
--     report wants but the repo does not have. Empty result = confirmed gap.
-- ===========================================================================
select table_schema, table_name, column_name, data_type
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
                           '_realtime', 'vault', 'extensions', 'graphql', 'graphql_public',
                           'supabase_functions', 'supabase_migrations', 'pgsodium',
                           'pgsodium_masks', 'net', 'cron', 'pgbouncer', '_analytics', 'pgmq')
  and column_name ~* '(judg|score|rubric|prompt|survey|feedback|rating|rank|winner|reflect|mentor|volunteer|company|industry|universit|school|major|graduat|academic|demograph|gender|ethnic|consent|token|budget|alloc|percent)'
order by 1, 2, 3;


-- ===========================================================================
-- Q5. Accounts by edition and test/organizer signal (counts only, no emails).
--     Use this to agree on the exclusion rules before any export.
-- ===========================================================================
select
  case
    when u.raw_app_meta_data ->> 'aspire_city' = 'DFW' then 'Dallas (app_metadata DFW)'
    when exists (select 1 from public.aspire_user_access a join public.aspire_cities c on c.id = a.city_id
                 where a.user_id = u.id and c.code = 'NYC') then 'New York (NYC access)'
    when exists (select 1 from public.aspire_user_access a join public.aspire_cities c on c.id = a.city_id
                 where a.user_id = u.id and c.code = 'DFW') then 'DFW access via 002 (legacy, not Dallas app)'
    else 'no edition'
  end as edition,
  exists (select 1 from public.aspire_dallas_students s where s.user_id = u.id) as has_dallas_student_row,
  coalesce(p.is_admin, false) as is_admin,
  coalesce(p.status, '(no profile)') as profile_status,
  case
    when u.email ~ '^loadtest[0-9]{2}@test\.lead$' then 'loadtest account'
    when lower(u.email) in ('student.ny@leadmindset.org', 'student.dallas@leadmindset.org') then 'seed demo account'
    when u.email ilike '%@leadmindset.org' then '@leadmindset.org (staff?)'
    when u.email ~* '@(example\.(org|com|net)|test\.[a-z]+)$' then 'test domain'
    else 'other'
  end as account_signal,
  count(*) as accounts,
  min(u.created_at) as first_created,
  max(u.created_at) as last_created,
  count(u.last_sign_in_at) as ever_signed_in
from auth.users u
left join public.aspire_profiles p on p.id = u.id
group by 1, 2, 3, 4, 5
order by 1, 5, 3;


-- ===========================================================================
-- Q6. Activity per day, per edition, to see the event day(s) and any
--     rehearsal/test days that must be excluded. Dates in America/Chicago.
-- ===========================================================================
select 'Dallas: student first login' as activity,
       (created_at at time zone 'America/Chicago')::date as day, count(*) as n
from public.aspire_dallas_students group by 1, 2
union all
select 'Dallas: phase opened', (started_at at time zone 'America/Chicago')::date, count(*)
from public.aspire_dallas_team_phases where started_at is not null group by 1, 2
union all
select 'Dallas: deck submitted', (updated_at at time zone 'America/Chicago')::date, count(*)
from public.aspire_dallas_submissions group by 1, 2
union all
select 'NY: login event', (created_at at time zone 'America/Chicago')::date, count(*)
from public.aspire_login_events group by 1, 2
union all
select 'NY: phase completed', (completed_at at time zone 'America/Chicago')::date, count(*)
from public.aspire_team_progress group by 1, 2
union all
select 'NY: deck submitted', (updated_at at time zone 'America/Chicago')::date, count(*)
from public.aspire_submissions group by 1, 2
union all
select 'Agent message: ' || coalesce(agent_name, '(agent_name null)'),
       (created_at at time zone 'America/Chicago')::date, count(*)
from public.aspire_coach_messages group by 1, 2
order by day, activity;


-- ===========================================================================
-- Q7. Dallas phase values and the live phase check constraint (should be
--     the 011 list: team, discover, strategize, design, pitch).
-- ===========================================================================
select 'row count' as what, phase as value, count(*)::text as detail
from public.aspire_dallas_team_phases group by phase
union all
select 'constraint', conname, pg_get_constraintdef(oid)
from pg_constraint
where conname = 'aspire_dallas_team_phases_phase_check'
order by 1, 2;


-- ===========================================================================
-- Q8. Answer keys actually present in Dallas team answers (key prefix per
--     phase), to confirm the map's decoding of the jsonb.
-- ===========================================================================
select p.phase,
       regexp_replace(k.key, '_.*$', '_*') as key_pattern,
       count(*) as occurrences,
       count(distinct p.team_id) as teams
from public.aspire_dallas_team_phases p
cross join lateral jsonb_object_keys(p.answers) as k(key)
group by 1, 2
order by 1, 2;


-- ===========================================================================
-- Q9. Storage: deck files per edition prefix (metadata only). Only the
--     aspire-team-submissions bucket; aspire-group-logos is excluded from
--     the report.
-- ===========================================================================
select case when name like 'DFW-team-%' then 'Dallas'
            when name like 'NYC-%' then 'New York'
            else 'other' end as edition,
       count(*) as files,
       min(created_at) as first_upload,
       max(created_at) as last_upload
from storage.objects
where bucket_id = 'aspire-team-submissions'
group by 1
order by 1;
