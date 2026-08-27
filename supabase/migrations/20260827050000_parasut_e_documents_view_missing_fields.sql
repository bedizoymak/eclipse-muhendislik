-- Phase 8.1: two real e_invoices/e_archives attributes (gtb_ref_no,
-- migration_source) already existed as base-table columns since Phase 8
-- but were left out of the public demo views' select lists -- a pure
-- view-layer omission, not a missing sync/mapping (the sync already reads
-- and stores both; they are simply always null in this account's real
-- data, which is itself a real, verified fact -- not something to hide).
-- CREATE OR REPLACE VIEW cannot reorder existing columns, so both are
-- appended at the end, same constraint documented in every prior
-- *_demo view migration in this project.

create or replace view public.parasut_e_invoices_demo
as
select
  e.parasut_id,
  e.parent_type,
  e.parent_parasut_id,
  e.external_id,
  e.uuid,
  e.direction,
  e.scenario,
  e.status,
  e.status_code,
  e.status_message,
  e.item_type,
  e.invoice_type_code,
  e.issue_date,
  e.expires_at,
  e.is_expired,
  e.is_answerable,
  e.is_seen,
  e.non_standard_e_invoice,
  e.archived,
  e.currency,
  e.net_total,
  e.total_vat,
  e.contact_name,
  e.from_address,
  e.from_vkn,
  e.to_address,
  e.to_vkn,
  e.note,
  e.response_type,
  e.env_uuid,
  e.profile_id,
  e.refund_of_id,
  e.vat_exemption_reason_code,
  e.pdf_url,
  e.signed_ubl_url,
  e.html_url,
  e.parasut_created_at,
  e.parasut_updated_at,
  e.synced_at,
  e.gtb_ref_no,
  e.migration_source
from parasut.e_invoices e
order by e.issue_date desc nulls last;

create or replace view public.parasut_e_archives_demo
as
select
  a.parasut_id,
  a.sales_invoice_parasut_id,
  a.uuid,
  a.vkn,
  a.invoice_number,
  a.status,
  a.is_printed,
  a.is_signed,
  a.printed_at,
  a.cancellable_until,
  a.email_status,
  a.note,
  a.pdf_url,
  a.signed_ubl_url,
  a.html_url,
  a.parasut_created_at,
  a.parasut_updated_at,
  a.synced_at,
  a.migration_source
from parasut.e_archives a
order by a.parasut_created_at desc nulls last;

grant select on public.parasut_e_invoices_demo to authenticated, anon;
grant select on public.parasut_e_archives_demo to authenticated, anon;
