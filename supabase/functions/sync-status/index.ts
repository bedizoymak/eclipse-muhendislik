// Phase 15 domain 11 -- sync-status. Public read function backing the
// DemoHome "Verileri yenile" widget. Distinct from parasut-sync (the write
// path, service_role/authenticated-triggered) -- this is read-only.
//
// Phase 15.1: migrated off `public.parasut_sync_status_demo` onto
// `parasut.sync_runs` (see the design note at the top of ../_shared/query.ts).
// This view is NOT a plain passthrough -- it is
//   SELECT DISTINCT ON (resource) <cols> FROM parasut.sync_runs
//   ORDER BY resource, started_at DESC
// i.e. the latest run per resource. Since this function only ever looks up
// ONE resource, `DISTINCT ON (resource)` collapses to "the single newest row
// for that resource", which is expressed here as
//   .eq("resource", r).order("started_at", desc).limit(1).maybeSingle()
// `nullsFirst: true` is set explicitly to match Postgres' default for
// `ORDER BY started_at DESC` (NULLS FIRST), so a run with a NULL started_at
// would win the tie-break in exactly the same way it does in the view.
// (`sync_runs.started_at` is NOT NULL today, so this is belt-and-braces.)
// The response envelope and field allow-list are unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";

const SCHEMA = "parasut";
const SYNC_RUNS_TABLE = "sync_runs";

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
      const { data, error } = await db
        .schema(SCHEMA)
        .from(SYNC_RUNS_TABLE)
        .select(STATUS_COLUMNS)
        .eq("resource", resource)
        .order("started_at", { ascending: false, nullsFirst: true })
        .limit(1)
        .maybeSingle();
      if (error) return errorResponse("internal_error", cors, error);
      return jsonResponse({ data: data ?? null }, 200, cors);
    }

    return errorResponse("invalid_params", cors);
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
