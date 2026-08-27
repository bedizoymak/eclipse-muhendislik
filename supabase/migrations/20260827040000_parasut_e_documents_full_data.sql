-- Phase 8: e-Belgeler (e-Fatura / e-Arşiv) via sales_invoices/purchase_bills'
-- real `active_e_document` relationship.
--
-- Verified directly against the live API (full pagination, 451 sales
-- invoices + 811 purchase bills, all real):
--   * Every one of the 451 sales_invoices and 811 purchase_bills has a real,
--     non-null active_e_document (0 without a document).
--   * sales_invoices' documents split 427 e_invoices / 24 e_archives.
--   * purchase_bills' documents are 811 e_invoices / 0 e_archives (e_archive
--     never observed on a purchase bill in this account).
--   * e_invoices is a genuinely POLYMORPHIC child: 427 belong to
--     sales_invoices and 811 belong to purchase_bills -- the pre-existing
--     `invoice_parasut_id` column cannot represent which parent TYPE a row
--     belongs to, so real polymorphic parent_type/parent_parasut_id columns
--     are added instead of reusing that ambiguous column (left untouched,
--     unpopulated -- not a regression, it was already null for every row).
--   * e_archives only ever attaches to sales_invoices in this account (0/24
--     to purchase_bills) -- its existing sales_invoice_parasut_id column
--     already correctly represents this, just needs to be populated.
--   * Every child's own relationships (e_invoices.invoice/responses/
--     activities, e_archives.sales_invoice) come back completely empty
--     (`{"meta":{}}`) even when included -- same established Parasut
--     pattern seen everywhere else in this project (payments, checks) --
--     so the parent link is always backfilled from the PARENT's own
--     relationships.active_e_document.data, never guessed from amount/date/
--     description.
--   * No document id collides between the two type namespaces (0 overlap).
--
-- Both e_invoices and e_archives already existed (Phase 0 schema) but were
-- missing real attributes the live API actually returns -- added here.
-- Existing rows (populated earlier by scripts/sync_parasut.py) are kept;
-- this migration only adds columns, it never drops/recreates data.

alter table parasut.e_invoices
  add column archived boolean,
  add column expires_at date,
  add column html_url text,
  add column invoice_type_code text,
  add column is_seen boolean,
  add column migration_source text,
  add column non_standard_e_invoice boolean,
  add column pdf_url text,
  add column profile_id text,
  add column refund_of_id bigint,
  add column signed_ubl_url text,
  add column status_code text,
  add column status_message text,
  add column total_vat numeric,
  add column vat_exemption_reason_code text,
  add column rendered_ubl_path text,
  add column ubl_remote_id text,
  add column signed_ubl_remote_id text,
  add column parent_type text,
  add column parent_parasut_id bigint;

create index if not exists e_invoices_parent_idx on parasut.e_invoices(parent_type, parent_parasut_id);

alter table parasut.e_archives
  add column email_status text,
  add column html_url text,
  add column migration_source text,
  add column pdf_url text,
  add column signed_ubl_url text;

create index if not exists e_archives_sales_invoice_parasut_id_idx on parasut.e_archives(sales_invoice_parasut_id);

-- Safe public read surface: no raw jsonb, no internal __-prefixed remote-id
-- tracking fields (rendered_ubl_path/ubl_remote_id/signed_ubl_remote_id --
-- these are Parasut-internal bookkeeping, always null/never populated in
-- this account's real data, and not meaningful business fields).
create view public.parasut_e_invoices_demo
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
  e.synced_at
from parasut.e_invoices e
order by e.issue_date desc nulls last;

create view public.parasut_e_archives_demo
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
  a.synced_at
from parasut.e_archives a
order by a.parasut_created_at desc nulls last;

grant select on public.parasut_e_invoices_demo to authenticated, anon;
grant select on public.parasut_e_archives_demo to authenticated, anon;

-- Append the parent's real active_e_document id/type to the existing demo
-- views (CREATE OR REPLACE VIEW cannot reorder/insert among existing
-- columns, so these are appended at the end, same constraint hit and
-- documented in every prior *_demo view migration in this project).
create or replace view public.parasut_sales_invoices_demo
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
  si.synced_at,
  si.active_e_document_type,
  si.active_e_document_parasut_id
from parasut.sales_invoices si
left join parasut.contacts c on c.parasut_id = si.contact_parasut_id
order by si.issue_date desc nulls last;

create or replace view public.parasut_purchase_bills_demo
as
select
  pb.parasut_id,
  pb.invoice_no,
  pb.item_type,
  pb.description,
  pb.issue_date,
  pb.due_date,
  pb.currency,
  pb.exchange_rate,
  pb.net_total,
  pb.gross_total,
  pb.total_vat,
  pb.total_discount,
  pb.total_paid,
  pb.remaining,
  pb.remaining_in_trl,
  pb.payment_status,
  pb.archived,
  pb.supplier_parasut_id,
  sup.name as supplier_name,
  pb.spender_parasut_id,
  spd.name as spender_name,
  pb.pay_to_parasut_id,
  coalesce(pay_to_contact.name, pay_to_employee.name) as pay_to_name,
  pb.synced_at,
  pb.active_e_document_type,
  pb.active_e_document_parasut_id
from parasut.purchase_bills pb
left join parasut.contacts sup on sup.parasut_id = pb.supplier_parasut_id
left join parasut.employees spd on spd.parasut_id = pb.spender_parasut_id
left join parasut.contacts pay_to_contact on pay_to_contact.parasut_id = pb.pay_to_parasut_id
left join parasut.employees pay_to_employee on pay_to_employee.parasut_id = pb.pay_to_parasut_id
order by pb.issue_date desc nulls last;

grant select on public.parasut_sales_invoices_demo to authenticated, anon;
grant select on public.parasut_purchase_bills_demo to authenticated, anon;
