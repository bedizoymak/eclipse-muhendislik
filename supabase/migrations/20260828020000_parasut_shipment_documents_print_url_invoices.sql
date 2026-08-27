-- Phase 9.1: two real gaps found by re-querying the live API with full
-- includes on all 15 real shipment_documents:
--
--   * `print_url` is a real attribute (15/15 populated, always an already-
--     absolute https://api.parasut.com/... URL -- unlike e_invoices'
--     pdf_url/html_url, never relative) that Phase 9 never added to the
--     base table, mapper, or view. A genuine sync/schema omission, not a
--     UI-only gap -- requires a real resync to backfill.
--   * `invoices` is a real to-many relationship, verified via the single-
--     record endpoint on all 15 documents: 14/15 genuinely empty (`data:[]`),
--     but document 1001145751 has a real link to sales_invoice 1039436257
--     (matches that document's own `has_invoice: true`). Never observed in
--     Phase 9 because the list endpoint's own 400 error message never lists
--     "invoices" as an acceptable include (same list/single inconsistency
--     as activities). Modeled as a real many-to-many junction table since
--     the relationship is a JSON:API array, even though only one real link
--     exists in this account today.

alter table parasut.shipment_documents
  add column print_url text;

create table parasut.shipment_document_invoices (
  id uuid primary key default gen_random_uuid(),
  shipment_document_parasut_id bigint not null,
  sales_invoice_parasut_id bigint not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint shipment_document_invoices_unique unique (shipment_document_parasut_id, sales_invoice_parasut_id)
);

create index shipment_document_invoices_shipment_document_idx
  on parasut.shipment_document_invoices(shipment_document_parasut_id);

alter table parasut.shipment_document_invoices enable row level security;
grant all on parasut.shipment_document_invoices to service_role;

-- Append print_url to the existing demo view (CREATE OR REPLACE VIEW cannot
-- reorder existing columns, so it goes at the end, same constraint as every
-- other *_demo view migration in this project).
create or replace view public.parasut_shipment_documents_demo
as
select
  s.parasut_id,
  s.description,
  s.uuid,
  s.despatch_no,
  s.order_no,
  s.order_date,
  s.status,
  s.status_message,
  s.status_changed_at,
  s.shipment_document_type,
  s.inflow,
  s.is_commercial,
  s.issue_date,
  s.issue_datetime,
  s.shipment_date,
  s.printed_issue_date,
  s.printed_at,
  s.print_note,
  s.legalized_at,
  s.sharings_count,
  s.has_invoice,
  s.invoice_no,
  s.procurement_number,
  s.carrier_legal_name,
  s.carrier_tax_number,
  s.carrier_license_plate,
  s.drivers_info,
  s.address,
  s.city,
  s.district,
  s.postal_code,
  s.company_address,
  s.company_city,
  s.company_district,
  s.company_postal_code,
  s.archived,
  s.contact_parasut_id,
  c.name as contact_name,
  s.warehouse_transfer_parasut_id,
  s.e_despatch_response_type,
  s.e_despatch_response_parasut_id,
  s.inbound_e_despatch_parasut_id,
  s.parasut_created_at,
  s.parasut_updated_at,
  s.synced_at,
  s.print_url
from parasut.shipment_documents s
left join parasut.contacts c on c.parasut_id = s.contact_parasut_id
order by s.issue_date desc nulls last;

grant select on public.parasut_shipment_documents_demo to authenticated, anon;

create view public.parasut_shipment_document_invoices_demo
as
select
  i.shipment_document_parasut_id,
  i.sales_invoice_parasut_id,
  si.invoice_no as sales_invoice_no,
  i.synced_at
from parasut.shipment_document_invoices i
left join parasut.sales_invoices si on si.parasut_id = i.sales_invoice_parasut_id
order by i.shipment_document_parasut_id;

grant select on public.parasut_shipment_document_invoices_demo to authenticated, anon;
