// Maps a Parasut JSON:API "payment" resource to a parasut.payments row.
//
// Parasut has no standalone /payments list endpoint (verified against both
// swagger and the live API) -- payments are only reachable nested under
// their payable resource (sales_invoices, purchase_bills, bank_fees,
// salaries, taxes, checks), via include=payments on that resource's list
// endpoint. Phase 1.2 synced sales_invoices payments; Phase 4 adds
// purchase_bills payments (expense payments); Phase 6.2 adds checks
// payments. bank_fees/salaries/taxes payments remain out of scope and are
// not represented here.
//
// The payment resource's own `relationships.payable` comes back empty from
// the API even when requested (verified) -- so payable_type/payable_id are
// NOT guessed from the payment itself. They are the invoice/bill/check this
// payment was found on, which Parasut's own data already stated via that
// parent resource's relationships.payments.data -- a real, explicit
// relationship, not an inference.
//
// due_date/matched_amount/amount_in_trl/paid_in_currency (added Phase 6.2)
// are real attributes the payment resource has always returned -- verified
// directly against the live API's included payment objects.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

function relatedId(item: JsonApiResource, key: string): number | null {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return null;
  const id = Number(rel.id);
  return Number.isFinite(id) ? id : null;
}

/** The payment ids a sales_invoice's or purchase_bill's own relationships.payments lists. */
export function paymentIdsForInvoice(resource: JsonApiResource): string[] {
  const rel = resource.relationships?.payments?.data;
  if (!rel || !Array.isArray(rel)) return [];
  return rel.map((r) => r.id);
}

export interface PaymentRow {
  parasut_id: number;
  date: string | null;
  due_date: string | null;
  amount: number | null;
  matched_amount: number | null;
  amount_in_trl: number | null;
  currency: string | null;
  paid_in_currency: string | null;
  notes: string | null;
  payable_type: string;
  payable_parasut_id: number;
  transaction_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapPayment(
  item: JsonApiResource,
  payableParasutId: number,
  payableType: "sales_invoices" | "purchase_bills" | "checks" = "sales_invoices",
): PaymentRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Payment resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    date: attr(a, "date"),
    due_date: attr(a, "due_date"),
    amount: attr(a, "amount"),
    matched_amount: attr(a, "matched_amount"),
    amount_in_trl: attr(a, "amount_in_trl"),
    currency: attr(a, "currency"),
    paid_in_currency: attr(a, "paid_in_currency"),
    notes: attr(a, "notes"),
    payable_type: payableType,
    payable_parasut_id: payableParasutId,
    transaction_parasut_id: relatedId(item, "transaction"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
