// Maps a Parasut JSON:API "contact" resource to a parasut.contacts row.
// Every mapped column comes directly from attributes/relationships that the
// API actually returned; anything null/absent in the payload stays null
// here. `raw` always holds the complete resource object.

import type { JsonApiResource } from "../parasut_client.ts";

function relatedId(item: JsonApiResource, key: string): number | null {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return null;
  const id = Number(rel.id);
  return Number.isFinite(id) ? id : null;
}

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

export interface ContactRow {
  parasut_id: number;
  name: string | null;
  short_name: string | null;
  email: string | null;
  contact_type: string | null;
  tax_office: string | null;
  tax_number: string | null;
  district: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  is_abroad: boolean | null;
  archived: boolean | null;
  iban: string | null;
  account_type: string | null;
  untrackable: boolean | null;
  invoicing_preferences: unknown;
  balance: number | null;
  trl_balance: number | null;
  usd_balance: number | null;
  eur_balance: number | null;
  gbp_balance: number | null;
  category_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapContact(item: JsonApiResource): ContactRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Contact resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    name: attr(a, "name"),
    short_name: attr(a, "short_name"),
    email: attr(a, "email"),
    contact_type: attr(a, "contact_type"),
    tax_office: attr(a, "tax_office"),
    tax_number: attr(a, "tax_number"),
    district: attr(a, "district"),
    postal_code: attr(a, "postal_code"),
    city: attr(a, "city"),
    country: attr(a, "country"),
    address: attr(a, "address"),
    phone: attr(a, "phone"),
    fax: attr(a, "fax"),
    is_abroad: attr(a, "is_abroad"),
    archived: attr(a, "archived"),
    iban: attr(a, "iban"),
    account_type: attr(a, "account_type"),
    untrackable: attr(a, "untrackable"),
    invoicing_preferences: attr(a, "invoicing_preferences"),
    balance: attr(a, "balance"),
    trl_balance: attr(a, "trl_balance"),
    usd_balance: attr(a, "usd_balance"),
    eur_balance: attr(a, "eur_balance"),
    gbp_balance: attr(a, "gbp_balance"),
    category_parasut_id: relatedId(item, "category"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
