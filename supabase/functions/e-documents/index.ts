// Phase 15 domain 9 -- e-documents. Public read function backing
// /satislar/e-faturalar(/:id), /satislar/e-fatura-mukellefleri, and the
// FaturaDetay/GiderDetay "active e-document" resolver (previously
// src/lib/eDocuments.ts querying parasut_e_invoices_demo/
// parasut_e_archives_demo directly).
//
// Phase 15.1: migrated off the `public.parasut_*_demo` views onto the
// `parasut.*` objects (see the design note at the top of
// ../_shared/query.ts). Five views were in play here:
//
//   * parasut_e_invoices_demo -- a plain single-table passthrough, but NOT
//     of parasut.e_invoices: it selects from `parasut.e_invoices_with_
//     resolution`, an existing VIEW that already lives in the `parasut`
//     schema. That view is NOT one of the public demo objects being retired
//     and is not in scope for removal, so it is used directly as the new
//     source here rather than being re-implemented. It is what computes
//     `parent_resolution_status`, joining sales_invoices/purchase_bills:
//         parent_type IS NULL                                -> 'no_relationship'
//         parent_type='sales_invoices' AND si matched        -> 'resolved'
//         parent_type='purchase_bills' AND pb matched        -> 'resolved'
//         otherwise                                          -> 'unresolved'
//     Re-deriving that in TS would duplicate logic the database already
//     owns, so the migration only swaps the demo wrapper for its source.
//     The demo view's `ORDER BY issue_date DESC NULLS LAST` was already
//     overridden by this function's own explicit sort on every read.
//
//   * parasut_e_invoices_counts_demo -- SEVENTEEN named counters over that
//     same resolution view (a plain total plus SIXTEEN `count(*) FILTER`
//     buckets). Every one is replicated below as its own exact head count,
//     in the view's own order, with none merged, derived or dropped --
//     several of them deliberately overlap (e.g. `unlinked_count` and
//     `no_invoice_relationship` are equal by construction, and
//     `total_with_relationship` is not the complement of any single other
//     bucket), and the counters are read by name by the frontend.
//
//   * parasut_e_invoice_lookup_results_demo -- a passthrough of
//     parasut.e_invoice_inboxes. Its baked-in
//     `ORDER BY synced_at DESC NULLS LAST, parasut_id DESC` was already
//     being overridden by this function's own outer `ORDER BY synced_at`,
//     and an outer sort in Postgres is not stable, so the migration keeps
//     the same single sort key and therefore the same tie non-determinism
//     rather than inventing a new deterministic tiebreaker.
//
//   * parasut_e_invoice_lookup_result_counts_demo -- a bare
//     `count(*) AS cached_query_result_count` over the same table; one exact
//     head count, keeping the counter's name.
//
//   * parasut_e_archives_demo -- a passthrough of parasut.e_archives with
//     `ORDER BY parasut_created_at DESC NULLS LAST`. It is only ever read
//     here as a single row by parasut_id (the `resolve` action), so no
//     ordering is observable and none is issued.
//
// Response envelope, field allow-lists, filters, pagination and sort
// behaviour are unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { scheduleDomainFreshness } from "../_shared/freshness.ts";
import { runGetQuery, runListQuery } from "../_shared/query.ts";

const SCHEMA = "parasut";
// The `parasut`-schema view that computes parent_resolution_status. NOT a
// public demo object -- see the header note.
const E_INVOICES_SOURCE = "e_invoices_with_resolution";

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
  scheduleDomainFreshness(db, "e-documents");

  try {
    switch (action) {
      case "invoices.counts": {
        // All seventeen counters of the retired aggregate view, one exact
        // head count each, in the view's own order. None is derived from
        // another (several overlap by construction).
        const e = () => db.schema(SCHEMA).from(E_INVOICES_SOURCE).select("parasut_id", { count: "exact", head: true });
        const [
          total,
          linkedSales,
          linkedPurchase,
          unlinked,
          inbound,
          outbound,
          unknownDirection,
          archived,
          active,
          nullArchived,
          unresolvedRelationship,
          resolvedSales,
          unresolvedSales,
          resolvedPurchase,
          unresolvedPurchase,
          noRelationship,
          withRelationship,
        ] = await Promise.all([
          e(),
          e().eq("parent_type", "sales_invoices"),
          e().eq("parent_type", "purchase_bills"),
          e().is("parent_type", null),
          e().eq("direction", "inbound"),
          e().eq("direction", "outbound"),
          e().is("direction", null),
          e().eq("archived", true),
          e().eq("archived", false),
          e().is("archived", null),
          e().not("parent_type", "is", null).not("parent_type", "in", "(sales_invoices,purchase_bills)"),
          e().eq("parent_resolution_status", "resolved").eq("parent_type", "sales_invoices"),
          e().eq("parent_resolution_status", "unresolved").eq("parent_type", "sales_invoices"),
          e().eq("parent_resolution_status", "resolved").eq("parent_type", "purchase_bills"),
          e().eq("parent_resolution_status", "unresolved").eq("parent_type", "purchase_bills"),
          e().eq("parent_resolution_status", "no_relationship"),
          e().not("parent_type", "is", null),
        ]);
        const err = total.error ?? linkedSales.error ?? linkedPurchase.error ?? unlinked.error ??
          inbound.error ?? outbound.error ?? unknownDirection.error ?? archived.error ?? active.error ??
          nullArchived.error ?? unresolvedRelationship.error ?? resolvedSales.error ??
          unresolvedSales.error ?? resolvedPurchase.error ?? unresolvedPurchase.error ??
          noRelationship.error ?? withRelationship.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse({
          data: {
            total_e_invoices: total.count ?? 0,
            linked_sales_invoice_count: linkedSales.count ?? 0,
            linked_purchase_bill_count: linkedPurchase.count ?? 0,
            unlinked_count: unlinked.count ?? 0,
            inbound_count: inbound.count ?? 0,
            outbound_count: outbound.count ?? 0,
            unknown_direction_count: unknownDirection.count ?? 0,
            archived_count: archived.count ?? 0,
            active_count: active.count ?? 0,
            null_archived_count: nullArchived.count ?? 0,
            unresolved_relationship_count: unresolvedRelationship.count ?? 0,
            resolved_sales_relationship: resolvedSales.count ?? 0,
            unresolved_sales_relationship: unresolvedSales.count ?? 0,
            resolved_purchase_relationship: resolvedPurchase.count ?? 0,
            unresolved_purchase_relationship: unresolvedPurchase.count ?? 0,
            no_invoice_relationship: noRelationship.count ?? 0,
            total_with_relationship: withRelationship.count ?? 0,
          },
        }, 200, cors);
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
          view: E_INVOICES_SOURCE,
          schema: SCHEMA,
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
        const res = await runGetQuery(db, { view: E_INVOICES_SOURCE, schema: SCHEMA, columns: E_INVOICE_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }

      case "lookup.list": {
        const parsed = parseListParams(body, ["synced_at"] as const, { column: "synced_at", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "e_invoice_inboxes",
          schema: SCHEMA,
          columns: LOOKUP_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "lookup.counts": {
        const { count, error } = await db
          .schema(SCHEMA)
          .from("e_invoice_inboxes")
          .select("parasut_id", { count: "exact", head: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: { cached_query_result_count: count ?? 0 } }, 200, cors);
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
          const res = await runGetQuery(db, { view: E_INVOICES_SOURCE, schema: SCHEMA, columns: E_INVOICE_COLUMNS, id });
          if (!res.ok) return errorResponse("internal_error", cors, res.error);
          return jsonResponse({ data: res.row ? { kind: "e_invoices", row: res.row } : null }, 200, cors);
        }
        if (docType === "e_archives") {
          const res = await runGetQuery(db, { view: "e_archives", schema: SCHEMA, columns: E_ARCHIVE_COLUMNS, id });
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
