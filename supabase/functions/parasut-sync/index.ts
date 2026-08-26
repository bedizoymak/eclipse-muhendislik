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
import { mapAccount } from "./resources/accounts.ts";
import { mapPayment, paymentIdsForInvoice } from "./resources/payments.ts";
import { mapTransaction } from "./resources/transactions.ts";
import { detailIdsForBill, mapPurchaseBill, mapPurchaseBillDetail } from "./resources/purchase_bills.ts";

const SUPPORTED_RESOURCES = [
  "contacts",
  "sales_invoices",
  "accounts",
  "payments",
  "transactions",
  "purchase_bills",
  "expense_payments",
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
    include: "supplier,spender,pay_to,details,details.product",
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

  return {
    dbFields: {
      fetched_count: fetchedCount,
      active_fetched_count: activeFetchedCount,
      archived_fetched_count: archivedFetchedCount,
      total_count_reported: result.totalCountReported,
      upserted_count: dryRun ? 0 : billUpsertedCount,
      detail_fetched_count: detailFetchedCount,
      detail_upserted_count: dryRun ? 0 : detailUpsertedCount,
      unresolved_count: supplierUnresolvedCount,
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
