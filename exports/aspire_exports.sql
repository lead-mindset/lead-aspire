-- LEAD Aspire Impact Report: export queries.
--
-- READ ONLY: every statement is a SELECT. Run ONE query at a time in the
-- Supabase SQL Editor (it shows only the last result), or with the export
-- script. See exports/SCHEMA_MAP.md for what each table means.
--
-- Excluded on purpose: the aspire-group-logos bucket and the
-- aspire_group_logos table (team logos are not evidence of student work).
-- Never selected: passwords, tokens, event codes.


-- ###########################################################################
-- SUBMISSIONS: Storage bucket aspire-team-submissions (both editions)
-- ###########################################################################
--
-- Both editions put their decks in one bucket, with the same meaning
-- (a team's final deck), so these queries are combined with an `edition`
-- column instead of being split. The edition comes from the folder:
--   New York: <group_code>/<epoch>-[<hex8>-]<file>  (routes.py: create_submission_upload_url, _store_submission)
--   Dallas:   DFW-team-<aspire_dallas_teams.id>/<epoch>-<hex8>-<file>  (dallas_submission.py)
--
-- Every query starts with the same prelude (keep the copies identical):
--   excluded_users  test, demo and organizer accounts, with the reason.
--                   The '@leadmindset.org' rule is PENDING your confirmation.
--   members         who is on each team (NY: aspire_user_access in NYC; Dallas: aspire_dallas_students).
--   records         the deck tables: aspire_submissions (NY) + aspire_dallas_submissions (Dallas).
--   team_status     every team, with excluded_reason (null = counts in the report):
--                     load-test group (NYC-LOADTEST-*), or every member is an
--                     excluded user, or the deck record was saved by an excluded user.
--   files           objects in aspire-team-submissions.
--   file_rows       files + team + whether the file is the team's current deck record.
--
-- Caveats for the whole section:
--   * Who uploaded a file is unknown: storage.objects.owner is not set by
--     these flows (the backend's service key or a backend-signed upload URL),
--     so exclusion is decided per TEAM, not per file.
--   * Confirming a new deck DELETES the previous file (routes.py _save_deck,
--     dallas_submission.py confirm_submission). Storage therefore keeps the
--     current deck plus leftovers only: uploads never confirmed, or old files
--     whose removal failed. File counts undercount resubmissions; deck
--     records keep only the first (created_at) and last (updated_at) save.
--   * The deck record's updated_at also moves when only the demo link changes.
--   * File names are typed by students and can contain personal names.


-- ===========================================================================
-- SUB-1. Files per team
-- Purpose:        Files in Storage per team, first and last upload, resubmission flag.
-- Edition:        Combined (edition column).
-- Report section: D. Student work; A. Participation (teams that submitted).
-- Caveats:        resubmission_flag = more than one file in Storage. Because a
--                 confirmed resubmission deletes the old file, this flag is a
--                 lower bound and can also mean an unconfirmed upload. Use
--                 deck_first_saved vs deck_last_saved as a second signal.
--                 Test teams are kept and flagged in excluded_reason.
-- ===========================================================================
with excluded_users as (
  select user_id, reason
  from (
    select u.id as user_id,
      case
        when coalesce(p.is_admin, false) then 'organizer (is_admin)'
        when u.email ~ '^loadtest[0-9]{2}@test\.lead$' then 'loadtest account'
        when lower(u.email) in ('student.ny@leadmindset.org', 'student.dallas@leadmindset.org') then 'seed demo account'
        when u.email ~* '@(example\.(org|com|net)|test\.[a-z]+)$' then 'test email domain'
        when u.email ilike '%@leadmindset.org' then '@leadmindset.org (PENDING confirmation)'
      end as reason
    from auth.users u
    left join public.aspire_profiles p on p.id = u.id
  ) x
  where reason is not null
),
members as (
  select 'NYC:' || a.group_id as team_key, a.user_id
  from public.aspire_user_access a
  join public.aspire_cities c on c.id = a.city_id and c.code = 'NYC'
  where a.group_id is not null
  union
  select 'DFW:' || s.team_id, s.user_id
  from public.aspire_dallas_students s
  where s.team_id is not null
),
records as (
  select 'New York' as edition, 'NYC:' || s.group_id as team_key, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_submissions s
  union all
  select 'Dallas', 'DFW:' || s.team_id, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_dallas_submissions s
),
teams as (
  select 'New York' as edition, 'NYC:' || g.id as team_key,
         array[g.group_code, g.id::text] as folders,
         g.group_code as team_label, g.group_name as team_name,
         g.group_code like 'NYC-LOADTEST-%' as is_load_test_team
  from public.aspire_groups g
  where g.group_code like 'NYC-%'
  union all
  select 'Dallas', 'DFW:' || t.id, array['DFW-team-' || t.id],
         'Team ' || t.team_number, tp.answers ->> 'display_name', false
  from public.aspire_dallas_teams t
  left join public.aspire_dallas_team_phases tp on tp.team_id = t.id and tp.phase = 'team'
),
team_status as (
  select t.*,
    case
      when t.is_load_test_team then 'load-test team'
      when t.members > 0 and t.members = t.excluded_members then 'all team members are excluded users'
      when t.submitter_reason is not null then 'deck record saved by excluded user: ' || t.submitter_reason
    end as excluded_reason
  from (
    select tm.*,
      (select count(*) from members m where m.team_key = tm.team_key) as members,
      (select count(*) from members m join excluded_users e on e.user_id = m.user_id
        where m.team_key = tm.team_key) as excluded_members,
      (select e.reason from records r join excluded_users e on e.user_id = r.submitted_by
        where r.team_key = tm.team_key) as submitter_reason
    from teams tm
  ) t
),
files as (
  select o.name as storage_path,
         split_part(o.name, '/', 1) as folder,
         regexp_replace(o.name, '^[^/]+/[0-9]+-([0-9a-f]{8}-)?', '') as file_name,
         o.metadata ->> 'mimetype' as file_type,
         (o.metadata ->> 'size')::bigint as size_bytes,
         o.created_at as uploaded_at
  from storage.objects o
  where o.bucket_id = 'aspire-team-submissions'
    and o.name not like '%.emptyFolderPlaceholder'
),
file_rows as (
  select f.*,
         coalesce(ts.edition, 'unknown folder') as edition,
         ts.team_key, ts.team_label, ts.team_name, ts.members, ts.excluded_members,
         ts.excluded_reason,
         r.storage_path is not null as is_current_deck_record
  from files f
  left join team_status ts on f.folder = any(ts.folders)
  left join records r on r.storage_path = f.storage_path
)
select fr.edition,
       coalesce(fr.team_label, '(no team) ' || min(fr.folder)) as team,
       fr.team_name,
       count(*) as files,
       min(fr.uploaded_at) as first_upload,
       max(fr.uploaded_at) as last_upload,
       count(*) > 1 as resubmission_flag,
       count(*) filter (where not fr.is_current_deck_record) as files_not_current_deck,
       r.created_at as deck_first_saved,
       r.updated_at as deck_last_saved,
       fr.excluded_reason
from file_rows fr
left join records r on r.team_key = fr.team_key
group by fr.edition, coalesce(fr.team_key, 'folder:' || fr.folder), fr.team_label, fr.team_name,
         r.created_at, r.updated_at, fr.excluded_reason
order by fr.edition, length(fr.team_label), fr.team_label;


-- ===========================================================================
-- SUB-2. Final submission per team (latest file in Storage)
-- Purpose:        The newest file per team: path, file name, type, size, upload time.
-- Edition:        Combined (edition column).
-- Report section: D. Student work (final solutions).
-- Caveats:        "Latest file" can be an upload the team never confirmed.
--                 is_current_deck_record says whether it is the deck the app
--                 shows as submitted; deck_record_file_name is the original
--                 name the student uploaded. Where they differ, SUB-5 explains.
--                 file_type is the type the browser declared on upload.
-- ===========================================================================
with excluded_users as (
  select user_id, reason
  from (
    select u.id as user_id,
      case
        when coalesce(p.is_admin, false) then 'organizer (is_admin)'
        when u.email ~ '^loadtest[0-9]{2}@test\.lead$' then 'loadtest account'
        when lower(u.email) in ('student.ny@leadmindset.org', 'student.dallas@leadmindset.org') then 'seed demo account'
        when u.email ~* '@(example\.(org|com|net)|test\.[a-z]+)$' then 'test email domain'
        when u.email ilike '%@leadmindset.org' then '@leadmindset.org (PENDING confirmation)'
      end as reason
    from auth.users u
    left join public.aspire_profiles p on p.id = u.id
  ) x
  where reason is not null
),
members as (
  select 'NYC:' || a.group_id as team_key, a.user_id
  from public.aspire_user_access a
  join public.aspire_cities c on c.id = a.city_id and c.code = 'NYC'
  where a.group_id is not null
  union
  select 'DFW:' || s.team_id, s.user_id
  from public.aspire_dallas_students s
  where s.team_id is not null
),
records as (
  select 'New York' as edition, 'NYC:' || s.group_id as team_key, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_submissions s
  union all
  select 'Dallas', 'DFW:' || s.team_id, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_dallas_submissions s
),
teams as (
  select 'New York' as edition, 'NYC:' || g.id as team_key,
         array[g.group_code, g.id::text] as folders,
         g.group_code as team_label, g.group_name as team_name,
         g.group_code like 'NYC-LOADTEST-%' as is_load_test_team
  from public.aspire_groups g
  where g.group_code like 'NYC-%'
  union all
  select 'Dallas', 'DFW:' || t.id, array['DFW-team-' || t.id],
         'Team ' || t.team_number, tp.answers ->> 'display_name', false
  from public.aspire_dallas_teams t
  left join public.aspire_dallas_team_phases tp on tp.team_id = t.id and tp.phase = 'team'
),
team_status as (
  select t.*,
    case
      when t.is_load_test_team then 'load-test team'
      when t.members > 0 and t.members = t.excluded_members then 'all team members are excluded users'
      when t.submitter_reason is not null then 'deck record saved by excluded user: ' || t.submitter_reason
    end as excluded_reason
  from (
    select tm.*,
      (select count(*) from members m where m.team_key = tm.team_key) as members,
      (select count(*) from members m join excluded_users e on e.user_id = m.user_id
        where m.team_key = tm.team_key) as excluded_members,
      (select e.reason from records r join excluded_users e on e.user_id = r.submitted_by
        where r.team_key = tm.team_key) as submitter_reason
    from teams tm
  ) t
),
files as (
  select o.name as storage_path,
         split_part(o.name, '/', 1) as folder,
         regexp_replace(o.name, '^[^/]+/[0-9]+-([0-9a-f]{8}-)?', '') as file_name,
         o.metadata ->> 'mimetype' as file_type,
         (o.metadata ->> 'size')::bigint as size_bytes,
         o.created_at as uploaded_at
  from storage.objects o
  where o.bucket_id = 'aspire-team-submissions'
    and o.name not like '%.emptyFolderPlaceholder'
),
file_rows as (
  select f.*,
         coalesce(ts.edition, 'unknown folder') as edition,
         ts.team_key, ts.team_label, ts.team_name, ts.members, ts.excluded_members,
         ts.excluded_reason,
         r.storage_path is not null as is_current_deck_record
  from files f
  left join team_status ts on f.folder = any(ts.folders)
  left join records r on r.storage_path = f.storage_path
),
latest as (
  select distinct on (coalesce(team_key, 'folder:' || folder)) *
  from file_rows
  order by coalesce(team_key, 'folder:' || folder), uploaded_at desc
)
select l.edition,
       coalesce(l.team_label, '(no team) ' || l.folder) as team,
       l.team_name,
       l.storage_path,
       l.file_name,
       l.file_type,
       l.size_bytes,
       l.uploaded_at,
       l.is_current_deck_record,
       r.file_name as deck_record_file_name,
       r.updated_at as deck_record_saved_at,
       l.excluded_reason
from latest l
left join records r on r.team_key = l.team_key
order by l.edition, length(l.team_label), l.team_label;


-- ===========================================================================
-- SUB-3. Uploads by day and hour, per edition
-- Purpose:        Separate event-day uploads from rehearsal, testing and late ones.
-- Edition:        Combined (edition column); each edition in its local time
--                 (Dallas America/Chicago, New York America/New_York).
-- Report section: I. Timeline; D. Student work.
-- Caveats:        Only files still in Storage: decks replaced by a confirmed
--                 resubmission were deleted and are missing from this
--                 distribution. files_excluded = files of excluded teams.
-- ===========================================================================
with excluded_users as (
  select user_id, reason
  from (
    select u.id as user_id,
      case
        when coalesce(p.is_admin, false) then 'organizer (is_admin)'
        when u.email ~ '^loadtest[0-9]{2}@test\.lead$' then 'loadtest account'
        when lower(u.email) in ('student.ny@leadmindset.org', 'student.dallas@leadmindset.org') then 'seed demo account'
        when u.email ~* '@(example\.(org|com|net)|test\.[a-z]+)$' then 'test email domain'
        when u.email ilike '%@leadmindset.org' then '@leadmindset.org (PENDING confirmation)'
      end as reason
    from auth.users u
    left join public.aspire_profiles p on p.id = u.id
  ) x
  where reason is not null
),
members as (
  select 'NYC:' || a.group_id as team_key, a.user_id
  from public.aspire_user_access a
  join public.aspire_cities c on c.id = a.city_id and c.code = 'NYC'
  where a.group_id is not null
  union
  select 'DFW:' || s.team_id, s.user_id
  from public.aspire_dallas_students s
  where s.team_id is not null
),
records as (
  select 'New York' as edition, 'NYC:' || s.group_id as team_key, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_submissions s
  union all
  select 'Dallas', 'DFW:' || s.team_id, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_dallas_submissions s
),
teams as (
  select 'New York' as edition, 'NYC:' || g.id as team_key,
         array[g.group_code, g.id::text] as folders,
         g.group_code as team_label, g.group_name as team_name,
         g.group_code like 'NYC-LOADTEST-%' as is_load_test_team
  from public.aspire_groups g
  where g.group_code like 'NYC-%'
  union all
  select 'Dallas', 'DFW:' || t.id, array['DFW-team-' || t.id],
         'Team ' || t.team_number, tp.answers ->> 'display_name', false
  from public.aspire_dallas_teams t
  left join public.aspire_dallas_team_phases tp on tp.team_id = t.id and tp.phase = 'team'
),
team_status as (
  select t.*,
    case
      when t.is_load_test_team then 'load-test team'
      when t.members > 0 and t.members = t.excluded_members then 'all team members are excluded users'
      when t.submitter_reason is not null then 'deck record saved by excluded user: ' || t.submitter_reason
    end as excluded_reason
  from (
    select tm.*,
      (select count(*) from members m where m.team_key = tm.team_key) as members,
      (select count(*) from members m join excluded_users e on e.user_id = m.user_id
        where m.team_key = tm.team_key) as excluded_members,
      (select e.reason from records r join excluded_users e on e.user_id = r.submitted_by
        where r.team_key = tm.team_key) as submitter_reason
    from teams tm
  ) t
),
files as (
  select o.name as storage_path,
         split_part(o.name, '/', 1) as folder,
         regexp_replace(o.name, '^[^/]+/[0-9]+-([0-9a-f]{8}-)?', '') as file_name,
         o.metadata ->> 'mimetype' as file_type,
         (o.metadata ->> 'size')::bigint as size_bytes,
         o.created_at as uploaded_at
  from storage.objects o
  where o.bucket_id = 'aspire-team-submissions'
    and o.name not like '%.emptyFolderPlaceholder'
),
file_rows as (
  select f.*,
         coalesce(ts.edition, 'unknown folder') as edition,
         ts.team_key, ts.team_label, ts.team_name, ts.members, ts.excluded_members,
         ts.excluded_reason,
         r.storage_path is not null as is_current_deck_record
  from files f
  left join team_status ts on f.folder = any(ts.folders)
  left join records r on r.storage_path = f.storage_path
),
localized as (
  select fr.*,
         case fr.edition when 'Dallas' then 'America/Chicago'
                         when 'New York' then 'America/New_York'
                         else 'UTC' end as time_zone
  from file_rows fr
)
select edition,
       time_zone,
       (uploaded_at at time zone time_zone)::date as local_day,
       extract(hour from uploaded_at at time zone time_zone)::int as local_hour,
       count(*) as files,
       count(*) filter (where excluded_reason is null) as files_included,
       count(*) filter (where excluded_reason is not null) as files_excluded,
       count(distinct team_key) filter (where excluded_reason is null) as teams_included,
       count(*) filter (where is_current_deck_record) as files_that_are_current_deck
from localized
group by 1, 2, 3, 4
order by 1, 3, 4;


-- ===========================================================================
-- SUB-4. Uploads by excluded users (test files made visible)
-- Purpose:        Every file that SUB-6 filters out, with the reason, plus
--                 files kept but worth a look (team with some excluded
--                 members, or a folder that matches no team).
-- Edition:        Combined (edition column).
-- Report section: Validation (README); not for the report body.
-- Caveats:        Exclusion is per team (see section caveats). filtered_out =
--                 true means the file's team is left out of every count.
--                 The '@leadmindset.org' rule is pending confirmation.
-- ===========================================================================
with excluded_users as (
  select user_id, reason
  from (
    select u.id as user_id,
      case
        when coalesce(p.is_admin, false) then 'organizer (is_admin)'
        when u.email ~ '^loadtest[0-9]{2}@test\.lead$' then 'loadtest account'
        when lower(u.email) in ('student.ny@leadmindset.org', 'student.dallas@leadmindset.org') then 'seed demo account'
        when u.email ~* '@(example\.(org|com|net)|test\.[a-z]+)$' then 'test email domain'
        when u.email ilike '%@leadmindset.org' then '@leadmindset.org (PENDING confirmation)'
      end as reason
    from auth.users u
    left join public.aspire_profiles p on p.id = u.id
  ) x
  where reason is not null
),
members as (
  select 'NYC:' || a.group_id as team_key, a.user_id
  from public.aspire_user_access a
  join public.aspire_cities c on c.id = a.city_id and c.code = 'NYC'
  where a.group_id is not null
  union
  select 'DFW:' || s.team_id, s.user_id
  from public.aspire_dallas_students s
  where s.team_id is not null
),
records as (
  select 'New York' as edition, 'NYC:' || s.group_id as team_key, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_submissions s
  union all
  select 'Dallas', 'DFW:' || s.team_id, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_dallas_submissions s
),
teams as (
  select 'New York' as edition, 'NYC:' || g.id as team_key,
         array[g.group_code, g.id::text] as folders,
         g.group_code as team_label, g.group_name as team_name,
         g.group_code like 'NYC-LOADTEST-%' as is_load_test_team
  from public.aspire_groups g
  where g.group_code like 'NYC-%'
  union all
  select 'Dallas', 'DFW:' || t.id, array['DFW-team-' || t.id],
         'Team ' || t.team_number, tp.answers ->> 'display_name', false
  from public.aspire_dallas_teams t
  left join public.aspire_dallas_team_phases tp on tp.team_id = t.id and tp.phase = 'team'
),
team_status as (
  select t.*,
    case
      when t.is_load_test_team then 'load-test team'
      when t.members > 0 and t.members = t.excluded_members then 'all team members are excluded users'
      when t.submitter_reason is not null then 'deck record saved by excluded user: ' || t.submitter_reason
    end as excluded_reason
  from (
    select tm.*,
      (select count(*) from members m where m.team_key = tm.team_key) as members,
      (select count(*) from members m join excluded_users e on e.user_id = m.user_id
        where m.team_key = tm.team_key) as excluded_members,
      (select e.reason from records r join excluded_users e on e.user_id = r.submitted_by
        where r.team_key = tm.team_key) as submitter_reason
    from teams tm
  ) t
),
files as (
  select o.name as storage_path,
         split_part(o.name, '/', 1) as folder,
         regexp_replace(o.name, '^[^/]+/[0-9]+-([0-9a-f]{8}-)?', '') as file_name,
         o.metadata ->> 'mimetype' as file_type,
         (o.metadata ->> 'size')::bigint as size_bytes,
         o.created_at as uploaded_at
  from storage.objects o
  where o.bucket_id = 'aspire-team-submissions'
    and o.name not like '%.emptyFolderPlaceholder'
),
file_rows as (
  select f.*,
         coalesce(ts.edition, 'unknown folder') as edition,
         ts.team_key, ts.team_label, ts.team_name, ts.members, ts.excluded_members,
         ts.excluded_reason,
         r.storage_path is not null as is_current_deck_record
  from files f
  left join team_status ts on f.folder = any(ts.folders)
  left join records r on r.storage_path = f.storage_path
)
select excluded_reason is not null as filtered_out,
       excluded_reason,
       case
         when edition = 'unknown folder' then 'folder matches no team: kept, review by hand'
         when excluded_reason is null and excluded_members > 0
           then 'team has ' || excluded_members || ' excluded member(s) of ' || members || ': kept'
       end as review_note,
       edition,
       coalesce(team_label, '(no team) ' || folder) as team,
       team_name,
       storage_path,
       file_name,
       uploaded_at,
       is_current_deck_record
from file_rows
where excluded_reason is not null
   or excluded_members > 0
   or edition = 'unknown folder'
order by filtered_out desc, edition, team, uploaded_at;


-- ===========================================================================
-- SUB-5. Storage files vs deck records: mismatches
-- Purpose:        Reconcile Storage with aspire_submissions (NY) and
--                 aspire_dallas_submissions (Dallas).
-- Edition:        Combined (edition column; for a record, the table it is in).
-- Report section: Validation (README).
-- Caveats:        'file with no deck record' is expected for uploads never
--                 confirmed and for old files whose removal failed; it is not
--                 necessarily an error. 'deck record with no file' means the
--                 team's submitted deck is gone from Storage. Size and type
--                 are compared with what Storage recorded on upload.
-- ===========================================================================
with excluded_users as (
  select user_id, reason
  from (
    select u.id as user_id,
      case
        when coalesce(p.is_admin, false) then 'organizer (is_admin)'
        when u.email ~ '^loadtest[0-9]{2}@test\.lead$' then 'loadtest account'
        when lower(u.email) in ('student.ny@leadmindset.org', 'student.dallas@leadmindset.org') then 'seed demo account'
        when u.email ~* '@(example\.(org|com|net)|test\.[a-z]+)$' then 'test email domain'
        when u.email ilike '%@leadmindset.org' then '@leadmindset.org (PENDING confirmation)'
      end as reason
    from auth.users u
    left join public.aspire_profiles p on p.id = u.id
  ) x
  where reason is not null
),
members as (
  select 'NYC:' || a.group_id as team_key, a.user_id
  from public.aspire_user_access a
  join public.aspire_cities c on c.id = a.city_id and c.code = 'NYC'
  where a.group_id is not null
  union
  select 'DFW:' || s.team_id, s.user_id
  from public.aspire_dallas_students s
  where s.team_id is not null
),
records as (
  select 'New York' as edition, 'NYC:' || s.group_id as team_key, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_submissions s
  union all
  select 'Dallas', 'DFW:' || s.team_id, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_dallas_submissions s
),
teams as (
  select 'New York' as edition, 'NYC:' || g.id as team_key,
         array[g.group_code, g.id::text] as folders,
         g.group_code as team_label, g.group_name as team_name,
         g.group_code like 'NYC-LOADTEST-%' as is_load_test_team
  from public.aspire_groups g
  where g.group_code like 'NYC-%'
  union all
  select 'Dallas', 'DFW:' || t.id, array['DFW-team-' || t.id],
         'Team ' || t.team_number, tp.answers ->> 'display_name', false
  from public.aspire_dallas_teams t
  left join public.aspire_dallas_team_phases tp on tp.team_id = t.id and tp.phase = 'team'
),
team_status as (
  select t.*,
    case
      when t.is_load_test_team then 'load-test team'
      when t.members > 0 and t.members = t.excluded_members then 'all team members are excluded users'
      when t.submitter_reason is not null then 'deck record saved by excluded user: ' || t.submitter_reason
    end as excluded_reason
  from (
    select tm.*,
      (select count(*) from members m where m.team_key = tm.team_key) as members,
      (select count(*) from members m join excluded_users e on e.user_id = m.user_id
        where m.team_key = tm.team_key) as excluded_members,
      (select e.reason from records r join excluded_users e on e.user_id = r.submitted_by
        where r.team_key = tm.team_key) as submitter_reason
    from teams tm
  ) t
),
files as (
  select o.name as storage_path,
         split_part(o.name, '/', 1) as folder,
         regexp_replace(o.name, '^[^/]+/[0-9]+-([0-9a-f]{8}-)?', '') as file_name,
         o.metadata ->> 'mimetype' as file_type,
         (o.metadata ->> 'size')::bigint as size_bytes,
         o.created_at as uploaded_at
  from storage.objects o
  where o.bucket_id = 'aspire-team-submissions'
    and o.name not like '%.emptyFolderPlaceholder'
),
file_rows as (
  select f.*,
         coalesce(ts.edition, 'unknown folder') as edition,
         ts.team_key, ts.team_label, ts.team_name, ts.members, ts.excluded_members,
         ts.excluded_reason,
         r.storage_path is not null as is_current_deck_record
  from files f
  left join team_status ts on f.folder = any(ts.folders)
  left join records r on r.storage_path = f.storage_path
)
select
  case
    when r.storage_path is null then 'file with no deck record'
    when f.storage_path is null then 'deck record with no file'
    when f.edition <> r.edition then 'edition mismatch (folder vs table)'
    when f.size_bytes is distinct from r.file_size_bytes then 'size mismatch'
    when f.file_type is distinct from r.content_type then 'type mismatch'
    else 'ok'
  end as status,
  coalesce(r.edition, f.edition) as edition,
  coalesce(ts.team_label, f.team_label, '(no team) ' || f.folder) as team,
  coalesce(ts.excluded_reason, f.excluded_reason) as excluded_reason,
  coalesce(f.storage_path, r.storage_path) as storage_path,
  f.file_name as storage_file_name,
  r.file_name as deck_record_file_name,
  f.size_bytes as storage_size_bytes,
  r.file_size_bytes as deck_record_size_bytes,
  f.file_type as storage_file_type,
  r.content_type as deck_record_content_type,
  f.uploaded_at,
  r.updated_at as deck_record_saved_at
from file_rows f
full outer join records r on r.storage_path = f.storage_path
left join team_status ts on ts.team_key = r.team_key
order by (case when r.storage_path is null or f.storage_path is null then 0 else 1 end),
         status, edition, team;


-- ===========================================================================
-- SUB-6. Teams with a submission, per edition (headline numbers)
-- Purpose:        DISTINCT TEAMS with a submission per edition, not file counts.
-- Edition:        One row per edition. Not added together: NY and Dallas
--                 are separate events.
-- Report section: A. Participation; D. Student work.
-- Caveats:        Excluded teams are left out of the first three columns and
--                 counted in the last one. Three definitions are given
--                 because they can disagree (see SUB-5); the report should
--                 name the one it uses:
--                   teams_with_deck_record      the app considers the team submitted
--                   teams_with_file             any file in the team's folder
--                   teams_with_record_and_file  the recorded deck still exists
--                 Files in folders that match no team (SUB-4) are not counted.
-- ===========================================================================
with excluded_users as (
  select user_id, reason
  from (
    select u.id as user_id,
      case
        when coalesce(p.is_admin, false) then 'organizer (is_admin)'
        when u.email ~ '^loadtest[0-9]{2}@test\.lead$' then 'loadtest account'
        when lower(u.email) in ('student.ny@leadmindset.org', 'student.dallas@leadmindset.org') then 'seed demo account'
        when u.email ~* '@(example\.(org|com|net)|test\.[a-z]+)$' then 'test email domain'
        when u.email ilike '%@leadmindset.org' then '@leadmindset.org (PENDING confirmation)'
      end as reason
    from auth.users u
    left join public.aspire_profiles p on p.id = u.id
  ) x
  where reason is not null
),
members as (
  select 'NYC:' || a.group_id as team_key, a.user_id
  from public.aspire_user_access a
  join public.aspire_cities c on c.id = a.city_id and c.code = 'NYC'
  where a.group_id is not null
  union
  select 'DFW:' || s.team_id, s.user_id
  from public.aspire_dallas_students s
  where s.team_id is not null
),
records as (
  select 'New York' as edition, 'NYC:' || s.group_id as team_key, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_submissions s
  union all
  select 'Dallas', 'DFW:' || s.team_id, s.storage_path, s.file_name,
         s.content_type, s.file_size_bytes, s.submitted_by, s.created_at, s.updated_at
  from public.aspire_dallas_submissions s
),
teams as (
  select 'New York' as edition, 'NYC:' || g.id as team_key,
         array[g.group_code, g.id::text] as folders,
         g.group_code as team_label, g.group_name as team_name,
         g.group_code like 'NYC-LOADTEST-%' as is_load_test_team
  from public.aspire_groups g
  where g.group_code like 'NYC-%'
  union all
  select 'Dallas', 'DFW:' || t.id, array['DFW-team-' || t.id],
         'Team ' || t.team_number, tp.answers ->> 'display_name', false
  from public.aspire_dallas_teams t
  left join public.aspire_dallas_team_phases tp on tp.team_id = t.id and tp.phase = 'team'
),
team_status as (
  select t.*,
    case
      when t.is_load_test_team then 'load-test team'
      when t.members > 0 and t.members = t.excluded_members then 'all team members are excluded users'
      when t.submitter_reason is not null then 'deck record saved by excluded user: ' || t.submitter_reason
    end as excluded_reason
  from (
    select tm.*,
      (select count(*) from members m where m.team_key = tm.team_key) as members,
      (select count(*) from members m join excluded_users e on e.user_id = m.user_id
        where m.team_key = tm.team_key) as excluded_members,
      (select e.reason from records r join excluded_users e on e.user_id = r.submitted_by
        where r.team_key = tm.team_key) as submitter_reason
    from teams tm
  ) t
),
files as (
  select o.name as storage_path,
         split_part(o.name, '/', 1) as folder,
         regexp_replace(o.name, '^[^/]+/[0-9]+-([0-9a-f]{8}-)?', '') as file_name,
         o.metadata ->> 'mimetype' as file_type,
         (o.metadata ->> 'size')::bigint as size_bytes,
         o.created_at as uploaded_at
  from storage.objects o
  where o.bucket_id = 'aspire-team-submissions'
    and o.name not like '%.emptyFolderPlaceholder'
),
per_team as (
  select ts.edition, ts.team_key, ts.excluded_reason,
         exists (select 1 from records r where r.team_key = ts.team_key) as has_record,
         exists (select 1 from files f where f.folder = any(ts.folders)) as has_file,
         exists (select 1 from records r join files f on f.storage_path = r.storage_path
                 where r.team_key = ts.team_key) as has_record_and_file
  from team_status ts
)
select edition,
       count(*) filter (where has_record and excluded_reason is null) as teams_with_deck_record,
       count(*) filter (where has_file and excluded_reason is null) as teams_with_file,
       count(*) filter (where has_record_and_file and excluded_reason is null) as teams_with_record_and_file,
       count(*) filter (where (has_record or has_file) and excluded_reason is not null) as excluded_teams_with_submission
from per_team
group by edition
order by edition;
