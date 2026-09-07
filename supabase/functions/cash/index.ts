// Phase 15 domain 5 -- cash. Public read function backing /nakit/hesaplar,
// /nakit/hesap-hareketleri, /nakit/cekler(/:id). IBAN/bank_account_no stay
// excluded from every accounts column list -- already dropped from the
// source view (20260906200827), repeated here as defense-in-depth.
//
// Phase 15.1: migrated off the `public.parasut_*_demo` views onto the
// `parasut.*` base tables (see the design note at the top of
// ../_shared/query.ts). Four views were in play here:
//
//   * parasut_accounts_demo -- a plain single-table passthrough of
//     parasut.accounts with `ORDER BY name` baked into the view. Both
//     account actions previously issued NO `.order()` of their own and so
//     inherited that ordering; it is now re-expressed EXPLICITLY as
//     `.order("name")` on the base table, per rule (2) of the design note.
//     NOTE the view exposes `bank_account_no` and `iban`; this function's
//     ACCOUNT_COLUMNS / ACCOUNT_OPTION_COLUMNS allow-lists deliberately do
//     NOT, and that is unchanged here -- the two column lists below are
//     byte-identical to the pre-migration ones. Do not widen them.
//
//   * parasut_transactions_demo -- transactions LEFT JOIN accounts (twice,
//     gated on *_account_type = 'accounts') LEFT JOIN contacts (twice, gated
//     on *_account_type = 'contacts'), purely to resolve four display names.
//     Every filterable/sortable column (`date`, `transaction_type`,
//     debit/credit account ids) lives on the PARENT table, so this uses the
//     cheap parent-page-then-merge pattern: Postgres does the filtering,
//     sorting, ranging and the exact count; the four name lookups are then
//     resolved with one page-scoped `.in(...)` per lookup table and merged
//     in TS. `count` comes from the parent query alone.
//
//   * parasut_checks_demo -- checks LEFT JOIN contacts twice (issuer, gated
//     on issued_by_type = 'contacts'; recipient, gated on
//     given_to_type = 'contacts'). Same shape: sorts/filters
//     (due_date, issue_date, is_in, is_out) are all parent columns, so the
//     same parent-page-then-merge applies. checks.get is the single-row
//     version of the same two lookups. checks.counts needs no join at all
//     and becomes three exact head counts on parasut.checks.
//
//   * parasut_payments_demo -- the widest view in this domain (a five-way
//     chain: payments -> sales_invoices -> contacts, and payments ->
//     transactions -> accounts on BOTH the debit and credit side). But the
//     only thing `cash` ever selects from it is CHECK_PAYMENT_COLUMNS, and
//     every one of those eight columns is a plain `parasut.payments` base
//     column -- none of the joined `invoice_no` / `contact_name` /
//     `transaction_*` / `*_account_name` fields is in this domain's
//     allow-list. So for `cash` this view degenerates to a single-table
//     passthrough of parasut.payments and needs no join code here. Its
//     baked-in `ORDER BY p.date DESC NULLS LAST` IS still load-bearing (the
//     old call passed no `.order()`), so it is re-expressed explicitly on
//     the runRelatedQuery call below. The full five-way join still has to be
//     implemented by whichever domain actually selects those joined columns
//     (`expenses` / `sales`), which have not been migrated yet -- this
//     function must not be read as evidence that the join is unnecessary.
//
// Every join is a LEFT join: the parent row is spread first, an unmatched
// lookup leaves the resolved name literally `null`, and no parent row is
// ever filtered out (that would shrink `count` and break pagination).
// Response envelope, field allow-lists, filters, pagination, sort behaviour
// and PII exclusions are all unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runRelatedQuery } from "../_shared/query.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "parasut";

// PII: `iban` and `bank_account_no` are intentionally absent from both of
// these lists. Unchanged from the pre-migration allow-lists.
const ACCOUNT_COLUMNS = "parasut_id, name, account_type, currency, bank_name, bank_branch, balance, archived, synced_at";
const ACCOUNT_OPTION_COLUMNS = "parasut_id, name";

// The client-facing shapes for transactions and checks are now the object
// literals built in the merge steps below; these constants are the PARENT
// (base-table) subsets actually selected, with the joined `*_name` fields
// resolved separately:
//   transactions: parasut_id, description, transaction_type, date,
//                 debit_amount, debit_currency, debit_account_parasut_id,
//                 debit_account_type, debit_account_name,
//                 debit_contact_name, credit_amount, credit_currency,
//                 credit_account_parasut_id, credit_account_type,
//                 credit_account_name, credit_contact_name
//   checks(list): parasut_id, serial_number, bank_identifier, bank_name,
//                 due_date, issue_date, net_total, remaining, currency,
//                 payment_status, is_cashed, is_in, is_out,
//                 issued_by_parasut_id, issued_by_name,
//                 given_to_parasut_id, given_to_name
const TRANSACTION_BASE_COLUMNS =
  "parasut_id, description, transaction_type, date, debit_amount, debit_currency, debit_account_parasut_id, debit_account_type, credit_amount, credit_currency, credit_account_parasut_id, credit_account_type";
const CHECK_LIST_BASE_COLUMNS =
  "parasut_id, serial_number, bank_identifier, bank_name, due_date, issue_date, net_total, remaining, currency, payment_status, is_cashed, is_in, is_out, issued_by_parasut_id, issued_by_type, given_to_parasut_id, given_to_type";
const CHECK_DETAIL_BASE_COLUMNS =
  "parasut_id, currency, description, due_date, issue_date, net_total, remaining, remaining_in_trl, payment_status, is_cashed, is_in, is_out, is_transferred, days_overdue, bank_identifier, bank_name, serial_number, issued_by_parasut_id, issued_by_type, given_to_parasut_id, given_to_type, synced_at, days_till_due_date, parasut_created_at, parasut_updated_at";
const CHECK_PAYMENT_COLUMNS = "parasut_id, date, due_date, amount, matched_amount, amount_in_trl, currency, paid_in_currency";

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
  return { ok: true, value: new Map(((data ?? []) as unknown as Row[]).map((r) => [r["parasut_id"], r])) };
}

/** The distinct non-null values of `column`, but only on rows whose
 * `typeColumn` equals `typeValue` -- this is exactly the view's
 * `ON (t.x_type = '...' AND lookup.parasut_id = t.x_parasut_id)` gate.
 * A row with the wrong type contributes no id and therefore resolves to
 * null, just as the LEFT JOIN's ON clause would leave it. */
function gatedIds(rows: Row[], column: string, typeColumn: string, typeValue: string): unknown[] {
  return [
    ...new Set(rows.filter((r) => r[typeColumn] === typeValue).map((r) => r[column]).filter((v) => v != null)),
  ];
}

/** LEFT JOIN name resolution honouring the view's type gate. */
function gatedName(
  row: Row,
  lookup: Map<unknown, Row>,
  column: string,
  typeColumn: string,
  typeValue: string,
): unknown {
  if (row[typeColumn] !== typeValue) return null;
  const hit = lookup.get(row[column]);
  return hit ? (hit["name"] ?? null) : null;
}

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
      case "accounts.list": {
        // `.order("name")` re-expresses the retired view's own ORDER BY name.
        const { data, error } = await db.schema(SCHEMA).from("accounts").select(ACCOUNT_COLUMNS).order("name", { ascending: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }
      case "accounts.options": {
        const { data, error } = await db.schema(SCHEMA).from("accounts").select(ACCOUNT_OPTION_COLUMNS).order("name", { ascending: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? [] }, 200, cors);
      }

      case "transactions.list": {
        const parsed = parseListParams(body, ["date"] as const, { column: "date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        let query = db.schema(SCHEMA).from("transactions").select(TRANSACTION_BASE_COLUMNS, { count: "exact" });
        const accountId = Number(body?.["account_id"]);
        if (Number.isFinite(accountId) && body?.["account_id"] !== undefined) {
          query = query.or(`debit_account_parasut_id.eq.${accountId},credit_account_parasut_id.eq.${accountId}`);
        }
        if (typeof body?.["transaction_type"] === "string") query = query.eq("transaction_type", body["transaction_type"] as string);
        const range = buildDateRange(body, "date");
        if (range?.gte) query = query.gte(range.column, range.gte);
        if (range?.lte) query = query.lte(range.column, range.lte);
        query = query.order(parsed.sort!.column, { ascending: parsed.sort!.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);
        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        const page = (data ?? []) as Row[];

        const [debitAccounts, debitContacts, creditAccounts, creditContacts] = await Promise.all([
          loadLookupByIds(db, "accounts", "parasut_id, name", gatedIds(page, "debit_account_parasut_id", "debit_account_type", "accounts")),
          loadLookupByIds(db, "contacts", "parasut_id, name", gatedIds(page, "debit_account_parasut_id", "debit_account_type", "contacts")),
          loadLookupByIds(db, "accounts", "parasut_id, name", gatedIds(page, "credit_account_parasut_id", "credit_account_type", "accounts")),
          loadLookupByIds(db, "contacts", "parasut_id, name", gatedIds(page, "credit_account_parasut_id", "credit_account_type", "contacts")),
        ]);
        if (!debitAccounts.ok) return errorResponse("internal_error", cors, debitAccounts.error);
        if (!debitContacts.ok) return errorResponse("internal_error", cors, debitContacts.error);
        if (!creditAccounts.ok) return errorResponse("internal_error", cors, creditAccounts.error);
        if (!creditContacts.ok) return errorResponse("internal_error", cors, creditContacts.error);

        const merged = page.map((t) => ({
          parasut_id: t["parasut_id"],
          description: t["description"] ?? null,
          transaction_type: t["transaction_type"] ?? null,
          date: t["date"] ?? null,
          debit_amount: t["debit_amount"] ?? null,
          debit_currency: t["debit_currency"] ?? null,
          debit_account_parasut_id: t["debit_account_parasut_id"] ?? null,
          debit_account_type: t["debit_account_type"] ?? null,
          debit_account_name: gatedName(t, debitAccounts.value, "debit_account_parasut_id", "debit_account_type", "accounts"),
          debit_contact_name: gatedName(t, debitContacts.value, "debit_account_parasut_id", "debit_account_type", "contacts"),
          credit_amount: t["credit_amount"] ?? null,
          credit_currency: t["credit_currency"] ?? null,
          credit_account_parasut_id: t["credit_account_parasut_id"] ?? null,
          credit_account_type: t["credit_account_type"] ?? null,
          credit_account_name: gatedName(t, creditAccounts.value, "credit_account_parasut_id", "credit_account_type", "accounts"),
          credit_contact_name: gatedName(t, creditContacts.value, "credit_account_parasut_id", "credit_account_type", "contacts"),
        } as Row));

        return jsonResponse({ data: merged, count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }

      case "checks.counts": {
        const [inRes, outRes, allRes] = await Promise.all([
          db.schema(SCHEMA).from("checks").select("parasut_id", { count: "exact", head: true }).eq("is_in", true),
          db.schema(SCHEMA).from("checks").select("parasut_id", { count: "exact", head: true }).eq("is_out", true),
          db.schema(SCHEMA).from("checks").select("parasut_id", { count: "exact", head: true }),
        ]);
        const err = inRes.error ?? outRes.error ?? allRes.error;
        if (err) return errorResponse("internal_error", cors, err);
        return jsonResponse({ data: { in: inRes.count ?? 0, out: outRes.count ?? 0, all: allRes.count ?? 0 } }, 200, cors);
      }
      case "checks.list": {
        const parsed = parseListParams(body, ["due_date", "issue_date"] as const, { column: "due_date", direction: "desc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        let query = db.schema(SCHEMA).from("checks").select(CHECK_LIST_BASE_COLUMNS, { count: "exact" });
        if (typeof body?.["is_in"] === "boolean") query = query.eq("is_in", body["is_in"] as boolean);
        if (typeof body?.["is_out"] === "boolean") query = query.eq("is_out", body["is_out"] as boolean);
        const range = buildDateRange(body, "due_date");
        if (range?.gte) query = query.gte(range.column, range.gte);
        if (range?.lte) query = query.lte(range.column, range.lte);
        if (parsed.sort) query = query.order(parsed.sort.column, { ascending: parsed.sort.direction === "asc" });
        const from = (parsed.page - 1) * parsed.pageSize;
        query = query.range(from, from + parsed.pageSize - 1);
        const { data, error, count } = await query;
        if (error) return errorResponse("internal_error", cors, error);
        const page = (data ?? []) as Row[];

        const [issuers, recipients] = await Promise.all([
          loadLookupByIds(db, "contacts", "parasut_id, name", gatedIds(page, "issued_by_parasut_id", "issued_by_type", "contacts")),
          loadLookupByIds(db, "contacts", "parasut_id, name", gatedIds(page, "given_to_parasut_id", "given_to_type", "contacts")),
        ]);
        if (!issuers.ok) return errorResponse("internal_error", cors, issuers.error);
        if (!recipients.ok) return errorResponse("internal_error", cors, recipients.error);

        const merged = page.map((c) => ({
          parasut_id: c["parasut_id"],
          serial_number: c["serial_number"] ?? null,
          bank_identifier: c["bank_identifier"] ?? null,
          bank_name: c["bank_name"] ?? null,
          due_date: c["due_date"] ?? null,
          issue_date: c["issue_date"] ?? null,
          net_total: c["net_total"] ?? null,
          remaining: c["remaining"] ?? null,
          currency: c["currency"] ?? null,
          payment_status: c["payment_status"] ?? null,
          is_cashed: c["is_cashed"] ?? null,
          is_in: c["is_in"] ?? null,
          is_out: c["is_out"] ?? null,
          issued_by_parasut_id: c["issued_by_parasut_id"] ?? null,
          issued_by_name: gatedName(c, issuers.value, "issued_by_parasut_id", "issued_by_type", "contacts"),
          given_to_parasut_id: c["given_to_parasut_id"] ?? null,
          given_to_name: gatedName(c, recipients.value, "given_to_parasut_id", "given_to_type", "contacts"),
        } as Row));

        return jsonResponse({ data: merged, count: count ?? 0, page: parsed.page, pageSize: parsed.pageSize }, 200, cors);
      }
      case "checks.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const { data: checkRow, error: checkError } = await db
          .schema(SCHEMA)
          .from("checks")
          .select(CHECK_DETAIL_BASE_COLUMNS)
          .eq("parasut_id", id)
          .maybeSingle();
        if (checkError) return errorResponse("internal_error", cors, checkError);
        if (!checkRow) return errorResponse("not_found", cors);
        const c = checkRow as Row;

        const [issuers, recipients] = await Promise.all([
          loadLookupByIds(db, "contacts", "parasut_id, name", gatedIds([c], "issued_by_parasut_id", "issued_by_type", "contacts")),
          loadLookupByIds(db, "contacts", "parasut_id, name", gatedIds([c], "given_to_parasut_id", "given_to_type", "contacts")),
        ]);
        if (!issuers.ok) return errorResponse("internal_error", cors, issuers.error);
        if (!recipients.ok) return errorResponse("internal_error", cors, recipients.error);

        const check = {
          parasut_id: c["parasut_id"],
          currency: c["currency"] ?? null,
          description: c["description"] ?? null,
          due_date: c["due_date"] ?? null,
          issue_date: c["issue_date"] ?? null,
          net_total: c["net_total"] ?? null,
          remaining: c["remaining"] ?? null,
          remaining_in_trl: c["remaining_in_trl"] ?? null,
          payment_status: c["payment_status"] ?? null,
          is_cashed: c["is_cashed"] ?? null,
          is_in: c["is_in"] ?? null,
          is_out: c["is_out"] ?? null,
          is_transferred: c["is_transferred"] ?? null,
          days_overdue: c["days_overdue"] ?? null,
          bank_identifier: c["bank_identifier"] ?? null,
          bank_name: c["bank_name"] ?? null,
          serial_number: c["serial_number"] ?? null,
          issued_by_parasut_id: c["issued_by_parasut_id"] ?? null,
          issued_by_type: c["issued_by_type"] ?? null,
          issued_by_name: gatedName(c, issuers.value, "issued_by_parasut_id", "issued_by_type", "contacts"),
          given_to_parasut_id: c["given_to_parasut_id"] ?? null,
          given_to_type: c["given_to_type"] ?? null,
          given_to_name: gatedName(c, recipients.value, "given_to_parasut_id", "given_to_type", "contacts"),
          synced_at: c["synced_at"] ?? null,
          days_till_due_date: c["days_till_due_date"] ?? null,
          parasut_created_at: c["parasut_created_at"] ?? null,
          parasut_updated_at: c["parasut_updated_at"] ?? null,
        };

        // Pure passthrough of parasut.payments for this domain's column list
        // (see the header note); the retired view's ORDER BY p.date DESC
        // NULLS LAST is re-expressed explicitly.
        const paymentsRes = await runRelatedQuery(
          db,
          "payments",
          CHECK_PAYMENT_COLUMNS,
          [
            { column: "payable_type", value: "checks" },
            { column: "payable_parasut_id", value: id },
          ],
          SCHEMA,
          { column: "date", ascending: false, nullsFirst: false },
        );
        if (!paymentsRes.ok) return errorResponse("internal_error", cors, paymentsRes.error);
        return jsonResponse({ data: { ...check, payments: paymentsRes.rows } }, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
