// Maps a Parasut JSON:API "account" resource to a parasut.accounts row.
// `balance` is stored exactly as the API returns it -- never recomputed
// from transaction history.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

export interface AccountRow {
  parasut_id: number;
  name: string | null;
  account_type: string | null;
  currency: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_no: string | null;
  iban: string | null;
  balance: number | null;
  used_for: string | null;
  last_used_at: string | null;
  last_adjustment_date: string | null;
  bank_integration_type: string | null;
  associate_email: string | null;
  archived: boolean | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapAccount(item: JsonApiResource): AccountRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Account resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    name: attr(a, "name"),
    account_type: attr(a, "account_type"),
    currency: attr(a, "currency"),
    bank_name: attr(a, "bank_name"),
    bank_branch: attr(a, "bank_branch"),
    bank_account_no: attr(a, "bank_account_no"),
    iban: attr(a, "iban"),
    balance: attr(a, "balance"),
    used_for: attr(a, "used_for"),
    last_used_at: attr(a, "last_used_at"),
    last_adjustment_date: attr(a, "last_adjustment_date"),
    bank_integration_type: attr(a, "bank_integration_type"),
    associate_email: attr(a, "associate_email"),
    archived: attr(a, "archived"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
