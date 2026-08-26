// Maps a Parasut JSON:API "payment" resource to a parasut.payments row.
//
// Parasut has no standalone /payments list endpoint (verified against both
// swagger and the live API) -- payments are only reachable nested under
// their payable resource (sales_invoices, purchase_bills, bank_fees,
// salaries, taxes), via include=payments on that resource's list endpoint.
// This sync only covers payments on sales_invoices (matches the
// /satislar/tahsilatlar scope); purchase_bills/bank_fees/salaries/taxes
// payments are out of scope and are not represented here.
//
// The payment resource's own `relationships.payable` comes back empty from
// the API even when requested (verified) -- so payable_type/payable_id are
// NOT guessed from the payment itself. They are the invoice this payment
// was found on, which Parasut's own data already stated via
// invoice.relationships.payments.data -- a real, explicit relationship,
// not an inference.

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

/** The payment ids a sales_invoice's own relationships.payments lists. */
export function paymentIdsForInvoice(invoice: JsonApiResource): string[] {
  const rel = invoice.relationships?.payments?.data;
  if (!rel || !Array.isArray(rel)) return [];
  return rel.map((r) => r.id);
}

export interface PaymentRow {
  parasut_id: number;
  date: string | null;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  payable_type: string;
  payable_parasut_id: number;
  transaction_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapPayment(item: JsonApiResource, payableInvoiceParasutId: number): PaymentRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Payment resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    date: attr(a, "date"),
    amount: attr(a, "amount"),
    currency: attr(a, "currency"),
    notes: attr(a, "notes"),
    payable_type: "sales_invoices",
    payable_parasut_id: payableInvoiceParasutId,
    transaction_parasut_id: relatedId(item, "transaction"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
