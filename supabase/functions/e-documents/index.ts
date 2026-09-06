// Phase 15 domain 9 -- e-documents. Public read function backing
// /satislar/e-faturalar(/:id), /satislar/e-fatura-mukellefleri, and the
// FaturaDetay/GiderDetay "active e-document" resolver (previously
// src/lib/eDocuments.ts querying parasut_e_invoices_demo/
// parasut_e_archives_demo directly).
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery } from "../_shared/query.ts";

const E_INVOICE_COLUMNS =
  "parasut_id, parent_type, parent_parasut_id, external_id, uuid, direction, scenario, status, status_code, status_message, item_type, invoice_type_code, issue_date, expires_at, is_expired, is_answerable, is_seen, non_standard_e_invoice, archived, currency, net_total, total_vat, contact_name, from_address, from_vkn, to_address, to_vkn, note, response_type, env_uuid, profile_id, refund_of_id, vat_exemption_reason_code, pdf_url, signed_ubl_url, html_url, parasut_created_at, parasut_updated_at, synced_at, gtb_ref_no, migration_source, parent_resolution_status";
const E_ARCHIVE_COLUMNS =
  "parasut_id, sales_invoice_parasut_id, uuid, vkn, invoice_number, status, is_printed, is_signed, printed_at, cancellable_until, email_status, note, pdf_url, signed_ubl_url, html_url, parasut_created_at, parasut_updated_at, synced_at, migration_source";
const LOOKUP_COLUMNS =
  "parasut_id, parasut_type, vkn, e_invoice_address, name, inbox_type, address_registered_at, registered_at, parasut_created_at, parasut_updated_at, synced_at";

const INVOICE_SORT = ["issue_date"] as const;

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
        const { data, error } = await db.from("parasut_e_invoices_counts_demo").select("*").maybeSingle();
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? {} }, 200, cors);
      }
      case "invoices.list": {
        const parsed = parseListParams(body, INVOICE_SORT, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        if (typeof body?.["direction"] === "string") eq.push({ column: "direction", value: body["direction"] as string });
        const isNull = [];
        const notNull = [];
        if (body?.["linked"] === true) notNull.push("parent_type");
        if (body?.["linked"] === false) isNull.push("parent_type");
        const res = await runListQuery(db, {
          view: "parasut_e_invoices_demo",
          columns: E_INVOICE_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
          isNull,
          notNull,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "invoices.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runGetQuery(db, { view: "parasut_e_invoices_demo", columns: E_INVOICE_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }

      case "lookup.list": {
        const parsed = parseListParams(body, ["synced_at"] as const, { column: "synced_at", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "parasut_e_invoice_lookup_results_demo",
          columns: LOOKUP_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "lookup.counts": {
        const { data, error } = await db.from("parasut_e_invoice_lookup_result_counts_demo").select("*").maybeSingle();
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? {} }, 200, cors);
      }

      // Used by FaturaDetay/GiderDetay to resolve a sales_invoice's or
      // purchase_bill's active_e_document (previously
      // src/lib/eDocuments.ts querying the two views directly from the
      // browser). `docType` must be exactly "e_invoices" or "e_archives" --
      // the same two real types the parent's own active_e_document_type
      // column has ever held; anything else returns { data: null }, never
      // a guess.
      case "resolve": {
        const docType = body?.["docType"];
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        if (docType === "e_invoices") {
          const res = await runGetQuery(db, { view: "parasut_e_invoices_demo", columns: E_INVOICE_COLUMNS, id });
          if (!res.ok) return errorResponse("internal_error", cors, res.error);
          return jsonResponse({ data: res.row ? { kind: "e_invoices", row: res.row } : null }, 200, cors);
        }
        if (docType === "e_archives") {
          const res = await runGetQuery(db, { view: "parasut_e_archives_demo", columns: E_ARCHIVE_COLUMNS, id });
          if (!res.ok) return errorResponse("internal_error", cors, res.error);
          return jsonResponse({ data: res.row ? { kind: "e_archives", row: res.row } : null }, 200, cors);
        }
        return jsonResponse({ data: null }, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
