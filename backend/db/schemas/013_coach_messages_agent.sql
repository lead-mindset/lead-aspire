-- Coach history: which Foundry agent answered each question (the name set in
-- FOUNDRY_AGENT_NAME, FOUNDRY_DALLAS_AGENT_NAME or
-- FOUNDRY_DALLAS_<CIO|CFO|CSO|SUPPORT>_AGENT_NAME, e.g. "contoso-cfo").
-- Run after 012 in the Supabase SQL Editor, before deploying the backend that
-- writes it. Rows saved before this migration keep agent_name null.
-- Rollback: 013_coach_messages_agent_rollback.sql.

begin;

alter table public.aspire_coach_messages
  add column if not exists agent_name text;

create index if not exists aspire_coach_messages_agent_idx
  on public.aspire_coach_messages (agent_name, created_at desc);

commit;
