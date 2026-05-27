-- Align admin role checks with the private.user_roles table used in production.
-- This keeps public.has_role available for RLS policies while sourcing roles
-- from the private schema.

create schema if not exists private;

create table if not exists private.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from private.user_roles
    where user_roles.user_id = _user_id
      and user_roles.role::text = _role
  );
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from private.user_roles
    where user_roles.user_id = _user_id
      and user_roles.role = _role
  );
$$;

alter table private.user_roles enable row level security;

drop policy if exists "Users view own private roles" on private.user_roles;
drop policy if exists "Admins view all private roles" on private.user_roles;
drop policy if exists "Admins manage private roles" on private.user_roles;

create policy "Users view own private roles"
  on private.user_roles for select
  using (auth.uid() = user_id);

create policy "Admins view all private roles"
  on private.user_roles for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage private roles"
  on private.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant usage on schema private to authenticated;
grant select on private.user_roles to authenticated;
