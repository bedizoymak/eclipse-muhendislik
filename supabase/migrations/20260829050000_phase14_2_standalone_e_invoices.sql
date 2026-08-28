-- Phase 14.2: standalone e_invoices full-universe sync support.
--
-- Prior syncs (Phase 8 / syncActiveEDocuments) only ever write e_invoices
-- rows that are reached via a real sales_invoices/purchase_bills parent
-- relationship (1238 rows: 811 purchase_bills + 427 sales_invoices as of
-- this phase). The real Parasut GET /e_invoices endpoint independently
-- exposes 1693 total e_invoice resources; the remainder are e-invoices
-- with no resolvable parent relationship (`invoice.data` is null in the
-- real API response) or a parent not yet captured by the active-document
-- sync. This migration adds a `last_seen_at` marker column so the new
-- standalone resource=e_invoices sync can record "seen in this real sync
-- run" without deleting anything (upsert-only, never a physical delete;
-- see report for the stale-semantics decision), and adds a durable
-- aggregate count view so frontend counters are never a hardcoded value
-- or a `.length` of a paginated fetch.
--
-- parent_type / parent_parasut_id already exist on parasut.e_invoices
-- since Phase 8 and are NOT touched by this migration -- the standalone
-- sync's mapper must only ever write those two columns when it has real
-- relationship evidence from the API's `invoice` relationship for that
-- specific row, and must never null out an existing real value it does
-- not have fresh evidence for.

alter table parasut.e_invoices
  add column if not exists last_seen_at timestamptz;

comment on column parasut.e_invoices.last_seen_at is
  'Timestamp of the most recent real standalone e_invoices sync run (resource=e_invoices) that observed this record in the Parasut API response. Null for rows only ever written by the active-parent e-document sync before Phase 14.2. Never used to drive a physical delete -- see Phase 14.2 report for the stale-semantics decision.';

-- Durable aggregate counters for parasut.e_invoices. Never a frontend
-- `.length`, never a hardcoded value -- always computed live from the
-- base table by the database itself.
create or replace view public.parasut_e_invoices_counts_demo
as
select
  count(*) as total_e_invoices,
  count(*) filter (where parent_type = 'sales_invoices') as linked_sales_invoice_count,
  count(*) filter (where parent_type = 'purchase_bills') as linked_purchase_bill_count,
  count(*) filter (where parent_type is null) as unlinked_count,
  count(*) filter (where direction = 'inbound') as inbound_count,
  count(*) filter (where direction = 'outbound') as outbound_count,
  count(*) filter (where direction is null) as unknown_direction_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived is null) as null_archived_count,
  count(*) filter (
    where parent_type is not null
      and parent_type not in ('sales_invoices', 'purchase_bills')
  ) as unresolved_relationship_count
from parasut.e_invoices;

grant select on public.parasut_e_invoices_counts_demo to authenticated, anon;

-- Bulk upsert RPC used ONLY by the new standalone resource=e_invoices sync
-- path (Phase 14.2). A plain PostgREST `.upsert()` with a fixed column set
-- would necessarily write parent_type/parent_parasut_id on every row,
-- which risks nulling out a real parent link the active-document sync
-- already established for a row the standalone endpoint has no `invoice`
-- relationship evidence for on this particular call. This function instead
-- COALESCEs those two columns specifically: a fresh non-null value from
-- the standalone sync's own real relationship read always wins (it is
-- real, current evidence), but a null from the standalone payload never
-- overwrites an existing non-null value. Every other real column is
-- always overwritten with the fresh fetch (standard upsert semantics),
-- and last_seen_at is always stamped with the current sync run.
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
