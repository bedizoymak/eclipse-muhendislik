-- Urgent security fix, applied live via `supabase db query` on 2026-09-06
-- ahead of this migration (captured here for reproducibility / rebuild
-- parity), found while starting the parasut data-layer refactor audit.
--
-- Every public.parasut_*_demo view had been granted INSERT, UPDATE,
-- DELETE, TRUNCATE, TRIGGER and REFERENCES to both `anon` and
-- `authenticated`, not just SELECT. At least 17 of these views are
-- genuinely updatable/insertable (information_schema.views.is_updatable =
-- 'YES'), including parasut_contacts_demo, parasut_employees_demo,
-- parasut_accounts_demo, parasut_suppliers_demo, parasut_warehouses_demo,
-- parasut_salaries_demo -- meaning anyone holding only the public
-- publishable key (visible in the client bundle, no login required) could
-- write or delete rows in the real Parasut mirror data through PostgREST.
-- A live test confirmed: SELECT continued to return 200 after this revoke,
-- and a test POST that returned 201 before now returns 401/permission
-- denied; no row was written to parasut.contacts by the verification
-- attempt.
--
-- This does not touch RLS policies or drop any object -- it only removes
-- privileges that should never have been granted. SELECT is preserved.

do $$
declare
  v_view record;
begin
  for v_view in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'VIEW'
  loop
    execute format(
      'revoke insert, update, delete, truncate, trigger, references on public.%I from anon, authenticated;',
      v_view.table_name
    );
  end loop;
end $$;
