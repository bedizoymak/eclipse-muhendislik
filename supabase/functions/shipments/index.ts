// Phase 15 domain 8 -- shipments. Public read function backing
// /stok/sevkiyat-irsaliyeleri(/:id).
//
// Phase 15.1: migrated off the `public.parasut_*_demo` views onto the
// `parasut.*` base tables (see the design note at the top of
// ../_shared/query.ts). This domain used six views; per-view treatment:
//
//   * parasut_shipment_document_counts_demo -- an AGGREGATE view, four
//     buckets over parasut.shipment_documents:
//         active_count        = count(*) FILTER (WHERE archived = false)
//         archived_count      = count(*) FILTER (WHERE archived = true)
//         null_archived_count = count(*) FILTER (WHERE archived IS NULL)
//         total_count         = count(*)
//     All four are replicated below as four exact head-counts. Note that
//     `archived = false` / `= true` are three-valued: neither matches NULL,
//     which is exactly why the third bucket exists, so it must NOT be folded
//     into either of the first two, and active + archived + null_archived is
//     the only decomposition that sums to total.
//
//   * parasut_shipment_documents_demo -- s LEFT JOIN contacts, only to
//     resolve `contact_name`. Both sortable columns (`issue_date`,
//     `shipment_date`) and the `archived` filter live on the parent table,
//     so `list` fetches the parent page in Postgres (filters + sort + range +
//     exact count) and merges the contact name in TS afterwards. `count`
//     therefore always comes from the parent query alone.
//
//   * parasut_shipment_document_invoices_demo -- i LEFT JOIN sales_invoices,
//     to resolve `sales_invoice_no`; same fetch-then-merge treatment.
//
//   * parasut_stock_movements_demo -- sm LEFT JOIN products / warehouses
//     (this domain does not request `contact_name`), same treatment.
//
//   * parasut_shipment_document_activities_demo and
//     parasut_inbound_e_despatches_demo -- plain single-table passthroughs.
//     Their baked-in `ORDER BY ... date/issue_date DESC NULLS LAST` is
//     re-expressed explicitly here, since these related-rows queries did not
//     previously apply an order of their own and so inherited the view's.
//
// Every join above is a LEFT join: an unmatched parent row is always kept
// with the resolved field left literally `null`, never filtered out.
// The response envelope, field allow-lists, filters, pagination and sort
// behaviour are unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "parasut";
const DOCS_TABLE = "shipment_documents";

// Parent-table column subsets. `contact_name` is resolved separately.
const DOC_LIST_BASE_COLUMNS =
  "parasut_id, description, despatch_no, status, inflow, issue_date, shipment_date, archived, contact_parasut_id, carrier_legal_name, carrier_license_plate";
const DOC_DETAIL_BASE_COLUMNS =
  "parasut_id, description, uuid, despatch_no, order_no, order_date, status, status_message, status_changed_at, shipment_document_type, inflow, is_commercial, issue_date, issue_datetime, shipment_date, printed_issue_date, printed_at, print_note, legalized_at, sharings_count, has_invoice, invoice_no, procurement_number, carrier_legal_name, carrier_tax_number, carrier_license_plate, drivers_info, address, city, district, postal_code, company_address, company_city, company_district, company_postal_code, archived, contact_parasut_id, warehouse_transfer_parasut_id, e_despatch_response_type, e_despatch_response_parasut_id, inbound_e_despatch_parasut_id, parasut_created_at, parasut_updated_at, synced_at, print_url";
const MOVEMENT_BASE_COLUMNS =
  "parasut_id, date, quantity, product_parasut_id, warehouse_parasut_id, source_type, source_parasut_id";
const ACTIVITY_COLUMNS =
  "parasut_id, activity_type, date, data_description, data_issue_date, done_by_email, done_by_parasut_id, done_by_type, done_by_name, done_by_user_email, item_parasut_id, item_type, parasut_created_at, parasut_updated_at";
const INBOUND_COLUMNS =
  "parasut_id, uuid, despatch_no, contact_name, issue_date, from_tax_number, response_status, response_type, expires_at, is_expired, parasut_created_at, parasut_updated_at";

type Row = Record<string, unknown>;

function buildDateRange(body: Record<string, unknown> | null, column: string) {
  const gte = body?.["dateFrom"];
  const lte = body?.["dateTo"];
  if (typeof gte !== "string" && typeof lte !== "string") return undefined;
  return { column, gte: typeof gte === "string" ? gte : undefined, lte: typeof lte === "string" ? lte : undefined };
}

function idsOf(rows: Row[], column: string): unknown[] {
  return [...new Set(rows.map((r) => r[column]).filter((v) => v != null))];
}

/** parasut_id -> row map for a lookup table, restricted to the ids on the
 * current page. Returns an empty map (all names resolve to null) when there
 * are no ids to look up. */
async function loadNames(
  db: SupabaseClient,
  table: string,
  ids: unknown[],
  columns = "parasut_id, name",
): Promise<{ ok: true; value: Map<unknown, Row> } | { ok: false; error: unknown }> {
  if (ids.length === 0) return { ok: true, value: new Map() };
  const { data, error } = await db.schema(SCHEMA).from(table).select(columns).in("parasut_id", ids);
  if (error) return { ok: false, error };
  return { ok: true, value: new Map(((data ?? []) as Row[]).map((r) => [r["parasut_id"], r])) };
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
        // All four buckets of parasut_shipment_document_counts_demo.
        const docs = () => db.schema(SCHEMA).from(DOCS_TABLE).select("parasut_id", { count: "exact", head: true });
        const [activeRes, archivedRes, nullArchivedRes, totalRes] = await Promise.all([
          docs().eq("archived", false),
          docs().eq("archived", true),
          docs().is("archived", null),
          docs(),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? nullArchivedRes.error ?? totalRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse(
          {
            data: {
              active_count: activeRes.count ?? 0,
              archived_count: archivedRes.count ?? 0,
              null_archived_count: nullArchivedRes.count ?? 0,
              total_count: totalRes.count ?? 0,
            },
          },
          200,
          cors,
        );
      }

      case "list": {
        const parsed = parseListParams(body, ["issue_date", "shipment_date"] as const, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);

        let query = db.schema(SCHEMA).from(DOCS_TABLE).select(DOC_LIST_BASE_COLUMNS, { count: "exact" });
        if (typeof body?.["archived"] === "boolean") query = query.eq("archived", body["archived"] as boolean);
        const dateRange = buildDateRange(body, "issue_date");
        if (dateRange?.gte) query = query.gte(dateRange.column, dateRange.gte);
        if (dateRange?.lte) query = query.lte(dateRange.column, dateRange.lte);
        if (parsed.sort) query = query.order(parsed.sort.column, { ascending: parsed.sort.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);

        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        const page = (data ?? []) as Row[];

        const contactsRes = await loadNames(db, "contacts", idsOf(page, "contact_parasut_id"));
        if (!contactsRes.ok) return errorResponse("internal_error", cors, contactsRes.error);

        const merged = page.map((s) => {
          const c = contactsRes.value.get(s["contact_parasut_id"]);
          // LEFT JOIN: spread the parent row first, contact_name null when
          // unmatched. The parent row is never dropped.
          return { ...s, contact_name: c ? (c["name"] ?? null) : null };
        });

        return jsonResponse({ data: merged, count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }

      case "get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);

        const docRes = await db
          .schema(SCHEMA)
          .from(DOCS_TABLE)
          .select(DOC_DETAIL_BASE_COLUMNS)
          .eq("parasut_id", id)
          .maybeSingle();
        if (docRes.error) return errorResponse("internal_error", cors, docRes.error);
        if (!docRes.data) return errorResponse("not_found", cors);
        const doc = docRes.data as Row;

        const docContactRes = await loadNames(db, "contacts", idsOf([doc], "contact_parasut_id"));
        if (!docContactRes.ok) return errorResponse("internal_error", cors, docContactRes.error);
        const docContact = docContactRes.value.get(doc["contact_parasut_id"]);
        const docRow: Row = { ...doc, contact_name: docContact ? (docContact["name"] ?? null) : null };

        const [movementsRes, activitiesRes, invoiceLinksRes] = await Promise.all([
          db
            .schema(SCHEMA)
            .from("stock_movements")
            .select(MOVEMENT_BASE_COLUMNS)
            .eq("source_type", "shipment_documents")
            .eq("source_parasut_id", id)
            // parasut_stock_movements_demo ordered by date DESC NULLS LAST.
            .order("date", { ascending: false, nullsFirst: false }),
          db
            .schema(SCHEMA)
            .from("shipment_document_activities")
            .select(ACTIVITY_COLUMNS)
            .eq("shipment_document_parasut_id", id)
            // view: ORDER BY shipment_document_parasut_id, date DESC NULLS LAST
            .order("date", { ascending: false, nullsFirst: false }),
          db
            .schema(SCHEMA)
            .from("shipment_document_invoices")
            .select("sales_invoice_parasut_id")
            .eq("shipment_document_parasut_id", id),
        ]);
        if (movementsRes.error) return errorResponse("internal_error", cors, movementsRes.error);
        if (activitiesRes.error) return errorResponse("internal_error", cors, activitiesRes.error);
        if (invoiceLinksRes.error) return errorResponse("internal_error", cors, invoiceLinksRes.error);

        const movementRows = (movementsRes.data ?? []) as Row[];
        const invoiceRows = (invoiceLinksRes.data ?? []) as Row[];

        const [productsRes, warehousesRes, salesInvoicesRes] = await Promise.all([
          loadNames(db, "products", idsOf(movementRows, "product_parasut_id")),
          loadNames(db, "warehouses", idsOf(movementRows, "warehouse_parasut_id")),
          loadNames(db, "sales_invoices", idsOf(invoiceRows, "sales_invoice_parasut_id"), "parasut_id, invoice_no"),
        ]);
        if (!productsRes.ok) return errorResponse("internal_error", cors, productsRes.error);
        if (!warehousesRes.ok) return errorResponse("internal_error", cors, warehousesRes.error);
        if (!salesInvoicesRes.ok) return errorResponse("internal_error", cors, salesInvoicesRes.error);

        const movements = movementRows.map((sm) => {
          const p = productsRes.value.get(sm["product_parasut_id"]);
          const w = warehousesRes.value.get(sm["warehouse_parasut_id"]);
          return {
            ...sm,
            product_name: p ? (p["name"] ?? null) : null,
            warehouse_name: w ? (w["name"] ?? null) : null,
          } as Row;
        });

        const invoices = invoiceRows.map((i) => {
          const si = salesInvoicesRes.value.get(i["sales_invoice_parasut_id"]);
          return {
            sales_invoice_parasut_id: i["sales_invoice_parasut_id"] ?? null,
            sales_invoice_no: si ? (si["invoice_no"] ?? null) : null,
          } as Row;
        });

        let inbound: unknown = null;
        const inboundId = docRow["inbound_e_despatch_parasut_id"] as number | null;
        if (inboundId) {
          const inboundRes = await db
            .schema(SCHEMA)
            .from("inbound_e_despatches")
            .select(INBOUND_COLUMNS)
            .eq("parasut_id", inboundId)
            .maybeSingle();
          if (inboundRes.error) return errorResponse("internal_error", cors, inboundRes.error);
          inbound = inboundRes.data ?? null;
        }

        return jsonResponse(
          {
            data: {
              ...docRow,
              stock_movements: movements,
              activities: activitiesRes.data ?? [],
              invoices,
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
