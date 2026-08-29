-- Phase 14.4: fix relationship-null semantics in
-- parasut.upsert_e_invoices_standalone().
--
-- Phase 14.2's version COALESCEs parent_type/parent_parasut_id
-- (`coalesce(excluded.parent_type, e.parent_type)`), on the theory that a
-- null from the standalone payload might mean "this call didn't carry the
-- relationship". That theory does not hold for this sync: syncEInvoicesStandalone()
-- (supabase/functions/parasut-sync/index.ts) ALWAYS requests
-- `include=invoice` on every call, so `item.relationships.invoice` is
-- always genuinely present in the real API response -- either a real
-- `{data: {id, type}}` object or a real `{data: null}`. The relationship is
-- therefore never merely "absent from this response"; when parent_type/
-- parent_parasut_id are null in the payload, that null is real, current
-- evidence from the API, not a gap. The old COALESCE wrongly preserved a
-- stale link in that case, violating the rule that a genuinely-null
-- relationship must never be shown as if it were still filled.
--
-- Fix: add an explicit `relationship_carried` flag to the payload (the
-- Edge Function always sets it to true for this sync, since include=invoice
-- guarantees presence). When true, parent_type/parent_parasut_id are always
-- overwritten with the fresh value, INCLUDING writing null when the API's
-- own read is null. When false (defensive default, not currently emitted
-- by any caller), the old COALESCE-preserve behavior is kept, so a future
-- caller that genuinely cannot observe the relationship on a given call
-- still cannot destroy a previously-established real link.
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
      coalesce((r->>'relationship_carried')::boolean, false) as relationship_carried,
      (r->'raw')::jsonb as raw,
      (r->>'parasut_created_at')::timestamptz as parasut_created_at,
      (r->>'parasut_updated_at')::timestamptz as parasut_updated_at
    from jsonb_array_elements(payload) as r
  ),
  -- ON CONFLICT DO UPDATE can only see `excluded.<real insert column>`, so
  -- relationship_carried (not a table column) cannot be read there directly.
  -- Resolve the final parent_type/parent_parasut_id HERE instead, using the
  -- existing stored row (left-joined by parasut_id) when relationship_carried
  -- is false, and the fresh incoming value (including a real null) when true.
  resolved as (
    select
      i.*,
      case when i.relationship_carried then i.parent_type else coalesce(i.parent_type, e.parent_type) end as final_parent_type,
      case when i.relationship_carried then i.parent_parasut_id else coalesce(i.parent_parasut_id, e.parent_parasut_id) end as final_parent_parasut_id
    from incoming i
    left join parasut.e_invoices e on e.parasut_id = i.parasut_id
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
      ubl_remote_id, signed_ubl_remote_id, final_parent_type, final_parent_parasut_id, raw,
      parasut_created_at, parasut_updated_at, now(), now()
    from resolved
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
      -- Phase 14.4 fix: `excluded.parent_type`/`excluded.parent_parasut_id`
      -- here are already the fully-resolved `final_parent_type`/
      -- `final_parent_parasut_id` values computed in the `resolved` CTE
      -- above (relationship_carried can't be read here -- it isn't a real
      -- table column, so ON CONFLICT can't see it via `excluded`). That
      -- resolution already applied the real rule: when this call's own
      -- read genuinely carried the relationship (always true for
      -- syncEInvoicesStandalone, since it always requests include=invoice),
      -- the fresh value wins outright -- INCLUDING writing a real null over
      -- a previously stored non-null value, because that null is itself
      -- real, current API evidence, not a gap. So a plain overwrite here is
      -- correct and never re-introduces the old blanket COALESCE bug.
      parent_type = excluded.parent_type,
      parent_parasut_id = excluded.parent_parasut_id,
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

comment on function parasut.upsert_e_invoices_standalone(jsonb) is
  'Phase 14.4: parent_type/parent_parasut_id are overwritten unconditionally (including to null) when the payload row carries relationship_carried=true, since syncEInvoicesStandalone always requests include=invoice and therefore always has genuine relationship evidence. Falls back to Phase 14.2 COALESCE-preserve only when relationship_carried=false.';
