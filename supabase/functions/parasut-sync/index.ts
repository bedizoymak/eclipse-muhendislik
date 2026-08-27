// parasut-sync: server-side Parasut -> Supabase mirror sync.
//
// POST body: { "resource": "contacts" | "sales_invoices", "dry_run"?: boolean }
//
// The Parasut list endpoints used here do not document a filter[archived]
// parameter in their swagger spec, but it is real and supported for both
// "contacts" and "sales_invoices" -- verified directly against the live API:
// filter[archived]=false and filter[archived]=true return disjoint, complete
// result sets. Both resources are therefore fetched as two independent,
// fully-paginated streams; a failure or an early pagination stop in EITHER
// stream aborts the whole run as an error, never a silent partial success.
// A partial unique index on parasut.sync_runs(resource) where
// status='running' prevents two concurrent syncs of the same resource.
//
// sales_invoices additionally pulls its line items via
// include=details,details.product on the same list call (Parasut has no
// separate /sales_invoice_details list endpoint) -- every detail id an
// invoice references in relationships.details must resolve inside that
// response's `included` array, or the run is an error, never a guess.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchAllPages, fetchResource, getAccessToken, type JsonApiResource } from "./parasut_client.ts";
import { mapContact } from "./resources/contacts.ts";
import { detailIdsForInvoice, mapSalesInvoice, mapSalesInvoiceDetail } from "./resources/sales_invoices.ts";
import { detailIdsForOffer, mapSalesOffer, mapSalesOfferActivity, mapSalesOfferDetail } from "./resources/sales_offers.ts";
import { mapEArchive, mapEInvoice } from "./resources/e_documents.ts";
import { mapAccount } from "./resources/accounts.ts";
import { mapPayment, paymentIdsForInvoice } from "./resources/payments.ts";
import { mapTransaction } from "./resources/transactions.ts";
import { detailIdsForBill, mapPurchaseBill, mapPurchaseBillDetail } from "./resources/purchase_bills.ts";
import { inventoryLevelIdsForProduct, mapInventoryLevel, mapProduct } from "./resources/products.ts";
import { mapWarehouse } from "./resources/warehouses.ts";
import { mapItemCategory } from "./resources/item_categories.ts";
import { mapStockMovement } from "./resources/stock_movements.ts";
import { mapCheck } from "./resources/checks.ts";
import { mapInboundEDespatch, mapShipmentDocument, mapShipmentDocumentActivity } from "./resources/shipment_documents.ts";

const SUPPORTED_RESOURCES = [
  "contacts",
  "sales_invoices",
  "accounts",
  "payments",
  "transactions",
  "purchase_bills",
  "expense_payments",
  "products",
  "warehouses",
  "stock_movements",
  "item_categories",
  "checks",
  "sales_offers",
  "shipment_documents",
] as const;
type Resource = (typeof SUPPORTED_RESOURCES)[number];

const BATCH_SIZE = 200;
const ARCHIVED_FILTER_PARAM = "filter[archived]";

interface SyncResult {
  dbFields: Record<string, unknown>;
  responseFields: Record<string, unknown>;
  errorCount: number;
  errorMessages: string[];
}

type SyncFn = (db: SupabaseClient, accessToken: string, dryRun: boolean) => Promise<SyncResult>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function upsertBatched(
  db: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<{ upsertedCount: number; errorCount: number; errorMessages: string[] }> {
  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await db
      .schema("parasut")
      .from(table)
      .upsert(batch, { onConflict: "parasut_id", count: "exact" })
      .select("parasut_id", { count: "exact", head: true });

    if (error) {
      errorCount += batch.length;
      errorMessages.push(`${table}: ${error.message}`);
    } else {
      upsertedCount += count ?? batch.length;
    }
  }

  return { upsertedCount, errorCount, errorMessages };
}

/** Fetches both the active and archived streams of a resource in parallel. */
async function fetchActiveAndArchived(accessToken: string, path: string, extraParams: Record<string, string> = {}) {
  const [active, archived] = await Promise.all([
    fetchAllPages(accessToken, path, 25, { ...extraParams, [ARCHIVED_FILTER_PARAM]: "false" }),
    fetchAllPages(accessToken, path, 25, { ...extraParams, [ARCHIVED_FILTER_PARAM]: "true" }),
  ]);
  return { active, archived };
}

async function syncContacts(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { active, archived } = await fetchActiveAndArchived(accessToken, "contacts");
  const activeFetchedCount = active.items.length;
  const archivedFetchedCount = archived.items.length;
  const totalCountReported = (active.totalCountReported ?? 0) + (archived.totalCountReported ?? 0) || null;

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    const rows = [...active.items, ...archived.items].map(mapContact);
    const result = await upsertBatched(db, "contacts", rows as unknown as Record<string, unknown>[]);
    upsertedCount = result.upsertedCount;
    errorCount = result.errorCount;
    errorMessages.push(...result.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: activeFetchedCount + archivedFetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      error_count: errorCount,
    },
    responseFields: {
      total_fetched_count: activeFetchedCount + archivedFetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      total_count_reported: totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

interface EDocumentSyncResult {
  eInvoiceFetchedCount: number;
  eInvoiceUpsertedCount: number;
  eArchiveFetchedCount: number;
  eArchiveUpsertedCount: number;
  parentLinkedCount: number;
  parentWithoutDocumentCount: number;
  duplicateCount: number;
  unresolvedCount: number;
  staleLinkRemovedCount: number;
  errorCount: number;
  errorMessages: string[];
}

/**
 * Resolves and stores the real active_e_document child (e_invoices or
 * e_archives) for a batch of already-fetched sales_invoices/purchase_bills
 * parents. Must be called with `include=active_e_document` already applied
 * to the parent fetch -- this function only reads relationships/included,
 * it never issues its own requests.
 *
 * The parent link is always taken from the PARENT's own
 * relationships.active_e_document.data (id+type) -- never from the child,
 * whose own back-reference relationships are verified empty
 * (`{"meta":{}}`) even when included. e_invoices is genuinely polymorphic
 * (attaches to both sales_invoices and purchase_bills in this account);
 * e_archives has only ever been observed attached to sales_invoices, so an
 * e_archive found under a purchase_bill is treated as unresolved/unexpected
 * rather than silently stored under an assumption that has never been true.
 */
async function syncActiveEDocuments(
  db: SupabaseClient,
  dryRun: boolean,
  parentType: "sales_invoices" | "purchase_bills",
  parentItems: JsonApiResource[],
  includedByKey: Map<string, JsonApiResource>,
): Promise<EDocumentSyncResult> {
  const eInvoicePairs: { parentParasutId: number; doc: JsonApiResource }[] = [];
  const eArchivePairs: { parentParasutId: number; doc: JsonApiResource }[] = [];
  const errorMessages: string[] = [];
  let parentLinkedCount = 0;
  let parentWithoutDocumentCount = 0;
  let unresolvedCount = 0;

  for (const parent of parentItems) {
    const parentParasutId = Number(parent.id);
    const rel = parent.relationships?.["active_e_document"]?.data;
    if (!rel || Array.isArray(rel)) {
      parentWithoutDocumentCount++;
      continue;
    }
    const doc = includedByKey.get(`${rel.type}:${rel.id}`);
    if (!doc) {
      unresolvedCount++;
      errorMessages.push(`${parentType} ${parent.id} -> active_e_document ${rel.type}:${rel.id} not present in the API response`);
      continue;
    }
    if (rel.type === "e_invoices") {
      parentLinkedCount++;
      eInvoicePairs.push({ parentParasutId, doc });
    } else if (rel.type === "e_archives" && parentType === "sales_invoices") {
      parentLinkedCount++;
      eArchivePairs.push({ parentParasutId, doc });
    } else {
      // A real but unexpected combination (e.g. e_archives on a
      // purchase_bill, never observed in this account) -- not fabricated,
      // not silently stored under a wrong assumption either.
      unresolvedCount++;
      errorMessages.push(`${parentType} ${parent.id} -> unexpected active_e_document type "${rel.type}"`);
    }
  }

  const eInvoiceIds = eInvoicePairs.map(({ doc }) => Number(doc.id));
  const duplicateCount = eInvoiceIds.length - new Set(eInvoiceIds).size;

  let eInvoiceUpsertedCount = 0;
  let eArchiveUpsertedCount = 0;
  let staleLinkRemovedCount = 0;
  let errorCount = unresolvedCount;

  if (!dryRun) {
    if (eInvoicePairs.length > 0) {
      const rows = eInvoicePairs.map(({ parentParasutId, doc }) => mapEInvoice(doc, parentType, parentParasutId));
      const result = await upsertBatched(db, "e_invoices", rows as unknown as Record<string, unknown>[]);
      eInvoiceUpsertedCount = result.upsertedCount;
      errorCount += result.errorCount;
      errorMessages.push(...result.errorMessages);
    }

    if (parentType === "sales_invoices" && eArchivePairs.length > 0) {
      const rows = eArchivePairs.map(({ parentParasutId, doc }) => mapEArchive(doc, parentParasutId));
      const result = await upsertBatched(db, "e_archives", rows as unknown as Record<string, unknown>[]);
      eArchiveUpsertedCount = result.upsertedCount;
      errorCount += result.errorCount;
      errorMessages.push(...result.errorMessages);
    }

    // Stale-link cleanup: this fetch is a full listing of every parent of
    // `parentType`, so it is authoritative -- any e_invoices row still
    // pointing at this parentType but no longer among the currently
    // resolved ids is stale and must have its parent link cleared. The
    // document row itself is never deleted (it is real Parasut data).
    const eInvoiceIdList = eInvoiceIds.length > 0 ? eInvoiceIds.join(",") : "0";
    const { data: staleEInvoices } = await db
      .schema("parasut")
      .from("e_invoices")
      .update({ parent_type: null, parent_parasut_id: null })
      .eq("parent_type", parentType)
      .not("parasut_id", "in", `(${eInvoiceIdList})`)
      .select("parasut_id");
    staleLinkRemovedCount += staleEInvoices?.length ?? 0;

    if (parentType === "sales_invoices") {
      const eArchiveIds = eArchivePairs.map(({ doc }) => Number(doc.id));
      const eArchiveIdList = eArchiveIds.length > 0 ? eArchiveIds.join(",") : "0";
      const { data: staleEArchives } = await db
        .schema("parasut")
        .from("e_archives")
        .update({ sales_invoice_parasut_id: null })
        .not("sales_invoice_parasut_id", "is", null)
        .not("parasut_id", "in", `(${eArchiveIdList})`)
        .select("parasut_id");
      staleLinkRemovedCount += staleEArchives?.length ?? 0;
    }
  }

  return {
    eInvoiceFetchedCount: eInvoicePairs.length,
    eInvoiceUpsertedCount: dryRun ? 0 : eInvoiceUpsertedCount,
    eArchiveFetchedCount: eArchivePairs.length,
    eArchiveUpsertedCount: dryRun ? 0 : eArchiveUpsertedCount,
    parentLinkedCount,
    parentWithoutDocumentCount,
    duplicateCount,
    unresolvedCount,
    staleLinkRemovedCount: dryRun ? 0 : staleLinkRemovedCount,
    errorCount,
    errorMessages,
  };
}

async function syncSalesInvoices(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  // Verified against the live API (not the swagger doc, which incorrectly
  // lists details.warehouse as acceptable here and gets a 400 rejecting it):
  // valid includes for this endpoint are category, contact, contact.company,
  // details, details.product, payments, payments.transaction(.pos_transaction_info),
  // tags, refunds, refund_of, sharings, recurrence_plan, active_e_document,
  // failed_e_invoice.
  const { active, archived } = await fetchActiveAndArchived(accessToken, "sales_invoices", {
    include: "details,details.product,contact,active_e_document",
  });

  const invoiceItems = [...active.items, ...archived.items];
  const invoiceActiveFetchedCount = active.items.length;
  const invoiceArchivedFetchedCount = archived.items.length;
  const invoiceFetchedCount = invoiceActiveFetchedCount + invoiceArchivedFetchedCount;
  const totalCountReported = (active.totalCountReported ?? 0) + (archived.totalCountReported ?? 0) || null;

  const includedByKey = new Map<string, JsonApiResource>();
  for (const resource of [...active.included, ...archived.included]) {
    includedByKey.set(`${resource.type}:${resource.id}`, resource);
  }

  // Resolve every detail id each invoice references against `included`.
  // A missing id means the response was incomplete for that invoice -- this
  // must fail the run, never be silently skipped or guessed.
  const detailPairs: { invoiceParasutId: number; detail: JsonApiResource }[] = [];
  const missingDetailRefs: string[] = [];

  for (const invoice of invoiceItems) {
    const invoiceParasutId = Number(invoice.id);
    for (const detailId of detailIdsForInvoice(invoice)) {
      const detail = includedByKey.get(`sales_invoice_details:${detailId}`);
      if (!detail) {
        missingDetailRefs.push(`invoice ${invoice.id} -> detail ${detailId}`);
        continue;
      }
      detailPairs.push({ invoiceParasutId, detail });
    }
  }

  const detailFetchedCount = detailPairs.length;

  let invoiceUpsertedCount = 0;
  let detailUpsertedCount = 0;
  let errorCount = missingDetailRefs.length;
  const errorMessages: string[] = [];
  if (missingDetailRefs.length > 0) {
    errorMessages.push(
      `${missingDetailRefs.length} sales_invoice_details referenced but not present in the API response: ${missingDetailRefs
        .slice(0, 20)
        .join(", ")}${missingDetailRefs.length > 20 ? ", ..." : ""}`,
    );
  }

  if (!dryRun) {
    const invoiceRows = invoiceItems.map(mapSalesInvoice);
    const invoiceResult = await upsertBatched(db, "sales_invoices", invoiceRows as unknown as Record<string, unknown>[]);
    invoiceUpsertedCount = invoiceResult.upsertedCount;
    errorCount += invoiceResult.errorCount;
    errorMessages.push(...invoiceResult.errorMessages);

    const detailRows = detailPairs.map(({ invoiceParasutId, detail }) => mapSalesInvoiceDetail(detail, invoiceParasutId));
    const detailResult = await upsertBatched(db, "sales_invoice_details", detailRows as unknown as Record<string, unknown>[]);
    detailUpsertedCount = detailResult.upsertedCount;
    errorCount += detailResult.errorCount;
    errorMessages.push(...detailResult.errorMessages);
  }

  const eDocResult = await syncActiveEDocuments(db, dryRun, "sales_invoices", invoiceItems, includedByKey);
  errorCount += eDocResult.errorCount;
  errorMessages.push(...eDocResult.errorMessages);

  return {
    dbFields: {
      fetched_count: invoiceFetchedCount,
      active_fetched_count: invoiceActiveFetchedCount,
      archived_fetched_count: invoiceArchivedFetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : invoiceUpsertedCount,
      detail_fetched_count: detailFetchedCount,
      detail_upserted_count: dryRun ? 0 : detailUpsertedCount,
      unresolved_count: eDocResult.unresolvedCount,
      error_count: errorCount,
    },
    responseFields: {
      invoice_fetched_count: invoiceFetchedCount,
      invoice_active_fetched_count: invoiceActiveFetchedCount,
      invoice_archived_fetched_count: invoiceArchivedFetchedCount,
      invoice_upserted_count: dryRun ? 0 : invoiceUpsertedCount,
      detail_fetched_count: detailFetchedCount,
      detail_upserted_count: dryRun ? 0 : detailUpsertedCount,
      total_count_reported: totalCountReported,
      e_invoice_fetched_count: eDocResult.eInvoiceFetchedCount,
      e_invoice_upserted_count: eDocResult.eInvoiceUpsertedCount,
      e_archive_fetched_count: eDocResult.eArchiveFetchedCount,
      e_archive_upserted_count: eDocResult.eArchiveUpsertedCount,
      parent_linked_count: eDocResult.parentLinkedCount,
      parent_without_document_count: eDocResult.parentWithoutDocumentCount,
      duplicate_count: eDocResult.duplicateCount,
      unresolved_count: eDocResult.unresolvedCount,
      stale_link_removed_count: eDocResult.staleLinkRemovedCount,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * Sales offers ("satış teklifleri"). filter[archived] works despite the
 * API's own bad-filter error message only listing issue_date/contact_id as
 * "Acceptable" (verified: both filter[archived]=true and =false return 200
 * with distinct meta.total_count) -- same fetchActiveAndArchived pattern as
 * every other archivable resource. Verified acceptable includes: contact,
 * details, details.product, sales_invoice.
 */
async function syncSalesOffers(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { active, archived } = await fetchActiveAndArchived(accessToken, "sales_offers", {
    include: "details,details.product,contact,sales_invoice",
  });

  const offerItems = [...active.items, ...archived.items];
  const offerActiveFetchedCount = active.items.length;
  const offerArchivedFetchedCount = archived.items.length;
  const offerFetchedCount = offerActiveFetchedCount + offerArchivedFetchedCount;
  const totalCountReported = (active.totalCountReported ?? 0) + (archived.totalCountReported ?? 0) || null;

  const includedByKey = new Map<string, JsonApiResource>();
  for (const resource of [...active.included, ...archived.included]) {
    includedByKey.set(`${resource.type}:${resource.id}`, resource);
  }

  const detailPairs: { offerParasutId: number; detail: JsonApiResource }[] = [];
  const missingDetailRefs: string[] = [];

  for (const offer of offerItems) {
    const offerParasutId = Number(offer.id);
    for (const detailId of detailIdsForOffer(offer)) {
      const detail = includedByKey.get(`sales_offer_details:${detailId}`);
      if (!detail) {
        missingDetailRefs.push(`offer ${offer.id} -> detail ${detailId}`);
        continue;
      }
      detailPairs.push({ offerParasutId, detail });
    }
  }

  const detailFetchedCount = detailPairs.length;
  const unresolvedCount = offerItems.filter((o) => !o.relationships?.contact?.data).length;

  // activities cannot be resolved via the list endpoint's include chain
  // (verified: the list endpoint 400s on include=activities) -- each
  // offer's activities are fetched individually via the single-record
  // endpoint, which does resolve them. Any per-offer fetch failure aborts
  // the whole sync (thrown by fetchResource), same all-or-nothing guarantee
  // as the paginated fetches.
  const activityPairs: { offerParasutId: number; activity: JsonApiResource; doneByUser: JsonApiResource | null }[] = [];
  if (!dryRun) {
    for (const offer of offerItems) {
      const offerParasutId = Number(offer.id);
      // activities.item / activities.done_by must each be included
      // explicitly -- verified: include=activities alone returns
      // relationships.done_by/item as empty {"meta":{}} on the activity
      // resource, same established Parasut pattern as elsewhere.
      const { included: offerIncluded } = await fetchResource(accessToken, "sales_offers", offer.id, {
        include: "activities,activities.item,activities.done_by",
      });
      const usersByKey = new Map<string, JsonApiResource>();
      for (const resource of offerIncluded) {
        if (resource.type === "users") usersByKey.set(resource.id, resource);
      }
      for (const resource of offerIncluded) {
        if (resource.type === "activities") {
          const doneByRel = resource.relationships?.["done_by"]?.data;
          const doneByUser =
            doneByRel && !Array.isArray(doneByRel) ? usersByKey.get(doneByRel.id) ?? null : null;
          activityPairs.push({ offerParasutId, activity: resource, doneByUser });
        }
      }
    }
  }
  const activityFetchedCount = activityPairs.length;

  let offerUpsertedCount = 0;
  let detailUpsertedCount = 0;
  let activityUpsertedCount = 0;
  let errorCount = missingDetailRefs.length;
  const errorMessages: string[] = [];
  if (missingDetailRefs.length > 0) {
    errorMessages.push(
      `${missingDetailRefs.length} sales_offer_details referenced but not present in the API response: ${missingDetailRefs
        .slice(0, 20)
        .join(", ")}${missingDetailRefs.length > 20 ? ", ..." : ""}`,
    );
  }

  if (!dryRun) {
    const offerRows = offerItems.map(mapSalesOffer);
    const offerResult = await upsertBatched(db, "sales_offers", offerRows as unknown as Record<string, unknown>[]);
    offerUpsertedCount = offerResult.upsertedCount;
    errorCount += offerResult.errorCount;
    errorMessages.push(...offerResult.errorMessages);

    const detailRows = detailPairs.map(({ offerParasutId, detail }) => mapSalesOfferDetail(detail, offerParasutId));
    const detailResult = await upsertBatched(db, "sales_offer_details", detailRows as unknown as Record<string, unknown>[]);
    detailUpsertedCount = detailResult.upsertedCount;
    errorCount += detailResult.errorCount;
    errorMessages.push(...detailResult.errorMessages);

    const activityRows = activityPairs.map(({ offerParasutId, activity, doneByUser }) =>
      mapSalesOfferActivity(activity, offerParasutId, doneByUser),
    );
    const activityResult = await upsertBatched(db, "sales_offer_activities", activityRows as unknown as Record<string, unknown>[]);
    activityUpsertedCount = activityResult.upsertedCount;
    errorCount += activityResult.errorCount;
    errorMessages.push(...activityResult.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: offerFetchedCount,
      active_fetched_count: offerActiveFetchedCount,
      archived_fetched_count: offerArchivedFetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : offerUpsertedCount,
      detail_fetched_count: detailFetchedCount,
      detail_upserted_count: dryRun ? 0 : detailUpsertedCount,
      unresolved_count: unresolvedCount,
      error_count: errorCount,
    },
    responseFields: {
      offer_fetched_count: offerFetchedCount,
      offer_active_fetched_count: offerActiveFetchedCount,
      offer_archived_fetched_count: offerArchivedFetchedCount,
      offer_upserted_count: dryRun ? 0 : offerUpsertedCount,
      detail_fetched_count: detailFetchedCount,
      detail_upserted_count: dryRun ? 0 : detailUpsertedCount,
      activity_fetched_count: dryRun ? 0 : activityFetchedCount,
      activity_upserted_count: dryRun ? 0 : activityUpsertedCount,
      unresolved_count: unresolvedCount,
      total_count_reported: totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * Shipment documents ("sevkiyat irsaliyeleri"). filter[archived] works
 * (verified: =false -> 14, =true -> 1, total 15). Verified acceptable list
 * includes (real 400 error message): contact, tags, warehouse_transfer(.*),
 * inbound_e_despatch, e_despatch_response, custom_requirement_infos,
 * stock_movements(.*). stock_movements is intentionally NOT included here --
 * parasut.stock_movements already carries this exact link via its own
 * source_type='shipment_documents'/source_parasut_id columns (verified: all
 * 20 real pairs already match), so re-fetching it here would only
 * duplicate work the existing stock_movements sync already does correctly.
 * activities is real (verified: 2 real records on a sample document) but,
 * same as sales_offers.activities, only resolves via the single-record
 * endpoint.
 */
async function syncShipmentDocuments(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { active, archived } = await fetchActiveAndArchived(accessToken, "shipment_documents", {
    include: "contact,tags,warehouse_transfer,e_despatch_response,inbound_e_despatch,custom_requirement_infos",
  });

  const docItems = [...active.items, ...archived.items];
  const docActiveFetchedCount = active.items.length;
  const docArchivedFetchedCount = archived.items.length;
  const docFetchedCount = docActiveFetchedCount + docArchivedFetchedCount;
  const totalCountReported = (active.totalCountReported ?? 0) + (archived.totalCountReported ?? 0) || null;

  const includedByKey = new Map<string, JsonApiResource>();
  for (const resource of [...active.included, ...archived.included]) {
    includedByKey.set(`${resource.type}:${resource.id}`, resource);
  }

  const inboundPairs: { docParasutId: number; despatch: JsonApiResource }[] = [];
  const missingInboundRefs: string[] = [];
  const unresolvedCount = docItems.filter((d) => !d.relationships?.contact?.data).length;

  for (const doc of docItems) {
    const docParasutId = Number(doc.id);
    const rel = doc.relationships?.["inbound_e_despatch"]?.data;
    if (!rel || Array.isArray(rel)) continue;
    const despatch = includedByKey.get(`${rel.type}:${rel.id}`);
    if (!despatch) {
      missingInboundRefs.push(`document ${doc.id} -> inbound_e_despatch ${rel.type}:${rel.id}`);
      continue;
    }
    inboundPairs.push({ docParasutId, despatch });
  }
  const inboundFetchedCount = inboundPairs.length;

  // activities cannot be resolved via the list endpoint's include chain
  // (verified: the list endpoint 400s on include=activities) -- each
  // document's activities are fetched individually via the single-record
  // endpoint, same established pattern as sales_offers.activities.
  const activityPairs: { docParasutId: number; activity: JsonApiResource; doneByUser: JsonApiResource | null }[] = [];
  if (!dryRun) {
    for (const doc of docItems) {
      const docParasutId = Number(doc.id);
      const { included: docIncluded } = await fetchResource(accessToken, "shipment_documents", doc.id, {
        include: "activities,activities.item,activities.done_by",
      });
      const usersByKey = new Map<string, JsonApiResource>();
      for (const resource of docIncluded) {
        if (resource.type === "users") usersByKey.set(resource.id, resource);
      }
      for (const resource of docIncluded) {
        if (resource.type === "activities") {
          const doneByRel = resource.relationships?.["done_by"]?.data;
          const doneByUser =
            doneByRel && !Array.isArray(doneByRel) ? usersByKey.get(doneByRel.id) ?? null : null;
          activityPairs.push({ docParasutId, activity: resource, doneByUser });
        }
      }
    }
  }
  const activityFetchedCount = activityPairs.length;

  let docUpsertedCount = 0;
  let inboundUpsertedCount = 0;
  let activityUpsertedCount = 0;
  let errorCount = missingInboundRefs.length;
  const errorMessages: string[] = [];
  if (missingInboundRefs.length > 0) {
    errorMessages.push(
      `${missingInboundRefs.length} inbound_e_despatch referenced but not present in the API response: ${missingInboundRefs
        .slice(0, 20)
        .join(", ")}${missingInboundRefs.length > 20 ? ", ..." : ""}`,
    );
  }

  if (!dryRun) {
    const docRows = docItems.map(mapShipmentDocument);
    const docResult = await upsertBatched(db, "shipment_documents", docRows as unknown as Record<string, unknown>[]);
    docUpsertedCount = docResult.upsertedCount;
    errorCount += docResult.errorCount;
    errorMessages.push(...docResult.errorMessages);

    const inboundRows = inboundPairs.map(({ docParasutId, despatch }) => mapInboundEDespatch(despatch, docParasutId));
    const inboundResult = await upsertBatched(db, "inbound_e_despatches", inboundRows as unknown as Record<string, unknown>[]);
    inboundUpsertedCount = inboundResult.upsertedCount;
    errorCount += inboundResult.errorCount;
    errorMessages.push(...inboundResult.errorMessages);

    const activityRows = activityPairs.map(({ docParasutId, activity, doneByUser }) =>
      mapShipmentDocumentActivity(activity, docParasutId, doneByUser),
    );
    const activityResult = await upsertBatched(db, "shipment_document_activities", activityRows as unknown as Record<string, unknown>[]);
    activityUpsertedCount = activityResult.upsertedCount;
    errorCount += activityResult.errorCount;
    errorMessages.push(...activityResult.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: docFetchedCount,
      active_fetched_count: docActiveFetchedCount,
      archived_fetched_count: docArchivedFetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : docUpsertedCount,
      detail_fetched_count: inboundFetchedCount,
      detail_upserted_count: dryRun ? 0 : inboundUpsertedCount,
      unresolved_count: unresolvedCount,
      error_count: errorCount,
    },
    responseFields: {
      document_fetched_count: docFetchedCount,
      document_active_fetched_count: docActiveFetchedCount,
      document_archived_fetched_count: docArchivedFetchedCount,
      document_upserted_count: dryRun ? 0 : docUpsertedCount,
      inbound_e_despatch_fetched_count: inboundFetchedCount,
      inbound_e_despatch_upserted_count: dryRun ? 0 : inboundUpsertedCount,
      activity_fetched_count: dryRun ? 0 : activityFetchedCount,
      activity_upserted_count: dryRun ? 0 : activityUpsertedCount,
      unresolved_count: unresolvedCount,
      total_count_reported: totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

async function syncAccounts(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { active, archived } = await fetchActiveAndArchived(accessToken, "accounts");
  const activeFetchedCount = active.items.length;
  const archivedFetchedCount = archived.items.length;
  const totalCountReported = (active.totalCountReported ?? 0) + (archived.totalCountReported ?? 0) || null;

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    const rows = [...active.items, ...archived.items].map(mapAccount);
    const result = await upsertBatched(db, "accounts", rows as unknown as Record<string, unknown>[]);
    upsertedCount = result.upsertedCount;
    errorCount = result.errorCount;
    errorMessages.push(...result.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: activeFetchedCount + archivedFetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      error_count: errorCount,
    },
    responseFields: {
      total_fetched_count: activeFetchedCount + archivedFetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      total_count_reported: totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * Payments have no standalone list endpoint in Parasut (verified against
 * swagger and the live API). This resource covers only payments attached to
 * sales_invoices, fetched via include=payments on that list endpoint --
 * matching the /satislar/tahsilatlar scope. payable_type/payable_id are the
 * invoice each payment was actually found under (a real relationship
 * Parasut's own invoice data states), never guessed.
 */
async function syncPayments(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { active, archived } = await fetchActiveAndArchived(accessToken, "sales_invoices", {
    include: "payments,payments.transaction",
  });

  const invoiceItems = [...active.items, ...archived.items];
  const includedByKey = new Map<string, JsonApiResource>();
  for (const resource of [...active.included, ...archived.included]) {
    includedByKey.set(`${resource.type}:${resource.id}`, resource);
  }

  const paymentPairs: { invoiceParasutId: number; payment: JsonApiResource }[] = [];
  const missingPaymentRefs: string[] = [];

  for (const invoice of invoiceItems) {
    const invoiceParasutId = Number(invoice.id);
    for (const paymentId of paymentIdsForInvoice(invoice)) {
      const payment = includedByKey.get(`payments:${paymentId}`);
      if (!payment) {
        missingPaymentRefs.push(`invoice ${invoice.id} -> payment ${paymentId}`);
        continue;
      }
      paymentPairs.push({ invoiceParasutId, payment });
    }
  }

  const fetchedCount = paymentPairs.length;
  const unresolvedCount = paymentPairs.filter(({ payment }) => !payment.relationships?.transaction?.data).length;

  let upsertedCount = 0;
  let errorCount = missingPaymentRefs.length;
  const errorMessages: string[] = [];
  if (missingPaymentRefs.length > 0) {
    errorMessages.push(
      `${missingPaymentRefs.length} payments referenced but not present in the API response: ${missingPaymentRefs
        .slice(0, 20)
        .join(", ")}${missingPaymentRefs.length > 20 ? ", ..." : ""}`,
    );
  }

  if (!dryRun) {
    const rows = paymentPairs.map(({ invoiceParasutId, payment }) => mapPayment(payment, invoiceParasutId));
    const result = await upsertBatched(db, "payments", rows as unknown as Record<string, unknown>[]);
    upsertedCount = result.upsertedCount;
    errorCount += result.errorCount;
    errorMessages.push(...result.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      error_count: errorCount,
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      coverage: "sales_invoices payments only (no purchase_bills/bank_fees/salaries/taxes payments in this phase)",
    },
    errorCount,
    errorMessages,
  };
}

/**
 * Parasut has no standalone list endpoint for transactions either --
 * fetched per-account via /accounts/{id}/transactions?include=debit_account,credit_account
 * (a real, paginated endpoint), covering every account. The same
 * transaction can legitimately appear under two different accounts (e.g. a
 * transfer between two of the company's own accounts); upserting on
 * parasut_id naturally dedupes that.
 */
async function syncTransactions(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { active: activeAccounts, archived: archivedAccounts } = await fetchActiveAndArchived(accessToken, "accounts");
  const accountIds = [...activeAccounts.items, ...archivedAccounts.items].map((a) => a.id);

  const perAccountResults = await Promise.all(
    accountIds.map((accountId) =>
      fetchAllPages(accessToken, `accounts/${accountId}/transactions`, 25, {
        include: "debit_account,credit_account",
      }),
    ),
  );

  const rawFetchedCount = perAccountResults.reduce((sum, r) => sum + r.items.length, 0);
  const totalCountReported = perAccountResults.reduce((sum, r) => sum + (r.totalCountReported ?? 0), 0) || null;

  const uniqueByParasutId = new Map<string, JsonApiResource>();
  for (const result of perAccountResults) {
    for (const item of result.items) {
      uniqueByParasutId.set(item.id, item);
    }
  }
  const uniqueItems = [...uniqueByParasutId.values()];
  const fetchedCount = uniqueItems.length;

  const rows = uniqueItems.map(mapTransaction);
  const unresolvedCount = rows.filter((r) => r.debit_account_parasut_id == null || r.credit_account_parasut_id == null).length;

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    const result = await upsertBatched(db, "transactions", rows as unknown as Record<string, unknown>[]);
    upsertedCount = result.upsertedCount;
    errorCount = result.errorCount;
    errorMessages.push(...result.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: fetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      error_count: errorCount,
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      raw_fetched_count_before_dedup: rawFetchedCount,
      accounts_covered: accountIds.length,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      total_count_reported: totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * purchase_bills ("giderler"). Unlike contacts/sales_invoices/accounts,
 * filter[archived] is NOT supported here -- verified against the live API,
 * which rejects it with a 400 ("'archived' is not a valid filter.
 * Acceptable: issue_date, due_date, spender_id, supplier_id, currency,
 * remaining, item_type"). So there is no independent way to fetch an
 * archived-only stream to cross-check against, unlike the other resources.
 * A single full listing is fetched instead; active/archived counts are
 * derived from each bill's own real `archived` attribute in that listing,
 * not independently verified via a second API call. This limitation is
 * reported, not hidden.
 */
async function syncPurchaseBills(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const result = await fetchAllPages(accessToken, "purchase_bills", 25, {
    include: "supplier,spender,pay_to,details,details.product,active_e_document",
  });

  const billItems = result.items;
  const activeFetchedCount = billItems.filter((b) => b.attributes?.archived === false).length;
  const archivedFetchedCount = billItems.filter((b) => b.attributes?.archived === true).length;
  const fetchedCount = billItems.length;

  const includedByKey = new Map<string, JsonApiResource>();
  for (const resource of result.included) {
    includedByKey.set(`${resource.type}:${resource.id}`, resource);
  }

  const detailPairs: { billParasutId: number; detail: JsonApiResource }[] = [];
  const missingDetailRefs: string[] = [];

  for (const bill of billItems) {
    const billParasutId = Number(bill.id);
    for (const detailId of detailIdsForBill(bill)) {
      const detail = includedByKey.get(`purchase_bill_details:${detailId}`);
      if (!detail) {
        missingDetailRefs.push(`bill ${bill.id} -> detail ${detailId}`);
        continue;
      }
      detailPairs.push({ billParasutId, detail });
    }
  }

  const detailFetchedCount = detailPairs.length;
  const billRows = billItems.map(mapPurchaseBill);
  const supplierUnresolvedCount = billRows.filter((r) => r.supplier_parasut_id == null).length;

  let billUpsertedCount = 0;
  let detailUpsertedCount = 0;
  let errorCount = missingDetailRefs.length;
  const errorMessages: string[] = [];
  if (missingDetailRefs.length > 0) {
    errorMessages.push(
      `${missingDetailRefs.length} purchase_bill_details referenced but not present in the API response: ${missingDetailRefs
        .slice(0, 20)
        .join(", ")}${missingDetailRefs.length > 20 ? ", ..." : ""}`,
    );
  }

  if (!dryRun) {
    const billResult = await upsertBatched(db, "purchase_bills", billRows as unknown as Record<string, unknown>[]);
    billUpsertedCount = billResult.upsertedCount;
    errorCount += billResult.errorCount;
    errorMessages.push(...billResult.errorMessages);

    const detailRows = detailPairs.map(({ billParasutId, detail }) => mapPurchaseBillDetail(detail, billParasutId));
    const detailResult = await upsertBatched(db, "purchase_bill_details", detailRows as unknown as Record<string, unknown>[]);
    detailUpsertedCount = detailResult.upsertedCount;
    errorCount += detailResult.errorCount;
    errorMessages.push(...detailResult.errorMessages);
  }

  const eDocResult = await syncActiveEDocuments(db, dryRun, "purchase_bills", billItems, includedByKey);
  errorCount += eDocResult.errorCount;
  errorMessages.push(...eDocResult.errorMessages);

  return {
    dbFields: {
      fetched_count: fetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      total_count_reported: result.totalCountReported,
      upserted_count: dryRun ? 0 : billUpsertedCount,
      detail_fetched_count: detailFetchedCount,
      detail_upserted_count: dryRun ? 0 : detailUpsertedCount,
      unresolved_count: supplierUnresolvedCount + eDocResult.unresolvedCount,
      error_count: errorCount,
    },
    responseFields: {
      bill_fetched_count: fetchedCount,
      bill_active_fetched_count: activeFetchedCount,
      bill_archived_fetched_count: archivedFetchedCount,
      bill_upserted_count: dryRun ? 0 : billUpsertedCount,
      detail_fetched_count: detailFetchedCount,
      detail_upserted_count: dryRun ? 0 : detailUpsertedCount,
      supplier_resolved_count: fetchedCount - supplierUnresolvedCount,
      supplier_unresolved_count: supplierUnresolvedCount,
      total_count_reported: result.totalCountReported,
      note: "filter[archived] is not supported by the live API for purchase_bills; active/archived counts are derived from a single full listing, not independently cross-checked",
      e_invoice_fetched_count: eDocResult.eInvoiceFetchedCount,
      e_invoice_upserted_count: eDocResult.eInvoiceUpsertedCount,
      e_archive_fetched_count: eDocResult.eArchiveFetchedCount,
      e_archive_upserted_count: eDocResult.eArchiveUpsertedCount,
      parent_linked_count: eDocResult.parentLinkedCount,
      parent_without_document_count: eDocResult.parentWithoutDocumentCount,
      duplicate_count: eDocResult.duplicateCount,
      e_document_unresolved_count: eDocResult.unresolvedCount,
      stale_link_removed_count: eDocResult.staleLinkRemovedCount,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * Expense payments: payments attached to purchase_bills, published
 * separately from the sales_invoices-scoped "payments" resource (Phase 1.2/3).
 * Same no-standalone-endpoint situation as sales_invoices payments --
 * fetched via include=payments,payments.transaction on purchase_bills.
 */
async function syncExpensePayments(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const result = await fetchAllPages(accessToken, "purchase_bills", 25, {
    include: "payments,payments.transaction",
  });

  const billItems = result.items;
  const includedByKey = new Map<string, JsonApiResource>();
  for (const resource of result.included) {
    includedByKey.set(`${resource.type}:${resource.id}`, resource);
  }

  const paymentPairs: { billParasutId: number; payment: JsonApiResource }[] = [];
  const missingPaymentRefs: string[] = [];

  for (const bill of billItems) {
    const billParasutId = Number(bill.id);
    for (const paymentId of paymentIdsForInvoice(bill)) {
      const payment = includedByKey.get(`payments:${paymentId}`);
      if (!payment) {
        missingPaymentRefs.push(`bill ${bill.id} -> payment ${paymentId}`);
        continue;
      }
      paymentPairs.push({ billParasutId, payment });
    }
  }

  const fetchedCount = paymentPairs.length;
  const unresolvedCount = paymentPairs.filter(({ payment }) => !payment.relationships?.transaction?.data).length;

  let upsertedCount = 0;
  let errorCount = missingPaymentRefs.length;
  const errorMessages: string[] = [];
  if (missingPaymentRefs.length > 0) {
    errorMessages.push(
      `${missingPaymentRefs.length} expense payments referenced but not present in the API response: ${missingPaymentRefs
        .slice(0, 20)
        .join(", ")}${missingPaymentRefs.length > 20 ? ", ..." : ""}`,
    );
  }

  if (!dryRun) {
    // Base parasut.payments already held 874 pre-existing rows from a
    // separate, earlier sync mechanism (payable_type "PurchaseBill", found
    // in Phase 3) -- those have different parasut_ids than what this real
    // API-driven sync fetches, so onConflict:'parasut_id' updates any
    // genuine overlap and inserts the rest without creating duplicates.
    const rows = paymentPairs.map(({ billParasutId, payment }) => mapPayment(payment, billParasutId, "purchase_bills"));
    const result = await upsertBatched(db, "payments", rows as unknown as Record<string, unknown>[]);
    upsertedCount = result.upsertedCount;
    errorCount += result.errorCount;
    errorMessages.push(...result.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      error_count: errorCount,
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      coverage: "purchase_bills payments only (no bank_fees/salaries/taxes payments in this phase)",
    },
    errorCount,
    errorMessages,
  };
}

/**
 * products (+ their inventory_levels, embedded via include -- Parasut has
 * no separate /inventory_levels list endpoint). filter[archived] is
 * undocumented for products but verified real (same as contacts/
 * sales_invoices/accounts). inventory_levels.warehouse needs its own
 * explicit include to resolve each level's warehouse id -- verified
 * empirically; without it the relationship comes back empty even though
 * the inventory_levels themselves are present.
 */
async function syncProducts(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { active, archived } = await fetchActiveAndArchived(accessToken, "products", {
    include: "inventory_levels,inventory_levels.warehouse,category",
  });

  const productItems = [...active.items, ...archived.items];
  const activeFetchedCount = active.items.length;
  const archivedFetchedCount = archived.items.length;
  const totalCountReported = (active.totalCountReported ?? 0) + (archived.totalCountReported ?? 0) || null;

  const includedByKey = new Map<string, JsonApiResource>();
  for (const resource of [...active.included, ...archived.included]) {
    includedByKey.set(`${resource.type}:${resource.id}`, resource);
  }

  const levelPairs: { productParasutId: number; level: JsonApiResource }[] = [];
  const missingLevelRefs: string[] = [];

  for (const product of productItems) {
    const productParasutId = Number(product.id);
    for (const levelId of inventoryLevelIdsForProduct(product)) {
      const level = includedByKey.get(`inventory_levels:${levelId}`);
      if (!level) {
        missingLevelRefs.push(`product ${product.id} -> inventory_level ${levelId}`);
        continue;
      }
      levelPairs.push({ productParasutId, level });
    }
  }

  const levelFetchedCount = levelPairs.length;
  const levelRows = levelPairs.map(({ productParasutId, level }) => mapInventoryLevel(level, productParasutId));
  const levelUnresolvedCount = levelRows.filter((r) => r.warehouse_parasut_id == null).length;

  let productUpsertedCount = 0;
  let levelUpsertedCount = 0;
  let errorCount = missingLevelRefs.length;
  const errorMessages: string[] = [];
  if (missingLevelRefs.length > 0) {
    errorMessages.push(
      `${missingLevelRefs.length} inventory_levels referenced but not present in the API response: ${missingLevelRefs
        .slice(0, 20)
        .join(", ")}${missingLevelRefs.length > 20 ? ", ..." : ""}`,
    );
  }

  if (!dryRun) {
    const productRows = productItems.map(mapProduct);
    const productResult = await upsertBatched(db, "products", productRows as unknown as Record<string, unknown>[]);
    productUpsertedCount = productResult.upsertedCount;
    errorCount += productResult.errorCount;
    errorMessages.push(...productResult.errorMessages);

    const levelResult = await upsertBatched(db, "inventory_levels", levelRows as unknown as Record<string, unknown>[]);
    levelUpsertedCount = levelResult.upsertedCount;
    errorCount += levelResult.errorCount;
    errorMessages.push(...levelResult.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: activeFetchedCount + archivedFetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : productUpsertedCount,
      detail_fetched_count: levelFetchedCount,
      detail_upserted_count: dryRun ? 0 : levelUpsertedCount,
      unresolved_count: levelUnresolvedCount,
      error_count: errorCount,
    },
    responseFields: {
      product_fetched_count: activeFetchedCount + archivedFetchedCount,
      product_active_fetched_count: activeFetchedCount,
      product_archived_fetched_count: archivedFetchedCount,
      product_upserted_count: dryRun ? 0 : productUpsertedCount,
      inventory_level_fetched_count: levelFetchedCount,
      inventory_level_upserted_count: dryRun ? 0 : levelUpsertedCount,
      inventory_level_unresolved_count: levelUnresolvedCount,
      total_count_reported: totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

/** warehouses: filter[archived] is documented and real for this endpoint. */
async function syncWarehouses(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { active, archived } = await fetchActiveAndArchived(accessToken, "warehouses");
  const activeFetchedCount = active.items.length;
  const archivedFetchedCount = archived.items.length;
  const totalCountReported = (active.totalCountReported ?? 0) + (archived.totalCountReported ?? 0) || null;

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    const rows = [...active.items, ...archived.items].map(mapWarehouse);
    const result = await upsertBatched(db, "warehouses", rows as unknown as Record<string, unknown>[]);
    upsertedCount = result.upsertedCount;
    errorCount = result.errorCount;
    errorMessages.push(...result.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: activeFetchedCount + archivedFetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      error_count: errorCount,
    },
    responseFields: {
      total_fetched_count: activeFetchedCount + archivedFetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      total_count_reported: totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * item_categories: no archived attribute exists on this resource at all
 * (verified against the schema), so there is no active/archived split to
 * attempt -- a single full listing is the complete, correct fetch.
 */
async function syncItemCategories(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const result = await fetchAllPages(accessToken, "item_categories");
  const fetchedCount = result.items.length;

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    const rows = result.items.map(mapItemCategory);
    const upsertResult = await upsertBatched(db, "item_categories", rows as unknown as Record<string, unknown>[]);
    upsertedCount = upsertResult.upsertedCount;
    errorCount = upsertResult.errorCount;
    errorMessages.push(...upsertResult.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: fetchedCount,
      total_count_reported: result.totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      error_count: errorCount,
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      total_count_reported: result.totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * stock_movements: a real, global, paginated list endpoint (no per-warehouse
 * iteration needed, unlike transactions in Phase 3). No archived concept.
 * Upserting on parasut_id is naturally idempotent -- no duplicate risk from
 * a single linear stream.
 */
async function syncStockMovements(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const result = await fetchAllPages(accessToken, "stock_movements", 25, {
    include: "product,source,contact,warehouse",
  });
  const fetchedCount = result.items.length;
  const rows = result.items.map(mapStockMovement);
  const unresolvedCount = rows.filter((r) => r.product_parasut_id == null || r.warehouse_parasut_id == null).length;

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    const upsertResult = await upsertBatched(db, "stock_movements", rows as unknown as Record<string, unknown>[]);
    upsertedCount = upsertResult.upsertedCount;
    errorCount = upsertResult.errorCount;
    errorMessages.push(...upsertResult.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: fetchedCount,
      total_count_reported: result.totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      error_count: errorCount,
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      total_count_reported: result.totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * checks ("çekler"). /{company_id}/checks is a real, working endpoint --
 * verified directly against the live API -- that is completely absent from
 * the published swagger spec. filter[archived] is not valid here either
 * (verified: rejected, real acceptable filters are due_date/issue_date/
 * currency/amount/net_total), so this is a single full listing, not a
 * dual archived stream. issued_by/given_to need their own explicit
 * includes to resolve (same established pattern as every other relation).
 */
async function syncChecks(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const result = await fetchAllPages(accessToken, "checks", 25, {
    include: "issued_by,given_to,payments",
  });
  const fetchedCount = result.items.length;
  const rows = result.items.map(mapCheck);
  const unresolvedCount = rows.filter((r) => r.issued_by_parasut_id == null && r.given_to_parasut_id == null).length;

  // A check's own relationships.payments.data lists real payment ids
  // (verified against the live API); the full payment objects are only
  // present when explicitly included -- same pattern as sales_invoices/
  // purchase_bills payments. Not every check has a payment yet (unpaid/
  // pending checks legitimately have an empty payments array).
  const includedByKey = new Map<string, JsonApiResource>();
  for (const resource of result.included) {
    includedByKey.set(`${resource.type}:${resource.id}`, resource);
  }
  const paymentPairs: { checkParasutId: number; payment: JsonApiResource }[] = [];
  const missingPaymentRefs: string[] = [];
  for (const check of result.items) {
    const checkParasutId = Number(check.id);
    for (const paymentId of paymentIdsForInvoice(check)) {
      const payment = includedByKey.get(`payments:${paymentId}`);
      if (!payment) {
        missingPaymentRefs.push(`check ${check.id} -> payment ${paymentId}`);
        continue;
      }
      paymentPairs.push({ checkParasutId, payment });
    }
  }

  let upsertedCount = 0;
  let paymentsUpsertedCount = 0;
  let errorCount = missingPaymentRefs.length;
  const errorMessages: string[] = [];
  if (missingPaymentRefs.length > 0) {
    errorMessages.push(
      `${missingPaymentRefs.length} check payments referenced but not present in the API response: ${missingPaymentRefs
        .slice(0, 20)
        .join(", ")}${missingPaymentRefs.length > 20 ? ", ..." : ""}`,
    );
  }

  if (!dryRun) {
    const upsertResult = await upsertBatched(db, "checks", rows as unknown as Record<string, unknown>[]);
    upsertedCount = upsertResult.upsertedCount;
    errorCount += upsertResult.errorCount;
    errorMessages.push(...upsertResult.errorMessages);

    const paymentRows = paymentPairs.map(({ checkParasutId, payment }) => mapPayment(payment, checkParasutId, "checks"));
    const paymentsResult = await upsertBatched(db, "payments", paymentRows as unknown as Record<string, unknown>[]);
    paymentsUpsertedCount = paymentsResult.upsertedCount;
    errorCount += paymentsResult.errorCount;
    errorMessages.push(...paymentsResult.errorMessages);
  }

  return {
    dbFields: {
      fetched_count: fetchedCount,
      total_count_reported: result.totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      error_count: errorCount,
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      payments_upserted_count: dryRun ? 0 : paymentsUpsertedCount,
      unresolved_count: unresolvedCount,
      total_count_reported: result.totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { resource?: string; dry_run?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const resource = body.resource as Resource;
  if (!resource || !SUPPORTED_RESOURCES.includes(resource)) {
    return jsonResponse(
      { error: `resource must be one of: ${SUPPORTED_RESOURCES.join(", ")}` },
      400,
    );
  }
  const dryRun = body.dry_run === true;

  const db = serviceClient();

  // Acquire the per-resource lock by inserting the running row. The partial
  // unique index rejects a second concurrent run for the same resource.
  const { data: runRow, error: lockError } = await db
    .schema("parasut")
    .from("sync_runs")
    .insert({ resource, status: "running", dry_run: dryRun })
    .select("id")
    .single();

  if (lockError) {
    if (lockError.code === "23505") {
      return jsonResponse({ error: `A sync for "${resource}" is already running` }, 409);
    }
    return jsonResponse({ error: `Failed to start sync run: ${lockError.message}` }, 500);
  }

  const runId = runRow.id as string;

  const finishRun = async (patch: Record<string, unknown>) => {
    await db
      .schema("parasut")
      .from("sync_runs")
      .update({ finished_at: new Date().toISOString(), ...patch })
      .eq("id", runId);
  };

  try {
    const accessToken = await getAccessToken(db);

    const syncers: Record<Resource, SyncFn> = {
      contacts: syncContacts,
      sales_invoices: syncSalesInvoices,
      accounts: syncAccounts,
      payments: syncPayments,
      transactions: syncTransactions,
      purchase_bills: syncPurchaseBills,
      expense_payments: syncExpensePayments,
      products: syncProducts,
      warehouses: syncWarehouses,
      stock_movements: syncStockMovements,
      item_categories: syncItemCategories,
      checks: syncChecks,
      sales_offers: syncSalesOffers,
      shipment_documents: syncShipmentDocuments,
    };
    const result = await syncers[resource](db, accessToken, dryRun);

    if (result.errorCount > 0) {
      await finishRun({
        ...result.dbFields,
        status: "error",
        error_message: result.errorMessages.join(" | ").slice(0, 2000),
      });
      return jsonResponse(
        {
          resource,
          dry_run: dryRun,
          status: "error",
          ...result.responseFields,
          error_count: result.errorCount,
          error_message: result.errorMessages.join(" | "),
        },
        502,
      );
    }

    await finishRun({
      ...result.dbFields,
      status: dryRun ? "dry_run" : "success",
    });

    return jsonResponse({
      resource,
      dry_run: dryRun,
      status: dryRun ? "dry_run" : "success",
      ...result.responseFields,
      error_count: 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun({
      status: "error",
      error_message: message.slice(0, 2000),
    });
    return jsonResponse({ resource, dry_run: dryRun, status: "error", error_message: message }, 502);
  }
});
