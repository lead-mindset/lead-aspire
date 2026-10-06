-- Final deck + demo link per team. Run after 001-004 in the Supabase SQL Editor.
-- The backend (service-role key) does every read and write, so the table has
-- RLS enabled with no policies and the bucket stays private.

begin;

create table if not exists public.aspire_submissions (
  id bigint generated always as identity primary key,
  group_id bigint not null unique references public.aspire_groups (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  file_size_bytes bigint not null,
  demo_link text,
  submitted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists aspire_submissions_set_updated_at on public.aspire_submissions;
create trigger aspire_submissions_set_updated_at
  before update on public.aspire_submissions
  for each row execute function public.aspire_set_updated_at();

alter table public.aspire_submissions enable row level security;

-- Private bucket for the decks: PDF or PowerPoint, up to 50 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aspire-team-submissions',
  'aspire-team-submissions',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;
