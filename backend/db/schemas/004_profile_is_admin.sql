-- LEAD admins: see the student app plus the organizer "View Teams Results" page.
-- Run after 001-003. Then mark the admins with the update at the bottom.

alter table public.aspire_profiles
  add column if not exists is_admin boolean not null default false;

-- Mark the admins (replace the emails):
-- update public.aspire_profiles p
-- set is_admin = true
-- from auth.users u
-- where u.id = p.id
--   and lower(u.email) in ('admin1@leadmindset.org', 'admin2@leadmindset.org');
