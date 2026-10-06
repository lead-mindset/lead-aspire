-- Completed phases per team, so progress survives a cleared browser and is
-- shared by every member. Run after 001-006 in the Supabase SQL Editor.
-- The backend (service-role key) does every read and write, so the table has
-- RLS enabled with no policies.

begin;

create table if not exists public.aspire_team_progress (
  group_id bigint not null references public.aspire_groups (id) on delete cascade,
  phase_key text not null check (phase_key in ('discover', 'strategize', 'build', 'pitch')),
  completed_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz not null default now(),
  primary key (group_id, phase_key)
);

alter table public.aspire_team_progress enable row level security;

commit;
