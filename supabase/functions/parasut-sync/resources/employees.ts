// Maps Parasut JSON:API "employees" ("çalışanlar") -- verified directly
// against the live API (full pagination, both archived streams, 6 real
// records total in this account).
//
// filter[archived] is real and supported (verified: =false -> 6, =true -> 0,
// same fetchActiveAndArchived pattern as contacts/accounts/shipment_documents).
// Real list-endpoint filters (via a real 400 error message): name, email,
// iban, tckn, employment_start_date, employment_end_date.
//
// Real relationships: category, managed_by_user, managed_by_user_role,
// tags (all acceptable on the list endpoint's `include`), plus activities
// and comments (list endpoint 400s on these two -- "Acceptable: category,
// managed_by_user, managed_by_user_role, tags" -- but both resolve as real,
// genuinely empty `data:[]` via the single-record endpoint, same
// list/single inconsistency pattern as shipment_documents.activities).
//
// In this account, ALL SIX real employee records have every one of these
// six relationships genuinely empty (category/managed_by_user/
// managed_by_user_role: real `data:null`; activities/comments/tags: real
// `data:[]`) -- verified via GET /employees/{id}?include=category,
// managed_by_user,managed_by_user_role,activities,comments,tags for every
// one of the 6 ids. No category, no managed-by user, no activity, no
// comment, no tag exists anywhere in this account's employee data --
// nothing is synthesized to fill that gap.
//
// Real attributes (all 6 records): created_at, updated_at, name (100% filled),
// email, archived (real boolean, always false in this account), iban, tckn,
// balance/trl_balance/usd_balance/eur_balance/gbp_balance (real "0.0" string
// decimals, never null), employment_start_date, employment_end_date, phone.
// Every attribute besides name/archived/the five balance fields is real
// null on all 6 current records -- preserved as null, never guessed.
//
// GET /salaries -> 200, real `data: []` -- 0 real salary records in this
// account. No salary row/summary is synthesized anywhere in this module.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

function relatedRef(item: JsonApiResource, key: string): { id: number | null; type: string | null } {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return { id: null, type: null };
  const id = Number(rel.id);
  return { id: Number.isFinite(id) ? id : null, type: rel.type ?? null };
}

/** True only when the relationship's real data is a (possibly empty) array -- i.e. tags/activities/comments genuinely resolved, not just an empty {"meta":{}} placeholder. */
function hasRealArrayData(item: JsonApiResource, key: string): boolean {
  const rel = item.relationships?.[key];
  return !!rel && Array.isArray(rel.data);
}

export interface EmployeeRow {
  parasut_id: number;
  name: string | null;
  email: string | null;
  iban: string | null;
  tckn: string | null;
  archived: boolean | null;
  balance: number | null;
  trl_balance: number | null;
  usd_balance: number | null;
  eur_balance: number | null;
  gbp_balance: number | null;
  employment_start_date: string | null;
  employment_end_date: string | null;
  phone: string | null;
  category_parasut_id: number | null;
  managed_by_user_parasut_id: number | null;
  managed_by_user_role_parasut_id: number | null;
  managed_by_user_role_type: string | null;
  tags_resolved: boolean | null;
  activities_resolved: boolean | null;
  comments_resolved: boolean | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

function toNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapEmployee(item: JsonApiResource): EmployeeRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Employee resource has a non-numeric id: ${item.id}`);
  }

  const category = relatedRef(item, "category");
  const managedByUser = relatedRef(item, "managed_by_user");
  const managedByUserRole = relatedRef(item, "managed_by_user_role");

  return {
    parasut_id: parasutId,
    name: attr(a, "name"),
    email: attr(a, "email"),
    iban: attr(a, "iban"),
    tckn: attr(a, "tckn"),
    archived: attr(a, "archived"),
    balance: toNumeric(a["balance"]),
    trl_balance: toNumeric(a["trl_balance"]),
    usd_balance: toNumeric(a["usd_balance"]),
    eur_balance: toNumeric(a["eur_balance"]),
    gbp_balance: toNumeric(a["gbp_balance"]),
    employment_start_date: attr(a, "employment_start_date"),
    employment_end_date: attr(a, "employment_end_date"),
    phone: attr(a, "phone"),
    category_parasut_id: category.id,
    managed_by_user_parasut_id: managedByUser.id,
    managed_by_user_role_parasut_id: managedByUserRole.id,
    managed_by_user_role_type: managedByUserRole.type,
    tags_resolved: hasRealArrayData(item, "tags") ? true : null,
    activities_resolved: hasRealArrayData(item, "activities") ? true : null,
    comments_resolved: hasRealArrayData(item, "comments") ? true : null,
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
