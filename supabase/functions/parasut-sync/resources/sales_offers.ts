// Maps Parasut JSON:API "sales_offers" / "sales_offer_details" resources to
// parasut.sales_offers / parasut.sales_offer_details rows.
//
// /{company_id}/sales_offers is a real, working Parasut endpoint (verified
// directly against the live API). filter[archived] works despite the API's
// own 400 error message on an unrelated bad filter only listing
// "issue_date, contact_id" as acceptable -- same established pattern as
// other resources where the error message's "Acceptable" list is incomplete
// or stale. Verified acceptable includes on the LIST endpoint (via real 400
// responses): contact, details, details.product, sales_invoice.
//
// Phase 7.1 finding: the SINGLE-record endpoint (GET /sales_offers/{id})
// accepts a materially different include set -- its own 400 error message
// lists details, details.product, contact, contact.contact_people(.contact),
// contact.category, sales_invoice, activities, activities.item,
// activities.done_by, sharings, sharings.* as acceptable, and
// include=activities on the single endpoint genuinely resolves to real
// activity records (status-change history), while the exact same include on
// the LIST endpoint 400s ("activities is not a valid relation"). This is a
// real, verified endpoint-level API inconsistency, not a bug in this
// codebase -- so activities are fetched per-offer via the single endpoint
// (fetchResource), not via the list's include chain, which cannot resolve
// them. sharings resolves to a real empty array via the single endpoint
// (genuinely no sharings on the one real offer in this account).
//
// All monetary/status fields are used exactly as the API returns them --
// never recomputed from line items. Anything null/absent in the payload
// stays null. `raw` always holds the complete resource object for that row
// only.

import type { JsonApiResource } from "../parasut_client.ts";

function relatedId(item: JsonApiResource, key: string): number | null {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return null;
  const id = Number(rel.id);
  return Number.isFinite(id) ? id : null;
}

function relatedIds(item: JsonApiResource, key: string): string[] {
  const rel = item.relationships?.[key]?.data;
  if (!rel || !Array.isArray(rel)) return [];
  return rel.map((r) => r.id);
}

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

export interface SalesOfferRow {
  parasut_id: number;
  content: string | null;
  contact_type: string | null;
  status: string | null;
  display_exchange_rate_in_pdf: boolean | null;
  net_total: number | null;
  net_total_in_trl: number | null;
  gross_total: number | null;
  withholding: number | null;
  withholding_rate: number | null;
  total_excise_duty: number | null;
  total_communications_tax: number | null;
  total_accommodation_tax: number | null;
  total_vat: number | null;
  total_vat_withholding: number | null;
  vat_withholding: number | null;
  vat_withholding_rate: number | null;
  total_discount: number | null;
  total_invoice_discount: number | null;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  exchange_rate: number | null;
  invoice_discount_type: string | null;
  invoice_discount: number | null;
  billing_address: string | null;
  billing_phone: string | null;
  billing_fax: string | null;
  tax_office: string | null;
  tax_number: string | null;
  city: string | null;
  district: string | null;
  is_abroad: boolean | null;
  order_no: string | null;
  order_date: string | null;
  sharings_count: number | null;
  archived: boolean | null;
  contact_parasut_id: number | null;
  sales_invoice_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapSalesOffer(item: JsonApiResource): SalesOfferRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`SalesOffer resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    content: attr(a, "content"),
    contact_type: attr(a, "contact_type"),
    status: attr(a, "status"),
    display_exchange_rate_in_pdf: attr(a, "display_exchange_rate_in_pdf"),
    net_total: attr(a, "net_total"),
    net_total_in_trl: attr(a, "net_total_in_trl"),
    gross_total: attr(a, "gross_total"),
    withholding: attr(a, "withholding"),
    withholding_rate: attr(a, "withholding_rate"),
    total_excise_duty: attr(a, "total_excise_duty"),
    total_communications_tax: attr(a, "total_communications_tax"),
    total_accommodation_tax: attr(a, "total_accommodation_tax"),
    total_vat: attr(a, "total_vat"),
    total_vat_withholding: attr(a, "total_vat_withholding"),
    vat_withholding: attr(a, "vat_withholding"),
    vat_withholding_rate: attr(a, "vat_withholding_rate"),
    total_discount: attr(a, "total_discount"),
    total_invoice_discount: attr(a, "total_invoice_discount"),
    description: attr(a, "description"),
    issue_date: attr(a, "issue_date"),
    due_date: attr(a, "due_date"),
    currency: attr(a, "currency"),
    exchange_rate: attr(a, "exchange_rate"),
    invoice_discount_type: attr(a, "invoice_discount_type"),
    invoice_discount: attr(a, "invoice_discount"),
    billing_address: attr(a, "billing_address"),
    billing_phone: attr(a, "billing_phone"),
    billing_fax: attr(a, "billing_fax"),
    tax_office: attr(a, "tax_office"),
    tax_number: attr(a, "tax_number"),
    city: attr(a, "city"),
    district: attr(a, "district"),
    is_abroad: attr(a, "is_abroad"),
    order_no: attr(a, "order_no"),
    order_date: attr(a, "order_date"),
    sharings_count: attr(a, "sharings_count"),
    archived: attr(a, "archived"),
    contact_parasut_id: relatedId(item, "contact"),
    sales_invoice_parasut_id: relatedId(item, "sales_invoice"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export function detailIdsForOffer(item: JsonApiResource): string[] {
  return relatedIds(item, "details");
}

export interface SalesOfferDetailRow {
  parasut_id: number;
  description: string | null;
  net_total: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  quantity: number | null;
  discount_type: string | null;
  discount_value: number | null;
  communications_tax_rate: number | null;
  excise_duty_type: string | null;
  excise_duty: number | null;
  excise_duty_rate: number | null;
  excise_duty_value: number | null;
  discount: number | null;
  communications_tax: number | null;
  detail_no: number | null;
  net_total_without_invoice_discount: number | null;
  invoice_discount: number | null;
  vat_withholding: number | null;
  vat_withholding_rate: number | null;
  accommodation_tax_rate: number | null;
  accommodation_tax: number | null;
  accommodation_tax_exempt: boolean | null;
  sales_offer_parasut_id: number;
  product_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapSalesOfferDetail(item: JsonApiResource, offerParasutId: number): SalesOfferDetailRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`SalesOfferDetail resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    description: attr(a, "description"),
    net_total: attr(a, "net_total"),
    unit_price: attr(a, "unit_price"),
    vat_rate: attr(a, "vat_rate"),
    quantity: attr(a, "quantity"),
    discount_type: attr(a, "discount_type"),
    discount_value: attr(a, "discount_value"),
    communications_tax_rate: attr(a, "communications_tax_rate"),
    excise_duty_type: attr(a, "excise_duty_type"),
    excise_duty: attr(a, "excise_duty"),
    excise_duty_rate: attr(a, "excise_duty_rate"),
    excise_duty_value: attr(a, "excise_duty_value"),
    discount: attr(a, "discount"),
    communications_tax: attr(a, "communications_tax"),
    detail_no: attr(a, "detail_no"),
    net_total_without_invoice_discount: attr(a, "net_total_without_invoice_discount"),
    invoice_discount: attr(a, "invoice_discount"),
    vat_withholding: attr(a, "vat_withholding"),
    vat_withholding_rate: attr(a, "vat_withholding_rate"),
    accommodation_tax_rate: attr(a, "accommodation_tax_rate"),
    accommodation_tax: attr(a, "accommodation_tax"),
    accommodation_tax_exempt: attr(a, "accommodation_tax_exempt"),
    sales_offer_parasut_id: offerParasutId,
    product_parasut_id: relatedId(item, "product"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export interface SalesOfferActivityRow {
  parasut_id: number;
  sales_offer_parasut_id: number;
  activity_type: string | null;
  date: string | null;
  data: unknown;
  done_by_email: string | null;
  done_by_parasut_id: number | null;
  done_by_type: string | null;
  item_parasut_id: number | null;
  item_type: string | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapSalesOfferActivity(item: JsonApiResource, offerParasutId: number): SalesOfferActivityRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`SalesOfferActivity resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    sales_offer_parasut_id: offerParasutId,
    activity_type: attr(a, "activity_type"),
    date: attr(a, "date"),
    data: attr(a, "data"),
    done_by_email: attr(a, "done_by_email"),
    done_by_parasut_id: relatedId(item, "done_by"),
    done_by_type: (() => {
      const rel = item.relationships?.["done_by"]?.data;
      return rel && !Array.isArray(rel) ? rel.type ?? null : null;
    })(),
    item_parasut_id: relatedId(item, "item"),
    item_type: (() => {
      const rel = item.relationships?.["item"]?.data;
      return rel && !Array.isArray(rel) ? rel.type ?? null : null;
    })(),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
