// Phase 15 domain 8 -- shipments. Public read function backing
// /stok/sevkiyat-irsaliyeleri(/:id).
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery, runRelatedQuery } from "../_shared/query.ts";

const DOC_LIST_COLUMNS =
  "parasut_id, description, despatch_no, status, inflow, issue_date, shipment_date, archived, contact_parasut_id, contact_name, carrier_legal_name, carrier_license_plate";
const DOC_DETAIL_COLUMNS =
  "parasut_id, description, uuid, despatch_no, order_no, order_date, status, status_message, status_changed_at, shipment_document_type, inflow, is_commercial, issue_date, issue_datetime, shipment_date, printed_issue_date, printed_at, print_note, legalized_at, sharings_count, has_invoice, invoice_no, procurement_number, carrier_legal_name, carrier_tax_number, carrier_license_plate, drivers_info, address, city, district, postal_code, company_address, company_city, company_district, company_postal_code, archived, contact_parasut_id, contact_name, warehouse_transfer_parasut_id, e_despatch_response_type, e_despatch_response_parasut_id, inbound_e_despatch_parasut_id, parasut_created_at, parasut_updated_at, synced_at, print_url";
const MOVEMENT_COLUMNS =
  "parasut_id, date, quantity, product_parasut_id, product_name, warehouse_parasut_id, warehouse_name, source_type, source_parasut_id";
const ACTIVITY_COLUMNS =
  "parasut_id, activity_type, date, data_description, data_issue_date, done_by_email, done_by_parasut_id, done_by_type, done_by_name, done_by_user_email, item_parasut_id, item_type, parasut_created_at, parasut_updated_at";
const INVOICE_LINK_COLUMNS = "sales_invoice_parasut_id, sales_invoice_no";
const INBOUND_COLUMNS =
  "parasut_id, uuid, despatch_no, contact_name, issue_date, from_tax_number, response_status, response_type, expires_at, is_expired, parasut_created_at, parasut_updated_at";

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
      case "counts": {
        const { data, error } = await db.from("parasut_shipment_document_counts_demo").select("*").maybeSingle();
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? {} }, 200, cors);
      }
      case "list": {
        const parsed = parseListParams(body, ["issue_date", "shipment_date"] as const, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const eq = [];
        if (typeof body?.["archived"] === "boolean") eq.push({ column: "archived", value: body["archived"] as boolean });
        const res = await runListQuery(db, {
          view: "parasut_shipment_documents_demo",
          columns: DOC_LIST_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
          eq,
          dateRange: buildDateRange(body, "issue_date"),
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const docRes = await runGetQuery<{ inbound_e_despatch_parasut_id: number | null }>(db, {
          view: "parasut_shipment_documents_demo",
          columns: DOC_DETAIL_COLUMNS,
          id,
        });
        if (!docRes.ok) return errorResponse("internal_error", cors, docRes.error);
        if (!docRes.row) return errorResponse("not_found", cors);

        const [movementsRes, activitiesRes, invoiceLinksRes] = await Promise.all([
          runRelatedQuery(db, "parasut_stock_movements_demo", MOVEMENT_COLUMNS, [
            { column: "source_type", value: "shipment_documents" },
            { column: "source_parasut_id", value: id },
          ]),
          runRelatedQuery(db, "parasut_shipment_document_activities_demo", ACTIVITY_COLUMNS, [{ column: "shipment_document_parasut_id", value: id }]),
          runRelatedQuery(db, "parasut_shipment_document_invoices_demo", INVOICE_LINK_COLUMNS, [{ column: "shipment_document_parasut_id", value: id }]),
        ]);
        if (!movementsRes.ok) return errorResponse("internal_error", cors, movementsRes.error);
        if (!activitiesRes.ok) return errorResponse("internal_error", cors, activitiesRes.error);
        if (!invoiceLinksRes.ok) return errorResponse("internal_error", cors, invoiceLinksRes.error);

        let inbound: unknown = null;
        if (docRes.row.inbound_e_despatch_parasut_id) {
          const inboundRes = await runGetQuery(db, {
            view: "parasut_inbound_e_despatches_demo",
            columns: INBOUND_COLUMNS,
            id: docRes.row.inbound_e_despatch_parasut_id,
          });
          if (!inboundRes.ok) return errorResponse("internal_error", cors, inboundRes.error);
          inbound = inboundRes.row;
        }

        return jsonResponse(
          {
            data: {
              ...docRes.row,
              stock_movements: movementsRes.rows,
              activities: activitiesRes.rows,
              invoices: invoiceLinksRes.rows,
              inbound_e_despatch: inbound,
            },
          },
          200,
          cors,
        );
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
