// Phase 15 domain 2 -- sales. Public read function backing
// /satislar/faturalar(/:id), /satislar/teklifler(/:id),
// /satislar/tahsilatlar(/:id). Actions: invoices.list, invoices.get,
// invoices.counts, offers.list, offers.get, offers.counts, payments.list,
// payments.get, payments.counts.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery, runRelatedQuery } from "../_shared/query.ts";

const INVOICE_LIST_COLUMNS =
  "parasut_id, invoice_no, item_type, issue_date, due_date, currency, net_total, gross_total, total_vat, remaining, payment_status, archived, contact_parasut_id, contact_name, active_e_document_type";
const INVOICE_DETAIL_COLUMNS =
  "parasut_id, invoice_no, item_type, description, issue_date, due_date, currency, exchange_rate, net_total, gross_total, total_vat, total_discount, before_taxes_total, remaining, remaining_in_trl, payment_status, billing_address, billing_postal_code, billing_phone, tax_office, tax_number, country, city, district, is_abroad, order_no, order_date, invoice_note, archived, contact_parasut_id, contact_name, synced_at, active_e_document_type, active_e_document_parasut_id";
const INVOICE_DETAIL_LINE_COLUMNS =
  "parasut_id, description, quantity, unit_price, vat_rate, discount_type, discount_value, net_total, product_parasut_id, product_name";

const OFFER_LIST_COLUMNS =
  "parasut_id, description, status, issue_date, due_date, currency, net_total, gross_total, total_vat, archived, contact_parasut_id, contact_name";
const OFFER_DETAIL_COLUMNS =
  "parasut_id, description, content, status, issue_date, due_date, currency, exchange_rate, net_total, net_total_in_trl, gross_total, total_vat, total_discount, total_invoice_discount, invoice_discount_type, invoice_discount, withholding, withholding_rate, vat_withholding, vat_withholding_rate, total_vat_withholding, total_excise_duty, total_communications_tax, total_accommodation_tax, billing_address, billing_phone, billing_fax, tax_office, tax_number, city, district, is_abroad, order_no, order_date, sharings_count, display_exchange_rate_in_pdf, contact_type, archived, contact_parasut_id, contact_name, sales_invoice_parasut_id, sales_invoice_no, parasut_created_at, parasut_updated_at, synced_at";
const OFFER_DETAIL_LINE_COLUMNS =
  "parasut_id, sales_offer_parasut_id, description, detail_no, quantity, unit_price, vat_rate, vat_withholding, vat_withholding_rate, discount_type, discount_value, discount, invoice_discount, excise_duty_type, excise_duty, excise_duty_rate, excise_duty_value, communications_tax_rate, communications_tax, accommodation_tax_rate, accommodation_tax, accommodation_tax_exempt, net_total, net_total_without_invoice_discount, product_parasut_id, product_name, parasut_created_at, parasut_updated_at, synced_at";
const OFFER_ACTIVITY_COLUMNS =
  "parasut_id, sales_offer_parasut_id, activity_type, date, data_description, data_issue_date, data_due_date, data_net_total, data_currency, data_content, data_status, data_contact_id, data_contact_name, done_by_email, done_by_parasut_id, done_by_type, done_by_name, done_by_user_email, item_parasut_id, item_type, parasut_created_at, parasut_updated_at, synced_at";

const PAYMENT_LIST_COLUMNS =
  "parasut_id, date, amount, currency, notes, payable_type, payable_parasut_id, invoice_no, contact_parasut_id, contact_name, transaction_parasut_id, debit_account_name, credit_account_name";
const PAYMENT_DETAIL_COLUMNS =
  "parasut_id, date, amount, currency, notes, payable_type, payable_parasut_id, invoice_no, contact_parasut_id, contact_name, transaction_parasut_id, transaction_description, transaction_type, debit_account_parasut_id, debit_account_type, debit_account_name, credit_account_parasut_id, credit_account_type, credit_account_name, synced_at, due_date, matched_amount, amount_in_trl, paid_in_currency";

const INVOICE_SORT = ["issue_date", "due_date", "net_total", "invoice_no"] as const;
const OFFER_SORT = ["issue_date", "due_date", "net_total"] as const;
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
      case "invoices.counts": {
        const { data, error } = await db.from("parasut_sales_invoice_counts_demo").select("*").maybeSingle();
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? {} }, 200, cors);
      }
      case "invoices.list": {
        const parsed = parseListParams(body, INVOICE_SORT, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        const neq = [];
        if (typeof body?.["archived"] === "boolean") eq.push({ column: "archived", value: body["archived"] as boolean });
        if (typeof body?.["payment_status"] === "string") eq.push({ column: "payment_status", value: body["payment_status"] as string });
        if (typeof body?.["item_type"] === "string") eq.push({ column: "item_type", value: body["item_type"] as string });
        if (body?.["exclude_cancelled"] === true) neq.push({ column: "item_type", value: "cancelled" });
        const res = await runListQuery(db, {
          view: "parasut_sales_invoices_demo",
          columns: INVOICE_LIST_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
          neq,
          dateRange: buildDateRange(body, "issue_date"),
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "invoices.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const invoiceRes = await runGetQuery(db, { view: "parasut_sales_invoices_demo", columns: INVOICE_DETAIL_COLUMNS, id });
        if (!invoiceRes.ok) return errorResponse("internal_error", cors, invoiceRes.error);
        if (!invoiceRes.row) return errorResponse("not_found", cors);
        const detailsRes = await runRelatedQuery(db, "parasut_sales_invoice_details_demo", INVOICE_DETAIL_LINE_COLUMNS, [
          { column: "sales_invoice_parasut_id", value: id },
        ]);
        if (!detailsRes.ok) return errorResponse("internal_error", cors, detailsRes.error);
        return jsonResponse({ data: { ...invoiceRes.row, details: detailsRes.rows } }, 200, cors);
      }

      case "offers.counts": {
        const [activeRes, archivedRes, allRes] = await Promise.all([
          db.from("parasut_sales_offers_demo").select("parasut_id", { count: "exact", head: true }).eq("archived", false),
          db.from("parasut_sales_offers_demo").select("parasut_id", { count: "exact", head: true }).eq("archived", true),
          db.from("parasut_sales_offers_demo").select("parasut_id", { count: "exact", head: true }),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? allRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse({ data: { active: activeRes.count ?? 0, archived: archivedRes.count ?? 0, all: allRes.count ?? 0 } }, 200, cors);
      }
      case "offers.list": {
        const parsed = parseListParams(body, OFFER_SORT, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        if (typeof body?.["archived"] === "boolean") eq.push({ column: "archived", value: body["archived"] as boolean });
        const res = await runListQuery(db, {
          view: "parasut_sales_offers_demo",
          columns: OFFER_LIST_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
          dateRange: buildDateRange(body, "issue_date"),
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "offers.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const offerRes = await runGetQuery(db, { view: "parasut_sales_offers_demo", columns: OFFER_DETAIL_COLUMNS, id });
        if (!offerRes.ok) return errorResponse("internal_error", cors, offerRes.error);
        if (!offerRes.row) return errorResponse("not_found", cors);
        const [detailsRes, activitiesRes] = await Promise.all([
          runRelatedQuery(db, "parasut_sales_offer_details_demo", OFFER_DETAIL_LINE_COLUMNS, [{ column: "sales_offer_parasut_id", value: id }]),
          runRelatedQuery(db, "parasut_sales_offer_activities_demo", OFFER_ACTIVITY_COLUMNS, [{ column: "sales_offer_parasut_id", value: id }]),
        ]);
        if (!detailsRes.ok) return errorResponse("internal_error", cors, detailsRes.error);
        if (!activitiesRes.ok) return errorResponse("internal_error", cors, activitiesRes.error);
        return jsonResponse({ data: { ...offerRes.row, details: detailsRes.rows, activities: activitiesRes.rows } }, 200, cors);
      }

      case "payments.counts": {
        const { count, error } = await db.from("parasut_payments_demo").select("parasut_id", { count: "exact", head: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: { total: count ?? 0 } }, 200, cors);
      }
      case "payments.list": {
        const parsed = parseListParams(body, PAYMENT_SORT, { column: "date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "parasut_payments_demo",
          columns: PAYMENT_LIST_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          dateRange: buildDateRange(body, "date"),
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "payments.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runGetQuery(db, { view: "parasut_payments_demo", columns: PAYMENT_DETAIL_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
