-- Allow a user to receive city access before a group is assigned.
-- Run this migration after 001_tables_creation.sql on an existing database.

begin;

alter table public.aspire_user_access
  drop constraint if exists aspire_user_access_pkey;

alter table public.aspire_user_access
  add column if not exists id bigint;

create sequence if not exists public.aspire_user_access_id_seq;

select setval(
  'public.aspire_user_access_id_seq',
  coalesce((select max(id) + 1 from public.aspire_user_access), 1),
  false
);

update public.aspire_user_access
set id = nextval('public.aspire_user_access_id_seq')
where id is null;

alter sequence public.aspire_user_access_id_seq
  owned by public.aspire_user_access.id;

alter table public.aspire_user_access
  alter column id set not null;

alter table public.aspire_user_access
  alter column id set default nextval('public.aspire_user_access_id_seq');

alter table public.aspire_user_access
  add constraint aspire_user_access_pkey primary key (id);

alter table public.aspire_user_access
  alter column group_id drop not null;

create unique index if not exists aspire_user_access_assigned_unique
  on public.aspire_user_access (user_id, city_id, group_id)
  where group_id is not null;

create unique index if not exists aspire_user_access_unassigned_unique
  on public.aspire_user_access (user_id, city_id)
  where group_id is null;

commit;
