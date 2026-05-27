-- Fix admin role checks that read public.user_roles from the frontend.
-- This does not drop tables and does not delete existing role rows.

alter table public.user_roles enable row level security;

grant usage on schema public to authenticated;
grant select on public.user_roles to authenticated;

drop policy if exists "Users view own roles" on public.user_roles;

create policy "Users view own roles"
  on public.user_roles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins view all roles" on public.user_roles;

create policy "Admins view all roles"
  on public.user_roles
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'private'
      and table_name = 'user_roles'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_roles'
        and column_name = 'role'
        and udt_name = 'app_role'
    ) then
      insert into public.user_roles (user_id, role)
      select user_id, role::text::public.app_role
      from private.user_roles
      on conflict (user_id, role) do nothing;
    else
      insert into public.user_roles (user_id, role)
      select user_id, role::text
      from private.user_roles
      on conflict (user_id, role) do nothing;
    end if;
  end if;
end $$;
