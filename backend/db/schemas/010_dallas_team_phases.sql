-- Dallas challenge: one shared set of answers per team per phase, plus the
-- phase timer start and completion. Run after 009 in the Supabase SQL Editor.
-- Rollback: 010_dallas_team_phases_rollback.sql.
--
-- Only creates aspire_dallas_* objects; nothing New York uses is altered.
-- The backend (service-role key) does every read and write: the table has
-- RLS on with no policies, and only service_role may run the functions.
--
-- Answers are a flat JSON object: one top-level key per field or option
-- (role_ae, cause_governance, ...). Saves merge only the keys sent, so two
-- students editing different fields at the same time keep both edits; the
-- last save of the same key wins. A key saved as null is removed.

begin;

create table if not exists public.aspire_dallas_team_phases (
  team_id bigint not null references public.aspire_dallas_teams (id) on delete cascade,
  phase text not null,
  answers jsonb not null default '{}'::jsonb,
  -- Timer start: set once, by the first member who opens the phase.
  started_at timestamptz,
  -- Progress: set when the team presses Continue with the minimum done.
  completed_at timestamptz,
  completed_by uuid,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (team_id, phase),
  constraint aspire_dallas_team_phases_phase_check
    check (phase in ('team', 'brief', 'discover', 'diagnose', 'advise', 'respond', 'deliver')),
  constraint aspire_dallas_team_phases_answers_check
    check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 32768),
  constraint aspire_dallas_team_phases_completed_by_fkey
    foreign key (completed_by) references public.aspire_dallas_students (user_id) on delete set null,
  constraint aspire_dallas_team_phases_updated_by_fkey
    foreign key (updated_by) references public.aspire_dallas_students (user_id) on delete set null
);

alter table public.aspire_dallas_team_phases enable row level security;
revoke all on public.aspire_dallas_team_phases from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Save: merge `patch` into the phase's answers (shallow, per key), drop keys
-- set to null, and record who saved. The team name locks once the Team phase
-- is complete.
-- ---------------------------------------------------------------------------
create or replace function public.aspire_dallas_save_answers(
  p_team_id bigint,
  p_phase text,
  p_patch jsonb,
  p_user_id uuid
)
returns public.aspire_dallas_team_phases
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.aspire_dallas_team_phases;
begin
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'aspire_dallas: patch must be a JSON object' using errcode = 'check_violation';
  end if;

  if p_phase = 'team' and p_patch ? 'display_name' and exists (
    select 1 from public.aspire_dallas_team_phases
    where team_id = p_team_id and phase = 'team' and completed_at is not null
  ) then
    raise exception 'aspire_dallas: the team name is locked' using errcode = 'check_violation';
  end if;

  insert into public.aspire_dallas_team_phases as existing (team_id, phase, answers, updated_by, updated_at)
  values (p_team_id, p_phase, jsonb_strip_nulls(p_patch), p_user_id, now())
  on conflict (team_id, phase) do update
    set answers = jsonb_strip_nulls(existing.answers || p_patch),
        updated_by = excluded.updated_by,
        updated_at = now()
  returning * into saved;

  return saved;
end;
$$;

-- ---------------------------------------------------------------------------
-- Open: start the phase timer if it has not started yet; returns the row.
-- ---------------------------------------------------------------------------
create or replace function public.aspire_dallas_open_phase(p_team_id bigint, p_phase text)
returns public.aspire_dallas_team_phases
language sql
security definer
set search_path = public
as $$
  insert into public.aspire_dallas_team_phases as existing (team_id, phase, started_at)
  values (p_team_id, p_phase, now())
  on conflict (team_id, phase) do update
    set started_at = coalesce(existing.started_at, excluded.started_at)
  returning *;
$$;

-- ---------------------------------------------------------------------------
-- Complete: mark the phase done once; later calls keep the first time.
-- ---------------------------------------------------------------------------
create or replace function public.aspire_dallas_complete_phase(
  p_team_id bigint,
  p_phase text,
  p_user_id uuid
)
returns public.aspire_dallas_team_phases
language sql
security definer
set search_path = public
as $$
  insert into public.aspire_dallas_team_phases as existing (team_id, phase, completed_at, completed_by)
  values (p_team_id, p_phase, now(), p_user_id)
  on conflict (team_id, phase) do update
    set completed_at = coalesce(existing.completed_at, excluded.completed_at),
        completed_by = coalesce(existing.completed_by, excluded.completed_by)
  returning *;
$$;

revoke all on function public.aspire_dallas_save_answers(bigint, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.aspire_dallas_open_phase(bigint, text) from public, anon, authenticated;
revoke all on function public.aspire_dallas_complete_phase(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.aspire_dallas_save_answers(bigint, text, jsonb, uuid) to service_role;
grant execute on function public.aspire_dallas_open_phase(bigint, text) to service_role;
grant execute on function public.aspire_dallas_complete_phase(bigint, text, uuid) to service_role;

commit;
