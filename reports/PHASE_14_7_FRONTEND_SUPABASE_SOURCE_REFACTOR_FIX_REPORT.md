# Phase 14.7 — Frontend Supabase Source Refactor: Audit & Fix Report

Date: 2026-09-07
Scope: `src/` (frontend), `supabase/functions/` (Edge Functions, secondary/bonus check), `supabase/migrations/` (evidence only, nothing applied).

## 0. Context note

This task was written as a "Phase 14.7 frontend `.from()` audit/fix," but Phase 15
(commit `6705ce3`, already on `origin/main`) had already migrated every frontend
page off direct `.from('parasut_*_demo')` PostgREST calls onto
`supabase.functions.invoke(...)` against 11 Edge Functions
(`customers, sales, expenses, payroll, cash, products, inventory, shipments,
e-documents, tags-and-settings, sync-status`). Per explicit instruction, this
audit was run literally against the frontend as it exists today. **Finding
zero direct `.from()` calls in frontend code is the correct and expected
result of this audit**, not a gap.

Separately, there is a known, unresolved incident: the remote `parasut`/`parasut_ops`
schema has drifted via migrations `20260930000000` / `20260930010000` / `20260930020000`
present on remote but absent from this repo's `supabase/migrations/`, and
`oauth_tokens` / `sync_runs` tables referenced by earlier phases are missing from the
live schema. That incident is being handled by a separate, parallel effort. This
report does **not** attempt to fix it — it only reports factually where this
audit's findings intersect it (sections 5 and 7).

## 1. Complete `.from()` inventory — frontend

Search: `\.from\(['"]` across `src/**` (pages, components, hooks, services, lib, tests).

**Result: 0 matches.**

| File and line | Current source | Purpose | Verified source | Evidence | Status |
|---|---|---|---|---|---|
| — none found — | — | — | — | `grep -rn "\.from(['\"]" src/` returns no matches | N/A |

Broader sweep `\.from\(` (catches non-string-literal / dynamically constructed
relation names) across the whole repo, filtered to `.ts`/`.tsx`, returns matches
**only** in:
- `supabase/functions/**/index.ts` and `supabase/functions/_shared/query.ts` — server-side Edge Function code, expected and correct (these run with the service_role key, never in the browser).
- `src/test/notFoundAndDetailTitle.test.tsx` — a mock comment referencing the *old* `.from()` shape for historical context; the actual test code mocks `supabase.functions.invoke(...)`, not `.from()` (see section 4).

No frontend page/component/hook/service file (`src/pages/*`, `src/components/*`,
`src/hooks/*`, `src/lib/*`) contains a `.from()` call of any kind, string-literal
or dynamic. All 27 files that reach Supabase do so exclusively via
`supabase.functions.invoke(<function-name>, { body: { action, ... } })`.

**Before/after count of direct base-table (or view) frontend queries: 0 → 0**
(Phase 15 already took this to 0; this audit re-confirms 0, it did not need to fix anything to reach it.)

## 2. Real database source verification

- `git log --oneline -1` on the working tree = `6705ce3` (Phase 15 cutover), tree clean at task start.
- `parasut_full_schema.json` (repo root, generated 2026-09-06T20:55:56Z, "live remote schema dump ... parsed post-incident") documents only the `parasut` and `parasut_ops` schemas — it does **not** include a `public` schema section, so it cannot by itself confirm current `public.parasut_*_demo` view definitions; it is however authoritative for the base-table/incident question below.
- `npx supabase migration list` (read-only) confirms the drift directly: remote has `20260930000000` and `20260930020000` with **no corresponding local migration file** (`"local":""` in the CLI output), and `20260930010000` (`supabase/migrations/20260930010000_lock_down_demo_views_after_edge_function_cutover.sql`) exists locally but is unapplied on remote relative to the two unexplained entries around it. This matches the incident description exactly.
- `parasut_ops` in `parasut_full_schema.json` lists only one table, `scheduled_sync_cycles` — no `oauth_tokens`, no `sync_runs`. Confirms those tables are indeed missing from the live schema, consistent with the reported incident.
- Frontend does not read `parasut.*` base tables directly under any code path found (see section 1) — all reads go through Edge Functions, which in turn read `public.parasut_*_demo` views server-side with `service_role` (per `supabase/functions/_shared/db.ts` `serviceClient()` pattern and per-function `.from("parasut_*_demo")` calls, e.g. `supabase/functions/sales/index.ts:62,76,91,103-105,144`).
- Bonus/secondary check (Edge Functions as current access path): confirmed reasonable. Each of the 11 functions under `supabase/functions/` uses `serviceClient()` + `.from("parasut_*_demo"/"parasut_*_counts_demo"/etc.)`, with `authorize(req)` gating and CORS headers, matching the design in `reports/PHASE_15_EDGE_FUNCTION_CONTRACTS_DESIGN.md`. This is a secondary, read-only sanity check, not a full Edge Function audit.

## 3. Module-by-module audit

All 25 frontend page modules that touch data (contacts/Musteriler, contact people, products/Urunler+Stok*, sales invoices/Faturalar, purchase bills/Giderler, e-Invoices/e-Archives (EFaturalar, eDocuments.ts), accounts/Hesap*, payments/Tahsilatlar, transactions, checks/Cekler, sales offers/Teklifler, shipment documents/Sevkiyat*, employees/Calisanlar, company profile/SirketBilgileri, empty-resource views (EmptyResourceList/Detay), scheduler/freshness (DemoHome, sync-status)) were confirmed in section 1 to use only `supabase.functions.invoke(...)`. No stale/renamed `.from()` targets were found because no `.from()` calls remain in the frontend to be stale. This audit cannot independently re-verify from the frontend side whether the underlying `public.parasut_*_demo` views themselves have drifted (missing columns, renamed relations) beyond what `parasut_full_schema.json` documents for the `parasut`/`parasut_ops` schemas — that would require a fresh `public`-schema dump, which was not generated by prior work and was out of scope for a read-only, non-schema-touching audit per the task's explicit restriction. This is flagged as **UNKNOWN_OR_BLOCKED for the `public` view layer specifically**, tied to the same drift incident, not a frontend defect.

## 4. Frontend source fixes

**No genuine remaining direct `.from()` call was found in frontend code**, so no fix was made under this section.

Specific edge cases checked, as instructed:
- `src/lib/eDocuments.ts` — reviewed in full. Uses only `supabase.functions.invoke("e-documents", { action: "resolve", ... })`. No `.from()`. Handles null/absent `active_e_document_type`/`active_e_document_parasut_id` correctly (returns `{ doc: null, error: null }`, never fabricates), and `formatEDocValue`/`resolveEDocumentUrl` preserve real null/falsy distinctions and reject unsafe URL schemes. No fix needed.
- `src/test/notFoundAndDetailTitle.test.tsx` — the mock (`makeFunctionsInvokeMock`) mocks `supabase.functions.invoke`, matching the current Edge Function envelope (`{ data: {...} }` / `{ error: "..." }`), not `.from()`. The comment at lines 26-29 explicitly documents the Phase 15 cutover. No stale `.from()` mock found. No fix needed.

Since no fix was required, no new migration was written under section 4 (the instruction to write-but-not-apply a migration only applies if a genuinely missing field were found; none was).

## 5. Latest sales-invoice reconciliation

| Layer | ID | created_at | updated_at | issue_date |
|---|---|---|---|---|
| Paraşüt API (live) | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED |
| Supabase base (`parasut.sales_invoices` or equivalent) | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED |
| Public view (`parasut_sales_invoices_demo`) | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED |
| Frontend response (`sales` Edge Function) | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED |
| Rendered UI (`Faturalar.tsx`) | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED | UNKNOWN_OR_BLOCKED |

This agent has no live Paraşüt API credentials/network access, and per the task's
explicit restriction was not to query the live remote database directly for
row-level data (only read-only CLI verification of migration/schema state was
in scope). No row-level data was fabricated for any layer above.

**Root cause classification: `UNKNOWN_OR_BLOCKED`.**

Rationale: the remote `parasut`/`parasut_ops` schema has unexplained drift
(migrations `20260930000000`/`20260930020000` on remote, not in repo history;
`oauth_tokens`/`sync_runs` missing) under active separate investigation. Any
conclusion about why new invoices aren't appearing (`SYNC_NOT_RUN` vs.
`SCHEDULER_BROKEN` vs. `RESOURCE_SYNC_FAILED` vs. `BASE_MISSING` vs. `VIEW_FILTERED`,
etc.) would depend on schema/table state that is currently in an unresolved,
possibly-compromised condition. Classifying this any more specifically before
that investigation concludes would risk being wrong and would not be based on
verified evidence. This finding should be revisited once the schema-drift
incident is resolved.

## 6. Refresh button security

Located in `src/pages/DemoHome.tsx`. Verified by reading the full component:

- The button (`handleRefresh`, "Verileri yenile") calls only `loadData()`, which invokes three Edge Functions: `customers` (`action: "list"`), `customers` (`action: "counts"`), and `sync-status` (`action: "get", resource: "contacts"`) — all via `supabase.functions.invoke(...)` using the publishable client (`src/integrations/supabase/client.ts`), never a service_role key.
- It does **not** invoke `parasut-sync` (the actual write/sync function) from the browser at all — confirmed by grep: no reference to `"parasut-sync"` anywhere in `src/`.
- `supabase/functions/sync-status/index.ts` is confirmed read-only: uses `serviceClient()` (service_role) only inside the Edge Function's server-side Deno runtime, never exposed to the browser, and only ever does `.from(...).select(...)` reads, no writes.
- UI copy already states the correct model. Code comment (lines 34-40 of `DemoHome.tsx`) and on-screen behavior confirm: real sync runs server-side on a schedule (pg_cron + pg_net) authenticated via a service_role key held only in Supabase Vault; the button only re-reads already-synced public data and requires no login. This copy already satisfies the requirement — no UI text change was needed.

**Verdict: PASS.** No fix required.

## 7. Runtime verification

- `npx tsc --noEmit` — **PASS**, zero errors, zero output.
- Code-review for `42P01`/`42703`/`PGRST*` handling: Edge Functions surface `error.message` / `data.error` from Supabase responses up through typed envelopes (`{ data }` / `{ error }`); frontend pages (e.g. `DemoHome.tsx` `loadData()`) surface `contactsRes.error?.message ?? contactsRes.data?.error ?? ...` and never swallow errors into fabricated success states.
- List/detail route `parasut_id` field agreement: not independently re-verified beyond what Phase 15's existing test suite (`src/test/parasutId.test.ts`, `src/test/schema_guard.test.ts`) already covers — those 34 + 14 tests pass (see section 8).
- Counters (`activeCount`/`archivedCount`/`totalCount` in `DemoHome.tsx`) come from the `customers` Edge Function's `action: "counts"`, a verified server-side count query, not client-side array length.
- Dev server / browser / curl route sanity checks, console-error checks, and 390px/768px responsive checks: **NOT PERFORMED** — no browser or network egress to the live/dev Supabase project available in this environment; a dev server was not started against live data, so no results are fabricated for this row.

## 8. Tests

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS — no errors |
| `npx vitest run` | PASS — 4 test files, 55 tests, all passed |
| `npm run lint` | PASS — 0 errors, 20 pre-existing `react-refresh/only-export-components` warnings (unrelated to this task, not newly introduced) |
| `npm run build:demo` | PASS — built successfully in ~6s, no errors |

Direct HTTP checks against production were **NOT PERFORMED** (explicitly out of scope).

## 9. Deployment

No migration applied, no Edge Function deployed, no push to remote. No code changes were made (see section 4 — no genuine defect found to fix), so the only local change from this task is the creation of this report file.

## 10. Summary / verdict

| Item | Status |
|---|---|
| Frontend `.from()` count (before → after) | 0 → 0 — PASS (already correct via Phase 15) |
| Frontend reads parasut base tables directly | No — PASS |
| Edge Functions are current access path (bonus check) | PASS (reasonable, read-only spot check) |
| `eDocuments.ts` / test mocks edge case | PASS — no stale `.from()` found |
| Sales-invoice reconciliation root cause | **UNKNOWN_OR_BLOCKED** — pending separate schema-drift investigation |
| Refresh button security | PASS |
| `tsc --noEmit` | PASS |
| `vitest run` | PASS (55/55) |
| `lint` | PASS (0 errors) |
| `build:demo` | PASS |
| Browser/responsive runtime checks | NOT PERFORMED (no browser/network available) |
| Live Paraşüt API / live DB row-level reconciliation | NOT PERFORMED / UNKNOWN_OR_BLOCKED (no credentials, out of scope) |

**Overall verdict: PASS** for everything within this audit's actual scope
(frontend source correctness, build/test health, refresh-button security).
**BLOCKED** on the sales-invoice reconciliation root-cause classification and
on `public`-schema-level view verification, both pending resolution of the
separately-tracked `parasut`/`parasut_ops` schema-drift incident
(`20260930000000`/`20260930010000`/`20260930020000`, missing `oauth_tokens`/`sync_runs`).

Code commit SHA: no code changes were made (no fix was needed), so there is no
code commit for this phase. Report commit SHA: see the commit created
alongside this file.

## Needs user/owner decision

- The sales-invoice-not-appearing report cannot be root-caused with confidence
  until the schema-drift incident is resolved by the parallel investigation.
  Once resolved, section 5 of this report should be re-run.
