// Phase 15 domain 5 -- cash. Public read function backing /nakit/hesaplar,
// /nakit/hesap-hareketleri, /nakit/cekler(/:id). IBAN/bank_account_no stay
// excluded from every accounts column list -- already dropped from the
// source view (20260906200827), repeated here as defense-in-depth.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery, runRelatedQuery } from "../_shared/query.ts";

const ACCOUNT_COLUMNS = "parasut_id, name, account_type, currency, bank_name, bank_branch, balance, archived, synced_at";
const ACCOUNT_OPTION_COLUMNS = "parasut_id, name";
const TRANSACTION_COLUMNS =
  "parasut_id, description, transaction_type, date, debit_amount, debit_currency, debit_account_parasut_id, debit_account_type, debit_account_name, debit_contact_name, credit_amount, credit_currency, credit_account_parasut_id, credit_account_type, credit_account_name, credit_contact_name";
const CHECK_LIST_COLUMNS =
  "parasut_id, serial_number, bank_identifier, bank_name, due_date, issue_date, net_total, remaining, currency, payment_status, is_cashed, is_in, is_out, issued_by_parasut_id, issued_by_name, given_to_parasut_id, given_to_name";
const CHECK_DETAIL_COLUMNS =
  "parasut_id, currency, description, due_date, issue_date, net_total, remaining, remaining_in_trl, payment_status, is_cashed, is_in, is_out, is_transferred, days_overdue, bank_identifier, bank_name, serial_number, issued_by_parasut_id, issued_by_type, issued_by_name, given_to_parasut_id, given_to_type, given_to_name, synced_at, days_till_due_date, parasut_created_at, parasut_updated_at";
const CHECK_PAYMENT_COLUMNS = "parasut_id, date, due_date, amount, matched_amount, amount_in_trl, currency, paid_in_currency";

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
      case "accounts.list": {
        const { data, error } = await db.from("parasut_accounts_demo").select(ACCOUNT_COLUMNS);
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }
      case "accounts.options": {
        const { data, error } = await db.from("parasut_accounts_demo").select(ACCOUNT_OPTION_COLUMNS);
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }

      case "transactions.list": {
        const parsed = parseListParams(body, ["date"] as const, { column: "date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        let query = db.from("parasut_transactions_demo").select(TRANSACTION_COLUMNS, { count: "exact" });
        const accountId = Number(body?.["account_id"]);
        if (Number.isFinite(accountId) && body?.["account_id"] !== undefined) {
          query = query.or(`debit_account_parasut_id.eq.${accountId},credit_account_parasut_id.eq.${accountId}`);
        }
        if (typeof body?.["transaction_type"] === "string") query = query.eq("transaction_type", body["transaction_type"] as string);
        const range = buildDateRange(body, "date");
        if (range?.gte) query = query.gte(range.column, range.gte);
        if (range?.lte) query = query.lte(range.column, range.lte);
        query = query.order(parsed.sort!.column, { ascending: parsed.sort!.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);
        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [], count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }

      case "checks.counts": {
        const [inRes, outRes, allRes] = await Promise.all([
          db.from("parasut_checks_demo").select("parasut_id", { count: "exact", head: true }).eq("is_in", true),
          db.from("parasut_checks_demo").select("parasut_id", { count: "exact", head: true }).eq("is_out", true),
          db.from("parasut_checks_demo").select("parasut_id", { count: "exact", head: true }),
        ]);
        const err = inRes.error ?? outRes.error ?? allRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse({ data: { in: inRes.count ?? 0, out: outRes.count ?? 0, all: allRes.count ?? 0 } }, 200, cors);
      }
      case "checks.list": {
        const parsed = parseListParams(body, ["due_date", "issue_date"] as const, { column: "due_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        if (typeof body?.["is_in"] === "boolean") eq.push({ column: "is_in", value: body["is_in"] as boolean });
        if (typeof body?.["is_out"] === "boolean") eq.push({ column: "is_out", value: body["is_out"] as boolean });
        const res = await runListQuery(db, {
          view: "parasut_checks_demo",
          columns: CHECK_LIST_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
          dateRange: buildDateRange(body, "due_date"),
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "checks.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const checkRes = await runGetQuery(db, { view: "parasut_checks_demo", columns: CHECK_DETAIL_COLUMNS, id });
        if (!checkRes.ok) return errorResponse("internal_error", cors, checkRes.error);
        if (!checkRes.row) return errorResponse("not_found", cors);
        const paymentsRes = await runRelatedQuery(db, "parasut_payments_demo", CHECK_PAYMENT_COLUMNS, [
          { column: "payable_type", value: "checks" },
          { column: "payable_parasut_id", value: id },
        ]);
        if (!paymentsRes.ok) return errorResponse("internal_error", cors, paymentsRes.error);
        return jsonResponse({ data: { ...checkRes.row, payments: paymentsRes.rows } }, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
