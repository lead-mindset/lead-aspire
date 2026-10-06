-- Run this file in Supabase SQL Editor after creating the Auth users.
--
-- Auth users must be created in Supabase Dashboard:
--   student.dallas@leadmindset.org
--   student.ny@leadmindset.org
--
-- Replace all values marked CHANGE_ME before running.
-- Do not put passwords in this file.

begin;

-- ---------------------------------------------------------------------------
-- 1. Replace these UUIDs with the IDs from Authentication > Users.
-- ---------------------------------------------------------------------------
do $$
declare
  dallas_user_id uuid := '00000000-0000-0000-0000-000000000000';
  new_york_user_id uuid := '00000000-0000-0000-0000-000000000000';
  new_york_group_code text := 'NYC-VISIONARIES';
  dallas_city_id bigint;
  new_york_city_id bigint;
  new_york_group_id bigint;
begin
  if dallas_user_id = '00000000-0000-0000-0000-000000000000'::uuid
    or new_york_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Replace the user UUID placeholders before running this script';
  end if;

  if not exists (select 1 from auth.users where id = dallas_user_id)
    or not exists (select 1 from auth.users where id = new_york_user_id) then
    raise exception 'Both UUIDs must belong to existing Supabase Auth users';
  end if;

  insert into public.aspire_cities (code, name, is_active)
  values
    ('NYC', 'New York', true),
    ('DFW', 'Dallas', true)
  on conflict (code) do update
    set name = excluded.name,
        is_active = excluded.is_active;

  -- Dallas groups are preconfigured before the event.
  insert into public.aspire_groups (group_code, group_name, is_active)
  select
    'DFW-G' || lpad(group_number::text, 2, '0'),
    format('Group %s', group_number),
    true
  from generate_series(1, 20) as groups(group_number)
  on conflict (group_code) do update
    set group_name = excluded.group_name,
        is_active = excluded.is_active;

  -- New York groups are assigned before the event. Add named groups here as
  -- the event roster changes. Removing a group requires an explicit cleanup
  -- operation so existing access is not revoked accidentally.
  insert into public.aspire_groups (group_code, group_name, is_active)
  values
    ('NYC-VISIONARIES', 'The Visionaries', true),
    ('NYC-ATHLETES', 'Athletes', true),
    ('NYC-COLUMBIA', 'Columbia', true)
  on conflict (group_code) do update
    set group_name = excluded.group_name,
        is_active = excluded.is_active;

  select id into dallas_city_id
  from public.aspire_cities
  where code = 'DFW' and is_active = true;

  select id into new_york_city_id
  from public.aspire_cities
  where code = 'NYC' and is_active = true;

  select id into new_york_group_id
  from public.aspire_groups
  where group_code = new_york_group_code and is_active = true;

  if new_york_group_id is null then
    raise exception 'New York group code % does not exist', new_york_group_code;
  end if;

  -- The Auth trigger normally creates these profiles. Insert missing profiles
  -- only; do not reactivate a profile that an administrator disabled.
  insert into public.aspire_profiles (id, display_name, status)
  values
    (dallas_user_id, 'Dallas Student', 'active'),
    (new_york_user_id, 'New York Student', 'active')
  on conflict (id) do nothing;

  -- New York receives access before the event.
  update public.aspire_user_access
  set group_id = new_york_group_id,
      access_role = 'member'
  where user_id = new_york_user_id
    and city_id = new_york_city_id
    and (group_id = new_york_group_id or group_id is null);

  if not found then
    insert into public.aspire_user_access (user_id, city_id, group_id, access_role)
    values (new_york_user_id, new_york_city_id, new_york_group_id, 'member');
  end if;

  -- Dallas access is intentionally assigned separately on event day.
end;
$$;

commit;

-- ---------------------------------------------------------------------------
-- Dallas event-day assignment
-- Run this separately after choosing a group from DFW-G01 through DFW-G20.
-- Replace both placeholders before running.
-- ---------------------------------------------------------------------------
do $$
declare
  dallas_user_id uuid := '00000000-0000-0000-0000-000000000000';
  dallas_group_code text := 'DFW-G01';
  dallas_city_id bigint;
  dallas_group_id bigint;
begin
  if dallas_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Replace dallas_user_id before running the Dallas assignment';
  end if;

  select id into dallas_city_id
  from public.aspire_cities
  where code = 'DFW' and is_active = true;

  select id into dallas_group_id
  from public.aspire_groups
  where group_code = dallas_group_code and is_active = true;

  if dallas_group_id is null then
    raise exception 'Dallas group code % does not exist', dallas_group_code;
  end if;

  update public.aspire_user_access
  set group_id = dallas_group_id,
      access_role = 'member'
  where user_id = dallas_user_id
    and city_id = dallas_city_id
    and (group_id = dallas_group_id or group_id is null);

  if not found then
    insert into public.aspire_user_access (user_id, city_id, group_id, access_role)
    values (dallas_user_id, dallas_city_id, dallas_group_id, 'member');
  end if;
end;
$$;
