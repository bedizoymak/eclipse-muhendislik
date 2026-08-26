-- Phase 2: sales_invoices + sales_invoice_details sync surface.
--
-- parasut.sales_invoices and parasut.sales_invoice_details already exist
-- (from the very first schema migration) but have been empty until now.
-- This migration only adds sync-run bookkeeping columns for the new
-- resource and a curated, real-data-only read surface for the demo
-- frontend -- it does not touch any existing table's columns.

alter table parasut.sync_runs
  add column detail_fetched_count integer,
  add column detail_upserted_count integer;

-- Recreate (not alter) the sync status view: CREATE OR REPLACE VIEW requires
-- every existing output column to keep its name and position, so the two
-- new columns are appended at the end (same constraint hit and documented
-- in the Phase 1.2 migration).
create or replace view public.parasut_sync_status_demo
as
select distinct on (resource)
  resource,
  status,
  dry_run,
  started_at,
  finished_at,
  fetched_count,
  upserted_count,
  error_count,
  error_message,
  active_fetched_count,
  archived_fetched_count,
  detail_fetched_count,
  detail_upserted_count
from parasut.sync_runs
order by resource, started_at desc;

-- Sales invoices, with the contact's real name resolved via
-- contact_parasut_id -> parasut.contacts.parasut_id. Every column here is a
-- real, API-sourced value (or a real relationship lookup); nothing is
-- computed or estimated. Owner-privilege view (no security_invoker), same
-- pattern as the other public.parasut_*_demo views, so anon/authenticated
-- need no direct grant on parasut.* tables.
create view public.parasut_sales_invoices_demo
as
select
  si.parasut_id,
  si.invoice_no,
  si.item_type,
  si.description,
  si.issue_date,
  si.due_date,
  si.currency,
  si.exchange_rate,
  si.net_total,
  si.gross_total,
  si.total_vat,
  si.total_discount,
  si.before_taxes_total,
  si.remaining,
  si.remaining_in_trl,
  si.payment_status,
  si.billing_address,
  si.billing_postal_code,
  si.billing_phone,
  si.tax_office,
  si.tax_number,
  si.country,
  si.city,
  si.district,
  si.is_abroad,
  si.order_no,
  si.order_date,
  si.invoice_note,
  si.archived,
  si.contact_parasut_id,
  c.name as contact_name,
  si.synced_at
from parasut.sales_invoices si
left join parasut.contacts c on c.parasut_id = si.contact_parasut_id
order by si.issue_date desc nulls last;

-- Sales invoice line items. product_name is left null when the referenced
-- product hasn't been synced yet (products are out of scope for Phase 2) --
-- never fabricated.
create view public.parasut_sales_invoice_details_demo
as
select
  d.parasut_id,
  d.sales_invoice_parasut_id,
  d.description,
  d.quantity,
  d.unit_price,
  d.vat_rate,
  d.discount_type,
  d.discount_value,
  d.net_total,
  d.product_parasut_id,
  p.name as product_name,
  d.synced_at
from parasut.sales_invoice_details d
left join parasut.products p on p.parasut_id = d.product_parasut_id
order by d.sales_invoice_parasut_id, d.parasut_id;

grant select on public.parasut_sales_invoices_demo to authenticated, anon;
grant select on public.parasut_sales_invoice_details_demo to authenticated, anon;
