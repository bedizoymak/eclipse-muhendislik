// Maps a Parasut JSON:API "transaction" resource (fetched via
// /accounts/{id}/transactions?include=debit_account,credit_account) to a
// parasut.transactions row.
//
// debit_account/credit_account are polymorphic in the real API (verified
// against live data): most point to "accounts", but some point to
// "contacts" (e.g. a contact_credit transaction against a customer's
// running balance). The swagger spec only documents "accounts" for both,
// which is incomplete -- both id and type are stored so nothing is
// mis-typed as an account it isn't.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

function relatedIdAndType(item: JsonApiResource, key: string): { id: number | null; type: string | null } {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return { id: null, type: null };
  const id = Number(rel.id);
  return { id: Number.isFinite(id) ? id : null, type: rel.type ?? null };
}

export interface TransactionRow {
  parasut_id: number;
  description: string | null;
  transaction_type: string | null;
  date: string | null;
  amount_in_trl: number | null;
  debit_amount: number | null;
  debit_currency: string | null;
  credit_amount: number | null;
  credit_currency: string | null;
  debit_account_parasut_id: number | null;
  debit_account_type: string | null;
  credit_account_parasut_id: number | null;
  credit_account_type: string | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapTransaction(item: JsonApiResource): TransactionRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Transaction resource has a non-numeric id: ${item.id}`);
  }

  const debit = relatedIdAndType(item, "debit_account");
  const credit = relatedIdAndType(item, "credit_account");

  return {
    parasut_id: parasutId,
    description: attr(a, "description"),
    transaction_type: attr(a, "transaction_type"),
    date: attr(a, "date"),
    amount_in_trl: attr(a, "amount_in_trl"),
    debit_amount: attr(a, "debit_amount"),
    debit_currency: attr(a, "debit_currency"),
    credit_amount: attr(a, "credit_amount"),
    credit_currency: attr(a, "credit_currency"),
    debit_account_parasut_id: debit.id,
    debit_account_type: debit.type,
    credit_account_parasut_id: credit.id,
    credit_account_type: credit.type,
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
