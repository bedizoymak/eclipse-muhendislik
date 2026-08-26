// Maps Parasut JSON:API "sales_invoices" / "sales_invoice_details" resources
// to parasut.sales_invoices / parasut.sales_invoice_details rows.
//
// All monetary/status fields (net_total, gross_total, total_vat, remaining,
// payment_status, ...) are used exactly as the API returns them -- never
// recomputed from line items. Anything null/absent in the payload stays
// null. `raw` always holds the complete resource object for that row only
// (the invoice's own raw does not embed its details, and vice versa).

import type { JsonApiResource } from "../parasut_client.ts";

function relatedId(item: JsonApiResource, key: string): number | null {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return null;
  const id = Number(rel.id);
  return Number.isFinite(id) ? id : null;
}

function relatedType(item: JsonApiResource, key: string): string | null {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return null;
  return rel.type ?? null;
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

export interface SalesInvoiceRow {
  parasut_id: number;
  invoice_no: string | null;
  invoice_series: string | null;
  invoice_id: number | null;
  item_type: string | null;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  exchange_rate: number | null;
  net_total: number | null;
  gross_total: number | null;
  withholding: number | null;
  withholding_rate: number | null;
  total_excise_duty: number | null;
  total_communications_tax: number | null;
  total_vat: number | null;
  total_vat_withholding: number | null;
  total_discount: number | null;
  total_invoice_discount: number | null;
  before_taxes_total: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  payment_status: string | null;
  invoice_discount_type: string | null;
  invoice_discount: number | null;
  billing_address: string | null;
  billing_postal_code: string | null;
  billing_phone: string | null;
  billing_fax: string | null;
  tax_office: string | null;
  tax_number: string | null;
  country: string | null;
  city: string | null;
  district: string | null;
  is_abroad: boolean | null;
  order_no: string | null;
  order_date: string | null;
  shipment_addres: string | null;
  shipment_included: boolean | null;
  cash_sale: boolean | null;
  payer_tax_numbers: unknown;
  invoice_note: string | null;
  append_contact_balance: boolean | null;
  e_document_accounts: unknown;
  archived: boolean | null;
  category_parasut_id: number | null;
  contact_parasut_id: number | null;
  sales_offer_parasut_id: number | null;
  recurrence_plan_parasut_id: number | null;
  active_e_document_type: string | null;
  active_e_document_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapSalesInvoice(item: JsonApiResource): SalesInvoiceRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`SalesInvoice resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    invoice_no: attr(a, "invoice_no"),
    invoice_series: attr(a, "invoice_series"),
    invoice_id: attr(a, "invoice_id"),
    item_type: attr(a, "item_type"),
    description: attr(a, "description"),
    issue_date: attr(a, "issue_date"),
    due_date: attr(a, "due_date"),
    currency: attr(a, "currency"),
    exchange_rate: attr(a, "exchange_rate"),
    net_total: attr(a, "net_total"),
    gross_total: attr(a, "gross_total"),
    withholding: attr(a, "withholding"),
    withholding_rate: attr(a, "withholding_rate"),
    total_excise_duty: attr(a, "total_excise_duty"),
    total_communications_tax: attr(a, "total_communications_tax"),
    total_vat: attr(a, "total_vat"),
    total_vat_withholding: attr(a, "total_vat_withholding"),
    total_discount: attr(a, "total_discount"),
    total_invoice_discount: attr(a, "total_invoice_discount"),
    before_taxes_total: attr(a, "before_taxes_total"),
    remaining: attr(a, "remaining"),
    remaining_in_trl: attr(a, "remaining_in_trl"),
    payment_status: attr(a, "payment_status"),
    invoice_discount_type: attr(a, "invoice_discount_type"),
    invoice_discount: attr(a, "invoice_discount"),
    billing_address: attr(a, "billing_address"),
    billing_postal_code: attr(a, "billing_postal_code"),
    billing_phone: attr(a, "billing_phone"),
    billing_fax: attr(a, "billing_fax"),
    tax_office: attr(a, "tax_office"),
    tax_number: attr(a, "tax_number"),
    country: attr(a, "country"),
    city: attr(a, "city"),
    district: attr(a, "district"),
    is_abroad: attr(a, "is_abroad"),
    order_no: attr(a, "order_no"),
    order_date: attr(a, "order_date"),
    shipment_addres: attr(a, "shipment_addres"),
    shipment_included: attr(a, "shipment_included"),
    cash_sale: attr(a, "cash_sale"),
    payer_tax_numbers: attr(a, "payer_tax_numbers"),
    invoice_note: attr(a, "invoice_note"),
    append_contact_balance: attr(a, "append_contact_balance"),
    e_document_accounts: attr(a, "e_document_accounts"),
    archived: attr(a, "archived"),
    category_parasut_id: relatedId(item, "category"),
    contact_parasut_id: relatedId(item, "contact"),
    sales_offer_parasut_id: relatedId(item, "sales_offer"),
    recurrence_plan_parasut_id: relatedId(item, "recurrence_plan"),
    active_e_document_type: relatedType(item, "active_e_document"),
    active_e_document_parasut_id: relatedId(item, "active_e_document"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export function detailIdsForInvoice(item: JsonApiResource): string[] {
  return relatedIds(item, "details");
}

export interface SalesInvoiceDetailRow {
  parasut_id: number;
  quantity: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  vat_withholding_rate: number | null;
  vat_withholding: number | null;
  discount_type: string | null;
  discount_value: number | null;
  excise_duty_type: string | null;
  excise_duty_value: number | null;
  communications_tax_rate: number | null;
  description: string | null;
  delivery_method: string | null;
  shipping_method: string | null;
  net_total: number | null;
  sales_invoice_parasut_id: number;
  warehouse_parasut_id: number | null;
  product_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapSalesInvoiceDetail(item: JsonApiResource, invoiceParasutId: number): SalesInvoiceDetailRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`SalesInvoiceDetail resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    quantity: attr(a, "quantity"),
    unit_price: attr(a, "unit_price"),
    vat_rate: attr(a, "vat_rate"),
    vat_withholding_rate: attr(a, "vat_withholding_rate"),
    vat_withholding: attr(a, "vat_withholding"),
    discount_type: attr(a, "discount_type"),
    discount_value: attr(a, "discount_value"),
    excise_duty_type: attr(a, "excise_duty_type"),
    excise_duty_value: attr(a, "excise_duty_value"),
    communications_tax_rate: attr(a, "communications_tax_rate"),
    description: attr(a, "description"),
    delivery_method: attr(a, "delivery_method"),
    shipping_method: attr(a, "shipping_method"),
    net_total: attr(a, "net_total"),
    sales_invoice_parasut_id: invoiceParasutId,
    warehouse_parasut_id: relatedId(item, "warehouse"),
    product_parasut_id: relatedId(item, "product"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
