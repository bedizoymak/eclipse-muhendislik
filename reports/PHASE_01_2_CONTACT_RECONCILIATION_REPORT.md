# Phase 1.2 — Contacts active/archived reconciliation report

- **Start:** 2026-08-25T23:16:19Z (continuing directly from Phase 1.1)
- **End:** 2026-08-25T23:55:00Z
- **Branch:** `main`
- **Base commit (before this phase):** `8ffab7a60418580f80d28136d6e9dd36d3744f33`
- **This phase's commit SHA:** _filled in below after commit, see final chat message for the definitive value_
- **Hosted Supabase project:** `yzuxdrknidveptvnwthf`
- **Live URL:** https://demo.eclipsemuhendislik.com

No secret values appear anywhere in this report.

## 1. Parasut `filter[archived]` — verified, not guessed

The published swagger (`https://apidocs.parasut.com/swagger.json`) does **not** list a `filter[archived]` parameter on `GET /{company_id}/contacts` — it only documents `filter[name]`, `filter[email]`, `filter[tax_number]`, `filter[tax_office]`, `filter[city]`, `filter[account_type]`, `sort`, `page[number]`, `page[size]`, `include`. `filter[archived]` **is** documented, but only on `inventory_levels`, `sales_offers`, `shipment_documents`, and `warehouses` — confirmed by downloading the raw 802 KB swagger.json and grepping every occurrence of `archived` in it directly (not relying on a lossy AI summary of the huge file, which gave contradictory answers).

Because the documented parameter list didn't settle the question either way, this was tested empirically against the **real, live Parasut API** (a one-off Node script using the account's own OAuth credentials from the local `.env`, deleted after use, no values ever printed):

| Request | `total_count` returned |
|---|---|
| `GET /contacts?page[size]=1` (no filter) | 440 |
| `GET /contacts?page[size]=1&filter[archived]=false` | 440 |
| `GET /contacts?page[size]=1&filter[archived]=true` | 8 |

**Conclusion, verified not assumed:** `filter[archived]` is real and functional for `contacts` despite being undocumented for this endpoint. The default (no filter) is equivalent to `filter[archived]=false`. 440 + 8 = 448, which is exactly the account's full contact count — closing the gap Phase 1.1's browser report flagged.

## 2–4. Dual-stream pagination

`supabase/functions/parasut-sync/parasut_client.ts`: `fetchPage`/`fetchAllPages` now accept an `extraParams` map, forwarded as query params.

`supabase/functions/parasut-sync/index.ts`: for `contacts`, runs two independent, fully-paginated fetches in parallel — `filter[archived]=false` and `filter[archived]=true` — via `Promise.all`. Each stream keeps the existing "throw if pagination stops before the reported last page" guard from Phase 1.1, and `Promise.all` means **either stream failing aborts the whole run** as an error (rule 4) — nothing is marked successful on a partial result. Response and `sync_runs` now carry `active_fetched_count`, `archived_fetched_count`, and a `total_fetched_count` (API response field name; stored in the pre-existing `fetched_count` DB column, now equal to active+archived).

## 5. If Parasut hadn't supported the filter

Not applicable here — verified supported (section 1). Documenting for completeness per the instructions: had the filter not worked, the rule would have been "don't delete the 8 pre-existing rows; report them as an unverifiable legacy record" — this branch was not needed.

## 6. `raw` payload

Unchanged: `resources/contacts.ts` still stores the complete JSON:API resource object in `raw` for every row in both streams, with no field added, removed, or altered.

## 7. `phone` on the demo view

New migration `20260826020000_parasut_contacts_reconciliation.sql` adds `phone` (already an existing column on `parasut.contacts`, mapped from the API since Phase 1) to `public.parasut_contacts_demo`. No new/fake column was created.

**Migration bug caught before it reached hosted:** the first version of this migration inserted `phone` and the two new `sync_runs` columns in the *middle* of each view's `select` list. `CREATE OR REPLACE VIEW` requires every existing output column to keep both its name and its ordinal position — Postgres rejected it: `ERROR: cannot change name of view column "contact_type" to "phone" (SQLSTATE 42P16)`. The push failed cleanly (whole migration rolled back — verified afterward that `sync_runs.active_fetched_count` did **not** exist and `migration list` still showed the migration as not applied to remote). Fixed by appending all new columns at the end of each view's column list instead, then re-pushed successfully.

## 8. Demo home counters

`src/pages/DemoHome.tsx` now shows four real, independently-queried counters: Aktif müşteriler, Arşivli müşteririye, Toplam kayıt, Son başarılı sync (with active/archived breakdown from the last sync run). All four come from live `count: exact` queries or the sync status view — no arithmetic shortcuts.

## 9–10. `/musteriler` default filter + tabs

`src/pages/Musteriler.tsx`: defaults to `archived = false`. Aktif/Arşivli/Tümü buttons, each showing its own real count (`count: exact` per filter), re-querying on click.

## 11. Phone on detail page

`src/pages/MusteriDetay.tsx` now selects and displays `phone` directly from `parasut_contacts_demo` (real value, `null` shown as `—` when Parasut has no phone on file — never fabricated).

## 12. No source normalization

Neither the sync function nor the migration applies `trim()` or any other transform to Parasut's values before storing them — `raw` and the mapped `email`/`phone`/etc. columns are stored exactly as the API returned them, including the one contact whose email has a leading space. `DemoHome.tsx`/`Musteriler.tsx` call `.trim()` **only in the JSX render**, for the on-screen text — the stored value, the `raw` payload, and everything returned by the API are untouched. This matches the instruction: "UI'da istenirse yalnızca görsel sunum için trim yapılabilir; raw ve kolon değeri değişmemeli."

## 13. Horizontal scroll

Both `DemoHome.tsx` and `Musteriler.tsx` tables are now wrapped in `overflow-x-auto` containers with a `min-w` on the table, so columns no longer disappear/clip on narrow viewports (the Phase 1.1 browser report's "Tür kolonu kırpılıyor" finding).

## 14. Invalid `parasutId`

Unchanged behavior, still verified working: an unknown-but-valid-looking numeric id shows "Müşteri bulunamadı"; a non-numeric id surfaces a clear error banner from the failed query rather than crashing or showing a blank screen. No special-casing was needed or added.

## 15–17. Hosted deploy

**Local verification note:** Docker Desktop was unresponsive/erroring for the entire duration of this phase's work (`docker ps` / `supabase start` failed with daemon-level errors: `LegacyDockerLifecycleInspectError`, then later plain hangs). This blocked running the local Supabase stack or `supabase functions serve` to dry-test before deploying, unlike Phase 1.1. Given the task's actual deliverable is the hosted deploy, and given the archived-filter behavior itself had already been verified directly against the real Parasut API (section 1, independent of local Supabase), this phase's changes were deployed straight to hosted and verified there instead — see below. This gap is flagged, not hidden.

- **Migration:** `supabase db push` — first attempt **failed cleanly** (see section 7), fixed, second attempt **succeeded**. `supabase migration list` confirms all 4 migrations now match local/remote.
- **Edge Function:** `supabase functions deploy parasut-sync` — **succeeded** (deployed without Docker, using remote asset upload; CLI printed `WARNING: Docker is not running` but completed the deploy).
- **Hosted dry run:** `{"status":"dry_run","total_fetched_count":448,"active_fetched_count":440,"archived_fetched_count":8,"upserted_count":0,"error_count":0,"total_count_reported":448}`
- **Hosted real sync:** `{"status":"success","total_fetched_count":448,"active_fetched_count":440,"archived_fetched_count":8,"upserted_count":448,"error_count":0}`
- **Frontend build:** `npm run build:demo` → success, `dist/demo/assets/index-Cr3lhBdi.js`.
- **Frontend deploy:** same FTP method as Phase 1.1 (`scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo`, `MSYS_NO_PATHCONV=1` to avoid the Git-Bash path-mangling caught in Phase 1.1). Dry-run confirmed the correct remote path, then real upload: **19/19 files uploaded**.

## 18. Live coverage check

| Layer | Active | Archived | Total |
|---|---|---|---|
| Parasut API (this sync's fetch) | 440 | 8 | 448 |
| Supabase `parasut.contacts` (`Content-Range` header, verified via anon-readable view) | 440 | 8 | 448 |
| Demo UI counters (same queries the page runs) | 440 | 8 | 448 |

**All three layers agree on the same scope.** This is the condition the task requires before calling anything complete, and it holds.

- `phone` verified real on the hosted view, e.g. `{"parasut_id":1011029218,...,"phone":"02125672019"}`.
- Live routes, all HTTP 200: `/`, `/musteriler`, `/musteriler/1011029218` (active), `/musteriler/1011029178` (archived).
- Live `index.html` references `assets/index-Cr3lhBdi.js` / `assets/index-RqOK1I0q.css` — matching the fresh build's hashes, confirming the deployed code is current.
- **Known carryover limitation (from Phase 1.1, unchanged):** `demo.eclipsemuhendislik.com` still serves a self-signed TLS certificate, so this session cannot render the live page in an actual trust-validating browser (WebFetch/plain curl both reject it). HTTP-status and bundle-hash checks were done with certificate validation bypassed. Visual, in-browser confirmation of the new counters/filters/phone field is **not independently confirmed by this session** — see Claude Browser handoff below.

## 19. Test / lint / build

- `npm test` → 1/1 passed (pre-existing placeholder test, unaffected).
- `npm run lint` → 0 errors, 10 pre-existing warnings (unrelated shadcn/ui + `LanguageContext.tsx` fast-refresh warnings, unchanged from Phase 1.1).
- `npm run build:demo` → success.
- (Informational) `tsc --noEmit -p tsconfig.app.json` → same single pre-existing error in `src/pages/Login.tsx:55`, not touched, not in scope.

## Changed files (this phase)

Modified: `src/pages/DemoHome.tsx`, `src/pages/Musteriler.tsx`, `src/pages/MusteriDetay.tsx`, `supabase/functions/parasut-sync/index.ts`, `supabase/functions/parasut-sync/parasut_client.ts`
Added: `supabase/migrations/20260826020000_parasut_contacts_reconciliation.sql`, `reports/PHASE_01_2_CONTACT_RECONCILIATION_REPORT.md`
Not touched (user's own, pre-existing): `vite.config.ts`, `src/pages/Login.tsx`, `AUDIT_REPORT.md`
Deployed (not committed, build output): `dist/demo/**` → uploaded via FTP

## Unverified / failed items

1. **No local Docker verification this phase** — Docker Desktop was down/unresponsive throughout (see section 15–17). Compensated with direct hosted verification plus an independent real-API probe for the archived-filter question itself.
2. **Visual/browser render on the live site is still not independently confirmed** by this session, for the same self-signed-certificate reason as Phase 1.1. HTTP 200 + matching bundle hash + matching Supabase/API/UI-query counts were confirmed instead.
3. One migration push attempt failed (caught and fixed within this session before any further action — see section 7); mentioning for completeness, not hidden.

## Sample `parasut_id` values for Claude Browser

- **Active:** `1011029218` — 2F MAKİNE SAN. VE DIŞ TİC. LTD. ŞTİ. (phone: `02125672019`)
- **Active:** `1017928283` — ABBAS ÇELİKTEN (phone: `0530 118 73 76`)
- **Archived:** `1011029178` — HİRA PARTS METAL SANAYİ VE TİCARET LİMİTED ŞİRKETİ (phone: `null` in Parasut — expect "—" on screen, not a blank/error)
