// Phase 15: shared list/get query helpers against public.parasut_*_demo
// views. Every column list passed in here is a hardcoded, server-side
// constant defined by the calling domain function -- never a client-
// supplied value -- so a client can never widen a `select()` beyond what
// the function author explicitly allow-listed (defense in depth, on top of
// the views themselves already being column-curated).
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface EqFilter {
  column: string;
  value: string | number | boolean;
}

export interface DateRangeFilter {
  column: string;
  gte?: string;
  lte?: string;
}

export interface ListQueryOptions {
  view: string;
  columns: string; // fixed, hardcoded select() column list
  page: number;
  pageSize: number;
  sort?: { column: string; direction: "asc" | "desc" };
  eq?: EqFilter[];
  neq?: EqFilter[];
  isNull?: string[];
  notNull?: string[];
  dateRange?: DateRangeFilter;
  ilike?: { column: string; value: string }[];
}

export interface ListResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

export async function runListQuery<T = Record<string, unknown>>(
  db: SupabaseClient,
  opts: ListQueryOptions,
): Promise<{ ok: true; result: ListResult<T> } | { ok: false; error: unknown }> {
  let query = db.from(opts.view).select(opts.columns, { count: "exact" });

  for (const f of opts.eq ?? []) {
    query = query.eq(f.column, f.value);
  }
  for (const f of opts.neq ?? []) {
    query = query.neq(f.column, f.value);
  }
  for (const c of opts.isNull ?? []) {
    query = query.is(c, null);
  }
  for (const c of opts.notNull ?? []) {
    query = query.not(c, "is", null);
  }
  if (opts.dateRange) {
    if (opts.dateRange.gte) query = query.gte(opts.dateRange.column, opts.dateRange.gte);
    if (opts.dateRange.lte) query = query.lte(opts.dateRange.column, opts.dateRange.lte);
  }
  for (const f of opts.ilike ?? []) {
    query = query.ilike(f.column, `%${f.value}%`);
  }
  if (opts.sort) {
    query = query.order(opts.sort.column, { ascending: opts.sort.direction === "asc" });
  }

  const from = (opts.page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) return { ok: false, error };
  return {
    ok: true,
    result: { data: (data ?? []) as unknown as T[], count: count ?? 0, page: opts.page, pageSize: opts.pageSize },
  };
}

export interface GetQueryOptions {
  view: string;
  columns: string;
  idColumn?: string; // default "parasut_id"
  id: number | string;
}

export async function runGetQuery<T = Record<string, unknown>>(
  db: SupabaseClient,
  opts: GetQueryOptions,
): Promise<{ ok: true; row: T | null } | { ok: false; error: unknown }> {
  const { data, error } = await db
    .from(opts.view)
    .select(opts.columns)
    .eq(opts.idColumn ?? "parasut_id", opts.id)
    .maybeSingle();
  if (error) return { ok: false, error };
  return { ok: true, row: (data as unknown as T) ?? null };
}

/** Runs an arbitrary related-rows query with a fixed column list, no
 * pagination envelope (used for detail-page "related rows" like invoice
 * line items, activities, etc.). */
export async function runRelatedQuery<T = Record<string, unknown>>(
  db: SupabaseClient,
  view: string,
  columns: string,
  eq: EqFilter[],
): Promise<{ ok: true; rows: T[] } | { ok: false; error: unknown }> {
  let query = db.from(view).select(columns);
  for (const f of eq) query = query.eq(f.column, f.value);
  const { data, error } = await query;
  if (error) return { ok: false, error };
  return { ok: true, rows: (data ?? []) as unknown as T[] };
}
