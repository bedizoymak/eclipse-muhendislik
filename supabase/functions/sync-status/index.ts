// Phase 15 domain 11 -- sync-status. Public read function backing the
// DemoHome "Verileri yenile" widget. Distinct from parasut-sync (the write
// path, service_role/authenticated-triggered) -- this is read-only.
import { authorize, corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery } from "../_shared/query.ts";

const STATUS_COLUMNS =
  "resource, status, dry_run, started_at, finished_at, fetched_count, upserted_count, error_count, error_message, active_fetched_count, archived_fetched_count, detail_fetched_count, detail_upserted_count, unresolved_count";

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
    if (action === "get") {
      const resource = body?.["resource"];
      if (typeof resource !== "string" || resource.trim().length === 0) return errorResponse("invalid_params", cors);
      const res = await runGetQuery(db, { view: "parasut_sync_status_demo", columns: STATUS_COLUMNS, idColumn: "resource", id: resource });
      if (!res.ok) return errorResponse("internal_error", cors, res.error);
      return jsonResponse({ data: res.row }, 200, cors);
    }

    return errorResponse("invalid_params", cors);
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
