// Phase 15 domain 7 -- inventory. Public read function backing
// /stok/seviyeleri, /stok/hareketleri.
//
// Phase 15.1: migrated off the `public.parasut_*_demo` views onto the
// `parasut.*` base tables (see the design note at the top of
// ../_shared/query.ts). BOTH views this domain used are joining views, so
// both get explicit per-domain fetch+merge code here -- but they need two
// different strategies, because of WHERE the sort column lives:
//
//   * parasut_stock_movements_demo -- sm LEFT JOIN products / warehouses /
//     contacts, purely for name resolution. Every filterable and sortable
//     column (`date`, `warehouse_parasut_id`, `product_parasut_id`) lives on
//     the PARENT table, so this is the standard cheap pattern: fetch the
//     parent page (with count, filters, sort and range all done in Postgres),
//     collect the key sets, resolve names with one `.in(...)` per lookup
//     table, merge in TS. `count` comes from the parent query only.
//
//   * parasut_inventory_levels_demo -- il LEFT JOIN products / warehouses,
//     but its sort columns are `product_name` / `warehouse_name`, which live
//     on the JOINED tables, and the view's own default order is
//     `ORDER BY p.name, w.name`. A parent-page-then-merge would sort only
//     within the fetched page and silently reorder across pages, so here the
//     merge has to happen BEFORE pagination: fetch all matching level rows
//     (chunked, since PostgREST caps a response at 1000 rows), resolve the
//     names, sort, then slice the requested page in TS. `count` is still the
//     exact count of the PARENT query alone.
//     Sort parity: Postgres compares text under the database collation
//     (en_US.UTF-8 here), which a naive code-point sort does NOT reproduce --
//     it disagreed on 2659 of 2660 real rows in testing. `Intl.Collator
//     ("en-US")` reproduces it exactly (0 of 2660 positions differed), so
//     that is what COLLATOR below is, and it must not be replaced with `<`
//     or `localeCompare()` without a default locale.
//
// Both joins are LEFT joins: an unmatched parent row is ALWAYS kept, with the
// resolved name fields left literally `null` -- never filtered out (that
// would shrink `count` and break pagination) and never back-filled.
// The response envelope, field allow-lists, filters, pagination and sort
// behaviour are unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "parasut";

// The frontend-facing allow-lists are now the object literals built in the
// two merge steps below -- they are still hardcoded server-side constants,
// just expressed as the merged shape rather than a select() string:
//   levels:    parasut_id, product_parasut_id, product_name, product_code,
//              warehouse_parasut_id, warehouse_name, stock_count,
//              initial_stock_count, critical_stock_count
//   movements: parasut_id, date, quantity, product_parasut_id, product_name,
//              warehouse_parasut_id, warehouse_name, source_type,
//              source_parasut_id, contact_parasut_id, contact_name
// These are the base-table subsets actually selected; the joined `*_name` /
// `product_code` fields are resolved separately.
const LEVEL_BASE_COLUMNS =
  "parasut_id, product_parasut_id, warehouse_parasut_id, stock_count, initial_stock_count, critical_stock_count";
const MOVEMENT_BASE_COLUMNS =
  "parasut_id, date, quantity, product_parasut_id, warehouse_parasut_id, source_type, source_parasut_id, contact_parasut_id";

const CHUNK = 1000; // PostgREST caps a single response at 1000 rows.
const COLLATOR = new Intl.Collator("en-US");

type Row = Record<string, unknown>;
type Res<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Postgres text ordering under the DB collation, with the NULL placement
 * Postgres uses by default (NULLS LAST for ASC, NULLS FIRST for DESC). */
function compareText(a: unknown, b: unknown, ascending: boolean): number {
  const an = a == null;
  const bn = b == null;
  if (an && bn) return 0;
  if (an) return ascending ? 1 : -1; // ASC NULLS LAST / DESC NULLS FIRST
  if (bn) return ascending ? -1 : 1;
  const c = COLLATOR.compare(String(a), String(b));
  return ascending ? c : -c;
}

/**
 * Reads every row matching a query, in CHUNK-sized ranges.
 *
 * Deliberately typed structurally (just "has .range()") instead of against
 * SupabaseClient's PostgrestFilterBuilder generics -- binding to that type
 * directly causes `tsc`/`deno check` to blow its instantiation depth trying
 * to unify the `.schema(SCHEMA).from(table).select(columns)` builder chain
 * (TS2589) and mis-infers the resolved row type as `GenericStringError[]`.
 */
async function fetchAll<T = Row>(
  // `data: unknown` (not `T[]`) here deliberately: a PostgrestFilterBuilder
  // built from a non-literal `.select(columns)` string types its rows as
  // `GenericStringError[]`, which is not assignable to a concrete `T[]` --
  // widening the structural bound to `unknown` sidesteps that mismatch
  // without weakening the function's own advertised return type.
  build: () => { range(from: number, to: number): PromiseLike<{ data: unknown; error: unknown }> },
): Promise<Res<T[]>> {
  const out: T[] = [];
  for (let offset = 0; ; offset += CHUNK) {
    const { data, error } = await build().range(offset, offset + CHUNK - 1);
    if (error) return { ok: false, error };
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < CHUNK) return { ok: true, value: out };
  }
}

/** Builds a parasut_id -> row map for a lookup table, reading it whole. */
async function loadLookup(db: SupabaseClient, table: string, columns: string): Promise<Res<Map<unknown, Row>>> {
  // Explicit <Row> here: with a non-literal `columns` string, supabase-js
  // cannot infer a row shape and silently falls back to `GenericStringError`,
  // which then poisons everything downstream -- see the comment on fetchAll.
  const res = await fetchAll<Row>(() => db.schema(SCHEMA).from(table).select(columns).order("parasut_id", { ascending: true }));
  if (!res.ok) return res;
  return { ok: true, value: new Map(res.value.map((r) => [r["parasut_id"], r])) };
}

/** Same, but only for the given ids (used when the id set is a single page). */
async function loadLookupByIds(
  db: SupabaseClient,
  table: string,
  columns: string,
  ids: unknown[],
): Promise<Res<Map<unknown, Row>>> {
  if (ids.length === 0) return { ok: true, value: new Map() };
  const { data, error } = await db.schema(SCHEMA).from(table).select(columns).in("parasut_id", ids);
  if (error) return { ok: false, error };
  const rows = (data ?? []) as unknown as Row[];
  return { ok: true, value: new Map(rows.map((r) => [r["parasut_id"], r])) };
}

function idsOf(rows: Row[], column: string): unknown[] {
  return [...new Set(rows.map((r) => r[column]).filter((v) => v != null))];
}

function buildDateRange(body: Record<string, unknown> | null, column: string) {
  const gte = body?.["dateFrom"];
  const lte = body?.["dateTo"];
  if (typeof gte !== "string" && typeof lte !== "string") return undefined;
  return { column, gte: typeof gte === "string" ? gte : undefined, lte: typeof lte === "string" ? lte : undefined };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const auth = authorize(req);
  if (!auth.ok) return errorResponse(auth.code, cors);

  let body: Record<string, unknown> | null = null;
  try {
    body = req.method === "POST" ? await req.json() : null;
  } catch {
    return errorResponse("invalid_params", cors);
  }

  const action = body?.["action"];
  const db = serviceClient();

  try {
    switch (action) {
      case "levels.list": {
        const parsed = parseListParams(body, ["product_name", "warehouse_name"] as const, undefined);
        if ("error" in parsed) return errorResponse(parsed.error, cors);

        const warehouseFilter =
          body?.["warehouse_id"] !== undefined && Number.isFinite(Number(body["warehouse_id"]))
            ? Number(body["warehouse_id"])
            : undefined;

        // Exact count from the PARENT table only -- never from a joined or
        // filtered set (that is what keeps pagination honest).
        let countQuery = db.schema(SCHEMA).from("inventory_levels").select("parasut_id", { count: "exact", head: true });
        if (warehouseFilter !== undefined) countQuery = countQuery.eq("warehouse_parasut_id", warehouseFilter);
        const { count, error: countError } = await countQuery;
        if (countError) return errorResponse("internal_error", cors, countError);

        const levelsRes = await fetchAll(() => {
          let q = db.schema(SCHEMA).from("inventory_levels").select(LEVEL_BASE_COLUMNS);
          if (warehouseFilter !== undefined) q = q.eq("warehouse_parasut_id", warehouseFilter);
          // Deterministic read order so the chunked fetch cannot skip or
          // repeat a row between ranges; the user-facing order is applied
          // after the merge, below.
          return q.order("parasut_id", { ascending: true });
        });
        if (!levelsRes.ok) return errorResponse("internal_error", cors, levelsRes.error);
        const levels = levelsRes.value;

        const [productsRes, warehousesRes] = await Promise.all([
          loadLookup(db, "products", "parasut_id, name, code"),
          loadLookup(db, "warehouses", "parasut_id, name"),
        ]);
        if (!productsRes.ok) return errorResponse("internal_error", cors, productsRes.error);
        if (!warehousesRes.ok) return errorResponse("internal_error", cors, warehousesRes.error);
        const products = productsRes.value;
        const warehouses = warehousesRes.value;

        const merged = levels.map((il) => {
          const p = products.get(il["product_parasut_id"]);
          const w = warehouses.get(il["warehouse_parasut_id"]);
          return {
            parasut_id: il["parasut_id"],
            product_parasut_id: il["product_parasut_id"] ?? null,
            product_name: p ? (p["name"] ?? null) : null, // LEFT JOIN: null when unmatched
            product_code: p ? (p["code"] ?? null) : null,
            warehouse_parasut_id: il["warehouse_parasut_id"] ?? null,
            warehouse_name: w ? (w["name"] ?? null) : null,
            stock_count: il["stock_count"] ?? null,
            initial_stock_count: il["initial_stock_count"] ?? null,
            critical_stock_count: il["critical_stock_count"] ?? null,
          } as Row;
        });

        if (parsed.sort) {
          // A client-supplied sort replaced the view's ORDER BY entirely,
          // with no secondary key -- same here.
          const asc = parsed.sort.direction === "asc";
          merged.sort((a, b) => compareText(a[parsed.sort!.column], b[parsed.sort!.column], asc));
        } else {
          // The view's own default: ORDER BY p.name, w.name (both ASC).
          merged.sort(
            (a, b) =>
              compareText(a["product_name"], b["product_name"], true) ||
              compareText(a["warehouse_name"], b["warehouse_name"], true),
          );
        }

        const from = (parsed.page - 1) * parsed.pageSize;
        return jsonResponse(
          {
            data: merged.slice(from, from + parsed.pageSize),
            count: count ?? 0,
            page: parsed.page,
            pageSize: parsed.pageSize,
          },
          200,
          cors,
        );
      }

      case "movements.list": {
        const parsed = parseListParams(body, ["date"] as const, { column: "date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);

        let query = db.schema(SCHEMA).from("stock_movements").select(MOVEMENT_BASE_COLUMNS, { count: "exact" });
        if (body?.["warehouse_id"] !== undefined && Number.isFinite(Number(body["warehouse_id"])))
          query = query.eq("warehouse_parasut_id", Number(body["warehouse_id"]));
        if (body?.["product_id"] !== undefined && Number.isFinite(Number(body["product_id"])))
          query = query.eq("product_parasut_id", Number(body["product_id"]));
        const dateRange = buildDateRange(body, "date");
        if (dateRange?.gte) query = query.gte(dateRange.column, dateRange.gte);
        if (dateRange?.lte) query = query.lte(dateRange.column, dateRange.lte);
        if (parsed.sort) query = query.order(parsed.sort.column, { ascending: parsed.sort.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);

        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        const page = (data ?? []) as Row[];

        const [productsRes, warehousesRes, contactsRes] = await Promise.all([
          loadLookupByIds(db, "products", "parasut_id, name", idsOf(page, "product_parasut_id")),
          loadLookupByIds(db, "warehouses", "parasut_id, name", idsOf(page, "warehouse_parasut_id")),
          loadLookupByIds(db, "contacts", "parasut_id, name", idsOf(page, "contact_parasut_id")),
        ]);
        if (!productsRes.ok) return errorResponse("internal_error", cors, productsRes.error);
        if (!warehousesRes.ok) return errorResponse("internal_error", cors, warehousesRes.error);
        if (!contactsRes.ok) return errorResponse("internal_error", cors, contactsRes.error);

        const merged = page.map((sm) => {
          const p = productsRes.value.get(sm["product_parasut_id"]);
          const w = warehousesRes.value.get(sm["warehouse_parasut_id"]);
          const c = contactsRes.value.get(sm["contact_parasut_id"]);
          return {
            parasut_id: sm["parasut_id"],
            date: sm["date"] ?? null,
            quantity: sm["quantity"] ?? null,
            product_parasut_id: sm["product_parasut_id"] ?? null,
            product_name: p ? (p["name"] ?? null) : null,
            warehouse_parasut_id: sm["warehouse_parasut_id"] ?? null,
            warehouse_name: w ? (w["name"] ?? null) : null,
            source_type: sm["source_type"] ?? null,
            source_parasut_id: sm["source_parasut_id"] ?? null,
            contact_parasut_id: sm["contact_parasut_id"] ?? null,
            contact_name: c ? (c["name"] ?? null) : null,
          } as Row;
        });

        return jsonResponse(
          { data: merged, count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize },
          200,
          cors,
        );
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
