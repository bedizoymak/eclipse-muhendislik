// Phase 15 domain 3 -- expenses. Public read function backing /giderler,
// /giderler/:id, /giderler/tedarikciler, /giderler/odemeler.
//
// Phase 15.1: migrated off the `public.parasut_*_demo` views onto the
// `parasut.*` base tables (see the design note at the top of
// ../_shared/query.ts). Five views were in play here:
//
//   * parasut_purchase_bill_counts_demo -- FOUR `count(*) FILTER` buckets
//     over parasut.purchase_bills: archived = false, archived = true,
//     archived IS NULL, and the plain total. All four are replicated as
//     SEPARATE exact head counts; `archived IS NULL` stays its own bucket
//     because `= false` and `= true` both miss NULL.
//
//   * parasut_purchase_bills_demo -- the widest join in this domain, FOUR
//     LEFT JOINs off parasut.purchase_bills:
//         sup             = contacts  ON parasut_id = pb.supplier_parasut_id
//         spd             = employees ON parasut_id = pb.spender_parasut_id
//         pay_to_contact  = contacts  ON parasut_id = pb.pay_to_parasut_id
//         pay_to_employee = employees ON parasut_id = pb.pay_to_parasut_id
//     and then, crucially:
//         pay_to_name = COALESCE(pay_to_contact.name, pay_to_employee.name)
//     There is NO type-discriminator column on purchase_bills for pay_to
//     (unlike transactions.debit_account_type in `cash`): the SAME
//     pay_to_parasut_id is probed against BOTH tables unconditionally and
//     the contact name WINS. The resolution order replicated below is
//     therefore, in exactly this order:
//         1. the matched contact's `name`, if that value is non-null;
//         2. otherwise the matched employee's `name`, if non-null;
//         3. otherwise null.
//     Note this is a COALESCE over the two NAME VALUES, not over row
//     presence: a contact row that exists but whose `name` is NULL falls
//     through to the employee name, which is why the merge below reads
//     `contact?.name ?? employee?.name ?? null` rather than branching on
//     which lookup hit. Both lookup tables have a UNIQUE(parasut_id)
//     constraint, so the four-way join can never fan a parent row out.
//     Every filter (archived, payment_status, supplier_parasut_id) and
//     every sortable column (issue_date, due_date, net_total) lives on the
//     PARENT table, so this uses the cheap parent-page-then-merge pattern:
//     Postgres does the filtering, sorting, ranging and the exact count.
//
//   * parasut_purchase_bill_details_demo -- details LEFT JOIN products for
//     `product_name`, ORDER BY purchase_bill_parasut_id, parasut_id. This
//     is only ever read for ONE bill, so the leading key is constant and
//     the ordering collapses to `parasut_id` -- re-expressed explicitly
//     (the old call passed no `.order()` and inherited the view's).
//
//   * parasut_expense_payments_demo -- a five-way chain,
//     payments -> purchase_bills -> contacts and payments -> transactions
//     -> accounts on BOTH the debit and credit side, under a hard
//     `WHERE p.payable_type = 'purchase_bills'` and
//     `ORDER BY p.date DESC NULLS LAST`. Unlike `cash`, this domain DOES
//     select the joined columns (invoice_no, supplier_*, *_account_name),
//     so the join is implemented for real here. The view's WHERE is now an
//     explicit `.eq("payable_type", "purchase_bills")` on every read -- it
//     was previously load-bearing and implicit. The two account joins keep
//     their ON-clause type gate (`*_account_type = 'accounts'`): a row with
//     any other type contributes no lookup id and resolves to null.
//
//   * parasut_suppliers_demo -- a single-table passthrough of
//     parasut.contacts with `WHERE account_type = 'supplier'` and
//     `ORDER BY name` baked in. Both are now explicit; suppliers.options in
//     particular passed no `.order()` and silently inherited the ordering.
//
// Every join is a LEFT join: the parent row is spread first, an unmatched
// lookup leaves the resolved field literally `null`, and no parent row is
// ever filtered out (that would shrink `count` and break pagination).
// Response envelope, field allow-lists, filters, pagination and sort
// behaviour are unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "parasut";

// Client-facing shapes (unchanged from the pre-migration allow-lists) are
// the object literals built in the merge steps below. These constants are
// the PARENT (base-table) subsets actually selected; the joined columns
// (supplier_name, spender_name, pay_to_name, invoice_no, debit/credit
// account names, product_name) are resolved separately.
//   bills.list:   ... supplier_parasut_id, supplier_name, spender_parasut_id, spender_name ...
//   bills.get:    ... + pay_to_parasut_id, pay_to_name ...
const BILL_LIST_BASE_COLUMNS =
  "parasut_id, invoice_no, description, issue_date, due_date, currency, net_total, gross_total, total_vat, total_paid, remaining, payment_status, archived, supplier_parasut_id, spender_parasut_id, active_e_document_type";
const BILL_DETAIL_BASE_COLUMNS =
  "parasut_id, invoice_no, item_type, description, issue_date, due_date, currency, exchange_rate, net_total, gross_total, total_vat, total_discount, total_paid, remaining, remaining_in_trl, payment_status, archived, supplier_parasut_id, spender_parasut_id, pay_to_parasut_id, synced_at, active_e_document_type, active_e_document_parasut_id";
const BILL_DETAIL_LINE_BASE_COLUMNS =
  "parasut_id, description, quantity, unit_price, vat_rate, discount_type, discount_value, net_total, product_parasut_id";
// Payment parent subsets. `invoice_no` / `supplier_parasut_id` come from the
// joined purchase_bill, and the `*_account_name`s from transactions+accounts.
const PAYMENT_LIST_BASE_COLUMNS = "parasut_id, date, amount, currency, notes, payable_parasut_id, transaction_parasut_id";
const PAYMENT_FOR_BILL_BASE_COLUMNS = "parasut_id, date, amount, currency, notes, transaction_parasut_id";
const SUPPLIER_COLUMNS = "parasut_id, name, short_name, email, phone, city, archived";

const BILL_SORT = ["issue_date", "due_date", "net_total"] as const;
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
 * `ON (t.x_type = '...' AND lookup.parasut_id = t.x_parasut_id)` gate. */
function gatedIds(rows: Row[], column: string, typeColumn: string, typeValue: string): unknown[] {
  return [
    ...new Set(rows.filter((r) => r[typeColumn] === typeValue).map((r) => r[column]).filter((v) => v != null)),
  ];
}

/** LEFT JOIN field resolution: unmatched -> null, matched-but-null -> null. */
function nameOf(lookup: Map<unknown, Row>, id: unknown): unknown {
  if (id == null) return null;
  return lookup.get(id)?.["name"] ?? null;
}

function buildDateRange(body: Record<string, unknown> | null, column: string) {
  const gte = body?.["dateFrom"];
  const lte = body?.["dateTo"];
  if (typeof gte !== "string" && typeof lte !== "string") return undefined;
  return { column, gte: typeof gte === "string" ? gte : undefined, lte: typeof lte === "string" ? lte : undefined };
}

/**
 * Resolves the `transactions -> accounts x2` tail shared by every payment
 * read in this domain (the last three legs of parasut_expense_payments_demo).
 * Returns, per payment `transaction_parasut_id`, the joined transaction row
 * plus the two gated account names.
 */
async function loadTransactionTail(
  db: SupabaseClient,
  payments: Row[],
): Promise<Res<{ tx: Map<unknown, Row>; debit: Map<unknown, Row>; credit: Map<unknown, Row> }>> {
  const txRes = await loadLookupByIds(
    db,
    "transactions",
    "parasut_id, description, transaction_type, debit_account_parasut_id, debit_account_type, credit_account_parasut_id, credit_account_type",
    idsOf(payments, "transaction_parasut_id"),
  );
  if (!txRes.ok) return txRes;
  const txRows = [...txRes.value.values()];
  const [debit, credit] = await Promise.all([
    loadLookupByIds(db, "accounts", "parasut_id, name", gatedIds(txRows, "debit_account_parasut_id", "debit_account_type", "accounts")),
    loadLookupByIds(db, "accounts", "parasut_id, name", gatedIds(txRows, "credit_account_parasut_id", "credit_account_type", "accounts")),
  ]);
  if (!debit.ok) return debit;
  if (!credit.ok) return credit;
  return { ok: true, value: { tx: txRes.value, debit: debit.value, credit: credit.value } };
}

/** The gated account name for one side of a payment's transaction. */
function accountName(
  tx: Row | undefined,
  lookup: Map<unknown, Row>,
  idColumn: string,
  typeColumn: string,
): unknown {
  if (!tx) return null;
  if (tx[typeColumn] !== "accounts") return null;
  return nameOf(lookup, tx[idColumn]);
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
      case "bills.counts": {
        // The retired view's four FILTER buckets, one exact head count each.
        const bills = () => db.schema(SCHEMA).from("purchase_bills").select("parasut_id", { count: "exact", head: true });
        const [activeRes, archivedRes, nullArchivedRes, totalRes] = await Promise.all([
          bills().eq("archived", false),
          bills().eq("archived", true),
          bills().is("archived", null),
          bills(),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? nullArchivedRes.error ?? totalRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse({
          data: {
            active_count: activeRes.count ?? 0,
            archived_count: archivedRes.count ?? 0,
            null_archived_count: nullArchivedRes.count ?? 0,
            total_count: totalRes.count ?? 0,
          },
        }, 200, cors);
      }
      case "bills.list": {
        const parsed = parseListParams(body, BILL_SORT, { column: "issue_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        let query = db.schema(SCHEMA).from("purchase_bills").select(BILL_LIST_BASE_COLUMNS, { count: "exact" });
        if (typeof body?.["archived"] === "boolean") query = query.eq("archived", body["archived"] as boolean);
        if (typeof body?.["payment_status"] === "string") query = query.eq("payment_status", body["payment_status"] as string);
        if (Number.isFinite(Number(body?.["supplier_id"]))) query = query.eq("supplier_parasut_id", Number(body?.["supplier_id"]));
        const range = buildDateRange(body, "issue_date");
        if (range?.gte) query = query.gte(range.column, range.gte);
        if (range?.lte) query = query.lte(range.column, range.lte);
        if (parsed.sort) query = query.order(parsed.sort.column, { ascending: parsed.sort.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);
        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        const page = (data ?? []) as Row[];

        const [suppliers, spenders] = await Promise.all([
          loadLookupByIds(db, "contacts", "parasut_id, name", idsOf(page, "supplier_parasut_id")),
          loadLookupByIds(db, "employees", "parasut_id, name", idsOf(page, "spender_parasut_id")),
        ]);
        if (!suppliers.ok) return errorResponse("internal_error", cors, suppliers.error);
        if (!spenders.ok) return errorResponse("internal_error", cors, spenders.error);

        const merged = page.map((b) => ({
          parasut_id: b["parasut_id"],
          invoice_no: b["invoice_no"] ?? null,
          description: b["description"] ?? null,
          issue_date: b["issue_date"] ?? null,
          due_date: b["due_date"] ?? null,
          currency: b["currency"] ?? null,
          net_total: b["net_total"] ?? null,
          gross_total: b["gross_total"] ?? null,
          total_vat: b["total_vat"] ?? null,
          total_paid: b["total_paid"] ?? null,
          remaining: b["remaining"] ?? null,
          payment_status: b["payment_status"] ?? null,
          archived: b["archived"] ?? null,
          supplier_parasut_id: b["supplier_parasut_id"] ?? null,
          supplier_name: nameOf(suppliers.value, b["supplier_parasut_id"]),
          spender_parasut_id: b["spender_parasut_id"] ?? null,
          spender_name: nameOf(spenders.value, b["spender_parasut_id"]),
          active_e_document_type: b["active_e_document_type"] ?? null,
        } as Row));

        return jsonResponse({ data: merged, count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }
      case "bills.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const { data: billRow, error: billError } = await db
          .schema(SCHEMA)
          .from("purchase_bills")
          .select(BILL_DETAIL_BASE_COLUMNS)
          .eq("parasut_id", id)
          .maybeSingle();
        if (billError) return errorResponse("internal_error", cors, billError);
        if (!billRow) return errorResponse("not_found", cors);
        const b = billRow as Row;

        // Four LEFT JOIN lookups. pay_to probes BOTH contacts and employees
        // with the same id -- see the COALESCE note in the header.
        const [suppliers, spenders, payToContacts, payToEmployees] = await Promise.all([
          loadLookupByIds(db, "contacts", "parasut_id, name", idsOf([b], "supplier_parasut_id")),
          loadLookupByIds(db, "employees", "parasut_id, name", idsOf([b], "spender_parasut_id")),
          loadLookupByIds(db, "contacts", "parasut_id, name", idsOf([b], "pay_to_parasut_id")),
          loadLookupByIds(db, "employees", "parasut_id, name", idsOf([b], "pay_to_parasut_id")),
        ]);
        if (!suppliers.ok) return errorResponse("internal_error", cors, suppliers.error);
        if (!spenders.ok) return errorResponse("internal_error", cors, spenders.error);
        if (!payToContacts.ok) return errorResponse("internal_error", cors, payToContacts.error);
        if (!payToEmployees.ok) return errorResponse("internal_error", cors, payToEmployees.error);

        const bill = {
          parasut_id: b["parasut_id"],
          invoice_no: b["invoice_no"] ?? null,
          item_type: b["item_type"] ?? null,
          description: b["description"] ?? null,
          issue_date: b["issue_date"] ?? null,
          due_date: b["due_date"] ?? null,
          currency: b["currency"] ?? null,
          exchange_rate: b["exchange_rate"] ?? null,
          net_total: b["net_total"] ?? null,
          gross_total: b["gross_total"] ?? null,
          total_vat: b["total_vat"] ?? null,
          total_discount: b["total_discount"] ?? null,
          total_paid: b["total_paid"] ?? null,
          remaining: b["remaining"] ?? null,
          remaining_in_trl: b["remaining_in_trl"] ?? null,
          payment_status: b["payment_status"] ?? null,
          archived: b["archived"] ?? null,
          supplier_parasut_id: b["supplier_parasut_id"] ?? null,
          supplier_name: nameOf(suppliers.value, b["supplier_parasut_id"]),
          spender_parasut_id: b["spender_parasut_id"] ?? null,
          spender_name: nameOf(spenders.value, b["spender_parasut_id"]),
          pay_to_parasut_id: b["pay_to_parasut_id"] ?? null,
          // COALESCE(pay_to_contact.name, pay_to_employee.name), in that
          // exact order, over the NAME VALUES (not over row presence).
          pay_to_name: nameOf(payToContacts.value, b["pay_to_parasut_id"]) ??
            nameOf(payToEmployees.value, b["pay_to_parasut_id"]) ?? null,
          synced_at: b["synced_at"] ?? null,
          active_e_document_type: b["active_e_document_type"] ?? null,
          active_e_document_parasut_id: b["active_e_document_parasut_id"] ?? null,
        };

        // Line items: details LEFT JOIN products. The retired view's
        // ORDER BY purchase_bill_parasut_id, parasut_id collapses to
        // parasut_id here because the bill is fixed.
        const detailsPromise = db
          .schema(SCHEMA)
          .from("purchase_bill_details")
          .select(BILL_DETAIL_LINE_BASE_COLUMNS)
          .eq("purchase_bill_parasut_id", id)
          .order("parasut_id", { ascending: true });
        // Payments: the view's WHERE payable_type = 'purchase_bills' is now
        // explicit, as is its ORDER BY date DESC NULLS LAST.
        const paymentsPromise = db
          .schema(SCHEMA)
          .from("payments")
          .select(PAYMENT_FOR_BILL_BASE_COLUMNS)
          .eq("payable_type", "purchase_bills")
          .eq("payable_parasut_id", id)
          .order("date", { ascending: false, nullsFirst: false });
        const [detailsRes, paymentsRes] = await Promise.all([detailsPromise, paymentsPromise]);
        if (detailsRes.error) return errorResponse("internal_error", cors, detailsRes.error);
        if (paymentsRes.error) return errorResponse("internal_error", cors, paymentsRes.error);
        const detailRows = (detailsRes.data ?? []) as unknown as Row[];
        const paymentRows = (paymentsRes.data ?? []) as unknown as Row[];

        const [products, tail] = await Promise.all([
          loadLookupByIds(db, "products", "parasut_id, name", idsOf(detailRows, "product_parasut_id")),
          loadTransactionTail(db, paymentRows),
        ]);
        if (!products.ok) return errorResponse("internal_error", cors, products.error);
        if (!tail.ok) return errorResponse("internal_error", cors, tail.error);

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
          product_name: nameOf(products.value, d["product_parasut_id"]),
        } as Row));

        const payments = paymentRows.map((p) => {
          const tx = tail.value.tx.get(p["transaction_parasut_id"]);
          return {
            parasut_id: p["parasut_id"],
            date: p["date"] ?? null,
            amount: p["amount"] ?? null,
            currency: p["currency"] ?? null,
            notes: p["notes"] ?? null,
            transaction_parasut_id: p["transaction_parasut_id"] ?? null,
            debit_account_name: accountName(tx, tail.value.debit, "debit_account_parasut_id", "debit_account_type"),
            credit_account_name: accountName(tx, tail.value.credit, "credit_account_parasut_id", "credit_account_type"),
          } as Row;
        });

        return jsonResponse({ data: { ...bill, details, payments } }, 200, cors);
      }

      case "suppliers.counts": {
        // WHERE account_type = 'supplier' was baked into the retired view.
        const suppliers = () =>
          db.schema(SCHEMA).from("contacts").select("parasut_id", { count: "exact", head: true }).eq("account_type", "supplier");
        const [activeRes, archivedRes, allRes] = await Promise.all([
          suppliers().eq("archived", false),
          suppliers().eq("archived", true),
          suppliers(),
        ]);
        const err = activeRes.error ?? archivedRes.error ?? allRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse({ data: { active: activeRes.count ?? 0, archived: archivedRes.count ?? 0, all: allRes.count ?? 0 } }, 200, cors);
      }
      case "suppliers.list": {
        const parsed = parseListParams(body, ["name"] as const, { column: "name", direction: "asc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        let query = db.schema(SCHEMA).from("contacts").select(SUPPLIER_COLUMNS, { count: "exact" }).eq("account_type", "supplier");
        if (typeof body?.["archived"] === "boolean") query = query.eq("archived", body["archived"] as boolean);
        if (parsed.sort) query = query.order(parsed.sort.column, { ascending: parsed.sort.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);
        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: (data ?? []) as unknown as Row[], count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }
      // Used by the /giderler supplier dropdown filter -- all suppliers,
      // unpaginated. The retired view's ORDER BY name was inherited here
      // (this call passed no `.order()` of its own), so it is now explicit.
      case "suppliers.options": {
        const { data, error } = await db
          .schema(SCHEMA)
          .from("contacts")
          .select("parasut_id, name")
          .eq("account_type", "supplier")
          .order("name", { ascending: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }

      case "payments.counts": {
        const { count, error } = await db
          .schema(SCHEMA)
          .from("payments")
          .select("parasut_id", { count: "exact", head: true })
          .eq("payable_type", "purchase_bills");
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
          .eq("payable_type", "purchase_bills");
        const range = buildDateRange(body, "date");
        if (range?.gte) query = query.gte(range.column, range.gte);
        if (range?.lte) query = query.lte(range.column, range.lte);
        if (parsed.sort) query = query.order(parsed.sort.column, { ascending: parsed.sort.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);
        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        const page = (data ?? []) as Row[];

        // payments -> purchase_bills -> contacts, and the transaction tail.
        const [billsRes, tail] = await Promise.all([
          loadLookupByIds(db, "purchase_bills", "parasut_id, invoice_no, supplier_parasut_id", idsOf(page, "payable_parasut_id")),
          loadTransactionTail(db, page),
        ]);
        if (!billsRes.ok) return errorResponse("internal_error", cors, billsRes.error);
        if (!tail.ok) return errorResponse("internal_error", cors, tail.error);
        const suppliersRes = await loadLookupByIds(
          db,
          "contacts",
          "parasut_id, name",
          idsOf([...billsRes.value.values()], "supplier_parasut_id"),
        );
        if (!suppliersRes.ok) return errorResponse("internal_error", cors, suppliersRes.error);

        const merged = page.map((p) => {
          const bill = billsRes.value.get(p["payable_parasut_id"]);
          const tx = tail.value.tx.get(p["transaction_parasut_id"]);
          return {
            parasut_id: p["parasut_id"],
            date: p["date"] ?? null,
            amount: p["amount"] ?? null,
            currency: p["currency"] ?? null,
            notes: p["notes"] ?? null,
            payable_parasut_id: p["payable_parasut_id"] ?? null,
            invoice_no: bill?.["invoice_no"] ?? null,
            supplier_parasut_id: bill?.["supplier_parasut_id"] ?? null,
            supplier_name: nameOf(suppliersRes.value, bill?.["supplier_parasut_id"]),
            transaction_parasut_id: p["transaction_parasut_id"] ?? null,
            debit_account_name: accountName(tx, tail.value.debit, "debit_account_parasut_id", "debit_account_type"),
            credit_account_name: accountName(tx, tail.value.credit, "credit_account_parasut_id", "credit_account_type"),
          } as Row;
        });

        return jsonResponse({ data: merged, count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
