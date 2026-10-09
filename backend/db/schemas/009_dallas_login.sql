-- Dallas login: event code, teams and students. Run after 001-008 in the
-- Supabase SQL Editor. Rollback: 009_dallas_login_rollback.sql.
--
-- Only creates aspire_dallas_* objects; nothing New York uses is altered.
-- Dallas students are Supabase Auth users created by the backend with
-- app_metadata.aspire_city = 'DFW'. The backend (service-role key) does every
-- write; students read their own row, their teammates and the team list.
--
-- The event code is NOT inserted here, so it never lands in git. See the
-- README "Dallas event day" checklist for the insert and deactivate SQL.

begin;

-- ---------------------------------------------------------------------------
-- Event codes: backend only (RLS on, no policies).
-- ---------------------------------------------------------------------------
create table if not exists public.aspire_dallas_event_codes (
  id bigint generated always as identity primary key,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Stored lowercased and trimmed; the backend compares lower(input).
  constraint aspire_dallas_event_codes_code_check
    check (code = lower(btrim(code)) and code <> '')
);

-- ---------------------------------------------------------------------------
-- Teams: Team 1 to Team 30, matching the signs at the venue.
-- ---------------------------------------------------------------------------
create table if not exists public.aspire_dallas_teams (
  id bigint generated always as identity primary key,
  team_number integer not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint aspire_dallas_teams_number_check check (team_number > 0),
  constraint aspire_dallas_teams_name_check check (btrim(name) <> '')
);

insert into public.aspire_dallas_teams (team_number, name)
select n, 'Team ' || n
from generate_series(1, 30) as teams(n)
on conflict (team_number) do nothing;

-- ---------------------------------------------------------------------------
-- Students: one row per Dallas auth user. Names and team are set once, on
-- the first login (Step 2); the team can never change afterwards.
-- ---------------------------------------------------------------------------
create table if not exists public.aspire_dallas_students (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  first_name text,
  last_name text,
  team_id bigint references public.aspire_dallas_teams (id),
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aspire_dallas_students_email_check
    check (email = lower(btrim(email)) and email like '%_@_%'),
  constraint aspire_dallas_students_first_name_check
    check (first_name is null or char_length(btrim(first_name)) between 1 and 80),
  constraint aspire_dallas_students_last_name_check
    check (last_name is null or char_length(btrim(last_name)) between 1 and 80),
  -- A team is only saved together with the student's name.
  constraint aspire_dallas_students_team_needs_name_check
    check (team_id is null or (first_name is not null and last_name is not null))
);

create index if not exists aspire_dallas_students_team_idx
  on public.aspire_dallas_students (team_id);

-- Keeps updated_at current and refuses any change of an assigned team, even
-- from the service role. An organizer who must move a student runs:
--   alter table public.aspire_dallas_students disable trigger aspire_dallas_students_before_update;
--   update ...;
--   alter table public.aspire_dallas_students enable trigger aspire_dallas_students_before_update;
create or replace function public.aspire_dallas_students_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.team_id is not null and new.team_id is distinct from old.team_id then
    raise exception 'aspire_dallas: the team of a student cannot be changed'
      using errcode = 'check_violation';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aspire_dallas_students_before_update on public.aspire_dallas_students;
create trigger aspire_dallas_students_before_update
  before update on public.aspire_dallas_students
  for each row execute function public.aspire_dallas_students_before_update();

-- ---------------------------------------------------------------------------
-- RLS helpers. SECURITY DEFINER so the student policy does not recurse.
-- ---------------------------------------------------------------------------
create or replace function public.aspire_dallas_is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.aspire_dallas_students where user_id = auth.uid()
  );
$$;

create or replace function public.aspire_dallas_my_team()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.aspire_dallas_students where user_id = auth.uid();
$$;

revoke all on function public.aspire_dallas_is_student() from public;
revoke all on function public.aspire_dallas_my_team() from public;
grant execute on function public.aspire_dallas_is_student() to authenticated;
grant execute on function public.aspire_dallas_my_team() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS and grants. No insert/update/delete policies: all writes go through
-- the backend's service-role key.
-- ---------------------------------------------------------------------------
alter table public.aspire_dallas_event_codes enable row level security;
alter table public.aspire_dallas_teams enable row level security;
alter table public.aspire_dallas_students enable row level security;

revoke all on public.aspire_dallas_event_codes from anon, authenticated;
revoke all on public.aspire_dallas_teams from anon, authenticated;
revoke all on public.aspire_dallas_students from anon, authenticated;

grant select on public.aspire_dallas_teams to authenticated;
-- Teammates' emails stay private: the browser can read these columns only.
grant select (user_id, first_name, last_name, team_id)
  on public.aspire_dallas_students to authenticated;

drop policy if exists aspire_dallas_teams_select_student on public.aspire_dallas_teams;
create policy aspire_dallas_teams_select_student
on public.aspire_dallas_teams for select to authenticated
using (is_active = true and public.aspire_dallas_is_student());

drop policy if exists aspire_dallas_students_select_self_or_team on public.aspire_dallas_students;
create policy aspire_dallas_students_select_self_or_team
on public.aspire_dallas_students for select to authenticated
using (
  user_id = auth.uid()
  or (team_id is not null and team_id = public.aspire_dallas_my_team())
);

commit;
