// Maps a Parasut JSON:API "check" resource to a parasut.checks row.
//
// /{company_id}/checks is a REAL, working endpoint (verified directly
// against the live API) that is completely absent from the published
// swagger spec -- "checks" only appears there as an enum value inside
// polymorphic payable/pay_to type lists, never as its own path or schema.
// Every field mapped here is copied verbatim from the API's own attributes
// -- serial_number, bank_identifier/bank_name, due_date, payment_status,
// is_in/is_out (the API's own received/issued distinction, not inferred
// from any description text) are all real, provided fields, never derived
// or guessed. filter[archived] is not a valid filter here either (verified:
// the API rejects it, listing the real acceptable filters), so this is
// fetched as a single full listing, not an active/archived dual stream.
//
// issued_by/given_to are real relationships (verified: type "contacts" in
// every observed sample) that only resolve to `.data` once explicitly
// included -- same established pattern as every other Parasut relationship
// in this codebase.

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

function relatedType(item: JsonApiResource, key: string): string | null {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return null;
  return rel.type ?? null;
}

export interface CheckRow {
  parasut_id: number;
  currency: string | null;
  description: string | null;
  due_date: string | null;
  issue_date: string | null;
  net_total: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  payment_status: string | null;
  is_cashed: boolean | null;
  is_in: boolean | null;
  is_out: boolean | null;
  is_transferred: boolean | null;
  days_overdue: number | null;
  days_till_due_date: number | null;
  bank_identifier: string | null;
  bank_name: string | null;
  serial_number: string | null;
  issued_by_parasut_id: number | null;
  issued_by_type: string | null;
  given_to_parasut_id: number | null;
  given_to_type: string | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapCheck(item: JsonApiResource): CheckRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Check resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    currency: attr(a, "currency"),
    description: attr(a, "description"),
    due_date: attr(a, "due_date"),
    issue_date: attr(a, "issue_date"),
    net_total: attr(a, "net_total"),
    remaining: attr(a, "remaining"),
    remaining_in_trl: attr(a, "remaining_in_trl"),
    payment_status: attr(a, "payment_status"),
    is_cashed: attr(a, "is_cashed"),
    is_in: attr(a, "is_in"),
    is_out: attr(a, "is_out"),
    is_transferred: attr(a, "is_transferred"),
    days_overdue: attr(a, "days_overdue"),
    days_till_due_date: attr(a, "days_till_due_date"),
    bank_identifier: attr(a, "bank_identifier"),
    bank_name: attr(a, "bank_name"),
    serial_number: attr(a, "serial_number"),
    issued_by_parasut_id: relatedId(item, "issued_by"),
    issued_by_type: relatedType(item, "issued_by"),
    given_to_parasut_id: relatedId(item, "given_to"),
    given_to_type: relatedType(item, "given_to"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
