-- Lead Aspire login and group-logo schema for Supabase/Postgres.
-- Authentication credentials and sessions remain managed by Supabase Auth.
-- Review this migration against existing shared-platform objects before applying.

begin;


create table if not exists public.aspire_profiles (
                                                      id uuid primary key references auth.users (id) on delete cascade,
    display_name text,
    status text not null default 'active',
    constraint aspire_profiles_status_check check (status in ('active', 'disabled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
    );

create table if not exists public.aspire_cities (
                                                    id bigint generated always as identity primary key,
                                                    code text not null unique,
                                                    name text not null unique,
                                                    is_active boolean not null default true,
                                                    created_at timestamptz not null default now()
    );

create table if not exists public.aspire_groups (
                                                    id bigint generated always as identity primary key,
                                                    group_code text not null unique,
                                                    group_name text not null,
                                                    is_active boolean not null default true,
                                                    created_at timestamptz not null default now()
    );

create table if not exists public.aspire_user_access (
                                                         id bigint generated always as identity primary key,
                                                         user_id uuid not null references public.aspire_profiles (id) on delete cascade,
    city_id bigint not null references public.aspire_cities (id),
    group_id bigint references public.aspire_groups (id),
                                                         access_role text not null default 'member',
    constraint aspire_user_access_role_check
    check (access_role in ('member', 'group_admin')),
    created_at timestamptz not null default now()
    );

create index if not exists aspire_user_access_group_idx
    on public.aspire_user_access (group_id);

create unique index if not exists aspire_user_access_assigned_unique
    on public.aspire_user_access (user_id, city_id, group_id)
    where group_id is not null;

create unique index if not exists aspire_user_access_unassigned_unique
    on public.aspire_user_access (user_id, city_id)
    where group_id is null;

create table if not exists public.aspire_group_logos (
                                                         id bigint generated always as identity primary key,
                                                         group_id bigint not null references public.aspire_groups (id) on delete cascade,
    storage_path text not null unique,
    file_name text not null,
                                                         content_type text not null,
    constraint aspire_group_logos_content_type_check
    check (content_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
    file_size_bytes integer not null,
    constraint aspire_group_logos_file_size_check
    check (file_size_bytes between 1 and 5242880),
    uploaded_by uuid not null references auth.users (id) on delete restrict,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
    );

create unique index if not exists aspire_one_active_logo_per_group
    on public.aspire_group_logos (group_id)
    where is_active = true;

create table if not exists public.aspire_login_events (
                                                          id bigint generated always as identity primary key,
                                                          user_id uuid references auth.users (id) on delete set null,
    email text not null,
    city_id bigint references public.aspire_cities (id) on delete set null,
    group_id bigint references public.aspire_groups (id) on delete set null,
    succeeded boolean not null,
    failure_reason text,
    created_at timestamptz not null default now()
    );

create index if not exists aspire_login_events_created_at_idx
    on public.aspire_login_events (created_at desc);

create or replace function public.aspire_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
return new;
end;
$$;

drop trigger if exists aspire_profiles_set_updated_at on public.aspire_profiles;
create trigger aspire_profiles_set_updated_at
    before update on public.aspire_profiles
    for each row execute function public.aspire_set_updated_at();

-- Creates an application profile whenever Supabase Auth creates a user.
create or replace function public.aspire_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
insert into public.aspire_profiles (id, display_name)
values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
    on conflict (id) do nothing;
return new;
end;
$$;

drop trigger if exists aspire_on_auth_user_created on auth.users;
create trigger aspire_on_auth_user_created
    after insert on auth.users
    for each row execute function public.aspire_handle_new_user();

-- SECURITY DEFINER avoids recursive RLS checks when storage policies inspect access.
create or replace function public.aspire_is_group_admin(requested_group_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
select exists (
    select 1
    from public.aspire_user_access
    where user_id = auth.uid()
      and group_id = requested_group_id
      and access_role = 'group_admin'
);
$$;

revoke all on function public.aspire_is_group_admin(bigint) from public;
grant execute on function public.aspire_is_group_admin(bigint) to authenticated;

create or replace function public.aspire_is_group_member(requested_group_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
select exists (
    select 1
    from public.aspire_user_access
    where user_id = auth.uid()
      and group_id = requested_group_id
);
$$;

revoke all on function public.aspire_is_group_member(bigint) from public;
grant execute on function public.aspire_is_group_member(bigint) to authenticated;

insert into public.aspire_profiles (id, display_name)
select id, email
from auth.users
where not exists (
    select 1
    from public.aspire_profiles
    where aspire_profiles.id = auth.users.id
);

insert into public.aspire_cities (code, name)
values
    ('NYC', 'New York'),
    ('DFW', 'Dallas')
    on conflict (code) do update
                              set name = excluded.name;

-- Storage buckets are not ordinary application tables, but Supabase supports
-- creating a bucket with SQL. The bucket is private by design.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
           'aspire-group-logos',
           'aspire-group-logos',
           false,
           5242880,
           array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
       )
    on conflict (id) do update
                            set public = excluded.public,
                            file_size_limit = excluded.file_size_limit,
                            allowed_mime_types = excluded.allowed_mime_types;

alter table public.aspire_profiles enable row level security;
alter table public.aspire_cities enable row level security;
alter table public.aspire_groups enable row level security;
alter table public.aspire_user_access enable row level security;
alter table public.aspire_group_logos enable row level security;
alter table public.aspire_login_events enable row level security;

drop policy if exists aspire_profiles_select_own on public.aspire_profiles;
create policy aspire_profiles_select_own
on public.aspire_profiles for select to authenticated
                                              using (id = auth.uid());

drop policy if exists aspire_cities_select_active on public.aspire_cities;
create policy aspire_cities_select_active
on public.aspire_cities for select to authenticated
                                            using (is_active = true);

drop policy if exists aspire_groups_select_active on public.aspire_groups;
create policy aspire_groups_select_active
on public.aspire_groups for select to authenticated
                                            using (is_active = true);

drop policy if exists aspire_user_access_select_own on public.aspire_user_access;
create policy aspire_user_access_select_own
on public.aspire_user_access for select to authenticated
                                                 using (user_id = auth.uid());

drop policy if exists aspire_group_logos_select_member on public.aspire_group_logos;
create policy aspire_group_logos_select_member
on public.aspire_group_logos for select to authenticated
                                                 using (
                                                 is_active = true
                                                 and exists (
                                                 select 1
                                                 from public.aspire_user_access access
                                                 where access.user_id = auth.uid()
                                                 and access.group_id = aspire_group_logos.group_id
                                                 )
                                                 );

drop policy if exists aspire_group_logos_insert_admin on public.aspire_group_logos;
create policy aspire_group_logos_insert_admin
on public.aspire_group_logos for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and public.aspire_is_group_admin(group_id)
);

drop policy if exists aspire_group_logos_update_admin on public.aspire_group_logos;
create policy aspire_group_logos_update_admin
on public.aspire_group_logos for update to authenticated
                                                             using (public.aspire_is_group_admin(group_id))
                                 with check (public.aspire_is_group_admin(group_id));

drop policy if exists aspire_group_logos_delete_admin on public.aspire_group_logos;
create policy aspire_group_logos_delete_admin
on public.aspire_group_logos for delete to authenticated
using (public.aspire_is_group_admin(group_id));

-- Storage object paths must begin with the numeric group id: {group_id}/...
drop policy if exists aspire_storage_group_logos_select on storage.objects;
create policy aspire_storage_group_logos_select
on storage.objects for select to authenticated
                                                                                           using (
                                                                                           bucket_id = 'aspire-group-logos'
                                                                                           and public.aspire_is_group_member((storage.foldername(name))[1]::bigint)
                                                                                           );

drop policy if exists aspire_storage_group_logos_insert on storage.objects;
create policy aspire_storage_group_logos_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'aspire-group-logos'
  and public.aspire_is_group_admin((storage.foldername(name))[1]::bigint)
);

drop policy if exists aspire_storage_group_logos_update on storage.objects;
create policy aspire_storage_group_logos_update
on storage.objects for update to authenticated
                                                   using (
                                                   bucket_id = 'aspire-group-logos'
                                                   and public.aspire_is_group_admin((storage.foldername(name))[1]::bigint)
                                                   )
                       with check (
                                                   bucket_id = 'aspire-group-logos'
                                                   and public.aspire_is_group_admin((storage.foldername(name))[1]::bigint)
                                                   );

drop policy if exists aspire_storage_group_logos_delete on storage.objects;
create policy aspire_storage_group_logos_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'aspire-group-logos'
  and public.aspire_is_group_admin((storage.foldername(name))[1]::bigint)
);

commit;
