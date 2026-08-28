// Maps a Parasut JSON:API "tax" resource to a parasut.taxes row.
// Phase 13: this account has 0 real tax records today (GET /taxes -> 200,
// real data:[]). Columns match the schema already created in the Phase 0
// bulk migration.

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
  return (rel as { type?: string }).type ?? null;
}

export interface TaxRow {
  parasut_id: number;
  parasut_type: string | null;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  net_total: number | null;
  total_paid: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  archived: boolean | null;
  category_parasut_id: number | null;
  category_parasut_type: string | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapTax(item: JsonApiResource): TaxRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Tax resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    // Phase 13.2: the real runtime item.type is always stored verbatim.
    // Swagger documents TaxAttributes.type enum as ["bank_fees"], a known
    // documentation bug -- this value is never coerced against that enum.
    parasut_type: (item as unknown as { type?: string }).type ?? null,
    description: attr(a, "description"),
    issue_date: attr(a, "issue_date"),
    due_date: attr(a, "due_date"),
    net_total: attr(a, "net_total"),
    total_paid: attr(a, "total_paid"),
    remaining: attr(a, "remaining"),
    remaining_in_trl: attr(a, "remaining_in_trl"),
    archived: attr(a, "archived"),
    category_parasut_id: relatedId(item, "category"),
    category_parasut_type: relatedType(item, "category"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
