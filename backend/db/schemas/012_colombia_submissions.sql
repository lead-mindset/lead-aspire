-- Colombia Pitch & Submit: one final deck + demo link per Colombia team. Run
-- after 011 in the Supabase SQL Editor, before deploying the backend that
-- uses it (app/colombia_submission.py).
-- Rollback: 012_colombia_submissions_rollback.sql.
--
-- The decks go to New York's private bucket (005, aspire-team-submissions)
-- under COL-team-<team id>/, so its type and size limits apply. The backend
-- (service-role key) does every read and write: RLS on, no policies.

begin;

create table if not exists public.aspire_colombia_submissions (
  id bigint generated always as identity primary key,
  team_id bigint not null unique references public.aspire_colombia_teams (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  file_size_bytes bigint not null,
  demo_link text,
  submitted_by uuid references public.aspire_colombia_students (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists aspire_colombia_submissions_set_updated_at on public.aspire_colombia_submissions;
create trigger aspire_colombia_submissions_set_updated_at
  before update on public.aspire_colombia_submissions
  for each row execute function public.aspire_set_updated_at();

alter table public.aspire_colombia_submissions enable row level security;
revoke all on public.aspire_colombia_submissions from anon, authenticated;

commit;
