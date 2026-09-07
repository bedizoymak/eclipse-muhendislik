// Phase 15: shared list/get query helpers for the read Edge Functions.
// Every column list passed in here is a hardcoded, server-side constant
// defined by the calling domain function -- never a client-supplied value --
// so a client can never widen a `select()` beyond what the function author
// explicitly allow-listed (defense in depth).
//
// ---------------------------------------------------------------------------
// Phase 15.1 DESIGN DECISION -- how domain functions reach `parasut.*`
// ---------------------------------------------------------------------------
// We are migrating the 11 domain functions off the `public.parasut_*_demo`
// views onto the `parasut.*` base tables directly. The rule, applied
// uniformly to every domain:
//
//   1. These generic helpers take an OPTIONAL `schema` field. When set (in
//      practice always "parasut") they issue `db.schema(s).from(table)`,
//      matching the `.schema('parasut').from(...)` pattern already proven by
//      `parasut-sync/index.ts`. When omitted they behave EXACTLY as before
//      (`db.from(table)`, i.e. `public`), so domains not yet migrated in this
//      pass keep working untouched -- this change is strictly additive and
//      backward-compatible.
//   2. Use these helpers ONLY for views that are plain single-table
//      passthroughs of one `parasut.*` table (no join / no aggregate). The
//      table name replaces the view name; the hardcoded column list is
//      unchanged; any `WHERE`/`ORDER BY` the view baked in must be
//      re-expressed here as `eq`/`sort` options.
//   3. For the ~15 views that DO join or aggregate, do NOT try to express the
//      join through PostgREST embedding: supabase-js resource embedding needs
//      a declared FK and does not compose cleanly across a non-default schema,
//      and several of these views join on `parasut_id` business keys rather
//      than real FKs. Instead write a small, explicit, per-domain query
//      function in that domain's own file: fetch the parent page, collect the
//      key list, fetch the related rows with a single `.in(...)`, and merge in
//      TypeScript. That keeps the SQL-shaped logic visible next to the domain
//      that owns it and avoids building a generic join framework nobody else
//      needs. NULL-preserving / COALESCE semantics from the view must be
//      re-implemented literally in that merge step (an unmatched parent keeps
//      NULL; it must never be silently dropped by the join, and must never be
//      back-filled with a guessed value).
//
// `customers` is the first domain migrated under this decision and is a pure
// case (1)+(2): both of its views are unfiltered single-table passthroughs.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Resolves the schema-qualified table/view builder. Omitting `schema`
 * preserves the original `public` behaviour for not-yet-migrated domains. */
export function fromTable(db: SupabaseClient, table: string, schema?: string) {
  return schema ? db.schema(schema).from(table) : db.from(table);
}

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
  view: string; // table or view name
  schema?: string; // omit for `public` (legacy demo views)
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
  let query = fromTable(db, opts.view, opts.schema).select(opts.columns, { count: "exact" });

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
  schema?: string;
  columns: string;
  idColumn?: string; // default "parasut_id"
  id: number | string;
}

export async function runGetQuery<T = Record<string, unknown>>(
  db: SupabaseClient,
  opts: GetQueryOptions,
): Promise<{ ok: true; row: T | null } | { ok: false; error: unknown }> {
  const { data, error } = await fromTable(db, opts.view, opts.schema)
    .select(opts.columns)
    .eq(opts.idColumn ?? "parasut_id", opts.id)
    .maybeSingle();
  if (error) return { ok: false, error };
  return { ok: true, row: (data as unknown as T) ?? null };
}

/** Runs an arbitrary related-rows query with a fixed column list, no
 * pagination envelope (used for detail-page "related rows" like invoice
 * line items, activities, etc.).
 *
 * `order` is the same purely-additive escape hatch as `schema`: when a demo
 * view baked an `ORDER BY` into its own definition, migrating off that view
 * onto the base table has to re-express the ordering EXPLICITLY here, or the
 * related rows silently come back in heap order. Omitting it preserves the
 * original unordered behaviour for domains not yet migrated. */
export async function runRelatedQuery<T = Record<string, unknown>>(
  db: SupabaseClient,
  view: string,
  columns: string,
  eq: EqFilter[],
  schema?: string,
  order?: { column: string; ascending: boolean; nullsFirst?: boolean },
): Promise<{ ok: true; rows: T[] } | { ok: false; error: unknown }> {
  let query = fromTable(db, view, schema).select(columns);
  for (const f of eq) query = query.eq(f.column, f.value);
  if (order) {
    query = query.order(order.column, { ascending: order.ascending, nullsFirst: order.nullsFirst });
  }
  const { data, error } = await query;
  if (error) return { ok: false, error };
  return { ok: true, rows: (data ?? []) as unknown as T[] };
}
