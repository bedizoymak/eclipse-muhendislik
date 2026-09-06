// Phase 15 domain 7 -- inventory. Public read function backing
// /stok/seviyeleri, /stok/hareketleri.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runListQuery } from "../_shared/query.ts";

const LEVEL_COLUMNS =
  "parasut_id, product_parasut_id, product_name, product_code, warehouse_parasut_id, warehouse_name, stock_count, initial_stock_count, critical_stock_count";
const MOVEMENT_COLUMNS =
  "parasut_id, date, quantity, product_parasut_id, product_name, warehouse_parasut_id, warehouse_name, source_type, source_parasut_id, contact_parasut_id, contact_name";

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
        const eq = [];
        if (Number.isFinite(Number(body?.["warehouse_id"])) && body?.["warehouse_id"] !== undefined)
          eq.push({ column: "warehouse_parasut_id", value: Number(body["warehouse_id"]) });
        const res = await runListQuery(db, {
          view: "parasut_inventory_levels_demo",
          columns: LEVEL_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }

      case "movements.list": {
        const parsed = parseListParams(body, ["date"] as const, { column: "date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        if (Number.isFinite(Number(body?.["warehouse_id"])) && body?.["warehouse_id"] !== undefined)
          eq.push({ column: "warehouse_parasut_id", value: Number(body["warehouse_id"]) });
        if (Number.isFinite(Number(body?.["product_id"])) && body?.["product_id"] !== undefined)
          eq.push({ column: "product_parasut_id", value: Number(body["product_id"]) });
        const res = await runListQuery(db, {
          view: "parasut_stock_movements_demo",
          columns: MOVEMENT_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
          dateRange: buildDateRange(body, "date"),
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
