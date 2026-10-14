-- Undo 013_coach_messages_agent.sql. The agent names saved so far are lost.

begin;

drop index if exists public.aspire_coach_messages_agent_idx;

alter table public.aspire_coach_messages
  drop column if exists agent_name;

commit;
