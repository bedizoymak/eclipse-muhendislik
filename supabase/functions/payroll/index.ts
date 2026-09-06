// Phase 15 domain 4 -- payroll. Public read function backing
// /giderler/calisanlar(/:id), /giderler/maaslar(/:id), /giderler/vergiler(/:id).
// IBAN/TCKN stay excluded from every employee column list below -- already
// dropped from the source view (20260906200827), repeated here as
// defense-in-depth per the Phase 15 design doc.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery, runRelatedQuery } from "../_shared/query.ts";

const EMPLOYEE_LIST_COLUMNS = "parasut_id, name, email, phone, archived, employment_start_date, employment_end_date, category_parasut_id";
const EMPLOYEE_DETAIL_COLUMNS =
  "parasut_id, name, email, phone, archived, employment_start_date, employment_end_date, balance, trl_balance, usd_balance, eur_balance, gbp_balance, category_parasut_id, managed_by_user_parasut_id, managed_by_user_role_parasut_id, managed_by_user_role_type, tags_resolved, activities_resolved, comments_resolved, parasut_created_at, parasut_updated_at, synced_at";
const SALARY_COLUMNS =
  "parasut_id, parasut_type, description, currency, issue_date, due_date, exchange_rate, net_total, total_paid, remaining, remaining_in_trl, archived, employee_parasut_id, employee_parasut_type, category_parasut_id, category_parasut_type, parasut_created_at, parasut_updated_at, synced_at";
const TAX_COLUMNS =
  "parasut_id, parasut_type, description, issue_date, due_date, net_total, total_paid, remaining, remaining_in_trl, archived, category_parasut_id, category_parasut_type, parasut_created_at, parasut_updated_at, synced_at";
const SALARY_TAG_COLUMNS = "tag_parasut_id, tag_type, tag_name";
const TAX_TAG_COLUMNS = "tag_parasut_id, tag_type, tag_name";

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
      case "employees.counts": {
        const { data, error } = await db.from("parasut_employee_counts_demo").select("*").maybeSingle();
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? {} }, 200, cors);
      }
      case "employees.meta": {
        const { data, error } = await db.from("parasut_employee_meta_demo").select("*");
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }
      case "employees.list": {
        const parsed = parseListParams(body, ["name"] as const, { column: "name", direction: "asc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        if (typeof body?.["archived"] === "boolean") eq.push({ column: "archived", value: body["archived"] as boolean });
        const res = await runListQuery(db, {
          view: "parasut_employees_demo",
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
        const res = await runGetQuery(db, { view: "parasut_employees_demo", columns: EMPLOYEE_DETAIL_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }
      // Lightweight name-only lookup used by MaasDetay for
      // row.employee_parasut_id -> employee name.
      case "employees.name": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runGetQuery<{ name: string | null }>(db, { view: "parasut_employees_demo", columns: "name", id });
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
        const res = await runGetQuery<{ name: string | null }>(db, { view: "parasut_item_categories_demo", columns: "name", id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse({ data: res.row }, 200, cors);
      }

      case "salaries.counts": {
        const { data, error } = await db.from("parasut_salary_counts_demo").select("*").maybeSingle();
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? {} }, 200, cors);
      }
      case "salaries.list": {
        const parsed = parseListParams(body, ["issue_date"] as const, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "parasut_salaries_demo",
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
        const res = await runGetQuery(db, { view: "parasut_salaries_demo", columns: SALARY_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }
      case "salaries.tags": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runRelatedQuery(db, "parasut_salary_tags_demo", SALARY_TAG_COLUMNS, [{ column: "salary_parasut_id", value: id }]);
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse({ data: res.rows }, 200, cors);
      }

      case "taxes.counts": {
        const { data, error } = await db.from("parasut_tax_counts_demo").select("*").maybeSingle();
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? {} }, 200, cors);
      }
      case "taxes.list": {
        const parsed = parseListParams(body, ["issue_date"] as const, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "parasut_taxes_demo",
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
        const res = await runGetQuery(db, { view: "parasut_taxes_demo", columns: TAX_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }
      case "taxes.tags": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runRelatedQuery(db, "parasut_tax_tags_demo", TAX_TAG_COLUMNS, [{ column: "tax_parasut_id", value: id }]);
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
