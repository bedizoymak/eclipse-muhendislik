// Maps a Parasut JSON:API "salary" resource to a parasut.salaries row.
// Phase 13: this account has 0 real salary records today (GET /salaries ->
// 200, real data:[]). Columns below match the schema already created in
// the Phase 0 bulk migration (never guessed here) -- once real records
// exist, the exact same mapper populates them with no code change.

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

export interface SalaryRow {
  parasut_id: number;
  description: string | null;
  currency: string | null;
  issue_date: string | null;
  due_date: string | null;
  exchange_rate: number | null;
  net_total: number | null;
  total_paid: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  archived: boolean | null;
  employee_parasut_id: number | null;
  category_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapSalary(item: JsonApiResource): SalaryRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Salary resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    description: attr(a, "description"),
    currency: attr(a, "currency"),
    issue_date: attr(a, "issue_date"),
    due_date: attr(a, "due_date"),
    exchange_rate: attr(a, "exchange_rate"),
    net_total: attr(a, "net_total"),
    total_paid: attr(a, "total_paid"),
    remaining: attr(a, "remaining"),
    remaining_in_trl: attr(a, "remaining_in_trl"),
    archived: attr(a, "archived"),
    employee_parasut_id: relatedId(item, "employee"),
    category_parasut_id: relatedId(item, "category"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
