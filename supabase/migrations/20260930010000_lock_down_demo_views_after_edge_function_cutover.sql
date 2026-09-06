-- Phase 15 (final step, NOT YET APPLIED remotely -- written for human
-- review and explicit approval only): revokes SELECT on every
-- public.parasut_*_demo view from anon/authenticated now that the frontend
-- no longer queries them directly. As of this commit, every page/route
-- listed in reports/PHASE_15_EDGE_FUNCTION_CONTRACTS_DESIGN.md calls one of
-- the 11 new read Edge Functions (customers, sales, expenses, payroll,
-- cash, products, inventory, shipments, e-documents, tags-and-settings,
-- sync-status) instead -- each of those reads these same views with the
-- service_role key, server-side, through a hardcoded column allow-list.
--
-- Context / do NOT duplicate prior work: two emergency migrations already
-- ran earlier in Phase 15 prep and are NOT touched or repeated here --
--   - 20260906200539_revoke_excess_demo_view_grants.sql already revoked
--     INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES from anon/
--     authenticated on every public view (SELECT was deliberately kept, so
--     the then-current direct-.from() frontend kept working).
--   - 20260906200827_remove_iban_tckn_from_demo_views.sql already dropped
--     the iban/tckn/bank_account_no columns from
--     parasut_accounts_demo/parasut_employees_demo.
-- This migration is the next step neither of those took: now that nothing
-- in the frontend bundle calls `.from("parasut_*_demo")` any more (verified
-- by grep across src/ as part of this same change), the remaining SELECT
-- grant to anon/authenticated on these views is no longer needed and is
-- revoked here too. The views themselves are NOT dropped -- they stay in
-- place, readable only by service_role (used exclusively by the 11 Edge
-- Functions above and by parasut-sync), so a future rollback is a single
-- re-GRANT, not a rebuild.
--
-- Deliberately excluded from this revoke: none. All public.parasut_*_demo
-- views are covered by the same information_schema loop already used in
-- 20260906200539, so this migration and that one always stay in sync with
-- whatever views exist at apply time -- no per-view list to maintain or
-- forget to update.
--
-- ROLLBACK: `grant select on public.<view_name> to anon, authenticated;`
-- for each view (or re-run the equivalent GRANT loop below with `grant`
-- instead of `revoke`). No data or view definitions are altered by this
-- migration -- it only changes privileges, so rollback is privilege-only
-- and fully reversible with no data loss.
--
-- STATUS: NOT APPLIED. Do not run `supabase db push` or otherwise execute
-- this against any remote database without explicit human approval --
-- confirm first that every consumer of these views (dashboards, ad hoc
-- SQL, future pages) has actually moved to the Edge Functions, since this
-- revoke will break any anon/authenticated caller still using PostgREST
-- directly against these views.

do $$
declare
  v_view record;
begin
  for v_view in
    select table_name from information_schema.views
    where table_schema = 'public' and table_name like 'parasut\_%\_demo' escape '\'
  loop
    execute format(
      'revoke select on public.%I from anon, authenticated;',
      v_view.table_name
    );
  end loop;
end $$;
