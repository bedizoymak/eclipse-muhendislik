# Phase 15 — Edge Function API Contracts (Design Only, Not Implemented)

Status: **DESIGN DRAFT — no code written, no database objects touched.** This
covers implementation-order item 1 ("Design the Edge Function request/response
contracts"). Nothing here is applied until reviewed.

## Common conventions (all domains)

- **Transport:** `supabase.functions.invoke("<function-name>", { body })` from
  the frontend — same pattern already used by `parasut-sync`.
- **Auth today:** the demo site's data has always been publicly viewable
  (no login gate on any list/detail route) and, after the Phase 14.6 privacy
  fix, no longer contains IBAN/TCKN. Each read Edge Function is deployed with
  `verify_jwt = false` (public, matching current behavior) but funnels every
  request through one `authorize(req)` helper — centralized, reviewable, and
  ready to tighten to `verify_jwt = true` / role checks later without
  touching every function. **This is a decision point, not a default I'm
  locking in** — flagging it for your call before implementation.
- **List response envelope:**
  ```json
  { "data": [ ... ], "count": 1234, "page": 1, "pageSize": 50 }
  ```
- **Detail response envelope:**
  ```json
  { "data": { ... } }        // or
  { "error": "not_found" }   // 404
  ```
- **List request params:** `page` (default 1), `pageSize` (default 50, max
  200), `sort` (allow-listed column + `asc`/`desc`), and per-domain filters
  (below). Pagination and counts always come from the DB (`count: "exact"`
  on the underlying view), never computed client-side.
- **Field allow-listing:** every function's `select()` is a fixed, hardcoded
  column list per response shape — never `select("*")`, so adding a column to
  a `parasut.*` table can never silently leak it to a client.
- **Errors:** functions never forward raw Postgres/PostgREST error text to
  the client — only a small set of safe, typed error codes
  (`invalid_params`, `not_found`, `unauthorized`, `internal_error`), full
  detail logged server-side only.
- **Underlying source:** every function queries the existing
  `public.parasut_*_demo` views (unchanged, already column-curated) using
  the `service_role` key — never `parasut.*` directly, never with the
  frontend's anon key.

## Domain 1 — `customers`

Routes: `/musteriler`, `/musteriler/:id`
Views used: `parasut_contacts_demo`, `parasut_contact_people_demo`

- `GET-style` action `list`: params `archived?: boolean`, `search?: string`
  (name/email ilike), sort `name|synced_at`. Returns contact list columns
  (unchanged from current `.select()`), plus `count`.
- `get`: `{ id }` → contact detail + related `contact_people` rows.

## Domain 2 — `sales`

Routes: `/satislar/faturalar`, `/satislar/faturalar/:id`,
`/satislar/teklifler`, `/satislar/teklifler/:id`, `/satislar/tahsilatlar`,
`/satislar/tahsilatlar/:id`
Views: `parasut_sales_invoices_demo`, `parasut_sales_invoice_details_demo`,
`parasut_sales_offers_demo`, `parasut_sales_offer_details_demo`,
`parasut_sales_offer_activities_demo`, `parasut_payments_demo`,
`parasut_e_invoices_demo`/`parasut_e_archives_demo` (via existing
`fetchActiveEDocument` logic, ported server-side)

- `invoices.list`: filters `archived`, `payment_status`, date range
  (`issue_date` gte/lte), sort.
- `invoices.get`: `{ id }` → invoice + details + resolved active e-document.
- `offers.list` / `offers.get`: same pattern.
- `payments.list` / `payments.get`: date range filter.

## Domain 3 — `expenses`

Routes: `/giderler`, `/giderler/:id`, `/giderler/tedarikciler`,
`/giderler/odemeler`
Views: `parasut_purchase_bills_demo`, `parasut_purchase_bill_details_demo`,
`parasut_expense_payments_demo`, `parasut_suppliers_demo`,
`parasut_purchase_bill_counts_demo`

- `bills.list`: filters `archived`, `payment_status`, `supplier_id`, date
  range.
- `bills.get`: bill + details + expense payments + active e-document.
- `suppliers.list`: filter `archived`.
- `payments.list`: date range.

## Domain 4 — `payroll`

Routes: `/giderler/calisanlar`, `/giderler/calisanlar/:id`,
`/giderler/maaslar`, `/giderler/maaslar/:id`, `/giderler/vergiler`,
`/giderler/vergiler/:id`
Views: `parasut_employees_demo`, `parasut_employee_meta_demo`,
`parasut_employee_counts_demo`, `parasut_salaries_demo`,
`parasut_salary_tags_demo`, `parasut_salary_counts_demo`,
`parasut_taxes_demo`, `parasut_tax_tags_demo`, `parasut_tax_counts_demo`

- `employees.list` / `employees.get`: **IBAN/TCKN stay excluded** (already
  dropped from the source view — this function inherits that, doesn't need
  its own filtering, but the column allow-list still explicitly omits them
  as defense-in-depth in case the view is ever changed back).
- `salaries.list` / `salaries.get`, `taxes.list` / `taxes.get`: same
  generic-resource pattern as today's `EmptyResourceList`/`Detail`.

## Domain 5 — `cash`

Routes: `/nakit/hesaplar`, `/nakit/hesap-hareketleri`, `/nakit/cekler`,
`/nakit/cekler/:id`
Views: `parasut_accounts_demo`, `parasut_transactions_demo`,
`parasut_checks_demo`, `parasut_payments_demo` (check-linked payments)

- `accounts.list`: **IBAN/bank_account_no stay excluded**, same
  defense-in-depth note as payroll.
- `transactions.list`: filters `date` range, `transaction_type`,
  `account_id` (debit or credit side).
- `checks.list` / `checks.get`: filters `is_in`/`is_out`, date range.

## Domain 6 — `products`

Routes: `/urunler`, `/urunler/:id`, `/stok/kategoriler`,
`/stok/kategoriler/:id`, `/stok/depolar`
Views: `parasut_products_demo`, `parasut_inventory_levels_demo`,
`parasut_item_categories_demo`, `parasut_item_category_counts_demo`,
`parasut_warehouses_demo`

- `products.list`: filters `archived`, `category_id`, `inventory_tracking`.
- `products.get`: product + inventory levels per warehouse.
- `categories.list` / `categories.get`, `warehouses.list`: generic-resource
  pattern.

## Domain 7 — `inventory`

Routes: `/stok/seviyeleri`, `/stok/hareketleri`
Views: `parasut_inventory_levels_demo`, `parasut_stock_movements_demo`,
`parasut_warehouses_demo` (dropdown)

- `levels.list`: filter `warehouse_id`.
- `movements.list`: filters `warehouse_id`, `product_id`, date range.

## Domain 8 — `shipments`

Routes: `/stok/sevkiyat-irsaliyeleri`, `/stok/sevkiyat-irsaliyeleri/:id`
Views: `parasut_shipment_documents_demo`,
`parasut_shipment_document_counts_demo`,
`parasut_shipment_document_activities_demo`,
`parasut_shipment_document_invoices_demo`,
`parasut_stock_movements_demo` (filtered by source),
`parasut_inbound_e_despatches_demo`

- `list`: filters `archived`, date range.
- `get`: document + activities + linked invoices + stock movements +
  inbound e-despatch (conditional).

## Domain 9 — `e-documents`

Routes: `/satislar/e-faturalar`, `/satislar/e-faturalar/:id`,
`/satislar/e-fatura-mukellefleri`
Views: `parasut_e_invoices_demo`, `parasut_e_invoices_counts_demo`,
`parasut_e_invoice_lookup_results_demo`,
`parasut_e_invoice_lookup_result_counts_demo`

- `invoices.list`: filters `direction`, `parent_type` (null/not-null).
- `invoices.get`.
- `lookup.list`: taxpayer lookup results (already a cached/synced table, no
  live Paraşüt lookup call from this function).

## Domain 10 — `tags-and-settings`

Routes: `/ayarlar/etiketler`, `/ayarlar/etiketler/:id`, `/sirket-bilgileri`
Views: `parasut_tags_demo`, `parasut_tag_counts_demo`,
`parasut_company_profile_demo`, `parasut_user_company_relation_demo`

- `tags.list` / `tags.get`: generic-resource pattern.
- `company.get`: singleton, no params.

## Domain 11 — `sync-status` (read-only, distinct from the sync trigger)

Route: `/` (DemoHome "Verileri yenile")
View: `parasut_sync_status_demo`

- `status.get`: `{ resource }` → last sync status. Already low-risk (no
  PII), mainly moved for consistency ("frontend must stop querying
  `public.parasut_*_demo` with `.from()`" applies here too).

## What does NOT change

- `parasut-sync` (the write path) — already Phase 14.6/14.7-hardened,
  `service_role`-only, untouched by this design.
- The 48 views themselves — kept as-is, become internal-only once their
  `anon`/`authenticated` grants are revoked in the final migration (not
  written yet).
- URL structure — every existing route path is preserved; only what each
  page calls to fetch data changes.

## Open decision for you before implementation starts

**Should reads stay public (no login), or should the whole demo now require
a Supabase Auth session to view data at all?** Nothing in this conversation
so far has asked for a login-gated *viewing* experience — only sync-triggering
was ever restricted. I've designed these contracts assuming reads stay public
(`verify_jwt = false`), consistent with how the site has always worked. If you
want viewing itself to require login now, say so before I start implementing
domain 1 — it changes every function's auth branch.
