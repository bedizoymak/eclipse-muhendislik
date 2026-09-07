-- Repair migration: restore the `parasut` schema objects that the schema
-- incident wiped but that migration history still records as applied.
--
-- `select count(*) from information_schema.routines where routine_schema
-- = 'parasut'` returned 0 after the recovery, and pg_indexes showed only
-- `sync_runs_pkey` on parasut.sync_runs. The recovery restored the
-- flattened mirror TABLES correctly, but not the functions or the
-- sync_runs indexes, and because supabase_migrations.schema_migrations
-- still lists 20260826000000 / 20260829050000 / 20260906040000 as
-- applied, `db push` would never re-run them. This is a forward,
-- non-destructive restore of exactly three wiped objects plus the two
-- wiped sync_runs indexes -- no table, column, view or schema is created,
-- altered or dropped anywhere, and `public` is not touched at all.
--
-- Restored objects and the observable breakage each one caused:
--
--   1. parasut.upsert_e_invoices_standalone(jsonb)
--      Source: 20260829050000_phase14_2_standalone_e_invoices.sql.
--      Body below is verbatim from that migration -- this is a restore,
--      not a redesign. Its absence made every resource=e_invoices sync
--      fail with "Could not find the function
--      parasut.upsert_e_invoices_standalone(payload) in the schema
--      cache", pinning the mirror at 1272 rows against a live API total
--      of 1708. Verified before writing this migration that every column
--      the body reads and writes still exists on the restored
--      parasut.e_invoices with a matching type, and that the
--      `on conflict (parasut_id)` target is still backed by the real
--      e_invoices_parasut_id_key unique constraint.
--      NOT restored here: the public.parasut_e_invoices_counts_demo view
--      that the same 20260829050000 migration also created. It was
--      deliberately dropped by 20260930130000 during the Edge Function
--      cutover and must stay dropped.
--
--   2. parasut.cleanup_stale_sync_locks()
--      Source: 20260906040000_phase13_4_physical_boundary_and_manifest_fix.sql,
--      verbatim. The parasut-sync Edge Function calls this via RPC on
--      every single invocation, before acquiring a run lock, as the
--      designed self-heal for a run row orphaned at status='running'.
--      With the function gone that call threw (and was swallowed by its
--      best-effort try/catch) on every invocation, so nothing ever
--      cleared orphaned locks.
--
--   3. sync_runs_one_running_per_resource_idx and
--      sync_runs_resource_started_at_idx
--      Source: 20260826000000_parasut_sync_infrastructure.sql, verbatim.
--      The partial unique index IS the one-run-per-resource lock; it is
--      what makes the Edge Function's 23505 -> HTTP 409 "already running"
--      path reachable. Without it concurrent runs of the same resource
--      were silently allowed.
--
-- Ordering matters: the stale-lock cleanup must run BEFORE the partial
-- unique index is created, because parasut.sync_runs currently holds
-- three orphaned status='running' stock_movements rows (started
-- 2026-09-07 02:49, 04:33 and 06:16 UTC, all finished_at null,
-- fetched_count 0) and the unique index would reject the duplicate
-- 'running' resource values.

-- ---------------------------------------------------------------------
-- 1. parasut.upsert_e_invoices_standalone(jsonb)
--    Verbatim restore of the Phase 14.2 definition.
-- ---------------------------------------------------------------------
create or replace function parasut.upsert_e_invoices_standalone(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = parasut, public
as $$
declare
  affected integer;
begin
  with incoming as (
    select
      (r->>'parasut_id')::bigint as parasut_id,
      r->>'external_id' as external_id,
      r->>'uuid' as uuid,
      r->>'env_uuid' as env_uuid,
      r->>'from_address' as from_address,
      r->>'from_vkn' as from_vkn,
      r->>'to_address' as to_address,
      r->>'to_vkn' as to_vkn,
      r->>'direction' as direction,
      r->>'note' as note,
      r->>'response_type' as response_type,
      r->>'contact_name' as contact_name,
      r->>'scenario' as scenario,
      r->>'status' as status,
      r->>'status_code' as status_code,
      r->>'status_message' as status_message,
      (r->>'issue_date')::date as issue_date,
      (r->>'expires_at')::date as expires_at,
      (r->>'is_expired')::boolean as is_expired,
      (r->>'is_answerable')::boolean as is_answerable,
      (r->>'is_seen')::boolean as is_seen,
      (r->>'net_total')::numeric as net_total,
      (r->>'total_vat')::numeric as total_vat,
      r->>'currency' as currency,
      r->>'item_type' as item_type,
      r->>'invoice_type_code' as invoice_type_code,
      (r->>'non_standard_e_invoice')::boolean as non_standard_e_invoice,
      (r->>'archived')::boolean as archived,
      r->>'migration_source' as migration_source,
      r->>'profile_id' as profile_id,
      (r->>'refund_of_id')::bigint as refund_of_id,
      r->>'vat_exemption_reason_code' as vat_exemption_reason_code,
      r->>'pdf_url' as pdf_url,
      r->>'signed_ubl_url' as signed_ubl_url,
      r->>'html_url' as html_url,
      r->>'rendered_ubl_path' as rendered_ubl_path,
      r->>'ubl_remote_id' as ubl_remote_id,
      r->>'signed_ubl_remote_id' as signed_ubl_remote_id,
      r->>'parent_type' as parent_type,
      (r->>'parent_parasut_id')::bigint as parent_parasut_id,
      (r->'raw')::jsonb as raw,
      (r->>'parasut_created_at')::timestamptz as parasut_created_at,
      (r->>'parasut_updated_at')::timestamptz as parasut_updated_at
    from jsonb_array_elements(payload) as r
  ),
  upserted as (
    insert into parasut.e_invoices as e (
      parasut_id, external_id, uuid, env_uuid, from_address, from_vkn, to_address, to_vkn,
      direction, note, response_type, contact_name, scenario, status, status_code, status_message,
      issue_date, expires_at, is_expired, is_answerable, is_seen, net_total, total_vat, currency,
      item_type, invoice_type_code, non_standard_e_invoice, archived, migration_source, profile_id,
      refund_of_id, vat_exemption_reason_code, pdf_url, signed_ubl_url, html_url, rendered_ubl_path,
      ubl_remote_id, signed_ubl_remote_id, parent_type, parent_parasut_id, raw,
      parasut_created_at, parasut_updated_at, synced_at, last_seen_at
    )
    select
      parasut_id, external_id, uuid, env_uuid, from_address, from_vkn, to_address, to_vkn,
      direction, note, response_type, contact_name, scenario, status, status_code, status_message,
      issue_date, expires_at, is_expired, is_answerable, is_seen, net_total, total_vat, currency,
      item_type, invoice_type_code, non_standard_e_invoice, archived, migration_source, profile_id,
      refund_of_id, vat_exemption_reason_code, pdf_url, signed_ubl_url, html_url, rendered_ubl_path,
      ubl_remote_id, signed_ubl_remote_id, parent_type, parent_parasut_id, raw,
      parasut_created_at, parasut_updated_at, now(), now()
    from incoming
    on conflict (parasut_id) do update set
      external_id = excluded.external_id,
      uuid = excluded.uuid,
      env_uuid = excluded.env_uuid,
      from_address = excluded.from_address,
      from_vkn = excluded.from_vkn,
      to_address = excluded.to_address,
      to_vkn = excluded.to_vkn,
      direction = excluded.direction,
      note = excluded.note,
      response_type = excluded.response_type,
      contact_name = excluded.contact_name,
      scenario = excluded.scenario,
      status = excluded.status,
      status_code = excluded.status_code,
      status_message = excluded.status_message,
      issue_date = excluded.issue_date,
      expires_at = excluded.expires_at,
      is_expired = excluded.is_expired,
      is_answerable = excluded.is_answerable,
      is_seen = excluded.is_seen,
      net_total = excluded.net_total,
      total_vat = excluded.total_vat,
      currency = excluded.currency,
      item_type = excluded.item_type,
      invoice_type_code = excluded.invoice_type_code,
      non_standard_e_invoice = excluded.non_standard_e_invoice,
      archived = excluded.archived,
      migration_source = excluded.migration_source,
      profile_id = excluded.profile_id,
      refund_of_id = excluded.refund_of_id,
      vat_exemption_reason_code = excluded.vat_exemption_reason_code,
      pdf_url = excluded.pdf_url,
      signed_ubl_url = excluded.signed_ubl_url,
      html_url = excluded.html_url,
      rendered_ubl_path = excluded.rendered_ubl_path,
      ubl_remote_id = excluded.ubl_remote_id,
      signed_ubl_remote_id = excluded.signed_ubl_remote_id,
      -- Phase 14.2 rule: a real non-null value from THIS sync's own
      -- relationship read always wins; a null never overwrites an
      -- existing real parent link established by the active-document
      -- sync (or a previous standalone run).
      parent_type = coalesce(excluded.parent_type, e.parent_type),
      parent_parasut_id = coalesce(excluded.parent_parasut_id, e.parent_parasut_id),
      raw = excluded.raw,
      parasut_created_at = excluded.parasut_created_at,
      parasut_updated_at = excluded.parasut_updated_at,
      synced_at = now(),
      last_seen_at = now()
    returning 1
  )
  select count(*) into affected from upserted;
  return affected;
end;
$$;

revoke all on function parasut.upsert_e_invoices_standalone(jsonb) from public;
grant execute on function parasut.upsert_e_invoices_standalone(jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 2. parasut.cleanup_stale_sync_locks()
--    Verbatim restore of the Phase 13.4 definition.
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

revoke all on function parasut.cleanup_stale_sync_locks() from public;
grant execute on function parasut.cleanup_stale_sync_locks() to service_role;

-- ---------------------------------------------------------------------
-- 3. Clear the orphaned stock_movements run locks using that restored
--    mechanism itself -- not a hand-written UPDATE, and never a broad
--    `where status = 'running'` with no age predicate. The three known
--    orphans all started many hours ago, so the function's own
--    "> 10 minutes" predicate covers them; any run legitimately in
--    flight right now is younger than that and is left alone.
-- ---------------------------------------------------------------------
select parasut.cleanup_stale_sync_locks();

-- ---------------------------------------------------------------------
-- 4. sync_runs indexes, verbatim from 20260826000000.
--    `if not exists` so this migration stays safely re-runnable.
-- ---------------------------------------------------------------------
create unique index if not exists sync_runs_one_running_per_resource_idx
  on parasut.sync_runs (resource)
  where status = 'running';

create index if not exists sync_runs_resource_started_at_idx
  on parasut.sync_runs (resource, started_at desc);
