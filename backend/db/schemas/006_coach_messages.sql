-- Coach chat history: one row per question and answer. Run after 001-005 in
-- the Supabase SQL Editor. The backend (service-role key) does every read and
-- write, so the table has RLS enabled with no policies.

begin;

create table if not exists public.aspire_coach_messages (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  group_id bigint references public.aspire_groups (id) on delete set null,
  conversation_id text not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

create index if not exists aspire_coach_messages_conversation_idx
  on public.aspire_coach_messages (conversation_id, created_at);

create index if not exists aspire_coach_messages_user_idx
  on public.aspire_coach_messages (user_id, created_at desc);

alter table public.aspire_coach_messages enable row level security;

commit;
