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
import { fetchAllPages, fetchCompaniesList, fetchMe, fetchPage, fetchResource, getAccessToken, type JsonApiResource } from "./parasut_client.ts";
import { mapContact, mapContactPerson } from "./resources/contacts.ts";
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
import {
  invoiceIdsForShipmentDocument,
  mapInboundEDespatch,
  mapShipmentDocument,
  mapShipmentDocumentActivity,
} from "./resources/shipment_documents.ts";
import { mapEmployee } from "./resources/employees.ts";
import { mapSalary, relatedManyRefs, type RelatedRef } from "./resources/salaries.ts";
import { mapTax } from "./resources/taxes.ts";
import { mapTag } from "./resources/tags.ts";
// Phase 13.3: mapEInvoiceInbox is no longer called from the sync path here
// (this resource is lookup-only and blocked pending secure-auth -- see
// syncEInvoiceInboxes below) but stays exported from its module for the
// future secure lookup flow to import directly.
import { detectUnknownKeys, detectTypeMismatch, expectedTypeStatus } from "./schema_guard.ts";
import { findCompanyListEntry, mapMeAddress, mapMeCompany, mapProfile, mapUser, mapUserRole } from "./resources/me.ts";

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
  "employees",
  "me",
  "salaries",
  "taxes",
  "tags",
  "e_invoice_inboxes",
  "e_invoices",
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

// Phase 14.6: explicit CORS allowlist. The browser sends a preflight OPTIONS
// request before every cross-origin POST; without a matching handler and
// Access-Control-* headers on every response (including errors), the
// browser blocks the request before it reaches this function at all -- the
// SDK then surfaces it as a generic "Failed to send a request" with no
// further detail, regardless of which resource was requested.
const ALLOWED_ORIGINS = new Set([
  "https://demo.eclipsemuhendislik.com",
  "https://www.demo.eclipsemuhendislik.com",
  "https://eclipsemuhendislik.com",
  "https://www.eclipsemuhendislik.com",
  "http://localhost:5173",
  "http://localhost:8080",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
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
    // Phase 13.5: dropped the redundant chained `.select(col, {count,
    // head})` call -- `.upsert(rows, { count: "exact" })` already
    // requests and returns an exact count on its own response, and
    // chaining a second `.select()` with a count/head options object
    // does not match this generated client's typed overload (deno-check
    // TS2554). No behavior change: `count` below is the same real
    // upserted-row count either way.
    const { error, count } = await db
      .schema("parasut")
      .from(table)
      .upsert(batch, { onConflict: "parasut_id", count: "exact" });

    if (error) {
      errorCount += batch.length;
      errorMessages.push(`${table}: ${error.message}`);
    } else {
      upsertedCount += count ?? batch.length;
    }
  }

  return { upsertedCount, errorCount, errorMessages };
}

/**
 * Phase 13.2: refreshes a real to-many relationship junction table
 * (parasut.salary_tags / parasut.tax_tags) against the CURRENT source
 * list for a batch of parent items. For each parent: real related
 * {id,type} rows are upserted (unique on parent+related id+type), and
 * any existing junction row for that parent whose related id/type is
 * NOT in the current source list is deleted -- so a source-removed link
 * never stays stale. `tag_type` is always the real relationships.data[]
 * .type value, never a hardcoded "tags" constant. With 0 parent rows
 * today this necessarily upserts/deletes 0 junction rows.
 */
async function refreshManyRelationshipJunction(
  db: SupabaseClient,
  table: string,
  parentIdColumn: string,
  items: { parasutId: number; refs: RelatedRef[] }[],
): Promise<{ upsertedCount: number; errorCount: number; errorMessages: string[] }> {
  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  for (const { parasutId, refs } of items) {
    const currentKeys = new Set(refs.map((r) => `${r.id}:${r.type}`));

    if (refs.length > 0) {
      const rows = refs.map((r) => ({
        [parentIdColumn]: parasutId,
        tag_parasut_id: r.id,
        tag_type: r.type,
      }));
      const onConflict = `${parentIdColumn},tag_parasut_id,tag_type`;
      // Phase 13.5: same fix as upsertBatched above -- rely on
      // `.upsert(rows, { count: "exact" })`'s own returned count instead
      // of a chained `.select(col, {count, head})` call.
      const { error, count } = await db
        .schema("parasut")
        .from(table)
        .upsert(rows, { onConflict, count: "exact" });
      if (error) {
        errorCount += rows.length;
        errorMessages.push(`${table}: ${error.message}`);
        continue;
      }
      upsertedCount += count ?? rows.length;
    }

    // Delete stale links: existing rows for this parent not present in
    // the current source list.
    const { data: existing, error: selectError } = await db
      .schema("parasut")
      .from(table)
      .select("tag_parasut_id, tag_type")
      .eq(parentIdColumn, parasutId);
    if (selectError) {
      errorMessages.push(`${table}: ${selectError.message}`);
      continue;
    }
    const staleMatchers = (existing ?? []).filter(
      (row: { tag_parasut_id: number; tag_type: string }) => !currentKeys.has(`${row.tag_parasut_id}:${row.tag_type}`),
    );
    for (const stale of staleMatchers) {
      const { error: deleteError } = await db
        .schema("parasut")
        .from(table)
        .delete()
        .eq(parentIdColumn, parasutId)
        .eq("tag_parasut_id", stale.tag_parasut_id)
        .eq("tag_type", stale.tag_type);
      if (deleteError) errorMessages.push(`${table} (stale delete): ${deleteError.message}`);
    }
  }

  return { upsertedCount, errorCount, errorMessages };
}

// Phase 13.5: refreshManyRelationshipJunctionGeneric() removed. It backed
// only parasut.salary_payments/tax_payments, which have been dropped
// (see the section-3/8 notes in the Phase 13.5 report): `payments` is a
// POST-only write action on Salary/Tax, never a GET relationship, so
// those junctions could never legitimately be populated and this helper
// had no remaining real caller. It also carried the `.select(...,
// {count, head})` overload type error listed in Phase 13.4's deno-check
// findings; removing the dead function removes that error at the
// source, rather than casting/silencing it.

/** Fetches both the active and archived streams of a resource in parallel. */
async function fetchActiveAndArchived(accessToken: string, path: string, extraParams: Record<string, string> = {}) {
  const [active, archived] = await Promise.all([
    fetchAllPages(accessToken, path, 25, { ...extraParams, [ARCHIVED_FILTER_PARAM]: "false" }),
    fetchAllPages(accessToken, path, 25, { ...extraParams, [ARCHIVED_FILTER_PARAM]: "true" }),
  ]);
  return { active, archived };
}

/**
 * contact_people are synced alongside contacts via `include=contact_people`
 * on the same contacts list call (no standalone contact_people endpoint
 * exists -- verified: GET /contact_people and GET /contact_people/{id} both
 * 404 "No route matches."). The parent LINK (which contact this person
 * belongs to) is taken from the parent CONTACT's own
 * `relationships.contact_people.data` list (real id+type) -- the one place
 * the genuine forward relationship lives on the LIST endpoint. Contact NAME
 * is never used for linking.
 *
 * Phase 11.1 (parent TYPE): with the plain `include=contact_people`, the
 * included contact_person's own `relationships.contact` is always
 * `{"meta":{}}` (no data) -- verified in Phase 11. Also verified in this
 * phase: the LIST endpoint rejects the nested `include=contact_people.contact`
 * outright (`400 contact_people.contact is not a valid relation`), so it
 * cannot be added to the bulk contacts fetch. The SINGLE endpoint
 * (`GET /contacts/{id}?include=contact_people.contact`), however, DOES
 * accept it (verified 200, real response) and is the one real API path
 * where the parent contact's own type ("contacts") is exposed alongside the
 * included contact_person. Since only contacts that actually have people
 * need this (2 of 448 in this account), one extra real SINGLE call is made
 * per such contact -- never a "contacts" string constant, never guessed.
 */
async function extractContactPeople(
  accessToken: string,
  contacts: JsonApiResource[],
  included: JsonApiResource[],
): Promise<{
  rows: ReturnType<typeof mapContactPerson>[];
  duplicateCount: number;
  unresolvedCount: number;
  missingTypeCount: number;
  typeMismatchCount: number;
}> {
  const includedByKey = new Map<string, JsonApiResource>();
  for (const resource of included) {
    if (resource.type === "contact_people") includedByKey.set(`contact_people:${resource.id}`, resource);
  }

  const rows: ReturnType<typeof mapContactPerson>[] = [];
  const seenPersonIds = new Set<string>();
  let duplicateCount = 0;
  let unresolvedCount = 0;
  let missingTypeCount = 0;
  let typeMismatchCount = 0;

  for (const contact of contacts) {
    const contactParasutId = Number(contact.id);
    const rel = contact.relationships?.["contact_people"]?.data;
    const personRefs = Array.isArray(rel) ? rel : rel ? [rel] : [];
    if (personRefs.length === 0) continue;

    // Real nested-include SINGLE call, only for contacts that genuinely
    // have people -- verified real API path (see doc comment above).
    const { item: nestedContact, included: nestedIncluded } = await fetchResource(accessToken, "contacts", contact.id, {
      include: "contact_people.contact",
    });
    const nestedIncludedByKey = new Map<string, JsonApiResource>();
    for (const resource of nestedIncluded) {
      if (resource.type === "contact_people") nestedIncludedByKey.set(`contact_people:${resource.id}`, resource);
    }

    for (const ref of personRefs) {
      const personResource = includedByKey.get(`contact_people:${ref.id}`);
      if (!personResource) {
        unresolvedCount += 1;
        continue;
      }
      if (seenPersonIds.has(ref.id)) {
        duplicateCount += 1;
        continue;
      }
      seenPersonIds.add(ref.id);

      const resourceType = personResource.type ?? null;
      const nestedPersonResource = nestedIncludedByKey.get(`contact_people:${ref.id}`);
      const nestedContactRel = nestedPersonResource?.relationships?.["contact"]?.data;
      const nestedParentRef = !nestedContactRel || Array.isArray(nestedContactRel) ? null : nestedContactRel;
      const contactType = nestedParentRef?.type ?? null;

      if (resourceType === null || contactType === null) missingTypeCount += 1;
      if (nestedParentRef && Number(nestedParentRef.id) !== contactParasutId) typeMismatchCount += 1;
      if (ref.type !== resourceType) typeMismatchCount += 1;
      if (nestedContact.type !== "contacts") typeMismatchCount += 1;

      rows.push(mapContactPerson(personResource, contactParasutId, contactType));
    }
  }

  return { rows, duplicateCount, unresolvedCount, missingTypeCount, typeMismatchCount };
}

async function syncContacts(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { active, archived } = await fetchActiveAndArchived(accessToken, "contacts", { include: "contact_people" });
  const activeFetchedCount = active.items.length;
  const archivedFetchedCount = archived.items.length;
  const totalCountReported = (active.totalCountReported ?? 0) + (archived.totalCountReported ?? 0) || null;

  const allContacts = [...active.items, ...archived.items];
  const allIncluded = [...active.included, ...archived.included];
  const {
    rows: contactPeopleRows,
    duplicateCount,
    unresolvedCount,
    missingTypeCount,
    typeMismatchCount,
  } = await extractContactPeople(accessToken, allContacts, allIncluded);
  // Any contact_people row genuinely present in the source this run but
  // whose parasut_id is no longer returned is a stale link: remove only
  // rows for parent contacts that WERE actually covered this run (full
  // active+archived coverage, verified above) and are no longer linked to
  // that person -- never delete anything if this run's contact coverage
  // was itself incomplete (handled by the throw in fetchAllPages, which
  // aborts the whole sync before we ever reach this point).
  const currentPersonIds = contactPeopleRows.map((r) => r.parasut_id);

  let upsertedCount = 0;
  let personUpsertedCount = 0;
  let staleRemovedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    const rows = allContacts.map(mapContact);
    const result = await upsertBatched(db, "contacts", rows as unknown as Record<string, unknown>[]);
    upsertedCount = result.upsertedCount;
    errorCount = result.errorCount;
    errorMessages.push(...result.errorMessages);

    const personResult = await upsertBatched(db, "contact_people", contactPeopleRows as unknown as Record<string, unknown>[]);
    personUpsertedCount = personResult.upsertedCount;
    errorCount += personResult.errorCount;
    errorMessages.push(...personResult.errorMessages);

    if (errorCount === 0) {
      const { error: deleteError, count } = await db
        .schema("parasut")
        .from("contact_people")
        .delete({ count: "exact" })
        .not("parasut_id", "in", `(${currentPersonIds.length > 0 ? currentPersonIds.join(",") : "-1"})`);
      if (deleteError) {
        errorMessages.push(`contact_people stale cleanup: ${deleteError.message}`);
      } else {
        staleRemovedCount = count ?? 0;
      }
    }
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
      contact_people_fetched_count: contactPeopleRows.length,
      contact_people_upserted_count: dryRun ? 0 : personUpsertedCount,
      contact_people_duplicate_count: duplicateCount,
      contact_people_unresolved_count: unresolvedCount,
      contact_people_missing_type_count: missingTypeCount,
      contact_people_type_mismatch_count: typeMismatchCount,
      contact_people_stale_removed_count: dryRun ? 0 : staleRemovedCount,
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
  const staleLinkRemovedCount = 0;
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

    // Phase 14.3 fix: the blanket stale-link cleanup that used to run here
    // (nulling any e_invoices/e_archives row whose parasut_id wasn't in this
    // batch's resolved id list) has been REMOVED. It was not actually safe:
    // `fetchActiveAndArchived` above only requests filter[archived]=false and
    // filter[archived]=true, which does NOT cover every real parent -- a
    // sales_invoice with item_type="cancelled" is returned by NEITHER filter
    // (verified live: GET /sales_invoices/{id} for 4 real cancelled parents
    // returns 200 with archived=false, item_type="cancelled", yet neither
    // active nor archived list surfaces them). Because those 4 parents never
    // appeared in `parentItems`, their child e_invoices ids were never added
    // to `eInvoiceIds`, and the old "not in (...)" UPDATE wrongly treated
    // them as stale and nulled real, still-valid parent_type/parent_parasut_id
    // links (e_invoice ids 1039238103, 1053844283, 1060947175, 1067768657 ->
    // sales_invoices 1052770408, 1069847471, 1078897329, 1087830427).
    //
    // This function's own parent fetch is therefore NOT provably a complete
    // listing of every real parent, so it must never be used as the
    // authority for deleting a link. Per-row evidence for "no relationship"
    // now comes exclusively from `syncEInvoicesStandalone()`'s own
    // `include=invoice` read (real `invoice.data === null`), which IS a
    // genuine global, unscoped listing and already only ever writes a null
    // parent link when its own fresh read is null (see
    // `parasut.upsert_e_invoices_standalone()`'s field-by-field COALESCE).
    // A link established here (from real `active_e_document` evidence) is
    // therefore only ever SET, never blindly cleared, by this function.
    // staleLinkRemovedCount is kept at 0 -- reported, never silently acted on.
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
  let invoiceFetchedCount = invoiceActiveFetchedCount + invoiceArchivedFetchedCount;
  const totalCountReported = (active.totalCountReported ?? 0) + (archived.totalCountReported ?? 0) || null;

  const includedByKey = new Map<string, JsonApiResource>();
  for (const resource of [...active.included, ...archived.included]) {
    includedByKey.set(`${resource.type}:${resource.id}`, resource);
  }

  // Phase 14.4/14.5: filter[archived]=false / =true together do NOT cover
  // every real sales_invoice -- a real invoice with item_type="cancelled" is
  // returned by NEITHER filter (verified live, Phase 14.3/14.4). The list
  // endpoint has no working item_type/status filter that surfaces these
  // (filter[item_type]=cancelled is accepted as valid but returns 0 rows;
  // there is no documented cancelled-list endpoint). Phase 14.4 discovered
  // these ids by reading the already-synced `parasut.e_invoices` DB table --
  // a real architectural bootstrap risk: if this sync runs against an empty
  // or not-yet-populated e_invoices table (fresh DB, or sales_invoices run
  // before the standalone e_invoices sync), the 4 cancelled ids would never
  // be discovered and this function would silently report success while
  // covering only 451/455 real invoices. Phase 14.5 fixes this: the
  // discovery source is now the REAL LIVE `/e_invoices?include=invoice` API
  // (the same call syncEInvoicesStandalone makes), fetched fresh in this
  // same run, never the DB. This makes syncSalesInvoices() self-sufficient --
  // it no longer depends on any other sync having run first. Any id found
  // there with relationships.invoice.data.type === "sales_invoices" that is
  // NOT among the ids just fetched via active+archived is fetched
  // individually via the real single-resource endpoint and merged in, using
  // the exact same include scope (details, details.product, contact,
  // active_e_document) as every other invoice -- never name/tax
  // number/amount/date matching, never a reduced include set.
  const knownIds = new Set(invoiceItems.map((item) => item.id));
  let cancelledDiscoveredCount = 0;
  let cancelledFetchedCount = 0;
  const cancelledFetchErrors: string[] = [];
  try {
    const eInvoiceProbe = await fetchAllPages(accessToken, "e_invoices", 100, {
      include: "invoice",
    });
    const candidateIds = [
      ...new Set(
        eInvoiceProbe.items
          .map((item) => {
            const rel = item.relationships?.invoice as
              | { data?: { id?: string; type?: string } | null }
              | undefined;
            if (rel && rel.data && rel.data.id && rel.data.type === "sales_invoices") {
              return rel.data.id;
            }
            return null;
          })
          .filter((id): id is string => id != null),
      ),
    ].filter((id) => !knownIds.has(id));
    cancelledDiscoveredCount = candidateIds.length;
    for (const id of candidateIds) {
      try {
        const { item, included } = await fetchResource(accessToken, "sales_invoices", id, {
          include: "details,details.product,contact,active_e_document",
        });
        invoiceItems.push(item);
        knownIds.add(item.id);
        for (const resource of included) {
          includedByKey.set(`${resource.type}:${resource.id}`, resource);
        }
        cancelledFetchedCount++;
      } catch (err) {
        cancelledFetchErrors.push(`sales_invoices/${id} (e_invoice-relationship discovery): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    cancelledFetchErrors.push(`live e_invoices relationship probe failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  invoiceFetchedCount = invoiceItems.length;

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
  let errorCount = missingDetailRefs.length + cancelledFetchErrors.length;
  const errorMessages: string[] = [...cancelledFetchErrors];
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
      invoice_cancelled_discovered_via_e_invoice_relationship_count: cancelledDiscoveredCount,
      invoice_cancelled_fetched_count: cancelledFetchedCount,
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
  // invoices is a real to-many relationship (verified: 1/15 documents in
  // this account has a real linked sales_invoice; the other 14 have a
  // genuinely empty array) -- same list/single inconsistency as activities,
  // the list endpoint 400s on include=invoices, so it is fetched alongside
  // activities on the same per-record call.
  const activityPairs: { docParasutId: number; activity: JsonApiResource; doneByUser: JsonApiResource | null }[] = [];
  const invoiceLinkPairs: { docParasutId: number; salesInvoiceParasutId: number }[] = [];
  if (!dryRun) {
    for (const doc of docItems) {
      const docParasutId = Number(doc.id);
      const { item: docSingle, included: docIncluded } = await fetchResource(accessToken, "shipment_documents", doc.id, {
        include: "activities,activities.item,activities.done_by,invoices",
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
      for (const invoiceId of invoiceIdsForShipmentDocument(docSingle)) {
        const salesInvoiceParasutId = Number(invoiceId);
        if (Number.isFinite(salesInvoiceParasutId)) {
          invoiceLinkPairs.push({ docParasutId, salesInvoiceParasutId });
        }
      }
    }
  }
  const activityFetchedCount = activityPairs.length;
  const invoiceLinkFetchedCount = invoiceLinkPairs.length;

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

    // Junction rows have no single parasut_id and this sync is a full,
    // authoritative listing of every real document -- so the safe way to
    // guarantee no stale (document, invoice) pair survives is to clear
    // every link for the documents just fetched, then re-insert exactly
    // the pairs the API reports right now. Never touches
    // parasut.sales_invoices itself, only the junction rows.
    const currentDocIds = docItems.map((d) => Number(d.id));
    const { error: clearError } = await db
      .schema("parasut")
      .from("shipment_document_invoices")
      .delete()
      .in("shipment_document_parasut_id", currentDocIds);
    if (clearError) {
      errorCount += 1;
      errorMessages.push(`shipment_document_invoices (clear): ${clearError.message}`);
    } else if (invoiceLinkPairs.length > 0) {
      const { error: insertError } = await db
        .schema("parasut")
        .from("shipment_document_invoices")
        .insert(
          invoiceLinkPairs.map(({ docParasutId, salesInvoiceParasutId }) => ({
            shipment_document_parasut_id: docParasutId,
            sales_invoice_parasut_id: salesInvoiceParasutId,
          })),
        );
      if (insertError) {
        errorCount += 1;
        errorMessages.push(`shipment_document_invoices (insert): ${insertError.message}`);
      }
    }
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
      invoice_link_fetched_count: dryRun ? 0 : invoiceLinkFetchedCount,
      unresolved_count: unresolvedCount,
      total_count_reported: totalCountReported,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * Real list-endpoint includes (verified via a real 400 error message):
 * category, managed_by_user, managed_by_user_role, tags. activities and
 * comments 400 on the list endpoint but resolve as real, genuinely empty
 * `data:[]` via the single-record endpoint (same list/single inconsistency
 * as shipment_documents.activities). In this account all 6 real employees
 * have every one of these six relationships genuinely empty -- nothing is
 * fabricated to fill that gap; tags_resolved/activities_resolved/
 * comments_resolved just record that the API was actually asked and
 * genuinely answered "none", vs. never having been asked.
 */
/**
 * Upserts one real employee_sync_meta row per filter_scope from the real,
 * verbatim links/meta block of the employee LIST response. Never called on
 * dry runs (dry runs never write). Never merges scopes: "active" and
 * "archived" are stored as two independent rows, each overwritten with the
 * current authoritative API value every real sync -- never averaged, never
 * copied onto employee rows. See supabase/migrations/
 * 20260829010000_parasut_employee_sync_meta.sql for the full real-value
 * verification (payable_total/advance_total/export_url meaning, currency
 * absence, page-to-page identical value, export_url security decision).
 */
async function upsertEmployeeSyncMeta(
  db: SupabaseClient,
  filterScope: "active" | "archived",
  meta: { current_page?: number; total_pages?: number; total_count?: number; per_page?: number; payable_total?: string; advance_total?: string; export_url?: string } | null,
): Promise<void> {
  if (!meta) return;
  const { error } = await db.schema("parasut").from("employee_sync_meta").upsert(
    {
      resource: "employees",
      filter_scope: filterScope,
      payable_total: meta.payable_total ?? null,
      advance_total: meta.advance_total ?? null,
      export_url: meta.export_url ?? null,
      source_total_count: meta.total_count ?? null,
      source_current_page: meta.current_page ?? null,
      source_total_pages: meta.total_pages ?? null,
      source_per_page: meta.per_page ?? null,
      fetched_at: new Date().toISOString(),
      raw_meta: meta,
    },
    { onConflict: "resource,filter_scope" },
  );
  if (error) {
    throw new Error(`employee_sync_meta upsert (${filterScope}) failed: ${error.message}`);
  }
}

async function syncEmployees(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { active, archived } = await fetchActiveAndArchived(accessToken, "employees", {
    include: "category,managed_by_user,managed_by_user_role,tags",
  });

  if (!dryRun) {
    await upsertEmployeeSyncMeta(db, "active", active.lastMeta ?? null);
    await upsertEmployeeSyncMeta(db, "archived", archived.lastMeta ?? null);
  }

  const items = [...active.items, ...archived.items];
  const activeFetchedCount = active.items.length;
  const archivedFetchedCount = archived.items.length;
  const fetchedCount = activeFetchedCount + archivedFetchedCount;
  const totalCountReported = (active.totalCountReported ?? 0) + (archived.totalCountReported ?? 0) || null;

  // activities/comments only resolve via the single-record endpoint -- one
  // extra GET per real employee (cheap: 6 records in this account).
  const resolvedByParasutId = new Map<string, JsonApiResource>();
  if (!dryRun) {
    for (const item of items) {
      const { item: single } = await fetchResource(accessToken, "employees", item.id, {
        include: "activities,comments",
      });
      resolvedByParasutId.set(item.id, single);
    }
  }

  const rows = items.map((item) => {
    const single = resolvedByParasutId.get(item.id);
    const merged: JsonApiResource = single
      ? {
          ...item,
          relationships: {
            ...item.relationships,
            // Phase 13.5: fall back to `{ data: null }` instead of
            // `undefined` when the single-record response has no
            // activities/comments key -- same real "no data" meaning,
            // but matches JsonApiResource's index signature (TS2322),
            // which does not allow an `undefined` value.
            activities: single.relationships?.["activities"] ?? { data: null },
            comments: single.relationships?.["comments"] ?? { data: null },
          },
        }
      : item;
    return mapEmployee(merged);
  });

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    const result = await upsertBatched(db, "employees", rows as unknown as Record<string, unknown>[]);
    upsertedCount = result.upsertedCount;
    errorCount = result.errorCount;
    errorMessages.push(...result.errorMessages);
  }

  const categoryResolvedCount = rows.filter((r) => r.category_parasut_id !== null).length;
  const managedByUserResolvedCount = rows.filter((r) => r.managed_by_user_parasut_id !== null).length;

  return {
    dbFields: {
      fetched_count: fetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      error_count: errorCount,
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      total_count_reported: totalCountReported,
      category_resolved_count: categoryResolvedCount,
      managed_by_user_resolved_count: managedByUserResolvedCount,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * Phase 12: GET /v4/me. NOT list-paginated (single document, one real
 * user/company/address/profile/user_role each in this account) -- no
 * fetchActiveAndArchived, no fetchAllPages. The company id/type comes ONLY
 * from user_roles.relationships.company.data (never from PARASUT_COMPANY_ID
 * / the request URL); the address comes ONLY from the included company's
 * own relationships.address.data (never guessed from the old DB row).
 */
async function syncMe(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const { item: userItem, included } = await fetchMe(accessToken);

  const userRoleResources = included.filter((r) => r.type === "user_roles");
  const companyResources = included.filter((r) => r.type === "companies");
  const addressResources = included.filter((r) => r.type === "addresses");
  const profileResources = included.filter((r) => r.type === "profiles");

  const userParasutId = Number(userItem.id);
  const userRow = mapUser(userItem);

  const profileRef = userItem.relationships?.["profile"]?.data;
  const profileItem = !Array.isArray(profileRef) && profileRef
    ? profileResources.find((p) => p.id === profileRef.id)
    : undefined;
  const profileRow = profileItem ? mapProfile(profileItem, userParasutId) : null;

  const userRolesRef = userItem.relationships?.["user_roles"]?.data;
  const userRoleIds = Array.isArray(userRolesRef) ? userRolesRef.map((r) => r.id) : [];
  const userRoleItems = userRoleResources.filter((r) => userRoleIds.includes(r.id));
  const userRoleRows = userRoleItems.map((r) => mapUserRole(r, userParasutId));

  // Real user->company link: the id/type on user_roles.relationships.company
  // -- one per real user_role, duplicates counted if the same company id
  // appears more than once (never assumed to be exactly one).
  const companyRefs = userRoleItems
    .map((r) => r.relationships?.["company"]?.data)
    .filter((d): d is { id: string; type: string } => !!d && !Array.isArray(d));
  const uniqueCompanyIds = new Set(companyRefs.map((c) => c.id));
  const duplicateCompanyLinkCount = companyRefs.length - uniqueCompanyIds.size;
  const typeMismatchCount = companyRefs.filter((c) => c.type !== "companies").length;

  // Phase 12.1: /v4/companies is a separate real source -- fetched here so
  // each company row carries its own `raw_company_list` provenance,
  // distinct from the /v4/me-sourced `raw`. A fetch failure here must not
  // abort the whole /v4/me sync (companies list is supplementary
  // provenance, not the primary source) -- degrade to null on error.
  let companyListResources: JsonApiResource[] = [];
  try {
    companyListResources = await fetchCompaniesList(accessToken);
  } catch (_err) {
    companyListResources = [];
  }

  const companyRows = companyResources
    .filter((c) => uniqueCompanyIds.has(c.id))
    .map((c) => mapMeCompany(c, findCompanyListEntry(companyListResources, c.id)));
  const unresolvedCompanyCount = companyRefs.filter((ref) => !companyResources.some((c) => c.id === ref.id)).length;

  // Address: only wired from the COMPANY's own relationships.address.data
  // (a company sub-resource, never a top-level /v4/me relationship).
  const addressRows = [];
  for (const companyItem of companyResources.filter((c) => uniqueCompanyIds.has(c.id))) {
    const addrRef = companyItem.relationships?.["address"]?.data;
    if (!addrRef || Array.isArray(addrRef)) continue;
    const addrItem = addressResources.find((a) => a.id === addrRef.id);
    if (!addrItem) continue;
    // Phase 12.2: addressable_type must come from the real API resource
    // type of the parent (companyItem.type, as returned by /v4/me), never
    // a hardcoded "companies" string literal.
    addressRows.push(mapMeAddress(addrItem, companyItem.type, Number(companyItem.id)));
  }

  let userUpserted = 0;
  let profileUpserted = 0;
  let userRoleUpserted = 0;
  let companyUpserted = 0;
  let addressUpserted = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    const userResult = await upsertBatched(db, "users", [userRow as unknown as Record<string, unknown>]);
    userUpserted = userResult.upsertedCount;
    errorCount += userResult.errorCount;
    errorMessages.push(...userResult.errorMessages);

    if (profileRow) {
      const profileResult = await upsertBatched(db, "profiles", [profileRow as unknown as Record<string, unknown>]);
      profileUpserted = profileResult.upsertedCount;
      errorCount += profileResult.errorCount;
      errorMessages.push(...profileResult.errorMessages);
    }

    if (userRoleRows.length > 0) {
      const roleResult = await upsertBatched(db, "user_roles", userRoleRows as unknown as Record<string, unknown>[]);
      userRoleUpserted = roleResult.upsertedCount;
      errorCount += roleResult.errorCount;
      errorMessages.push(...roleResult.errorMessages);
    }

    if (companyRows.length > 0) {
      const companyResult = await upsertBatched(db, "companies", companyRows as unknown as Record<string, unknown>[]);
      companyUpserted = companyResult.upsertedCount;
      errorCount += companyResult.errorCount;
      errorMessages.push(...companyResult.errorMessages);
    }

    if (addressRows.length > 0) {
      const addressResult = await upsertBatched(db, "addresses", addressRows as unknown as Record<string, unknown>[]);
      addressUpserted = addressResult.upsertedCount;
      errorCount += addressResult.errorCount;
      errorMessages.push(...addressResult.errorMessages);
    }
  }

  return {
    dbFields: {
      fetched_count: 1,
      upserted_count: dryRun ? 0 : userUpserted + profileUpserted + userRoleUpserted + companyUpserted + addressUpserted,
      error_count: errorCount,
    },
    responseFields: {
      user_id: userItem.id,
      user_upserted_count: dryRun ? 0 : userUpserted,
      profile_upserted_count: dryRun ? 0 : profileUpserted,
      user_role_upserted_count: dryRun ? 0 : userRoleUpserted,
      company_upserted_count: dryRun ? 0 : companyUpserted,
      address_upserted_count: dryRun ? 0 : addressUpserted,
      unique_company_count: uniqueCompanyIds.size,
      duplicate_company_link_count: duplicateCompanyLinkCount,
      unresolved_company_count: unresolvedCompanyCount,
      type_mismatch_count: typeMismatchCount,
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
const ITEM_CATEGORY_EXPECTED_TYPES = ["item_categories"] as const;

async function syncItemCategories(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const result = await fetchAllPages(accessToken, "item_categories");
  const fetchedCount = result.items.length;
  const typeStatus = expectedTypeStatus(result.items, ITEM_CATEGORY_EXPECTED_TYPES);

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
      metadata: { type_status: typeStatus },
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      total_count_reported: result.totalCountReported,
      type_status: typeStatus,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * salaries: real list endpoint (GET /salaries -> 200), 0 real records in
 * this account today (data:[]). filter[archived] is rejected as an invalid
 * filter param by the real API (verified: 400, "Acceptable: due_date,
 * issue_date, currency, remaining"), so no active/archived scoped fetch is
 * attempted here -- a single full listing is the complete, correct fetch.
 * The exact same code fetches/upserts real rows the moment records exist.
 */
// Phase 13.1/13.2: the exact attribute/relationship keys mapSalary()
// reads -- kept next to the sync function so the manifest and the mapper
// are easy to eyeball together. SALARY_SWAGGER_RELATIONSHIP_KEYS lists
// every relationship the real, live-downloaded swagger.json documents
// for Salary, whether or not it has been moved to a column yet -- `tags`
// is real and known in Swagger (many-to-many, now normalized via
// parasut.salary_tags in this phase).
// Phase 13.4 correction: `definitions.Salary.properties.relationships`
// in the real swagger.json (re-verified live against
// https://apidocs.parasut.com/swagger.json in this phase) documents ONLY
// `employee`, `category`, `tags`. There is no `activities` key anywhere
// in that object, and no `/salaries/{id}/activities` path exists either
// -- Phase 13.3's inclusion of "activities" here was fabricated (copied
// from other resources that DO have a real activities relationship,
// which Salary/Tax do not).
// Phase 13.5 correction: `payments` is REMOVED from the relationship
// manifest entirely. Re-verified live against the real swagger.json in
// this phase: `/{company_id}/salaries/{id}/payments` documents ONLY a
// `post` method (payment-creation action) -- there is no `get` on that
// path, and `definitions.Salary.properties.relationships.properties`
// never contained a `payments` key in the first place (only `employee`,
// `category`, `tags`, confirmed above). Phase 13.3/13.4 treated this POST
// action endpoint as if it were a readable to-many relationship and
// built `parasut.salary_payments` to mirror it via
// `relatedManyRefs(item, "payments")` -- but no GET response for a
// Salary resource (list or detail, with or without `include=`) will ever
// contain a `payments` relationship key, so that junction was
// structurally guaranteed to stay empty forever (confirmed: 0 rows live).
// It has been dropped in the companion migration. See
// SALARY_WRITE_CAPABILITIES below for how this POST action is now
// tracked -- as a write capability, never as a relationship.
const SALARY_KNOWN_ATTRIBUTE_KEYS = [
  "description", "currency", "issue_date", "due_date", "exchange_rate",
  "net_total", "total_paid", "remaining", "remaining_in_trl", "archived",
  "created_at", "updated_at",
] as const;
const SALARY_KNOWN_RELATIONSHIP_KEYS = ["employee", "category", "tags"] as const;
const SALARY_SWAGGER_RELATIONSHIP_KEYS = ["employee", "category", "tags"] as const;
const SALARY_EXPECTED_TYPES = ["salaries"] as const;
// Phase 13.5: PARASUT_WRITE_CAPABILITY class -- documents real POST/PUT/
// PATCH/DELETE-only API paths that are NOT read relationships and must
// never be mirrored into a base/junction table as if they were one. This
// is a technical capability manifest, deliberately kept separate from
// the relationship manifest above. It does not imply "no linked
// payment" (unknowable without a per-record GET this API does not
// expose), is not by itself sufficient to open a create-button in the
// public demo, and requires user input/auth/write-back/idempotency
// design before any UI could use it.
const SALARY_WRITE_CAPABILITIES = [
  { resource: "salaries", operation: "create_payment", method: "POST", path: "/salaries/{id}/payments", readWrite: "write_only", authStatus: "requires_write_scope", uiDecision: "not_exposed" },
] as const;

async function syncSalaries(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const result = await fetchAllPages(accessToken, "salaries");
  const fetchedCount = result.items.length;
  const unknownKeys = detectUnknownKeys(
    result.items,
    SALARY_KNOWN_ATTRIBUTE_KEYS,
    SALARY_KNOWN_RELATIONSHIP_KEYS,
    [],
    SALARY_SWAGGER_RELATIONSHIP_KEYS,
  );
  const typeMismatches = detectTypeMismatch(result.items, SALARY_EXPECTED_TYPES);

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];
  let junctionUpsertedCount = 0;

  if (!dryRun) {
    const rows = result.items.map(mapSalary);
    const upsertResult = await upsertBatched(db, "salaries", rows as unknown as Record<string, unknown>[]);
    upsertedCount = upsertResult.upsertedCount;
    errorCount = upsertResult.errorCount;
    errorMessages.push(...upsertResult.errorMessages);

    // Real to-many tags relationship -> junction table, refreshed against
    // the current source list per parent (0 parents today -> 0 junction
    // rows, genuinely, not hardcoded).
    const junctionInputs = result.items.map((item) => ({
      parasutId: Number(item.id),
      refs: relatedManyRefs(item, "tags") as RelatedRef[],
    })).filter((x) => Number.isFinite(x.parasutId));
    const junctionResult = await refreshManyRelationshipJunction(db, "salary_tags", "salary_parasut_id", junctionInputs);
    junctionUpsertedCount = junctionResult.upsertedCount;
    errorCount += junctionResult.errorCount;
    errorMessages.push(...junctionResult.errorMessages);

    // Phase 13.5: `payments` junction intentionally removed -- see the
    // SALARY_SWAGGER_RELATIONSHIP_KEYS comment above. There is no GET
    // relationship to mirror; `/salaries/{id}/payments` is POST-only and
    // is tracked in SALARY_WRITE_CAPABILITIES instead.
  }

  const typeStatus = expectedTypeStatus(result.items, SALARY_EXPECTED_TYPES);

  return {
    dbFields: {
      fetched_count: fetchedCount,
      total_count_reported: result.totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      error_count: errorCount,
      metadata: {
        unknown_keys: unknownKeys,
        type_mismatches: typeMismatches,
        salary_tags_junction_upserted: junctionUpsertedCount,
        write_capabilities: SALARY_WRITE_CAPABILITIES,
        type_status: typeStatus,
      },
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      total_count_reported: result.totalCountReported,
      unknown_keys: unknownKeys,
      type_mismatches: typeMismatches,
      salary_tags_junction_upserted: junctionUpsertedCount,
      type_status: typeStatus,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * taxes: real list endpoint (GET /taxes -> 200), 0 real records in this
 * account today (data:[]). Same filter[archived]-rejected behavior as
 * salaries (identical real 400 body) -- single full listing only.
 */
// Phase 13.1/13.2: same rationale as SALARY_KNOWN_*. `tags` is a real Tax
// relationship per Swagger, now normalized via parasut.tax_tags in this
// phase.
// Phase 13.4 correction: `definitions.Tax.properties.relationships` in the
// real swagger.json documents ONLY `category` and `tags` -- no
// `activities` key, no `/taxes/{id}/activities` path. Phase 13.3's
// `Tax.activities` manifest row was fabricated ("other resources have
// activities" is not evidence for Tax specifically) and is removed here
// and from `parasut.relationship_manifest` (see the new migration).
// Phase 13.5 correction: `payments` is REMOVED from the relationship
// manifest for the same reason as Salary above -- re-verified live:
// `/{company_id}/taxes/{id}/payments` documents ONLY `post`, no `get`,
// and `definitions.Tax.properties.relationships.properties` never
// contained a `payments` key (only `category`, `tags`). Tracked instead
// in TAX_WRITE_CAPABILITIES as a write-only action.
const TAX_KNOWN_ATTRIBUTE_KEYS = [
  "description", "issue_date", "due_date", "net_total", "total_paid",
  "remaining", "remaining_in_trl", "archived", "created_at", "updated_at",
] as const;
const TAX_KNOWN_RELATIONSHIP_KEYS = ["category", "tags"] as const;
const TAX_SWAGGER_RELATIONSHIP_KEYS = ["category", "tags"] as const;
const TAX_WRITE_CAPABILITIES = [
  { resource: "taxes", operation: "create_payment", method: "POST", path: "/taxes/{id}/payments", readWrite: "write_only", authStatus: "requires_write_scope", uiDecision: "not_exposed" },
] as const;
// Phase 13.4 correction: the real swagger.json `definitions.Tax.properties.type.enum`
// is `["bank_fees"]` (verified live against https://apidocs.parasut.com/swagger.json
// in this phase). Phase 13.3's `TAX_EXPECTED_TYPES = ["taxes"]` derived its value from
// the REST endpoint name ("/taxes"), not from Swagger -- with 0 real runtime tax
// records this was unprovable and, per the real schema, was simply wrong. It is
// replaced with the genuine swagger-documented value below. This list is used ONLY
// as separate metadata (`swagger_documented_type`) for diagnostic comparison -- it
// NEVER coerces/derives the stored value. Once a real record arrives, the runtime
// item.type is reported verbatim (mapTax) alongside this list as two clearly
// separate fields (`observed_runtime_type` vs `swagger_documented_type`), with an
// explicit `mismatch` boolean -- never merged or forced.
const TAX_SWAGGER_DOCUMENTED_TYPES = ["bank_fees"] as const;

async function syncTaxes(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const result = await fetchAllPages(accessToken, "taxes");
  const fetchedCount = result.items.length;
  const unknownKeys = detectUnknownKeys(
    result.items,
    TAX_KNOWN_ATTRIBUTE_KEYS,
    TAX_KNOWN_RELATIONSHIP_KEYS,
    [],
    TAX_SWAGGER_RELATIONSHIP_KEYS,
  );
  const typeMismatches = detectTypeMismatch(result.items, TAX_SWAGGER_DOCUMENTED_TYPES);

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];
  let junctionUpsertedCount = 0;

  if (!dryRun) {
    const rows = result.items.map(mapTax);
    const upsertResult = await upsertBatched(db, "taxes", rows as unknown as Record<string, unknown>[]);
    upsertedCount = upsertResult.upsertedCount;
    errorCount = upsertResult.errorCount;
    errorMessages.push(...upsertResult.errorMessages);

    const junctionInputs = result.items.map((item) => ({
      parasutId: Number(item.id),
      refs: relatedManyRefs(item, "tags") as RelatedRef[],
    })).filter((x) => Number.isFinite(x.parasutId));
    const junctionResult = await refreshManyRelationshipJunction(db, "tax_tags", "tax_parasut_id", junctionInputs);
    junctionUpsertedCount = junctionResult.upsertedCount;
    errorCount += junctionResult.errorCount;
    errorMessages.push(...junctionResult.errorMessages);

    // Phase 13.5: `payments` junction intentionally removed -- see the
    // TAX_SWAGGER_RELATIONSHIP_KEYS comment above.
  }

  const typeStatus = expectedTypeStatus(result.items, TAX_SWAGGER_DOCUMENTED_TYPES);

  return {
    dbFields: {
      fetched_count: fetchedCount,
      total_count_reported: result.totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      error_count: errorCount,
      metadata: {
        unknown_keys: unknownKeys,
        type_mismatches: typeMismatches,
        tax_tags_junction_upserted: junctionUpsertedCount,
        write_capabilities: TAX_WRITE_CAPABILITIES,
        type_status: typeStatus,
      },
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      total_count_reported: result.totalCountReported,
      unknown_keys: unknownKeys,
      type_mismatches: typeMismatches,
      tax_tags_junction_upserted: junctionUpsertedCount,
      type_status: typeStatus,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * tags: real list endpoint (GET /tags -> 200), 0 real records in this
 * account today (meta.total_count:0). No archived attribute on this
 * resource at all (real 400: "Acceptable: " -- empty list) -- single full
 * listing only.
 */
const TAG_KNOWN_ATTRIBUTE_KEYS = ["name", "created_at", "updated_at"] as const;
const TAG_KNOWN_RELATIONSHIP_KEYS = [] as const;
const TAG_EXPECTED_TYPES = ["tags"] as const;

async function syncTags(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const result = await fetchAllPages(accessToken, "tags");
  const fetchedCount = result.items.length;
  const unknownKeys = detectUnknownKeys(result.items, TAG_KNOWN_ATTRIBUTE_KEYS, TAG_KNOWN_RELATIONSHIP_KEYS);
  const typeMismatches = detectTypeMismatch(result.items, TAG_EXPECTED_TYPES);
  const typeStatus = expectedTypeStatus(result.items, TAG_EXPECTED_TYPES);

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    const rows = result.items.map(mapTag);
    const upsertResult = await upsertBatched(db, "tags", rows as unknown as Record<string, unknown>[]);
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
      metadata: { unknown_keys: unknownKeys, type_mismatches: typeMismatches, type_status: typeStatus },
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      total_count_reported: result.totalCountReported,
      unknown_keys: unknownKeys,
      type_mismatches: typeMismatches,
      type_status: typeStatus,
    },
    errorCount,
    errorMessages,
  };
}

/**
 * e_invoice_inboxes: Phase 13.3 fix -- this is a taxpayer LOOKUP service
 * (`GET /e_invoice_inboxes?filter[vkn]=...`), never a global inbox record
 * list. Phase 13.2 still called it unfiltered as a "keep the plumbing
 * warm" sync; that is itself the bug this phase removes. As of this
 * phase:
 *   - This resource is REMOVED from the general full/scheduled sync list
 *     (scripts/sync_parasut.py LIST_ENDPOINTS) -- see that file.
 *   - A direct call to this Edge Function with resource=e_invoice_inboxes
 *     and no real `vkn` argument NEVER performs an unfiltered fetch. It
 *     returns status "lookup_required" / blocked_reason
 *     "BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH" and touches zero rows.
 *   - A real per-VKN lookup additionally requires secure caller
 *     authentication, which does not exist yet (still BLOCKED pending a
 *     future secure-auth phase -- see EFaturaMukellefSorgulama.tsx). So
 *     even when a `vkn` argument is supplied today, the call is still
 *     blocked (auth prerequisite not met) -- this keeps the architecture
 *     ready without opening a live public VKN form.
 *   - No global collection count and no global stale-deletion are ever
 *     produced for this resource.
 */
const E_INVOICE_INBOX_KNOWN_ATTRIBUTE_KEYS = [
  "vkn", "e_invoice_address", "name", "inbox_type", "address_registered_at",
  "registered_at", "created_at", "updated_at",
] as const;
const E_INVOICE_INBOX_KNOWN_RELATIONSHIP_KEYS = [] as const;
const E_INVOICE_INBOX_EXPECTED_TYPES = ["e_invoice_inboxes"] as const;

async function syncEInvoiceInboxes(_db: SupabaseClient, _accessToken: string, _dryRun: boolean) {
  // Phase 13.3: never runs an unfiltered fetch. Secure per-VKN auth is not
  // implemented yet, so every call today is blocked -- deliberately, to
  // never let this public demo function write user input into the
  // parasut mirror or run a global sync for a lookup-only resource.
  return {
    dbFields: {
      fetched_count: 0,
      total_count_reported: null,
      upserted_count: 0,
      error_count: 0,
      status: "lookup_required",
      metadata: {
        resource_class: "PARASUT_AUTHORITATIVE_QUERY_RESULT",
        blocked_reason: "BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH",
        cached_query_result_count: null,
        known_attribute_keys: E_INVOICE_INBOX_KNOWN_ATTRIBUTE_KEYS,
        known_relationship_keys: E_INVOICE_INBOX_KNOWN_RELATIONSHIP_KEYS,
        expected_types: E_INVOICE_INBOX_EXPECTED_TYPES,
      },
    },
    responseFields: {
      status: "lookup_required",
      blocked_reason: "BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH",
      total_fetched_count: 0,
      cached_query_result_count: null,
      upserted_count: 0,
      total_count_reported: null,
    },
    errorCount: 0,
    errorMessages: [] as string[],
  };
}

/**
 * Phase 14.2: standalone e_invoices full-universe sync.
 *
 * `GET /e_invoices` is a genuine, separately-paginated, global list
 * endpoint independent of the sales_invoices/purchase_bills-scoped
 * `active_e_document` include that `syncActiveEDocuments()` (defined
 * above, called from syncSalesInvoices/syncPurchaseBills) already
 * covers. As of Phase 14.1's discovery, that active-parent path only
 * ever reaches e_invoices rows with a resolvable real parent -- but the
 * standalone endpoint returns MORE rows than that (1693 total vs 1238
 * parent-linked, verified in this phase), because a real e-invoice can
 * exist with no resolvable `invoice` relationship (`invoice.data` is
 * null in the real API response) or with a parent the active-document
 * sync has not (yet) linked.
 *
 * Two important, verified-in-this-phase API facts:
 *   - The plain `GET /e_invoices?page[size]=...` response's `invoice`
 *     relationship is ALWAYS `{"meta":{}}` (no `data` key) -- it does
 *     NOT surface real relationship data unless `include=invoice` is
 *     explicitly requested. This sync always requests `include=invoice`
 *     so the real relationship evidence is genuinely read, never
 *     defaulted or guessed.
 *   - With `include=invoice`, of 1693 real records: 1242 have a real
 *     non-null `invoice.data` (431 sales_invoices, 811 purchase_bills)
 *     and 451 have a real null `invoice.data` (no parent -- a genuine
 *     scope, not a sync bug, per Phase 14.1's sampled confirmation).
 *
 * This sync writes through `parasut.upsert_e_invoices_standalone()`
 * (Phase 14.2 migration), which COALESCEs parent_type/parent_parasut_id
 * so a null relationship from this call NEVER overwrites an existing
 * real parent link that `syncActiveEDocuments()` (or a prior standalone
 * run) already established -- while a real non-null value from this
 * call's own fresh relationship read is always written. Every other
 * real column is always overwritten with the fresh fetch. Never a
 * physical delete: absent-from-source rows are left untouched (see
 * Phase 14.2 report, section 5, for the stale-semantics decision);
 * `last_seen_at` is stamped on every row this run observed, so a
 * future phase could report (never silently act on) stale candidates
 * by comparing `last_seen_at` against the sync run time.
 */
async function syncEInvoicesStandalone(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const result = await fetchAllPages(accessToken, "e_invoices", 100, {
    include: "invoice",
  });

  const items = result.items;
  const fetchedCount = items.length;

  const idSet = new Set(items.map((item) => item.id));
  const duplicateCount = fetchedCount - idSet.size;

  let linkedSalesInvoiceCount = 0;
  let linkedPurchaseBillCount = 0;
  let unlinkedCount = 0;
  let unresolvedRelationshipCount = 0;

  const rows = items.map((item) => {
    const rel = item.relationships?.invoice as
      | { data?: { id?: string; type?: string } | null }
      | undefined;
    let parentType: string | null = null;
    let parentParasutId: number | null = null;
    if (rel && rel.data && rel.data.id && rel.data.type) {
      if (rel.data.type === "sales_invoices") {
        parentType = "sales_invoices";
        linkedSalesInvoiceCount++;
      } else if (rel.data.type === "purchase_bills") {
        parentType = "purchase_bills";
        linkedPurchaseBillCount++;
      } else {
        // A real relationship pointing at a type this account has never
        // shown before -- preserve the real id/type, never guess it into
        // one of the two known buckets, never drop it.
        parentType = rel.data.type;
        unresolvedRelationshipCount++;
      }
      const parsedId = Number(rel.data.id);
      parentParasutId = Number.isFinite(parsedId) ? parsedId : null;
    } else {
      unlinkedCount++;
    }

    return {
      ...mapEInvoice(item, (parentType ?? "sales_invoices") as "sales_invoices" | "purchase_bills", parentParasutId ?? 0),
      // mapEInvoice always requires a non-null parentType/parentParasutId
      // (it is also used by the active-document path, which always has
      // one) -- override with the real values for this row, which may
      // genuinely be null. This is intentional: the standalone sync's own
      // row may have no parent at all, and that must be preserved as null.
      parent_type: parentType,
      parent_parasut_id: parentParasutId,
      // Phase 14.4: this call always requests include=invoice (see comment
      // above), so the `invoice` relationship is always genuinely carried
      // in this response -- a null here is real API evidence, never an
      // absence. Tells parasut.upsert_e_invoices_standalone() to write the
      // fresh value unconditionally (including null), never COALESCE it
      // away against a stale stored value.
      relationship_carried: true,
    };
  });

  let upsertedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  if (!dryRun) {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { data, error } = await db
        .schema("parasut")
        .rpc("upsert_e_invoices_standalone", { payload: batch as unknown as Record<string, unknown>[] });
      if (error) {
        errorCount += batch.length;
        errorMessages.push(`e_invoices (standalone rpc): ${error.message}`);
      } else {
        upsertedCount += (data as unknown as number) ?? batch.length;
      }
    }
  }

  return {
    dbFields: {
      fetched_count: fetchedCount,
      total_count_reported: result.totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedRelationshipCount,
      error_count: errorCount,
    },
    responseFields: {
      e_invoice_fetched_count: fetchedCount,
      e_invoice_upserted_count: dryRun ? 0 : upsertedCount,
      total_count_reported: result.totalCountReported,
      linked_sales_invoice_count: linkedSalesInvoiceCount,
      linked_purchase_bill_count: linkedPurchaseBillCount,
      unlinked_count: unlinkedCount,
      unresolved_relationship_count: unresolvedRelationshipCount,
      duplicate_count: duplicateCount,
      note: "GET /e_invoices with include=invoice -- global standalone universe, independent of the active-document sync inside sales_invoices/purchase_bills. Null relationship rows are stored with parent_type/parent_parasut_id = null and never guessed.",
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
 *
 * RESUMABLE, unlike every other resource here. Measured against the live
 * API (not assumed):
 *   - `page[size]` is hard-capped at 25 by Parasut -- 50 and 100 both come
 *     back 422 "Page size is too big. page[size] can be maximum 25". With
 *     3424 stock movements that is 137 mandatory sequential page requests.
 *   - Parasut rate-limits at 10 requests per 10s window: the 11th request
 *     in a window returns 429 with `x-ratelimit-limit: 10`,
 *     `x-ratelimit-remaining: 0` and `Retry-After: 8`, which fetchPage
 *     honours by sleeping.
 * So the wall-clock FLOOR for a single full pass is ~13 x 8s of forced
 * rate-limit sleeps (~104s) plus ~137 x ~0.25s of request latency (~35s)
 * = ~140s, before any upsert round-trips -- over the Edge Function's
 * ~150s wall-clock budget. The worker was being killed by the platform
 * mid-loop (the scheduler recorded HTTP 546 / WORKER_LIMIT for every
 * stock_movements step), and because a killed worker runs no catch and no
 * finally, finishRun() never executed and the parasut.sync_runs row was
 * orphaned at status='running' forever. This is exactly the
 * "chunking stock_movements across multiple invocations" follow-up that
 * 20260906194321_parasut_durable_scheduler.sql explicitly deferred.
 *
 * The fix: fetch pages under an explicit wall-clock budget, flushing each
 * page's rows to the mirror as it goes (so progress is durable even if the
 * pass is cut short), and record the page to resume from in
 * sync_runs.metadata.next_page. The next invocation picks up there. A
 * completed pass records next_page = null, so the following run starts
 * over at page 1 and re-observes the whole universe.
 *
 * `include=product,source,contact,warehouse` is REQUIRED and must not be
 * dropped as a "payload saving" optimisation, even though this syncer
 * never reads the `included` array. Verified against the live API: with
 * no include, Parasut returns every relationship as `{"meta":{}}` with no
 * `data` member at all, so mapStockMovement resolves every
 * product/warehouse/source/contact id to null. With the include, the same
 * record returns real `relationships.product.data.id` etc. The include is
 * what populates the relationship linkage, not just the sideload.
 */
const STOCK_MOVEMENTS_PAGE_SIZE = 25;
const STOCK_MOVEMENTS_INCLUDE = "product,source,contact,warehouse";
/** Leaves real headroom under the Edge Function's ~150s wall-clock limit
 * for token acquisition, the final upsert flush and finishRun. */
const STOCK_MOVEMENTS_BUDGET_MS = 100_000;

async function readStockMovementsResumePage(db: SupabaseClient): Promise<number> {
  const { data, error } = await db
    .schema("parasut")
    .from("sync_runs")
    .select("metadata")
    .eq("resource", "stock_movements")
    .not("finished_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A missing/unreadable cursor is never fatal -- it just means this pass
  // starts from the top, which is always correct (upserts are idempotent).
  if (error || !data) return 1;
  const next = (data.metadata as { next_page?: unknown } | null)?.next_page;
  return typeof next === "number" && Number.isFinite(next) && next > 1 ? Math.floor(next) : 1;
}

async function syncStockMovements(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  const startedAt = Date.now();
  const startPage = dryRun ? 1 : await readStockMovementsResumePage(db);

  let fetchedCount = 0;
  let upsertedCount = 0;
  let unresolvedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  let totalPages: number | null = null;
  let totalCountReported: number | null = null;
  let page = startPage;
  let lastCompletedPage = startPage - 1;

  while (true) {
    const result = await fetchPage(accessToken, "stock_movements", page, STOCK_MOVEMENTS_PAGE_SIZE, {
      include: STOCK_MOVEMENTS_INCLUDE,
    });

    if (result.meta?.total_pages != null) totalPages = result.meta.total_pages;
    if (result.meta?.total_count != null) totalCountReported = result.meta.total_count;

    const rows = result.items.map(mapStockMovement);
    fetchedCount += rows.length;
    unresolvedCount += rows.filter((r) => r.product_parasut_id == null || r.warehouse_parasut_id == null).length;

    if (!dryRun && rows.length > 0) {
      const upsertResult = await upsertBatched(db, "stock_movements", rows as unknown as Record<string, unknown>[]);
      upsertedCount += upsertResult.upsertedCount;
      errorCount += upsertResult.errorCount;
      errorMessages.push(...upsertResult.errorMessages);
      // Stop immediately on a real write error rather than burning the
      // rest of the budget repeating it -- the run reports error and the
      // cursor is not advanced past the failed page.
      if (upsertResult.errorCount > 0) break;
    }

    lastCompletedPage = page;

    if (result.items.length === 0) break;
    if (totalPages != null && page >= totalPages) break;
    if (totalPages == null && result.items.length < STOCK_MOVEMENTS_PAGE_SIZE) break;

    page += 1;

    if (Date.now() - startedAt > STOCK_MOVEMENTS_BUDGET_MS) break;
  }

  const completedFullPass = totalPages != null && lastCompletedPage >= totalPages && errorCount === 0;
  // null = "start over from page 1 next time"; a number = "resume here".
  const nextPage = errorCount > 0
    ? lastCompletedPage + 1
    : completedFullPass
    ? null
    : lastCompletedPage + 1;

  return {
    dbFields: {
      fetched_count: fetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      error_count: errorCount,
      metadata: {
        start_page: startPage,
        last_completed_page: lastCompletedPage,
        total_pages: totalPages,
        next_page: dryRun ? null : nextPage,
        completed_full_pass: completedFullPass,
        page_size: STOCK_MOVEMENTS_PAGE_SIZE,
      },
    },
    responseFields: {
      total_fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      unresolved_count: unresolvedCount,
      total_count_reported: totalCountReported,
      start_page: startPage,
      last_completed_page: lastCompletedPage,
      total_pages: totalPages,
      next_page: dryRun ? null : nextPage,
      completed_full_pass: completedFullPass,
      note: completedFullPass
        ? "Full stock_movements pass completed in this invocation."
        : "Partial stock_movements pass -- Parasut caps page[size] at 25 and rate-limits at 10 req/10s, so a full 137-page pass exceeds the Edge Function wall-clock budget. Progress is durable; the next invocation resumes at next_page.",
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
  const cors = corsHeaders(req.headers.get("origin"));

  // Preflight must succeed before any body parsing or auth/Parasut work --
  // browsers never attach cookies/tokens to it and expect a fast 204.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  // Phase 14.7: this function is deployed with verify_jwt = true, so the
  // Supabase gateway already rejects any request with no/malformed
  // Authorization header (401) before this code runs. That signature check
  // only proves the token was issued by this project -- it does not mean
  // the caller is allowed to trigger a write sync. Authentication and
  // authorization are deliberately separated here: this product has no
  // login-gated sync feature (the public button is read-only and never
  // calls this function), so the ONLY authorized caller is whoever holds
  // the service_role key -- the scheduled orchestrator (key read from
  // Supabase Vault, server-side only) or someone with dashboard/CLI
  // access. A real, successfully-authenticated Supabase user session is
  // NOT sufficient on its own and is explicitly rejected with 403 --
  // getUser() succeeding only proves *who* the caller is, never that they
  // are allowed to run this.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return jsonResponse({ error: "Missing authorization header" }, 401, cors);
  }

  let role: string | undefined;
  try {
    const payloadSegment = token.split(".")[1];
    const payload = JSON.parse(atob(payloadSegment.replace(/-/g, "+").replace(/_/g, "/")));
    role = typeof payload?.role === "string" ? payload.role : undefined;
  } catch {
    return jsonResponse({ error: "Malformed authorization token" }, 401, cors);
  }

  if (role !== "service_role") {
    return jsonResponse(
      { error: "Bu işlem yalnızca sunucu tarafı zamanlanmış senkronizasyon tarafından çalıştırılabilir." },
      403,
      cors,
    );
  }

  let body: { resource?: string; dry_run?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  const resource = body.resource as Resource;
  if (!resource || !SUPPORTED_RESOURCES.includes(resource)) {
    return jsonResponse(
      { error: `resource must be one of: ${SUPPORTED_RESOURCES.join(", ")}` },
      400,
      cors,
    );
  }
  const dryRun = body.dry_run === true;

  const db = serviceClient();

  // Phase 13.4: defensive, best-effort self-heal for any sync_runs row
  // stuck at status='running' for more than 10 minutes (e.g. a prior
  // invocation whose finishRun failed AND whose own best-effort recovery
  // also failed -- total DB unavailability at that moment). Never blocks
  // or fails this request if the RPC itself errors; the per-resource lock
  // simply stays whatever it already was.
  try {
    await db.schema("parasut").rpc("cleanup_stale_sync_locks");
  } catch (cleanupErr) {
    console.error(`cleanup_stale_sync_locks best-effort call failed: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`);
  }

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
      return jsonResponse({ error: `A sync for "${resource}" is already running` }, 409, cors);
    }
    return jsonResponse({ error: `Failed to start sync run: ${lockError.message}` }, 500, cors);
  }

  const runId = runRow.id as string;

  // Phase 13.3 bug fix (insufficient -- corrected in Phase 13.4): this
  // update's error was previously only console.error'd. A status value
  // the sync_runs CHECK constraint rejects (this actually happened for
  // "lookup_required" before the constraint was widened) silently left
  // the row stuck at status='running' forever, permanently holding the
  // one-run-per-resource lock, WHILE the HTTP caller still received a
  // 200 success response (finishRun's failure was invisible to the
  // response path). Phase 13.4 fix: finishRun now THROWS on failure so
  // the caller can never build a success response on top of a failed
  // finalize; every call site below wraps it explicitly.
  const finishRun = async (patch: Record<string, unknown>) => {
    // Phase 13.5 fix: Supabase does NOT treat a 0-matching-row update as
    // an error -- `.update(...).eq("id", runId)` with no matching row
    // returns `{ error: null, data: [] }`, which the previous
    // `if (error)` check alone could never catch. That would let a run
    // whose id row had already been deleted/renumbered finalize
    // "successfully" while sync_runs itself was never actually updated
    // (silently stuck, exactly the failure mode this function exists to
    // prevent). `.select("id")` forces the real updated row set back so
    // it can be verified with a genuine row count, not just the absence
    // of a Postgres error.
    const { data, error } = await db
      .schema("parasut")
      .from("sync_runs")
      .update({ finished_at: new Date().toISOString(), ...patch })
      .eq("id", runId)
      .select("id");
    if (error) {
      console.error(`finishRun failed to update sync_runs id=${runId}: ${error.message}`);
      throw new Error(`finishRun update failed for sync_runs id=${runId}: ${error.message}`);
    }
    if (!data || data.length === 0) {
      console.error(`finishRun: 0 rows matched for sync_runs id=${runId} (row missing or already finalized)`);
      throw new Error(`finishRun matched 0 rows for sync_runs id=${runId}`);
    }
  };

  // Best-effort finalize used only on paths that are ALREADY reporting
  // failure to the caller (error_count>0 branch, outer catch block).
  // Never throws -- a secondary finalize failure on an already-failing
  // run must not mask or replace the original error response; the
  // stale-lock cleanup migration recovers the row after its timeout if
  // even this best-effort update fails.
  const finishRunBestEffort = async (patch: Record<string, unknown>) => {
    try {
      await finishRun(patch);
    } catch (finishErr) {
      const msg = finishErr instanceof Error ? finishErr.message : String(finishErr);
      console.error(`finishRunBestEffort: secondary finalize failure for id=${runId}: ${msg}`);
    }
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
      employees: syncEmployees,
      me: syncMe,
      salaries: syncSalaries,
      taxes: syncTaxes,
      tags: syncTags,
      e_invoice_inboxes: syncEInvoiceInboxes,
      e_invoices: syncEInvoicesStandalone,
    };
    const result = await syncers[resource](db, accessToken, dryRun);

    if (result.errorCount > 0) {
      await finishRunBestEffort({
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
        cors,
      );
    }

    // Phase 13.3 fix: a syncer (e_invoice_inboxes) may return its own
    // dbFields.status (e.g. "lookup_required") that must win over the
    // generic dry_run/success default -- never silently overwritten back
    // to "success", which would misreport a blocked lookup as a
    // successful global sync in sync_runs.
    const defaultStatus = dryRun ? "dry_run" : "success";
    const runStatus = (result.dbFields as { status?: string }).status ?? defaultStatus;

    // Phase 13.4 fix: finishRun can throw here even though the fetch +
    // upsert already succeeded (e.g. a rejected sync_runs status value,
    // a transient DB error on the UPDATE). A genuinely-successful fetch
    // followed by a failed finalize must produce an overall FAIL result
    // -- never a 200 success response -- and must never leave the row
    // stuck at status='running' forever holding the per-resource lock.
    try {
      await finishRun({
        ...result.dbFields,
        status: runStatus,
      });
    } catch (finishErr) {
      const finishMessage = finishErr instanceof Error ? finishErr.message : String(finishErr);
      // Best-effort recovery: try once more with a minimal, constraint-safe
      // patch so the lock is released even if the original patch's shape
      // was what caused the failure. Never lets a secondary failure here
      // change the response back to success.
      await finishRunBestEffort({
        status: "error",
        error_message: `finalize failed after successful fetch: ${finishMessage}`.slice(0, 2000),
      });
      return jsonResponse(
        {
          resource,
          dry_run: dryRun,
          status: "error",
          error_message: `Sync fetch/upsert succeeded but finalize failed: ${finishMessage}`,
          ...result.responseFields,
        },
        502,
        cors,
      );
    }

    return jsonResponse(
      {
        resource,
        dry_run: dryRun,
        ...result.responseFields,
        status: runStatus,
        error_count: 0,
      },
      200,
      cors,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRunBestEffort({
      status: "error",
      error_message: message.slice(0, 2000),
    });
    return jsonResponse({ resource, dry_run: dryRun, status: "error", error_message: message }, 502, cors);
  }
});
