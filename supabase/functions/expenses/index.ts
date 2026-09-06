// Phase 15 domain 3 -- expenses. Public read function backing /giderler,
// /giderler/:id, /giderler/tedarikciler, /giderler/odemeler.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery, runRelatedQuery } from "../_shared/query.ts";

const BILL_LIST_COLUMNS =
  "parasut_id, invoice_no, description, issue_date, due_date, currency, net_total, gross_total, total_vat, total_paid, remaining, payment_status, archived, supplier_parasut_id, supplier_name, spender_parasut_id, spender_name, active_e_document_type";
const BILL_DETAIL_COLUMNS =
  "parasut_id, invoice_no, item_type, description, issue_date, due_date, currency, exchange_rate, net_total, gross_total, total_vat, total_discount, total_paid, remaining, remaining_in_trl, payment_status, archived, supplier_parasut_id, supplier_name, spender_parasut_id, spender_name, pay_to_parasut_id, pay_to_name, synced_at, active_e_document_type, active_e_document_parasut_id";
const BILL_DETAIL_LINE_COLUMNS =
  "parasut_id, description, quantity, unit_price, vat_rate, discount_type, discount_value, net_total, product_parasut_id, product_name";
const EXPENSE_PAYMENT_COLUMNS_LIST =
  "parasut_id, date, amount, currency, notes, payable_parasut_id, invoice_no, supplier_parasut_id, supplier_name, transaction_parasut_id, debit_account_name, credit_account_name";
const EXPENSE_PAYMENT_COLUMNS_FOR_BILL =
  "parasut_id, date, amount, currency, notes, transaction_parasut_id, debit_account_name, credit_account_name";
const SUPPLIER_COLUMNS = "parasut_id, name, short_name, email, phone, city, archived";

const BILL_SORT = ["issue_date", "due_date", "net_total"] as const;
const PAYMENT_SORT = ["date", "amount"] as const;

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
      case "bills.counts": {
        const { data, error } = await db.from("parasut_purchase_bill_counts_demo").select("*").maybeSingle();
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? {} }, 200, cors);
      }
      case "bills.list": {
        const parsed = parseListParams(body, BILL_SORT, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        if (typeof body?.["archived"] === "boolean") eq.push({ column: "archived", value: body["archived"] as boolean });
        if (typeof body?.["payment_status"] === "string") eq.push({ column: "payment_status", value: body["payment_status"] as string });
        if (Number.isFinite(Number(body?.["supplier_id"]))) eq.push({ column: "supplier_parasut_id", value: Number(body?.["supplier_id"]) });
        const res = await runListQuery(db, {
          view: "parasut_purchase_bills_demo",
          columns: BILL_LIST_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
          dateRange: buildDateRange(body, "issue_date"),
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "bills.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const billRes = await runGetQuery(db, { view: "parasut_purchase_bills_demo", columns: BILL_DETAIL_COLUMNS, id });
        if (!billRes.ok) return errorResponse("internal_error", cors, billRes.error);
        if (!billRes.row) return errorResponse("not_found", cors);
        const [detailsRes, paymentsRes] = await Promise.all([
          runRelatedQuery(db, "parasut_purchase_bill_details_demo", BILL_DETAIL_LINE_COLUMNS, [{ column: "purchase_bill_parasut_id", value: id }]),
          runRelatedQuery(db, "parasut_expense_payments_demo", EXPENSE_PAYMENT_COLUMNS_FOR_BILL, [{ column: "payable_parasut_id", value: id }]),
        ]);
        if (!detailsRes.ok) return errorResponse("internal_error", cors, detailsRes.error);
        if (!paymentsRes.ok) return errorResponse("internal_error", cors, paymentsRes.error);
        return jsonResponse({ data: { ...billRes.row, details: detailsRes.rows, payments: paymentsRes.rows } }, 200, cors);
      }

      case "suppliers.counts": {
        const [activeRes, archivedRes, allRes] = await Promise.all([
          db.from("parasut_suppliers_demo").select("parasut_id", { count: "exact", head: true }).eq("archived", false),
          db.from("parasut_suppliers_demo").select("parasut_id", { count: "exact", head: true }).eq("archived", true),
          db.from("parasut_suppliers_demo").select("parasut_id", { count: "exact", head: true }),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? allRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse({ data: { active: activeRes.count ?? 0, archived: archivedRes.count ?? 0, all: allRes.count ?? 0 } }, 200, cors);
      }
      case "suppliers.list": {
        const parsed = parseListParams(body, ["name"] as const, { column: "name", direction: "asc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        if (typeof body?.["archived"] === "boolean") eq.push({ column: "archived", value: body["archived"] as boolean });
        const res = await runListQuery(db, {
          view: "parasut_suppliers_demo",
          columns: SUPPLIER_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      // Used by the /giderler supplier dropdown filter -- all suppliers,
      // unpaginated (matches the current .select("parasut_id, name") client
      // behavior exactly).
      case "suppliers.options": {
        const { data, error } = await db.from("parasut_suppliers_demo").select("parasut_id, name");
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }

      case "payments.counts": {
        const { count, error } = await db.from("parasut_expense_payments_demo").select("parasut_id", { count: "exact", head: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: { total: count ?? 0 } }, 200, cors);
      }
      case "payments.list": {
        const parsed = parseListParams(body, PAYMENT_SORT, { column: "date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "parasut_expense_payments_demo",
          columns: EXPENSE_PAYMENT_COLUMNS_LIST,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
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
