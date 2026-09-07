// Phase 15 domain 6 -- products. Public read function backing /urunler(/:id),
// /stok/kategoriler(/:id), /stok/depolar.
//
// Phase 15.1: migrated off the `public.parasut_*_demo` views onto the
// `parasut.*` base tables (see the design note at the top of
// ../_shared/query.ts). Five views were in play:
//
//   * parasut_products_demo -- products LEFT JOIN item_categories, purely to
//     resolve `category_name`. Both sortable columns (`name`, `code`) and all
//     three filters (`archived`, `category_parasut_id`, `inventory_tracking`)
//     live on the PARENT table, so this is the cheap
//     parent-page-then-merge case: Postgres does filter/sort/range and the
//     exact count, then one page-scoped `.in(...)` on item_categories
//     resolves the names. `count` comes from the parent query alone. The
//     view's baked-in `ORDER BY p.name` is already the function's explicit
//     default sort, so nothing is lost.
//
//   * parasut_item_categories_demo -- a plain passthrough of
//     parasut.item_categories with `ORDER BY full_path, parasut_id DESC`.
//     categories.list already applied its OWN outer `ORDER BY full_path`, so
//     the view's `parasut_id DESC` secondary was never a guaranteed
//     tiebreaker for this function (an outer sort in Postgres is not
//     stable). Per the "match the DB's own behaviour" rule, the migration
//     keeps exactly the same single `ORDER BY full_path` and therefore the
//     same tie non-determinism -- it deliberately does NOT invent a new
//     deterministic tiebreaker, which would be a behaviour change.
//     categoryOptions previously passed no `.order()` and inherited the
//     view's order, so it now re-expresses BOTH keys explicitly.
//
//   * parasut_item_category_counts_demo -- `SELECT count(*) AS total_count`.
//     One bucket, no FILTER clauses, so one exact head count reproduces it;
//     the `{ total_count }` response shape is preserved literally (the view
//     always returns exactly one row, 0 included).
//
//   * parasut_warehouses_demo -- plain passthrough of parasut.warehouses
//     with `ORDER BY name`; neither warehouse action passed an `.order()` of
//     its own, so both now state it explicitly.
//
//   * parasut_inventory_levels_demo -- inventory_levels LEFT JOIN products
//     LEFT JOIN warehouses, `ORDER BY p.name, w.name`. This same view was
//     migrated for the `inventory` domain in 76cdc76, but the two uses are
//     NOT the same query and are intentionally not factored into a shared
//     helper (the design note's "no generic join framework" rule): inventory
//     reads a paginated, warehouse-filtered, product+warehouse-name-sorted
//     projection of the WHOLE table, whereas products.get reads the
//     unpaginated levels of ONE product with a narrower column list and no
//     product_name at all. Because the product is fixed, `p.name` is
//     constant across the result and the view's two-key order collapses to
//     `ORDER BY w.name` -- a JOINED column, so the sort must happen in TS
//     after the merge (there is no pagination here, so no chunking is
//     needed: one product's level rows are read in full). Postgres compares
//     text under the database collation (en_US.UTF-8), which a code-point
//     sort does not reproduce, so this uses `Intl.Collator("en-US")` -- the
//     same collator the `inventory` migration verified against the live
//     database order. It must not be replaced with `<` or a bare
//     `localeCompare()`.
//
// Every join is a LEFT join: the parent row is spread first, an unmatched
// lookup leaves the resolved name literally `null`, and no parent row is
// ever filtered out (that would shrink `count` and break pagination).
// Response envelopes, field allow-lists, filters, pagination and sort
// behaviour are unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery } from "../_shared/query.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "parasut";

// The products / inventory-level client-facing shapes are now the object
// literals built in the merge steps below. They are unchanged:
//   products(list):   parasut_id, code, name, unit, barcode, vat_rate,
//                     list_price, currency, buying_price, buying_currency,
//                     inventory_tracking, stock_count, archived,
//                     category_parasut_id, category_name
//   products(detail): the same plus initial_stock_count and synced_at
//   inventory_levels: parasut_id, warehouse_parasut_id, warehouse_name,
//                     stock_count, initial_stock_count, critical_stock_count
const PRODUCT_LIST_BASE_COLUMNS =
  "parasut_id, code, name, unit, barcode, vat_rate, list_price, currency, buying_price, buying_currency, inventory_tracking, stock_count, archived, category_parasut_id";
const PRODUCT_DETAIL_BASE_COLUMNS =
  "parasut_id, code, name, unit, barcode, vat_rate, list_price, currency, buying_price, buying_currency, inventory_tracking, initial_stock_count, stock_count, archived, category_parasut_id, synced_at";
const INVENTORY_LEVEL_BASE_COLUMNS =
  "parasut_id, warehouse_parasut_id, stock_count, initial_stock_count, critical_stock_count";
const CATEGORY_COLUMNS =
  "parasut_id, parasut_type, name, full_path, bg_color, text_color, category_type, parent_category_parasut_id, parent_category_parasut_type, subcategories, parasut_created_at, parasut_updated_at, synced_at";
const WAREHOUSE_COLUMNS = "parasut_id, name, address, city, district, archived";
const CATEGORY_OPTION_COLUMNS = "parasut_id, name";

const COLLATOR = new Intl.Collator("en-US");

type Row = Record<string, unknown>;
type Res<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Postgres text ordering under the DB collation, with the NULL placement
 * Postgres uses by default (NULLS LAST for ASC). */
function compareTextAsc(a: unknown, b: unknown): number {
  const an = a == null;
  const bn = b == null;
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  return COLLATOR.compare(String(a), String(b));
}

/** Resolves `parasut_id -> row` for a lookup table, restricted to the ids
 * actually present on the rows being merged. */
async function loadLookupByIds(
  db: SupabaseClient,
  table: string,
  columns: string,
  ids: unknown[],
): Promise<Res<Map<unknown, Row>>> {
  if (ids.length === 0) return { ok: true, value: new Map() };
  const { data, error } = await db.schema(SCHEMA).from(table).select(columns).in("parasut_id", ids);
  if (error) return { ok: false, error };
  return { ok: true, value: new Map(((data ?? []) as unknown as Row[]).map((r) => [r["parasut_id"], r])) };
}

function idsOf(rows: Row[], column: string): unknown[] {
  return [...new Set(rows.map((r) => r[column]).filter((v) => v != null))];
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
      case "products.counts": {
        // No join is involved in any of these three buckets, so they are
        // plain head counts on the parent table.
        const [activeRes, archivedRes, allRes] = await Promise.all([
          db.schema(SCHEMA).from("products").select("parasut_id", { count: "exact", head: true }).eq("archived", false),
          db.schema(SCHEMA).from("products").select("parasut_id", { count: "exact", head: true }).eq("archived", true),
          db.schema(SCHEMA).from("products").select("parasut_id", { count: "exact", head: true }),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? allRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse({ data: { active: activeRes.count ?? 0, archived: archivedRes.count ?? 0, all: allRes.count ?? 0 } }, 200, cors);
      }
      case "products.list": {
        const parsed = parseListParams(body, ["name", "code"] as const, { column: "name", direction: "asc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);

        let query = db.schema(SCHEMA).from("products").select(PRODUCT_LIST_BASE_COLUMNS, { count: "exact" });
        if (typeof body?.["archived"] === "boolean") query = query.eq("archived", body["archived"] as boolean);
        if (Number.isFinite(Number(body?.["category_id"])) && body?.["category_id"] !== undefined)
          query = query.eq("category_parasut_id", Number(body["category_id"]));
        if (typeof body?.["inventory_tracking"] === "boolean")
          query = query.eq("inventory_tracking", body["inventory_tracking"] as boolean);
        if (parsed.sort) query = query.order(parsed.sort.column, { ascending: parsed.sort.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);

        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        const page = (data ?? []) as Row[];

        const categories = await loadLookupByIds(db, "item_categories", "parasut_id, name", idsOf(page, "category_parasut_id"));
        if (!categories.ok) return errorResponse("internal_error", cors, categories.error);

        const merged = page.map((p) => {
          const c = categories.value.get(p["category_parasut_id"]);
          return {
            parasut_id: p["parasut_id"],
            code: p["code"] ?? null,
            name: p["name"] ?? null,
            unit: p["unit"] ?? null,
            barcode: p["barcode"] ?? null,
            vat_rate: p["vat_rate"] ?? null,
            list_price: p["list_price"] ?? null,
            currency: p["currency"] ?? null,
            buying_price: p["buying_price"] ?? null,
            buying_currency: p["buying_currency"] ?? null,
            inventory_tracking: p["inventory_tracking"] ?? null,
            stock_count: p["stock_count"] ?? null,
            archived: p["archived"] ?? null,
            category_parasut_id: p["category_parasut_id"] ?? null,
            category_name: c ? (c["name"] ?? null) : null, // LEFT JOIN: null when unmatched
          } as Row;
        });

        return jsonResponse({ data: merged, count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }
      case "products.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const { data: productRow, error: productError } = await db
          .schema(SCHEMA)
          .from("products")
          .select(PRODUCT_DETAIL_BASE_COLUMNS)
          .eq("parasut_id", id)
          .maybeSingle();
        if (productError) return errorResponse("internal_error", cors, productError);
        if (!productRow) return errorResponse("not_found", cors);
        const p = productRow as Row;

        const categories = await loadLookupByIds(db, "item_categories", "parasut_id, name", idsOf([p], "category_parasut_id"));
        if (!categories.ok) return errorResponse("internal_error", cors, categories.error);
        const c = categories.value.get(p["category_parasut_id"]);

        const product = {
          parasut_id: p["parasut_id"],
          code: p["code"] ?? null,
          name: p["name"] ?? null,
          unit: p["unit"] ?? null,
          barcode: p["barcode"] ?? null,
          vat_rate: p["vat_rate"] ?? null,
          list_price: p["list_price"] ?? null,
          currency: p["currency"] ?? null,
          buying_price: p["buying_price"] ?? null,
          buying_currency: p["buying_currency"] ?? null,
          inventory_tracking: p["inventory_tracking"] ?? null,
          initial_stock_count: p["initial_stock_count"] ?? null,
          stock_count: p["stock_count"] ?? null,
          archived: p["archived"] ?? null,
          category_parasut_id: p["category_parasut_id"] ?? null,
          category_name: c ? (c["name"] ?? null) : null,
          synced_at: p["synced_at"] ?? null,
        };

        // One product's inventory levels. The retired view ordered by
        // (product name, warehouse name); the product is fixed here, so that
        // collapses to warehouse name -- a JOINED column, hence sorted in TS
        // after the merge, under the DB collation.
        const { data: levelData, error: levelError } = await db
          .schema(SCHEMA)
          .from("inventory_levels")
          .select(INVENTORY_LEVEL_BASE_COLUMNS)
          .eq("product_parasut_id", id);
        if (levelError) return errorResponse("internal_error", cors, levelError);
        const levelRows = (levelData ?? []) as Row[];

        const warehouses = await loadLookupByIds(db, "warehouses", "parasut_id, name", idsOf(levelRows, "warehouse_parasut_id"));
        if (!warehouses.ok) return errorResponse("internal_error", cors, warehouses.error);

        const levels = levelRows
          .map((il) => {
            const w = warehouses.value.get(il["warehouse_parasut_id"]);
            return {
              parasut_id: il["parasut_id"],
              warehouse_parasut_id: il["warehouse_parasut_id"] ?? null,
              warehouse_name: w ? (w["name"] ?? null) : null,
              stock_count: il["stock_count"] ?? null,
              initial_stock_count: il["initial_stock_count"] ?? null,
              critical_stock_count: il["critical_stock_count"] ?? null,
            } as Row;
          })
          .sort((a, b) => compareTextAsc(a["warehouse_name"], b["warehouse_name"]));

        return jsonResponse({ data: { ...product, inventory_levels: levels } }, 200, cors);
      }
      case "products.categoryOptions": {
        // Re-expresses the retired view's ORDER BY full_path, parasut_id DESC.
        const { data, error } = await db
          .schema(SCHEMA)
          .from("item_categories")
          .select(CATEGORY_OPTION_COLUMNS)
          .order("full_path", { ascending: true })
          .order("parasut_id", { ascending: false });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }

      case "categories.counts": {
        // Reproduces `SELECT count(*) AS total_count FROM item_categories`.
        const { count, error } = await db
          .schema(SCHEMA)
          .from("item_categories")
          .select("parasut_id", { count: "exact", head: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: { total_count: count ?? 0 } }, 200, cors);
      }
      case "categories.list": {
        const parsed = parseListParams(body, ["full_path"] as const, { column: "full_path", direction: "asc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "item_categories",
          schema: SCHEMA,
          columns: CATEGORY_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "categories.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runGetQuery(db, { view: "item_categories", schema: SCHEMA, columns: CATEGORY_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }

      case "warehouses.list": {
        // Re-expresses the retired view's ORDER BY name.
        const { data, error } = await db
          .schema(SCHEMA)
          .from("warehouses")
          .select(WAREHOUSE_COLUMNS)
          .order("name", { ascending: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }
      case "warehouses.options": {
        const { data, error } = await db
          .schema(SCHEMA)
          .from("warehouses")
          .select("parasut_id, name")
          .order("name", { ascending: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
