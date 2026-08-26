// Maps Parasut JSON:API "purchase_bills" / "purchase_bill_details" resources
// to parasut.purchase_bills / parasut.purchase_bill_details rows.
//
// All monetary/status fields (net_total, gross_total, total_vat, total_paid,
// remaining, payment_status, ...) are used exactly as the API returns them
// -- never recomputed from line items. `supplier_parasut_id` comes from the
// bill's real `relationships.supplier` (type "contacts"); `spender_parasut_id`
// from `relationships.spender` (type "employees", genuinely null when a bill
// has no spender -- not guessed); `pay_to` is polymorphic (contacts or
// employees) so both id and type are stored.

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

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

export interface PurchaseBillRow {
  parasut_id: number;
  item_type: string | null;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  invoice_no: string | null;
  currency: string | null;
  exchange_rate: number | null;
  net_total: number | null;
  withholding_rate: number | null;
  invoice_discount_type: string | null;
  invoice_discount: number | null;
  gross_total: number | null;
  total_excise_duty: number | null;
  total_communications_tax: number | null;
  total_vat: number | null;
  total_vat_withholding: number | null;
  total_discount: number | null;
  total_invoice_discount: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  payment_status: string | null;
  is_detailed: boolean | null;
  sharings_count: number | null;
  e_invoices_count: number | null;
  remaining_reimbursement: number | null;
  remaining_reimbursement_in_trl: number | null;
  total_paid: number | null;
  archived: boolean | null;
  category_parasut_id: number | null;
  spender_parasut_id: number | null;
  supplier_parasut_id: number | null;
  pay_to_parasut_id: number | null;
  recurrence_plan_parasut_id: number | null;
  active_e_document_type: string | null;
  active_e_document_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapPurchaseBill(item: JsonApiResource): PurchaseBillRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`PurchaseBill resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    item_type: attr(a, "item_type"),
    description: attr(a, "description"),
    issue_date: attr(a, "issue_date"),
    due_date: attr(a, "due_date"),
    invoice_no: attr(a, "invoice_no"),
    currency: attr(a, "currency"),
    exchange_rate: attr(a, "exchange_rate"),
    net_total: attr(a, "net_total"),
    withholding_rate: attr(a, "withholding_rate"),
    invoice_discount_type: attr(a, "invoice_discount_type"),
    invoice_discount: attr(a, "invoice_discount"),
    gross_total: attr(a, "gross_total"),
    total_excise_duty: attr(a, "total_excise_duty"),
    total_communications_tax: attr(a, "total_communications_tax"),
    total_vat: attr(a, "total_vat"),
    total_vat_withholding: attr(a, "total_vat_withholding"),
    total_discount: attr(a, "total_discount"),
    total_invoice_discount: attr(a, "total_invoice_discount"),
    remaining: attr(a, "remaining"),
    remaining_in_trl: attr(a, "remaining_in_trl"),
    payment_status: attr(a, "payment_status"),
    is_detailed: attr(a, "is_detailed"),
    sharings_count: attr(a, "sharings_count"),
    e_invoices_count: attr(a, "e_invoices_count"),
    remaining_reimbursement: attr(a, "remaining_reimbursement"),
    remaining_reimbursement_in_trl: attr(a, "remaining_reimbursement_in_trl"),
    total_paid: attr(a, "total_paid"),
    archived: attr(a, "archived"),
    category_parasut_id: relatedId(item, "category"),
    spender_parasut_id: relatedId(item, "spender"),
    supplier_parasut_id: relatedId(item, "supplier"),
    pay_to_parasut_id: relatedId(item, "pay_to"),
    recurrence_plan_parasut_id: relatedId(item, "recurrence_plan"),
    active_e_document_type: relatedType(item, "active_e_document"),
    active_e_document_parasut_id: relatedId(item, "active_e_document"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export function detailIdsForBill(bill: JsonApiResource): string[] {
  const rel = bill.relationships?.details?.data;
  if (!rel || !Array.isArray(rel)) return [];
  return rel.map((r) => r.id);
}

export interface PurchaseBillDetailRow {
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
  net_total: number | null;
  purchase_bill_parasut_id: number;
  warehouse_parasut_id: number | null;
  product_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapPurchaseBillDetail(item: JsonApiResource, billParasutId: number): PurchaseBillDetailRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`PurchaseBillDetail resource has a non-numeric id: ${item.id}`);
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
    net_total: attr(a, "net_total"),
    purchase_bill_parasut_id: billParasutId,
    warehouse_parasut_id: relatedId(item, "warehouse"),
    product_parasut_id: relatedId(item, "product"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
