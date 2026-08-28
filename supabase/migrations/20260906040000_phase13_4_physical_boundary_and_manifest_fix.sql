-- Phase 13.4: physical ERP/Parasut schema-boundary enforcement + relationship
-- manifest correction against the real, live-downloaded swagger.json.
--
-- Phase 13.3 CLAIMED query_vkn was "moved out" of the Parasut mirror, but it
-- only added a `comment on column` marking it deprecated -- the column
-- physically remained on parasut.e_invoice_inboxes. Verified live before this
-- migration (information_schema.columns + row counts):
--   parasut.e_invoice_inboxes: 0 total rows, query_vkn 0 filled / 0 null,
--   query_vkn AND queried_at both still physically present as columns.
-- 0 rows means 0 data-loss risk -- no backfill into erp.* is needed.
--
-- queried_at is lookup-operation metadata (not a genuine Parasut API field --
-- absent from swagger.json's EInvoiceInboxAttributes), so per the same
-- ERP_USER_ENTERED/operational-metadata boundary rule it must not live on
-- the Parasut mirror table either. Every row in this table only ever exists
-- because of a real per-VKN lookup (Phase 13.3 removed all unfiltered/global
-- population), so the pre-existing `synced_at` column already carries
-- equivalent "when was this row last fetched" provenance -- no replacement
-- column is added.

-- ---------------------------------------------------------------------
-- 1. Drop the two dependent public views first (they select queried_at),
--    then physically drop query_vkn and queried_at from the Parasut
--    mirror, then rebuild the views without the dropped columns.
-- ---------------------------------------------------------------------
drop view if exists public.parasut_e_invoice_lookup_results_demo;
drop view if exists public.parasut_e_invoice_lookup_result_counts_demo;

alter table parasut.e_invoice_inboxes drop column if exists query_vkn;
alter table parasut.e_invoice_inboxes drop column if exists queried_at;

-- ---------------------------------------------------------------------
-- 2. Rebuild the public views without the dropped columns, ordering/
--    filtering on synced_at (a genuine, already-standard sync-metadata
--    column present on every parasut.* mirror table) instead.
-- ---------------------------------------------------------------------
drop view if exists public.parasut_e_invoice_lookup_results_demo;
create view public.parasut_e_invoice_lookup_results_demo as
select
  parasut_id,
  parasut_type,
  vkn,
  e_invoice_address,
  name,
  inbox_type,
  address_registered_at,
  registered_at,
  parasut_created_at,
  parasut_updated_at,
  synced_at
from parasut.e_invoice_inboxes
order by synced_at desc nulls last, parasut_id desc;
comment on view public.parasut_e_invoice_lookup_results_demo is
  'Phase 13.4: query_vkn and queried_at no longer exist as physical columns on parasut.e_invoice_inboxes (dropped this phase) -- this view exposes only genuine Parasut-authoritative query-result fields, all 10 real swagger.json EInvoiceInboxAttributes fields (parasut_id, parasut_type, vkn, e_invoice_address, name, inbox_type, address_registered_at, registered_at, parasut_created_at/updated_at). No ERP request/audit history (erp.e_invoice_lookup_requests/_results) is ever exposed here.';
grant select on public.parasut_e_invoice_lookup_results_demo to authenticated, anon;

drop view if exists public.parasut_e_invoice_lookup_result_counts_demo;
create view public.parasut_e_invoice_lookup_result_counts_demo as
select count(*) as cached_query_result_count
from parasut.e_invoice_inboxes;
comment on view public.parasut_e_invoice_lookup_result_counts_demo is
  'Phase 13.4: with queried_at dropped, every row in parasut.e_invoice_inboxes by definition only ever exists because of a real per-VKN lookup (Phase 13.3 removed all unfiltered/global population of this table) -- count(*) is therefore already exactly the cached-query-result count, with no separate flag column needed.';
grant select on public.parasut_e_invoice_lookup_result_counts_demo to authenticated, anon;

-- ---------------------------------------------------------------------
-- 3. Relationship manifest correction: real swagger.json
--    (definitions.Tax.properties.relationships / definitions.Salary.
--    properties.relationships, re-verified live in this phase) documents
--    ONLY {category, tags} for Tax and {employee, category, tags} for
--    Salary. There is no "activities" key in either relationships object,
--    and no /salaries/{id}/activities or /taxes/{id}/activities path.
--    Phase 13.3's `Tax.activities` / `Salary.activities` manifest rows
--    were fabricated (copied from other resources that DO have a real
--    activities relationship, e.g. sales_offers/shipment_documents) --
--    "other resources have activities" is not evidence for Tax/Salary
--    specifically. Removed rather than reclassified: a relationship that
--    does not exist in the API has no state to report.
-- ---------------------------------------------------------------------
delete from parasut.relationship_manifest
where resource = 'taxes' and relationship_key = 'activities';
delete from parasut.relationship_manifest
where resource = 'salaries' and relationship_key = 'activities';

comment on table parasut.relationship_manifest is
  'Phase 13.3/13.4: static audit manifest of every Swagger-documented relationship key per resource, cross-checked by hand against the live Swagger schema (not runtime-inferred). Phase 13.4 removed salaries.activities/taxes.activities: re-verified against the real swagger.json in this phase, neither relationships object documents an activities key and no /{id}/activities path exists for either resource -- see reports/PHASE_13_4_FINAL_SOURCE_BOUNDARY_AND_UI_REPORT.md section 3.';

-- ---------------------------------------------------------------------
-- 4. Durable stale-lock self-healing (Phase 13.3's equivalent was a
--    one-off manual UPDATE migration, not a reusable mechanism -- a
--    future total-DB-error inside finishRun's own best-effort recovery
--    could still leave a row stuck at status='running' forever). This
--    reusable function is called defensively (best-effort, before lock
--    acquisition) by the Edge Function on every invocation, so a
--    resource's lock self-heals within one request-interval instead of
--    requiring a hand-written migration each time it happens.
-- ---------------------------------------------------------------------
create or replace function parasut.cleanup_stale_sync_locks()
returns integer
language sql
security definer
set search_path = parasut, pg_temp
as $$
  with cleared as (
    update parasut.sync_runs
    set status = 'error',
        finished_at = now(),
        error_message = 'Phase 13.4: stale running lock auto-cleared by cleanup_stale_sync_locks() (started > 10 minutes ago, never reached finishRun)'
    where status = 'running'
      and started_at < now() - interval '10 minutes'
    returning id
  )
  select count(*)::integer from cleared;
$$;
comment on function parasut.cleanup_stale_sync_locks() is
  'Phase 13.4: reusable, idempotent stale-lock self-heal -- replaces Phase 13.3''s one-off manual UPDATE migration. Called defensively by the Edge Function before acquiring a new run''s lock.';
grant execute on function parasut.cleanup_stale_sync_locks() to service_role;
