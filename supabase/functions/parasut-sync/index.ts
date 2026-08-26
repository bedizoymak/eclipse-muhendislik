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
import { fetchAllPages, getAccessToken, type JsonApiResource } from "./parasut_client.ts";
import { mapContact } from "./resources/contacts.ts";
import { detailIdsForInvoice, mapSalesInvoice, mapSalesInvoiceDetail } from "./resources/sales_invoices.ts";

const SUPPORTED_RESOURCES = ["contacts", "sales_invoices"] as const;
type Resource = (typeof SUPPORTED_RESOURCES)[number];

const BATCH_SIZE = 200;
const ARCHIVED_FILTER_PARAM = "filter[archived]";

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

async function syncSalesInvoices(db: SupabaseClient, accessToken: string, dryRun: boolean) {
  // Verified against the live API (not the swagger doc, which incorrectly
  // lists details.warehouse as acceptable here and gets a 400 rejecting it):
  // valid includes for this endpoint are category, contact, contact.company,
  // details, details.product, payments, payments.transaction(.pos_transaction_info),
  // tags, refunds, refund_of, sharings, recurrence_plan, active_e_document,
  // failed_e_invoice.
  const { active, archived } = await fetchActiveAndArchived(accessToken, "sales_invoices", {
    include: "details,details.product,contact",
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

  return {
    dbFields: {
      fetched_count: invoiceFetchedCount,
      active_fetched_count: invoiceActiveFetchedCount,
      archived_fetched_count: invoiceArchivedFetchedCount,
      total_count_reported: totalCountReported,
      upserted_count: dryRun ? 0 : invoiceUpsertedCount,
      detail_fetched_count: detailFetchedCount,
      detail_upserted_count: dryRun ? 0 : detailUpsertedCount,
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

    const result =
      resource === "contacts"
        ? await syncContacts(db, accessToken, dryRun)
        : await syncSalesInvoices(db, accessToken, dryRun);

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
