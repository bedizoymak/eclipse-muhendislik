-- Phase 7: sales_offers ("satış teklifleri") sync surface.
--
-- parasut.sales_offers and parasut.sales_offer_details already exist (from
-- the very first schema migration) but were missing two real API attributes
-- each, and had no public demo view. This migration only adds the missing
-- columns and a curated, real-data-only read surface for the demo frontend
-- -- it does not touch any other existing table or column.
--
-- Verified directly against the live /sales_offers API (single real account
-- record, id 1001300304): the attribute set includes net_total_in_trl and
-- vat_withholding_rate on the offer itself, and invoice_discount on each
-- sales_offer_detail line -- none of these three were present in the
-- original schema migration's column list. Every other attribute already
-- had a matching column.

alter table parasut.sales_offers
  add column net_total_in_trl numeric,
  add column vat_withholding_rate numeric;

alter table parasut.sales_offer_details
  add column invoice_discount numeric;

-- Sales offers, with the contact's real name resolved via
-- contact_parasut_id -> parasut.contacts.parasut_id, and (when the offer was
-- actually converted) the linked sales invoice's real invoice_no via
-- sales_invoice_parasut_id -> parasut.sales_invoices.parasut_id. Owner-
-- privilege view, same pattern as every other public.parasut_*_demo view.
create view public.parasut_sales_offers_demo
as
select
  o.parasut_id,
  o.description,
  o.content,
  o.status,
  o.issue_date,
  o.due_date,
  o.currency,
  o.exchange_rate,
  o.net_total,
  o.net_total_in_trl,
  o.gross_total,
  o.total_vat,
  o.total_discount,
  o.total_invoice_discount,
  o.invoice_discount_type,
  o.invoice_discount,
  o.withholding,
  o.withholding_rate,
  o.vat_withholding,
  o.vat_withholding_rate,
  o.total_vat_withholding,
  o.total_excise_duty,
  o.total_communications_tax,
  o.total_accommodation_tax,
  o.billing_address,
  o.billing_phone,
  o.billing_fax,
  o.tax_office,
  o.tax_number,
  o.city,
  o.district,
  o.is_abroad,
  o.order_no,
  o.order_date,
  o.sharings_count,
  o.display_exchange_rate_in_pdf,
  o.contact_type,
  o.archived,
  o.contact_parasut_id,
  c.name as contact_name,
  o.sales_invoice_parasut_id,
  si.invoice_no as sales_invoice_no,
  o.parasut_created_at,
  o.parasut_updated_at,
  o.synced_at
from parasut.sales_offers o
left join parasut.contacts c on c.parasut_id = o.contact_parasut_id
left join parasut.sales_invoices si on si.parasut_id = o.sales_invoice_parasut_id
order by o.issue_date desc nulls last;

-- Sales offer line items. product_name is left null when the referenced
-- product hasn't been synced -- never fabricated.
create view public.parasut_sales_offer_details_demo
as
select
  d.parasut_id,
  d.sales_offer_parasut_id,
  d.description,
  d.detail_no,
  d.quantity,
  d.unit_price,
  d.vat_rate,
  d.vat_withholding,
  d.vat_withholding_rate,
  d.discount_type,
  d.discount_value,
  d.discount,
  d.invoice_discount,
  d.excise_duty_type,
  d.excise_duty,
  d.excise_duty_rate,
  d.excise_duty_value,
  d.communications_tax_rate,
  d.communications_tax,
  d.accommodation_tax_rate,
  d.accommodation_tax,
  d.accommodation_tax_exempt,
  d.net_total,
  d.net_total_without_invoice_discount,
  d.product_parasut_id,
  p.name as product_name,
  d.parasut_created_at,
  d.parasut_updated_at,
  d.synced_at
from parasut.sales_offer_details d
left join parasut.products p on p.parasut_id = d.product_parasut_id
order by d.sales_offer_parasut_id, d.detail_no nulls last, d.parasut_id;

grant select on public.parasut_sales_offers_demo to authenticated, anon;
grant select on public.parasut_sales_offer_details_demo to authenticated, anon;
