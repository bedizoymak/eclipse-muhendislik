// Phase 15 domain 2 -- sales. Public read function backing
// /satislar/faturalar(/:id), /satislar/teklifler(/:id),
// /satislar/tahsilatlar(/:id). Actions: invoices.list, invoices.get,
// invoices.counts, offers.list, offers.get, offers.counts, payments.list,
// payments.get, payments.counts.
//
// Phase 15.1: migrated off the `public.parasut_*_demo` views onto the
// `parasut.*` base tables (see the design note at the top of
// ../_shared/query.ts). Seven views were in play here:
//
//   * parasut_sales_invoice_counts_demo -- ELEVEN counters, each its own
//     named bucket, and (per the view's own COMMENT) no counter may ever be
//     derived by subtracting or summing another. All eleven are replicated
//     as separate exact head counts below, in the view's order. Two notes:
//       - `IS DISTINCT FROM 'cancelled'` must include NULL item_types, so
//         it becomes `item_type.is.null,item_type.neq.cancelled` -- a plain
//         `.neq()` would silently drop every NULL row.
//       - `count(DISTINCT parasut_id) AS total_unique_count` is replicated
//         from the same exact total count. That is an identity, not a
//         shortcut: parasut.sales_invoices declares
//         `parasut_id bigint NOT NULL` with a UNIQUE(parasut_id)
//         constraint, so count(DISTINCT parasut_id) = count(*) always. The
//         counter keeps its own name in the response and is NOT dropped.
//
//   * parasut_sales_invoices_demo -- sales_invoices LEFT JOIN contacts for
//     `contact_name`, ORDER BY issue_date DESC NULLS LAST. Every filter
//     (archived, payment_status, item_type, exclude_cancelled) and every
//     sortable column lives on the PARENT table, so this uses the cheap
//     parent-page-then-merge pattern with `count` from the parent query.
//
//   * parasut_sales_invoice_details_demo / parasut_sales_offer_details_demo
//     -- line items LEFT JOIN products for `product_name`. Both are only
//     ever read for ONE parent, so their leading ORDER BY key is constant
//     and the ordering collapses to `parasut_id` (invoices) and
//     `detail_no, parasut_id` (offers). Both calls previously passed no
//     `.order()` and inherited the view's, so both are now explicit.
//
//   * parasut_sales_offers_demo -- sales_offers LEFT JOIN contacts
//     (contact_name) LEFT JOIN sales_invoices (sales_invoice_no). Same
//     parent-page-then-merge shape.
//
//   * parasut_sales_offer_activities_demo -- a plain passthrough of
//     parasut.sales_offer_activities with
//     ORDER BY sales_offer_parasut_id, date DESC NULLS LAST; read for one
//     offer, so that collapses to `date DESC NULLS LAST`, now explicit.
//
//   * parasut_payments_demo -- the five-way chain
//     payments -> sales_invoices -> contacts and payments -> transactions
//     -> accounts (debit and credit). UNLIKE `cash` (see the header note in
//     ../cash/index.ts), this domain's allow-lists DO select the joined
//     columns -- payments.list needs invoice_no / contact_parasut_id /
//     contact_name / debit_account_name / credit_account_name, and
//     payments.get additionally needs transaction_description /
//     transaction_type / debit_account_parasut_id / debit_account_type /
//     credit_account_parasut_id / credit_account_type. So `sales` is where
//     the real join is written; treating it as a passthrough here would
//     silently blank six-to-twelve fields per row. Two gates are reproduced
//     literally:
//       - `si` joins ONLY when payable_type = 'sales_invoices'; a payment
//         against a purchase_bill or a check therefore resolves invoice_no,
//         contact_parasut_id and contact_name to null (and the view has NO
//         outer WHERE, so those payments are still returned).
//       - `da`/`ca` join ONLY when the corresponding
//         `*_account_type = 'accounts'`.
//     `contact_parasut_id` comes from the joined sales_invoice, not from
//     parasut.payments. The view's ORDER BY date DESC NULLS LAST was
//     overridden by this function's own sort and stays overridden.
//
// Every join is a LEFT join: the parent row is spread first, an unmatched
// lookup leaves the resolved field literally `null`, and no parent row is
// ever filtered out (that would shrink `count` and break pagination).
// Response envelope, field allow-lists, filters, pagination and sort
// behaviour are unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { scheduleDomainFreshness } from "../_shared/freshness.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "parasut";

// PARENT (base-table) column subsets. The joined columns (contact_name,
// product_name, sales_invoice_no, invoice_no, transaction_*, *_account_name)
// are resolved separately and re-assembled in the merge steps below, whose
// object literals are byte-for-byte the pre-migration allow-lists.
const INVOICE_LIST_BASE_COLUMNS =
  "parasut_id, invoice_no, item_type, issue_date, due_date, currency, net_total, gross_total, total_vat, remaining, payment_status, archived, contact_parasut_id, active_e_document_type";
const INVOICE_DETAIL_BASE_COLUMNS =
  "parasut_id, invoice_no, item_type, description, issue_date, due_date, currency, exchange_rate, net_total, gross_total, total_vat, total_discount, before_taxes_total, remaining, remaining_in_trl, payment_status, billing_address, billing_postal_code, billing_phone, tax_office, tax_number, country, city, district, is_abroad, order_no, order_date, invoice_note, archived, contact_parasut_id, synced_at, active_e_document_type, active_e_document_parasut_id";
const INVOICE_DETAIL_LINE_BASE_COLUMNS =
  "parasut_id, description, quantity, unit_price, vat_rate, discount_type, discount_value, net_total, product_parasut_id";

const OFFER_LIST_BASE_COLUMNS =
  "parasut_id, description, status, issue_date, due_date, currency, net_total, gross_total, total_vat, archived, contact_parasut_id";
const OFFER_DETAIL_BASE_COLUMNS =
  "parasut_id, description, content, status, issue_date, due_date, currency, exchange_rate, net_total, net_total_in_trl, gross_total, total_vat, total_discount, total_invoice_discount, invoice_discount_type, invoice_discount, withholding, withholding_rate, vat_withholding, vat_withholding_rate, total_vat_withholding, total_excise_duty, total_communications_tax, total_accommodation_tax, billing_address, billing_phone, billing_fax, tax_office, tax_number, city, district, is_abroad, order_no, order_date, sharings_count, display_exchange_rate_in_pdf, contact_type, archived, contact_parasut_id, sales_invoice_parasut_id, parasut_created_at, parasut_updated_at, synced_at";
const OFFER_DETAIL_LINE_BASE_COLUMNS =
  "parasut_id, sales_offer_parasut_id, description, detail_no, quantity, unit_price, vat_rate, vat_withholding, vat_withholding_rate, discount_type, discount_value, discount, invoice_discount, excise_duty_type, excise_duty, excise_duty_rate, excise_duty_value, communications_tax_rate, communications_tax, accommodation_tax_rate, accommodation_tax, accommodation_tax_exempt, net_total, net_total_without_invoice_discount, product_parasut_id, parasut_created_at, parasut_updated_at, synced_at";
// A plain passthrough -- unchanged from the pre-migration allow-list.
const OFFER_ACTIVITY_COLUMNS =
  "parasut_id, sales_offer_parasut_id, activity_type, date, data_description, data_issue_date, data_due_date, data_net_total, data_currency, data_content, data_status, data_contact_id, data_contact_name, done_by_email, done_by_parasut_id, done_by_type, done_by_name, done_by_user_email, item_parasut_id, item_type, parasut_created_at, parasut_updated_at, synced_at";

const PAYMENT_LIST_BASE_COLUMNS =
  "parasut_id, date, amount, currency, notes, payable_type, payable_parasut_id, transaction_parasut_id";
const PAYMENT_DETAIL_BASE_COLUMNS =
  "parasut_id, date, amount, currency, notes, payable_type, payable_parasut_id, transaction_parasut_id, synced_at, due_date, matched_amount, amount_in_trl, paid_in_currency";
const TRANSACTION_COLUMNS =
  "parasut_id, description, transaction_type, debit_account_parasut_id, debit_account_type, credit_account_parasut_id, credit_account_type";

const INVOICE_SORT = ["issue_date", "due_date", "net_total", "invoice_no"] as const;
const OFFER_SORT = ["issue_date", "due_date", "net_total"] as const;
const PAYMENT_SORT = ["date", "amount"] as const;

type Row = Record<string, unknown>;
type Res<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Resolves `parasut_id -> row` for a lookup table, restricted to the ids
 * actually present on the page being merged. */
async function loadLookupByIds(
  db: SupabaseClient,
  table: string,
  columns: string,
  ids: unknown[],
): Promise<Res<Map<unknown, Row>>> {
  if (ids.length === 0) return { ok: true, value: new Map() };
  const { data, error } = await db.schema(SCHEMA).from(table).select(columns).in("parasut_id", ids);
  if (error) return { ok: false, error };
  // A non-literal `.select(columns)` string types rows as
  // `GenericStringError`, which a direct `as Row[]` cast rejects as
  // non-overlapping -- go through `unknown` first.
  const rows = (data ?? []) as unknown as Row[];
  return { ok: true, value: new Map(rows.map((r) => [r["parasut_id"], r])) };
}

/** Distinct non-null values of `column` across `rows`. */
function idsOf(rows: Row[], column: string): unknown[] {
  return [...new Set(rows.map((r) => r[column]).filter((v) => v != null))];
}

/** Distinct non-null values of `column`, but only on rows whose `typeColumn`
 * equals `typeValue` -- exactly the view's
 * `ON (x.type = '...' AND lookup.parasut_id = x.id)` gate. */
function gatedIds(rows: Row[], column: string, typeColumn: string, typeValue: string): unknown[] {
  return [
    ...new Set(rows.filter((r) => r[typeColumn] === typeValue).map((r) => r[column]).filter((v) => v != null)),
  ];
}

/** LEFT JOIN field resolution: unmatched -> null, matched-but-null -> null. */
function fieldOf(lookup: Map<unknown, Row>, id: unknown, column: string): unknown {
  if (id == null) return null;
  return lookup.get(id)?.[column] ?? null;
}

function buildDateRange(body: Record<string, unknown> | null, column: string) {
  const gte = body?.["dateFrom"];
  const lte = body?.["dateTo"];
  if (typeof gte !== "string" && typeof lte !== "string") return undefined;
  return { column, gte: typeof gte === "string" ? gte : undefined, lte: typeof lte === "string" ? lte : undefined };
}

/** The parasut_payments_demo join tail shared by payments.list/get:
 * payments -> sales_invoices -> contacts, and
 * payments -> transactions -> accounts (debit + credit). */
interface PaymentJoins {
  invoices: Map<unknown, Row>;
  contacts: Map<unknown, Row>;
  tx: Map<unknown, Row>;
  debit: Map<unknown, Row>;
  credit: Map<unknown, Row>;
}

async function loadPaymentJoins(db: SupabaseClient, payments: Row[]): Promise<Res<PaymentJoins>> {
  const [invoicesRes, txRes] = await Promise.all([
    // `si` is gated on payable_type = 'sales_invoices'.
    loadLookupByIds(
      db,
      "sales_invoices",
      "parasut_id, invoice_no, contact_parasut_id",
      gatedIds(payments, "payable_parasut_id", "payable_type", "sales_invoices"),
    ),
    loadLookupByIds(db, "transactions", TRANSACTION_COLUMNS, idsOf(payments, "transaction_parasut_id")),
  ]);
  if (!invoicesRes.ok) return invoicesRes;
  if (!txRes.ok) return txRes;

  const txRows = [...txRes.value.values()];
  const [contactsRes, debitRes, creditRes] = await Promise.all([
    loadLookupByIds(db, "contacts", "parasut_id, name", idsOf([...invoicesRes.value.values()], "contact_parasut_id")),
    loadLookupByIds(db, "accounts", "parasut_id, name", gatedIds(txRows, "debit_account_parasut_id", "debit_account_type", "accounts")),
    loadLookupByIds(db, "accounts", "parasut_id, name", gatedIds(txRows, "credit_account_parasut_id", "credit_account_type", "accounts")),
  ]);
  if (!contactsRes.ok) return contactsRes;
  if (!debitRes.ok) return debitRes;
  if (!creditRes.ok) return creditRes;

  return {
    ok: true,
    value: {
      invoices: invoicesRes.value,
      contacts: contactsRes.value,
      tx: txRes.value,
      debit: debitRes.value,
      credit: creditRes.value,
    },
  };
}

/** The `si`-side fields, honouring the payable_type gate. */
function invoiceOf(j: PaymentJoins, p: Row): Row | undefined {
  if (p["payable_type"] !== "sales_invoices") return undefined;
  const id = p["payable_parasut_id"];
  return id == null ? undefined : j.invoices.get(id);
}

/** The gated account name for one side of a payment's transaction. */
function accountName(tx: Row | undefined, lookup: Map<unknown, Row>, idColumn: string, typeColumn: string): unknown {
  if (!tx) return null;
  if (tx[typeColumn] !== "accounts") return null;
  return fieldOf(lookup, tx[idColumn], "name");
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
  scheduleDomainFreshness(db, "sales");

  try {
    switch (action) {
      case "invoices.counts": {
        const inv = () => db.schema(SCHEMA).from("sales_invoices").select("parasut_id", { count: "exact", head: true });
        // `IS DISTINCT FROM 'cancelled'` == NULL OR <> 'cancelled'.
        const NOT_CANCELLED = "item_type.is.null,item_type.neq.cancelled";
        const [
          listActive,
          archived,
          nullArchived,
          cancelled,
          archivedCancelled,
          nonCancelledArchived,
          invoiceItemType,
          otherItemType,
          nullItemType,
          total,
        ] = await Promise.all([
          inv().eq("archived", false).or(NOT_CANCELLED),
          inv().eq("archived", true),
          inv().is("archived", null),
          inv().eq("item_type", "cancelled"),
          inv().eq("archived", true).eq("item_type", "cancelled"),
          inv().eq("archived", true).or(NOT_CANCELLED),
          inv().eq("item_type", "invoice"),
          inv().not("item_type", "is", null).not("item_type", "in", "(invoice,cancelled)"),
          inv().is("item_type", null),
          inv(),
        ]);
        const err = listActive.error ?? archived.error ?? nullArchived.error ?? cancelled.error ??
          archivedCancelled.error ?? nonCancelledArchived.error ?? invoiceItemType.error ??
          otherItemType.error ?? nullItemType.error ?? total.error;
        if (err) return errorResponse("internal_error", cors, err);
        const totalCount = total.count ?? 0;
        return jsonResponse({
          data: {
            list_active_count: listActive.count ?? 0,
            archived_count: archived.count ?? 0,
            null_archived_count: nullArchived.count ?? 0,
            cancelled_count: cancelled.count ?? 0,
            archived_cancelled_count: archivedCancelled.count ?? 0,
            non_cancelled_archived_count: nonCancelledArchived.count ?? 0,
            invoice_item_type_count: invoiceItemType.count ?? 0,
            other_item_type_count: otherItemType.count ?? 0,
            null_item_type_count: nullItemType.count ?? 0,
            // See the header note: parasut_id is NOT NULL + UNIQUE, so
            // count(DISTINCT parasut_id) is identically count(*).
            total_unique_count: totalCount,
            total_count: totalCount,
          },
        }, 200, cors);
      }
      case "invoices.list": {
        const parsed = parseListParams(body, INVOICE_SORT, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        let query = db.schema(SCHEMA).from("sales_invoices").select(INVOICE_LIST_BASE_COLUMNS, { count: "exact" });
        if (typeof body?.["archived"] === "boolean") query = query.eq("archived", body["archived"] as boolean);
        if (typeof body?.["payment_status"] === "string") query = query.eq("payment_status", body["payment_status"] as string);
        if (typeof body?.["item_type"] === "string") query = query.eq("item_type", body["item_type"] as string);
        if (body?.["exclude_cancelled"] === true) query = query.neq("item_type", "cancelled");
        const range = buildDateRange(body, "issue_date");
        if (range?.gte) query = query.gte(range.column, range.gte);
        if (range?.lte) query = query.lte(range.column, range.lte);
        if (parsed.sort) query = query.order(parsed.sort.column, { ascending: parsed.sort.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);
        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        const page = (data ?? []) as Row[];

        const contacts = await loadLookupByIds(db, "contacts", "parasut_id, name", idsOf(page, "contact_parasut_id"));
        if (!contacts.ok) return errorResponse("internal_error", cors, contacts.error);

        const merged = page.map((si) => ({
          parasut_id: si["parasut_id"],
          invoice_no: si["invoice_no"] ?? null,
          item_type: si["item_type"] ?? null,
          issue_date: si["issue_date"] ?? null,
          due_date: si["due_date"] ?? null,
          currency: si["currency"] ?? null,
          net_total: si["net_total"] ?? null,
          gross_total: si["gross_total"] ?? null,
          total_vat: si["total_vat"] ?? null,
          remaining: si["remaining"] ?? null,
          payment_status: si["payment_status"] ?? null,
          archived: si["archived"] ?? null,
          contact_parasut_id: si["contact_parasut_id"] ?? null,
          contact_name: fieldOf(contacts.value, si["contact_parasut_id"], "name"),
          active_e_document_type: si["active_e_document_type"] ?? null,
        } as Row));

        return jsonResponse({ data: merged, count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }
      case "invoices.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const { data: invoiceRow, error: invoiceError } = await db
          .schema(SCHEMA)
          .from("sales_invoices")
          .select(INVOICE_DETAIL_BASE_COLUMNS)
          .eq("parasut_id", id)
          .maybeSingle();
        if (invoiceError) return errorResponse("internal_error", cors, invoiceError);
        if (!invoiceRow) return errorResponse("not_found", cors);
        const si = invoiceRow as Row;

        // Line items: the retired view's
        // ORDER BY sales_invoice_parasut_id, parasut_id collapses to
        // parasut_id here because the invoice is fixed.
        const [contacts, detailsRes] = await Promise.all([
          loadLookupByIds(db, "contacts", "parasut_id, name", idsOf([si], "contact_parasut_id")),
          db.schema(SCHEMA).from("sales_invoice_details").select(INVOICE_DETAIL_LINE_BASE_COLUMNS)
            .eq("sales_invoice_parasut_id", id).order("parasut_id", { ascending: true }),
        ]);
        if (!contacts.ok) return errorResponse("internal_error", cors, contacts.error);
        if (detailsRes.error) return errorResponse("internal_error", cors, detailsRes.error);
        const detailRows = (detailsRes.data ?? []) as unknown as Row[];

        const products = await loadLookupByIds(db, "products", "parasut_id, name", idsOf(detailRows, "product_parasut_id"));
        if (!products.ok) return errorResponse("internal_error", cors, products.error);

        const invoice = {
          parasut_id: si["parasut_id"],
          invoice_no: si["invoice_no"] ?? null,
          item_type: si["item_type"] ?? null,
          description: si["description"] ?? null,
          issue_date: si["issue_date"] ?? null,
          due_date: si["due_date"] ?? null,
          currency: si["currency"] ?? null,
          exchange_rate: si["exchange_rate"] ?? null,
          net_total: si["net_total"] ?? null,
          gross_total: si["gross_total"] ?? null,
          total_vat: si["total_vat"] ?? null,
          total_discount: si["total_discount"] ?? null,
          before_taxes_total: si["before_taxes_total"] ?? null,
          remaining: si["remaining"] ?? null,
          remaining_in_trl: si["remaining_in_trl"] ?? null,
          payment_status: si["payment_status"] ?? null,
          billing_address: si["billing_address"] ?? null,
          billing_postal_code: si["billing_postal_code"] ?? null,
          billing_phone: si["billing_phone"] ?? null,
          tax_office: si["tax_office"] ?? null,
          tax_number: si["tax_number"] ?? null,
          country: si["country"] ?? null,
          city: si["city"] ?? null,
          district: si["district"] ?? null,
          is_abroad: si["is_abroad"] ?? null,
          order_no: si["order_no"] ?? null,
          order_date: si["order_date"] ?? null,
          invoice_note: si["invoice_note"] ?? null,
          archived: si["archived"] ?? null,
          contact_parasut_id: si["contact_parasut_id"] ?? null,
          contact_name: fieldOf(contacts.value, si["contact_parasut_id"], "name"),
          synced_at: si["synced_at"] ?? null,
          active_e_document_type: si["active_e_document_type"] ?? null,
          active_e_document_parasut_id: si["active_e_document_parasut_id"] ?? null,
        };

        const details = detailRows.map((d) => ({
          parasut_id: d["parasut_id"],
          description: d["description"] ?? null,
          quantity: d["quantity"] ?? null,
          unit_price: d["unit_price"] ?? null,
          vat_rate: d["vat_rate"] ?? null,
          discount_type: d["discount_type"] ?? null,
          discount_value: d["discount_value"] ?? null,
          net_total: d["net_total"] ?? null,
          product_parasut_id: d["product_parasut_id"] ?? null,
          product_name: fieldOf(products.value, d["product_parasut_id"], "name"),
        } as Row));

        return jsonResponse({ data: { ...invoice, details } }, 200, cors);
      }

      case "offers.counts": {
        const offers = () => db.schema(SCHEMA).from("sales_offers").select("parasut_id", { count: "exact", head: true });
        const [activeRes, archivedRes, allRes] = await Promise.all([
          offers().eq("archived", false),
          offers().eq("archived", true),
          offers(),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? allRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse({ data: { active: activeRes.count ?? 0, archived: archivedRes.count ?? 0, all: allRes.count ?? 0 } }, 200, cors);
      }
      case "offers.list": {
        const parsed = parseListParams(body, OFFER_SORT, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        let query = db.schema(SCHEMA).from("sales_offers").select(OFFER_LIST_BASE_COLUMNS, { count: "exact" });
        if (typeof body?.["archived"] === "boolean") query = query.eq("archived", body["archived"] as boolean);
        const range = buildDateRange(body, "issue_date");
        if (range?.gte) query = query.gte(range.column, range.gte);
        if (range?.lte) query = query.lte(range.column, range.lte);
        if (parsed.sort) query = query.order(parsed.sort.column, { ascending: parsed.sort.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);
        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        const page = (data ?? []) as Row[];

        const contacts = await loadLookupByIds(db, "contacts", "parasut_id, name", idsOf(page, "contact_parasut_id"));
        if (!contacts.ok) return errorResponse("internal_error", cors, contacts.error);

        const merged = page.map((o) => ({
          parasut_id: o["parasut_id"],
          description: o["description"] ?? null,
          status: o["status"] ?? null,
          issue_date: o["issue_date"] ?? null,
          due_date: o["due_date"] ?? null,
          currency: o["currency"] ?? null,
          net_total: o["net_total"] ?? null,
          gross_total: o["gross_total"] ?? null,
          total_vat: o["total_vat"] ?? null,
          archived: o["archived"] ?? null,
          contact_parasut_id: o["contact_parasut_id"] ?? null,
          contact_name: fieldOf(contacts.value, o["contact_parasut_id"], "name"),
        } as Row));

        return jsonResponse({ data: merged, count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }
      case "offers.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const { data: offerRow, error: offerError } = await db
          .schema(SCHEMA)
          .from("sales_offers")
          .select(OFFER_DETAIL_BASE_COLUMNS)
          .eq("parasut_id", id)
          .maybeSingle();
        if (offerError) return errorResponse("internal_error", cors, offerError);
        if (!offerRow) return errorResponse("not_found", cors);
        const o = offerRow as Row;

        const [contacts, invoices, detailsRes, activitiesRes] = await Promise.all([
          loadLookupByIds(db, "contacts", "parasut_id, name", idsOf([o], "contact_parasut_id")),
          loadLookupByIds(db, "sales_invoices", "parasut_id, invoice_no", idsOf([o], "sales_invoice_parasut_id")),
          // ORDER BY sales_offer_parasut_id, detail_no, parasut_id, with the
          // offer fixed.
          db.schema(SCHEMA).from("sales_offer_details").select(OFFER_DETAIL_LINE_BASE_COLUMNS)
            .eq("sales_offer_parasut_id", id)
            .order("detail_no", { ascending: true })
            .order("parasut_id", { ascending: true }),
          // ORDER BY sales_offer_parasut_id, date DESC NULLS LAST.
          db.schema(SCHEMA).from("sales_offer_activities").select(OFFER_ACTIVITY_COLUMNS)
            .eq("sales_offer_parasut_id", id)
            .order("date", { ascending: false, nullsFirst: false }),
        ]);
        if (!contacts.ok) return errorResponse("internal_error", cors, contacts.error);
        if (!invoices.ok) return errorResponse("internal_error", cors, invoices.error);
        if (detailsRes.error) return errorResponse("internal_error", cors, detailsRes.error);
        if (activitiesRes.error) return errorResponse("internal_error", cors, activitiesRes.error);
        const detailRows = (detailsRes.data ?? []) as unknown as Row[];

        const products = await loadLookupByIds(db, "products", "parasut_id, name", idsOf(detailRows, "product_parasut_id"));
        if (!products.ok) return errorResponse("internal_error", cors, products.error);

        const offer = {
          parasut_id: o["parasut_id"],
          description: o["description"] ?? null,
          content: o["content"] ?? null,
          status: o["status"] ?? null,
          issue_date: o["issue_date"] ?? null,
          due_date: o["due_date"] ?? null,
          currency: o["currency"] ?? null,
          exchange_rate: o["exchange_rate"] ?? null,
          net_total: o["net_total"] ?? null,
          net_total_in_trl: o["net_total_in_trl"] ?? null,
          gross_total: o["gross_total"] ?? null,
          total_vat: o["total_vat"] ?? null,
          total_discount: o["total_discount"] ?? null,
          total_invoice_discount: o["total_invoice_discount"] ?? null,
          invoice_discount_type: o["invoice_discount_type"] ?? null,
          invoice_discount: o["invoice_discount"] ?? null,
          withholding: o["withholding"] ?? null,
          withholding_rate: o["withholding_rate"] ?? null,
          vat_withholding: o["vat_withholding"] ?? null,
          vat_withholding_rate: o["vat_withholding_rate"] ?? null,
          total_vat_withholding: o["total_vat_withholding"] ?? null,
          total_excise_duty: o["total_excise_duty"] ?? null,
          total_communications_tax: o["total_communications_tax"] ?? null,
          total_accommodation_tax: o["total_accommodation_tax"] ?? null,
          billing_address: o["billing_address"] ?? null,
          billing_phone: o["billing_phone"] ?? null,
          billing_fax: o["billing_fax"] ?? null,
          tax_office: o["tax_office"] ?? null,
          tax_number: o["tax_number"] ?? null,
          city: o["city"] ?? null,
          district: o["district"] ?? null,
          is_abroad: o["is_abroad"] ?? null,
          order_no: o["order_no"] ?? null,
          order_date: o["order_date"] ?? null,
          sharings_count: o["sharings_count"] ?? null,
          display_exchange_rate_in_pdf: o["display_exchange_rate_in_pdf"] ?? null,
          contact_type: o["contact_type"] ?? null,
          archived: o["archived"] ?? null,
          contact_parasut_id: o["contact_parasut_id"] ?? null,
          contact_name: fieldOf(contacts.value, o["contact_parasut_id"], "name"),
          sales_invoice_parasut_id: o["sales_invoice_parasut_id"] ?? null,
          sales_invoice_no: fieldOf(invoices.value, o["sales_invoice_parasut_id"], "invoice_no"),
          parasut_created_at: o["parasut_created_at"] ?? null,
          parasut_updated_at: o["parasut_updated_at"] ?? null,
          synced_at: o["synced_at"] ?? null,
        };

        const details = detailRows.map((d) => ({
          parasut_id: d["parasut_id"],
          sales_offer_parasut_id: d["sales_offer_parasut_id"] ?? null,
          description: d["description"] ?? null,
          detail_no: d["detail_no"] ?? null,
          quantity: d["quantity"] ?? null,
          unit_price: d["unit_price"] ?? null,
          vat_rate: d["vat_rate"] ?? null,
          vat_withholding: d["vat_withholding"] ?? null,
          vat_withholding_rate: d["vat_withholding_rate"] ?? null,
          discount_type: d["discount_type"] ?? null,
          discount_value: d["discount_value"] ?? null,
          discount: d["discount"] ?? null,
          invoice_discount: d["invoice_discount"] ?? null,
          excise_duty_type: d["excise_duty_type"] ?? null,
          excise_duty: d["excise_duty"] ?? null,
          excise_duty_rate: d["excise_duty_rate"] ?? null,
          excise_duty_value: d["excise_duty_value"] ?? null,
          communications_tax_rate: d["communications_tax_rate"] ?? null,
          communications_tax: d["communications_tax"] ?? null,
          accommodation_tax_rate: d["accommodation_tax_rate"] ?? null,
          accommodation_tax: d["accommodation_tax"] ?? null,
          accommodation_tax_exempt: d["accommodation_tax_exempt"] ?? null,
          net_total: d["net_total"] ?? null,
          net_total_without_invoice_discount: d["net_total_without_invoice_discount"] ?? null,
          product_parasut_id: d["product_parasut_id"] ?? null,
          product_name: fieldOf(products.value, d["product_parasut_id"], "name"),
          parasut_created_at: d["parasut_created_at"] ?? null,
          parasut_updated_at: d["parasut_updated_at"] ?? null,
          synced_at: d["synced_at"] ?? null,
        } as Row));

        return jsonResponse({
          data: { ...offer, details, activities: (activitiesRes.data ?? []) as unknown as Row[] },
        }, 200, cors);
      }

      case "payments.counts": {
        // This endpoint backs the Tahsilatlar screens. A payment attached to
        // a purchase bill is an outgoing expense payment, not a collection.
        const { count, error } = await db
          .schema(SCHEMA)
          .from("payments")
          .select("parasut_id", { count: "exact", head: true })
          .eq("payable_type", "sales_invoices");
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: { total: count ?? 0 } }, 200, cors);
      }
      case "payments.list": {
        const parsed = parseListParams(body, PAYMENT_SORT, { column: "date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        let query = db
          .schema(SCHEMA)
          .from("payments")
          .select(PAYMENT_LIST_BASE_COLUMNS, { count: "exact" })
          .eq("payable_type", "sales_invoices");
        const range = buildDateRange(body, "date");
        if (range?.gte) query = query.gte(range.column, range.gte);
        if (range?.lte) query = query.lte(range.column, range.lte);
        if (parsed.sort) query = query.order(parsed.sort.column, { ascending: parsed.sort.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);
        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        const page = (data ?? []) as Row[];

        const joins = await loadPaymentJoins(db, page);
        if (!joins.ok) return errorResponse("internal_error", cors, joins.error);
        const j = joins.value;

        const merged = page.map((p) => {
          const si = invoiceOf(j, p);
          const tx = j.tx.get(p["transaction_parasut_id"]);
          return {
            parasut_id: p["parasut_id"],
            date: p["date"] ?? null,
            amount: p["amount"] ?? null,
            currency: p["currency"] ?? null,
            notes: p["notes"] ?? null,
            payable_type: p["payable_type"] ?? null,
            payable_parasut_id: p["payable_parasut_id"] ?? null,
            invoice_no: si?.["invoice_no"] ?? null,
            contact_parasut_id: si?.["contact_parasut_id"] ?? null,
            contact_name: fieldOf(j.contacts, si?.["contact_parasut_id"], "name"),
            transaction_parasut_id: p["transaction_parasut_id"] ?? null,
            debit_account_name: accountName(tx, j.debit, "debit_account_parasut_id", "debit_account_type"),
            credit_account_name: accountName(tx, j.credit, "credit_account_parasut_id", "credit_account_type"),
          } as Row;
        });

        return jsonResponse({ data: merged, count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }
      case "payments.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const { data: paymentRow, error: paymentError } = await db
          .schema(SCHEMA)
          .from("payments")
          .select(PAYMENT_DETAIL_BASE_COLUMNS)
          .eq("parasut_id", id)
          .eq("payable_type", "sales_invoices")
          .maybeSingle();
        if (paymentError) return errorResponse("internal_error", cors, paymentError);
        if (!paymentRow) return errorResponse("not_found", cors);
        const p = paymentRow as Row;

        const joins = await loadPaymentJoins(db, [p]);
        if (!joins.ok) return errorResponse("internal_error", cors, joins.error);
        const j = joins.value;
        const si = invoiceOf(j, p);
        const tx = j.tx.get(p["transaction_parasut_id"]);

        return jsonResponse({
          data: {
            parasut_id: p["parasut_id"],
            date: p["date"] ?? null,
            amount: p["amount"] ?? null,
            currency: p["currency"] ?? null,
            notes: p["notes"] ?? null,
            payable_type: p["payable_type"] ?? null,
            payable_parasut_id: p["payable_parasut_id"] ?? null,
            invoice_no: si?.["invoice_no"] ?? null,
            contact_parasut_id: si?.["contact_parasut_id"] ?? null,
            contact_name: fieldOf(j.contacts, si?.["contact_parasut_id"], "name"),
            transaction_parasut_id: p["transaction_parasut_id"] ?? null,
            transaction_description: tx?.["description"] ?? null,
            transaction_type: tx?.["transaction_type"] ?? null,
            debit_account_parasut_id: tx?.["debit_account_parasut_id"] ?? null,
            debit_account_type: tx?.["debit_account_type"] ?? null,
            debit_account_name: accountName(tx, j.debit, "debit_account_parasut_id", "debit_account_type"),
            credit_account_parasut_id: tx?.["credit_account_parasut_id"] ?? null,
            credit_account_type: tx?.["credit_account_type"] ?? null,
            credit_account_name: accountName(tx, j.credit, "credit_account_parasut_id", "credit_account_type"),
            synced_at: p["synced_at"] ?? null,
            due_date: p["due_date"] ?? null,
            matched_amount: p["matched_amount"] ?? null,
            amount_in_trl: p["amount_in_trl"] ?? null,
            paid_in_currency: p["paid_in_currency"] ?? null,
          },
        }, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
