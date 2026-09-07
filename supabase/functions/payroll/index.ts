// Phase 15 domain 4 -- payroll. Public read function backing
// /giderler/calisanlar(/:id), /giderler/maaslar(/:id), /giderler/vergiler(/:id).
// IBAN/TCKN stay excluded from every employee column list below -- already
// dropped from the source view (20260906200827), repeated here as
// defense-in-depth per the Phase 15 design doc.
//
// Phase 15.1: migrated off the `public.parasut_*_demo` views onto the
// `parasut.*` base tables (see the design note at the top of
// ../_shared/query.ts). Nine views were in play:
//
//   * parasut_employees_demo -- plain passthrough of parasut.employees with
//     `ORDER BY name`. IMPORTANT: the VIEW still exposes `iban` and `tckn`;
//     this function's EMPLOYEE_LIST_COLUMNS / EMPLOYEE_DETAIL_COLUMNS
//     allow-lists never did, and reading the base table directly does NOT
//     widen them -- the two lists below are byte-identical to the
//     pre-migration ones and must not be widened. The view's ORDER BY name
//     is already employees.list's explicit default sort.
//
//   * parasut_employee_counts_demo -- FOUR count(*) FILTER buckets:
//     archived = false, archived = true, archived IS NULL, and the total.
//     All four are replicated as separate exact head counts. The IS NULL
//     bucket is NOT merged into either boolean bucket: `= false` and
//     `= true` both MISS a NULL row, so NULL is a real third state and
//     dropping it would change the numbers.
//
//   * parasut_salary_counts_demo / parasut_tax_counts_demo -- THREE buckets
//     each (archived = false, archived = true, total). These views have no
//     IS NULL bucket, so exactly three head counts are issued and no fourth
//     is invented: each aggregate view is replicated bucket-for-bucket as it
//     is actually written, not normalised against its sibling.
//
//   * parasut_employee_meta_demo -- passthrough of parasut.employee_sync_meta
//     with `ORDER BY filter_scope`. The action passed no `.order()` of its
//     own and inherited the view's, so it is now stated explicitly. The
//     response shape stayed `select("*")` on the view, which projected seven
//     named columns; those seven are now listed explicitly so the base
//     table's extra bookkeeping columns (id/created_at/updated_at) are not
//     leaked into the response.
//
//   * parasut_salaries_demo / parasut_taxes_demo -- passthroughs with
//     `ORDER BY issue_date DESC NULLS LAST, parasut_id DESC`. Both list
//     actions already applied their OWN outer `ORDER BY issue_date DESC`,
//     so the view's NULLS LAST and its `parasut_id DESC` secondary were
//     never guaranteed for this function (an outer sort in Postgres is not
//     stable, and an outer DESC defaults to NULLS FIRST). Per the "match the
//     DB's own behaviour" rule the migration keeps exactly the same single
//     outer `ORDER BY issue_date DESC` with the same default NULL placement
//     and the same tie non-determinism -- deliberately NOT inventing a new
//     deterministic tiebreaker, which would be a behaviour change.
//
//   * parasut_salary_tags_demo / parasut_tax_tags_demo -- salary_tags (resp.
//     tax_tags) LEFT JOIN tags, purely to resolve `tag_name`. Neither view
//     has an ORDER BY, and both actions filter on the parent's
//     salary_parasut_id / tax_parasut_id, so these get the standard explicit
//     fetch-parent-then-merge treatment: read the parent rows for one id,
//     resolve the tag names with a single `.in(...)`, merge in TS. LEFT JOIN
//     semantics are preserved literally -- an unmatched tag leaves
//     `tag_name` null and the parent row is still returned.
//
//   * parasut_item_categories_demo -- used only by the lightweight
//     categories.name lookup, a single-column passthrough by parasut_id.
//
// Response envelopes, field allow-lists, filters, pagination, sort behaviour
// and PII exclusions are all unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { scheduleDomainFreshness } from "../_shared/freshness.ts";
import { runGetQuery, runListQuery } from "../_shared/query.ts";

const SCHEMA = "parasut";

// PII: `iban` and `tckn` are intentionally absent from both employee lists.
// Unchanged from the pre-migration allow-lists. Do not widen.
const EMPLOYEE_LIST_COLUMNS = "parasut_id, name, email, phone, archived, employment_start_date, employment_end_date, category_parasut_id";
const EMPLOYEE_DETAIL_COLUMNS =
  "parasut_id, name, email, phone, archived, employment_start_date, employment_end_date, balance, trl_balance, usd_balance, eur_balance, gbp_balance, category_parasut_id, managed_by_user_parasut_id, managed_by_user_role_parasut_id, managed_by_user_role_type, tags_resolved, activities_resolved, comments_resolved, parasut_created_at, parasut_updated_at, synced_at";
// The seven columns the retired parasut_employee_meta_demo view projected.
const EMPLOYEE_META_COLUMNS = "resource, filter_scope, payable_total, advance_total, export_url, source_total_count, fetched_at";
const SALARY_COLUMNS =
  "parasut_id, parasut_type, description, currency, issue_date, due_date, exchange_rate, net_total, total_paid, remaining, remaining_in_trl, archived, employee_parasut_id, employee_parasut_type, category_parasut_id, category_parasut_type, parasut_created_at, parasut_updated_at, synced_at";
const TAX_COLUMNS =
  "parasut_id, parasut_type, description, issue_date, due_date, net_total, total_paid, remaining, remaining_in_trl, archived, category_parasut_id, category_parasut_type, parasut_created_at, parasut_updated_at, synced_at";
// Client-facing tag shape (unchanged): tag_parasut_id, tag_type, tag_name.
// `tag_name` is the joined column, resolved separately below.
const TAG_BASE_COLUMNS = "tag_parasut_id, tag_type";

type Row = Record<string, unknown>;

/** Reads one tag-link table for a single parent id and resolves `tag_name`
 * from parasut.tags with LEFT JOIN semantics. */
async function loadTags(
  db: ReturnType<typeof serviceClient>,
  table: string,
  parentColumn: string,
  parentId: number,
): Promise<{ ok: true; rows: Row[] } | { ok: false; error: unknown }> {
  const { data, error } = await db.schema(SCHEMA).from(table).select(TAG_BASE_COLUMNS).eq(parentColumn, parentId);
  if (error) return { ok: false, error };
  const links = (data ?? []) as Row[];

  const ids = [...new Set(links.map((l) => l["tag_parasut_id"]).filter((v) => v != null))];
  let names = new Map<unknown, Row>();
  if (ids.length > 0) {
    const { data: tagData, error: tagError } = await db.schema(SCHEMA).from("tags").select("parasut_id, name").in("parasut_id", ids);
    if (tagError) return { ok: false, error: tagError };
    names = new Map(((tagData ?? []) as Row[]).map((t) => [t["parasut_id"], t]));
  }

  return {
    ok: true,
    rows: links.map((l) => {
      const t = names.get(l["tag_parasut_id"]);
      return {
        tag_parasut_id: l["tag_parasut_id"] ?? null,
        tag_type: l["tag_type"] ?? null,
        tag_name: t ? (t["name"] ?? null) : null, // LEFT JOIN: null when unmatched
      } as Row;
    }),
  };
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
  scheduleDomainFreshness(db, "payroll");

  try {
    switch (action) {
      case "employees.counts": {
        // Four buckets, four head counts -- see the note above on why the
        // `archived IS NULL` bucket stays separate.
        const [activeRes, archivedRes, nullRes, totalRes] = await Promise.all([
          db.schema(SCHEMA).from("employees").select("parasut_id", { count: "exact", head: true }).eq("archived", false),
          db.schema(SCHEMA).from("employees").select("parasut_id", { count: "exact", head: true }).eq("archived", true),
          db.schema(SCHEMA).from("employees").select("parasut_id", { count: "exact", head: true }).is("archived", null),
          db.schema(SCHEMA).from("employees").select("parasut_id", { count: "exact", head: true }),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? nullRes.error ?? totalRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse(
          {
            data: {
              active_count: activeRes.count ?? 0,
              archived_count: archivedRes.count ?? 0,
              null_archived_count: nullRes.count ?? 0,
              total_count: totalRes.count ?? 0,
            },
          },
          200,
          cors,
        );
      }
      case "employees.meta": {
        // Re-expresses the retired view's ORDER BY filter_scope.
        const { data, error } = await db
          .schema(SCHEMA)
          .from("employee_sync_meta")
          .select(EMPLOYEE_META_COLUMNS)
          .order("filter_scope", { ascending: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }
      case "employees.list": {
        const parsed = parseListParams(body, ["name"] as const, { column: "name", direction: "asc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        if (typeof body?.["archived"] === "boolean") eq.push({ column: "archived", value: body["archived"] as boolean });
        const res = await runListQuery(db, {
          view: "employees",
          schema: SCHEMA,
          columns: EMPLOYEE_LIST_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "employees.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runGetQuery(db, { view: "employees", schema: SCHEMA, columns: EMPLOYEE_DETAIL_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }
      // Lightweight name-only lookup used by MaasDetay for
      // row.employee_parasut_id -> employee name.
      case "employees.name": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runGetQuery<{ name: string | null }>(db, { view: "employees", schema: SCHEMA, columns: "name", id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse({ data: res.row }, 200, cors);
      }
      // Lightweight name-only lookup for category_parasut_id -> category
      // name, used by MaasDetay/VergiDetay (shared with the products
      // domain's own item_categories, duplicated here to keep payroll
      // self-contained).
      case "categories.name": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runGetQuery<{ name: string | null }>(db, { view: "item_categories", schema: SCHEMA, columns: "name", id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse({ data: res.row }, 200, cors);
      }

      case "salaries.counts": {
        // Three buckets only -- parasut_salary_counts_demo has no IS NULL
        // bucket, so none is invented here.
        const [activeRes, archivedRes, totalRes] = await Promise.all([
          db.schema(SCHEMA).from("salaries").select("parasut_id", { count: "exact", head: true }).eq("archived", false),
          db.schema(SCHEMA).from("salaries").select("parasut_id", { count: "exact", head: true }).eq("archived", true),
          db.schema(SCHEMA).from("salaries").select("parasut_id", { count: "exact", head: true }),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? totalRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse(
          { data: { active_count: activeRes.count ?? 0, archived_count: archivedRes.count ?? 0, total_count: totalRes.count ?? 0 } },
          200,
          cors,
        );
      }
      case "salaries.list": {
        const parsed = parseListParams(body, ["issue_date"] as const, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "salaries",
          schema: SCHEMA,
          columns: SALARY_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "salaries.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runGetQuery(db, { view: "salaries", schema: SCHEMA, columns: SALARY_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }
      case "salaries.tags": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await loadTags(db, "salary_tags", "salary_parasut_id", id);
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse({ data: res.rows }, 200, cors);
      }

      case "taxes.counts": {
        // Three buckets only, matching parasut_tax_counts_demo exactly.
        const [activeRes, archivedRes, totalRes] = await Promise.all([
          db.schema(SCHEMA).from("taxes").select("parasut_id", { count: "exact", head: true }).eq("archived", false),
          db.schema(SCHEMA).from("taxes").select("parasut_id", { count: "exact", head: true }).eq("archived", true),
          db.schema(SCHEMA).from("taxes").select("parasut_id", { count: "exact", head: true }),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? totalRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse(
          { data: { active_count: activeRes.count ?? 0, archived_count: archivedRes.count ?? 0, total_count: totalRes.count ?? 0 } },
          200,
          cors,
        );
      }
      case "taxes.list": {
        const parsed = parseListParams(body, ["issue_date"] as const, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "taxes",
          schema: SCHEMA,
          columns: TAX_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "taxes.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runGetQuery(db, { view: "taxes", schema: SCHEMA, columns: TAX_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }
      case "taxes.tags": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await loadTags(db, "tax_tags", "tax_parasut_id", id);
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse({ data: res.rows }, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
