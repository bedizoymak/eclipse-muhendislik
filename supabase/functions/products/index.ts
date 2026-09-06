// Phase 15 domain 6 -- products. Public read function backing /urunler(/:id),
// /stok/kategoriler(/:id), /stok/depolar.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery, runRelatedQuery } from "../_shared/query.ts";

const PRODUCT_LIST_COLUMNS =
  "parasut_id, code, name, unit, barcode, vat_rate, list_price, currency, buying_price, buying_currency, inventory_tracking, stock_count, archived, category_parasut_id, category_name";
const PRODUCT_DETAIL_COLUMNS =
  "parasut_id, code, name, unit, barcode, vat_rate, list_price, currency, buying_price, buying_currency, inventory_tracking, initial_stock_count, stock_count, archived, category_parasut_id, category_name, synced_at";
const INVENTORY_LEVEL_COLUMNS =
  "parasut_id, warehouse_parasut_id, warehouse_name, stock_count, initial_stock_count, critical_stock_count";
const CATEGORY_COLUMNS =
  "parasut_id, parasut_type, name, full_path, bg_color, text_color, category_type, parent_category_parasut_id, parent_category_parasut_type, subcategories, parasut_created_at, parasut_updated_at, synced_at";
const WAREHOUSE_COLUMNS = "parasut_id, name, address, city, district, archived";
const CATEGORY_OPTION_COLUMNS = "parasut_id, name";

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
        const [activeRes, archivedRes, allRes] = await Promise.all([
          db.from("parasut_products_demo").select("parasut_id", { count: "exact", head: true }).eq("archived", false),
          db.from("parasut_products_demo").select("parasut_id", { count: "exact", head: true }).eq("archived", true),
          db.from("parasut_products_demo").select("parasut_id", { count: "exact", head: true }),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? allRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse({ data: { active: activeRes.count ?? 0, archived: archivedRes.count ?? 0, all: allRes.count ?? 0 } }, 200, cors);
      }
      case "products.list": {
        const parsed = parseListParams(body, ["name", "code"] as const, { column: "name", direction: "asc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        if (typeof body?.["archived"] === "boolean") eq.push({ column: "archived", value: body["archived"] as boolean });
        if (Number.isFinite(Number(body?.["category_id"])) && body?.["category_id"] !== undefined)
          eq.push({ column: "category_parasut_id", value: Number(body["category_id"]) });
        if (typeof body?.["inventory_tracking"] === "boolean") eq.push({ column: "inventory_tracking", value: body["inventory_tracking"] as boolean });
        const res = await runListQuery(db, {
          view: "parasut_products_demo",
          columns: PRODUCT_LIST_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "products.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const productRes = await runGetQuery(db, { view: "parasut_products_demo", columns: PRODUCT_DETAIL_COLUMNS, id });
        if (!productRes.ok) return errorResponse("internal_error", cors, productRes.error);
        if (!productRes.row) return errorResponse("not_found", cors);
        const levelsRes = await runRelatedQuery(db, "parasut_inventory_levels_demo", INVENTORY_LEVEL_COLUMNS, [
          { column: "product_parasut_id", value: id },
        ]);
        if (!levelsRes.ok) return errorResponse("internal_error", cors, levelsRes.error);
        return jsonResponse({ data: { ...productRes.row, inventory_levels: levelsRes.rows } }, 200, cors);
      }
      case "products.categoryOptions": {
        const { data, error } = await db.from("parasut_item_categories_demo").select(CATEGORY_OPTION_COLUMNS);
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }

      case "categories.counts": {
        const { data, error } = await db.from("parasut_item_category_counts_demo").select("*").maybeSingle();
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? {} }, 200, cors);
      }
      case "categories.list": {
        const parsed = parseListParams(body, ["full_path"] as const, { column: "full_path", direction: "asc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "parasut_item_categories_demo",
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
        const res = await runGetQuery(db, { view: "parasut_item_categories_demo", columns: CATEGORY_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }

      case "warehouses.list": {
        const { data, error } = await db.from("parasut_warehouses_demo").select(WAREHOUSE_COLUMNS);
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }
      case "warehouses.options": {
        const { data, error } = await db.from("parasut_warehouses_demo").select("parasut_id, name");
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
