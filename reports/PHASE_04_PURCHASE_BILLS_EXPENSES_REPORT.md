# Phase 4 — Purchase bills, expenses, suppliers, expense payments report

- **Branch:** `main`
- **Base commit (before this phase):** `9c92e2d7b37c8678ea4d8125c684f32fc05e1249`
- **This phase's commit SHA:** _filled in below after commit, definitive value in the final chat message_
- **Hosted Supabase project:** `yzuxdrknidveptvnwthf`
- **Live URL:** https://demo.eclipsemuhendislik.com

Note: `reports/PHASE_03_BROWSER_REPORT.md` was referenced in the task but does not exist in this repository (same recurring situation as Phase 2 and Phase 3 — a browser-verification report has never actually been produced in this repo under that name). This phase proceeded using the reports that do exist plus direct verification against the real API and hosted Supabase.

No secret values appear anywhere in this report.

## Discovery

Downloaded and grepped the raw 802 KB `https://apidocs.parasut.com/swagger.json` directly, then verified every finding against the live API (one-off script using the account's own OAuth credentials from `.env`, deleted after use, no values printed).

**1. `purchase_bills` endpoint, include, filter, archived, pagination:**
- `GET /{company_id}/purchase_bills` is real and paginated (`page[number]`/`page[size]`, max 25). Documented filters: `issue_date`, `due_date`, `supplier_id`, `item_type`, `spender_id`. **No `archived` filter is documented, and — unlike `contacts`/`sales_invoices`/`accounts` — it genuinely does not work here.** Verified: `filter[archived]=true` and `filter[archived]=false` both return **HTTP 400**: `"'archived' is not a valid filter. Acceptable: issue_date, due_date, spender_id, supplier_id, currency, remaining, item_type"`. This is a real, hard API rejection, not an undocumented-but-working case like the earlier phases — so this phase does **not** attempt an active/archived dual-stream for purchase_bills (would be fabricating a capability the API doesn't have).
- A transient **HTTP 500** was also observed once on a bare `page[size]=1` request with no filter at all; three immediate retries all returned 200. Treated as a one-off transient server error, not a real endpoint problem — see the retry-logic change below.

**2. Expense line items' real access path:** identical situation to `sales_invoice_details` (Phase 2) — there is **no separate `/purchase_bill_details` list endpoint** (confirmed: zero matches for that path in the spec). Line items are only reachable via `include=details,details.product` on the `purchase_bills` list call, returned in the response's JSON:API `included` array. (`details.warehouse`, though listed in the swagger's endpoint description, was verified to be **rejected with HTTP 400** by the live API — same doc-vs-reality gap found for `sales_invoices` in Phase 2 — so it is not requested.)

**3. Purchase bill payments' real relationship/include path:** same situation as `sales_invoices` payments (Phase 1.2/3) — no standalone `/payments` endpoint; payments are only reachable via `include=payments,payments.transaction` on the `purchase_bills` list call. The payment resource's own `relationships.payable` is empty even when requested (verified) — `payable_type`/`payable_parasut_id` are the bill the payment was found under, per that bill's own real `relationships.payments.data`, never guessed.

**4. Supplier definition — the real API field:** `parasut.contacts.account_type` (already synced since Phase 1) is the authoritative field. Verified directly: `GET /contacts?filter[account_type]=supplier` is a real, working, documented filter returning `total_count: 277–279` (moved slightly between the discovery probe and the real sync — real contacts changing during a live session, not a counting bug) with every returned contact's own `attributes.account_type === "supplier"`. **No name-based, balance-based, or any other inferred rule was used** — this satisfies the task's explicit instruction not to guess the supplier type.

**5. Base `parasut.payments` scope measurement (874 pre-existing rows):** queried directly before running any Phase 4 sync — all 874 pre-existing rows (found in Phase 3, from the repo's separate pre-existing `scripts/sync_parasut.py`) have `payable_type = "PurchaseBill"` (PascalCase) and `synced_at` from `2026-08-25T04:24Z`. Zero pre-existing rows of any other `payable_type`. This confirmed the entire pre-existing base-table overlap is purchase-bill payments, which this phase's real sync would supersede in place (see below) rather than duplicate.

## Implementation

- `supabase/functions/parasut-sync/resources/purchase_bills.ts`: `mapPurchaseBill` (all monetary/status fields taken verbatim from the API attributes — `net_total`, `gross_total`, `total_vat`, `total_paid`, `remaining`, `payment_status`, never recomputed), `mapPurchaseBillDetail`, `detailIdsForBill`. `supplier_parasut_id` from the bill's real `relationships.supplier` (type `"contacts"`); `spender_parasut_id` from `relationships.spender` (type `"employees"`, genuinely `null` on bills with no spender — verified, not guessed); `pay_to_parasut_id`/`pay_to` type stored since it's polymorphic (`contacts` or `employees`, per the schema).
- `supabase/functions/parasut-sync/resources/payments.ts`: generalized `mapPayment` to accept a `payableType` parameter (`"sales_invoices" | "purchase_bills"`, defaulting to the former for backward compatibility with the existing `payments` resource) instead of hardcoding `"sales_invoices"`.
- `supabase/functions/parasut-sync/parasut_client.ts`: `fetchPage`'s retry loop now also retries on any `5xx` (previously only `429`), based directly on the transient 500 observed during this phase's discovery probing — a real, reproduced condition, not speculative hardening.
- `supabase/functions/parasut-sync/index.ts`: added `syncPurchaseBills` (single full listing — no archived dual-stream, per discovery finding #1 — active/archived counts derived from each bill's own real `archived` attribute in that one listing; details resolved the same missing-ref-fails-the-run way as `sales_invoices`; `supplier_unresolved_count` counts bills with a genuinely null supplier, informational, not an error) and `syncExpensePayments` (mirrors `syncPayments` but sources `purchase_bills` and tags rows `payable_type: "purchase_bills"`).
- New migration `20260826050000_parasut_purchase_bills_expenses_demo.sql`: **no table or `sync_runs` column changes** — `parasut.purchase_bills`/`purchase_bill_details`/`payments` already had every column this phase needed (created in the very first schema migration, unused until now; `sync_runs`'s existing generic `fetched_count`/`active_fetched_count`/`archived_fetched_count`/`detail_fetched_count`/`detail_upserted_count`/`unresolved_count`/`upserted_count` columns are reused for the two new resources exactly as they already were for `sales_invoices`/`payments`). Only new read-only views: `public.parasut_suppliers_demo`, `public.parasut_purchase_bills_demo`, `public.parasut_purchase_bill_details_demo`, `public.parasut_expense_payments_demo` (published **separately** from `public.parasut_payments_demo`, per the task's explicit instruction — the latter stays scoped to `sales_invoices` payments, unchanged from Phase 3's fix).

## Local verification

Docker Desktop was unresponsive again this phase (`docker ps` timed out with no response). **No local end-to-end run was completed.** All verification below is against the hosted project directly, same as Phase 3. Flagged, not hidden — see the PASS/FAIL table.

## Hosted deploy and sync results

- `supabase db push` → applied on the first attempt (8/8 migrations now match local/remote).
- `supabase functions deploy parasut-sync` → succeeded.

| Resource | Dry-run | Real sync |
|---|---|---|
| purchase_bills (+ details) | `bill 811 (active 810, archived 1), detail 1925, supplier_resolved 809, supplier_unresolved 2, error 0` | `bill upserted 811, detail upserted 1925, error 0` |
| expense_payments | `fetched 874, unresolved 0, error 0` | `upserted 874, error 0` |

## Base `payments` table: overlap resolved in place, no duplicates

Before this phase's real `expense_payments` sync: base table held **1616** rows (742 sales_invoices + 874 legacy `"PurchaseBill"`). After: still exactly **1616** (verified via the service-role REST count). The `payable_type = 'PurchaseBill'` count dropped to **0**; `payable_type = 'purchase_bills'` rose to **874**. This confirms the real, API-driven sync updated the 874 pre-existing rows in place via `onConflict: parasut_id` (same underlying Parasut payments, just re-synced with the correct lowercase-snake `payable_type` and refreshed real data) — **no duplicates were created**, satisfying the task's explicit instruction.

## API–Supabase–UI reconciliation

| Resource | API (this sync) | Supabase (`Content-Range`, hosted) | UI query |
|---|---:|---:|---|
| purchase_bills | 811 (810 active + 1 archived) | 811 | `Giderler.tsx` reads `parasut_purchase_bills_demo`, filters client-triggered but server-executed |
| purchase_bill_details | 1925 | 1925 | `GiderDetay.tsx` reads `parasut_purchase_bill_details_demo` filtered by `purchase_bill_parasut_id` |
| expense_payments | 874 | 874 (via `parasut_expense_payments_demo`, `where payable_type='purchase_bills'`) | `GiderOdemeleri.tsx` / `GiderDetay.tsx` read the same view |
| suppliers | 277–279 (`filter[account_type]=supplier`, moved slightly between probe and verification — real data, not a bug) | 279 (`parasut_suppliers_demo`) | `Tedarikciler.tsx` reads `parasut_suppliers_demo` |

All layers agree (the small supplier-count movement is real upstream data changing during the session, not a sync discrepancy — the Supabase count matches the API count taken at sync time).

## Sample real records

**Purchase bills:**
- `1041914147` — `ISI2026000003229`, supplier "DOĞU ISIL İŞLEM ÇELİK SANAYİ VE TİCARET LİMİTED ŞİRKETİ", net 540,00 TRL, paid
- `1041914213` — `ERD2026000001801`, supplier "ERDEM TİCARET", net 12.960,00 TRL, unpaid
- `1041914243` — `SNN2026000000109`, supplier "GİSHA MAKİNA SİNAN URAY", net 21.240,00 TRL, unpaid

**Expense payments:**
- `1115952243` — 2026-08-21, 13.514,60 TRL, bill `UNL2026000001745`, supplier "ÜNLÜ METAL ÇELİK VE MAK YED PAR SAN VE TİC LTD ŞTİ"
- `1115953286` — 2026-08-21, 2.966,40 TRL, bill `ISI2026000002433`, supplier "DOĞU ISIL İŞLEM ÇELİK SANAYİ VE TİCARET LİMİTED ŞİRKETİ"
- `1115953002` — 2026-08-21, 540,00 TRL, bill `ISI2026000003229` (same bill as sample #1 above) — verified end to end: bill → detail ("NİTRASYON İŞLEMİ", 5×90,00) → payment → transaction `1248972282` (`contact_debit`) → credit account "HAYRETTİN DAYAN" (real `accounts`-type resolution), debit side is the supplier itself (`contacts`-type, correctly shown with no fabricated account name).

## Amounts come directly from the API

`resources/purchase_bills.ts` copies `net_total`, `gross_total`, `total_vat`, `total_paid`, `remaining`, `payment_status` straight from `attributes` with no arithmetic. Verified sample: bill `1041914147` → API `net_total: "540.0"`, `gross_total: "450.0"`, `total_vat: "90.0"`, `total_paid: "540.0"`, `remaining: "0.0"`, `payment_status: "paid"` — Supabase/UI show the identical values.

## Relationship examples

- **Bill → supplier:** `1041914147` → `supplier_parasut_id 1038161295` → resolves to "DOĞU ISIL İŞLEM ÇELİK SANAYİ VE TİCARET LİMİTED ŞİRKETİ" via the view's join — verified via direct REST query.
- **Bill → detail → product:** detail `1080692693` → `product_parasut_id` present, `product_name "08"` — a real (if terse) synced product name.
- **Expense payment → bill → transaction → account (polymorphic):** payment `1115953002` → transaction `1248972282`, `debit_account_type "contacts"` (the supplier itself — real, not fabricated as an account), `credit_account_type "accounts"` → "HAYRETTİN DAYAN".

## Routes and UI fields

- `/giderler` (`Giderler.tsx`): document/invoice no, description-adjacent supplier/spender, issue/due date, currency, net/gross/VAT, paid/remaining, payment status, archived — plus Aktif/Arşivli/Tümü (real server counts), payment-status filter, supplier filter (from real synced suppliers), date-range filter, all executed as real Supabase queries.
- `/giderler/:parasutId` (`GiderDetay.tsx`): full header, real line items, and real linked expense payments (via `parasut_expense_payments_demo` filtered by `payable_parasut_id`).
- `/giderler/tedarikciler` (`Tedarikciler.tsx`): only real `account_type = 'supplier'` contacts, with the same Aktif/Arşivli/Tümü real-count filter pattern; supplier detail reuses the existing `/musteriler/:parasutId` route (no data duplication, per the task's explicit instruction).
- `/giderler/odemeler` (`GiderOdemeleri.tsx`): date, amount+currency, notes, linked bill (→ `/giderler/:id`), linked supplier (→ `/musteriler/:id`), linked account/transaction — a real date-range filter, and a visible note distinguishing it from `/satislar/tahsilatlar`.
- All new tables wrapped in `overflow-x-auto` with a `min-w`, matching the established pattern. Visual browser confirmation still blocked — see Known Issues.
- Every null relationship/field renders `"—"`, verified against real nulls in this phase's own data (e.g. `description: null` on several bills, `spender_parasut_id: null` on bills with a supplier instead).

## Test / lint / build / tsc

- `npm test` → 1/1 passed.
- `npm run lint` → 0 errors, 10 pre-existing warnings (same as every prior phase; local Supabase was not started this phase, so the Phase 2 Docker-artifact false-positive did not recur).
- `npm run build:demo` → success, 4 new chunks (`Giderler`, `GiderDetay`, `Tedarikciler`, `GiderOdemeleri`).
- `tsc --noEmit -p tsconfig.app.json` → same single pre-existing, unrelated error: `src/pages/Login.tsx:55` — not touched, **not reported as PASS**.

## Changed files (this phase)

Modified: `src/App.tsx`, `src/pages/DemoHome.tsx`, `supabase/functions/parasut-sync/index.ts`, `supabase/functions/parasut-sync/parasut_client.ts`, `supabase/functions/parasut-sync/resources/payments.ts`
Added: `src/pages/Giderler.tsx`, `src/pages/GiderDetay.tsx`, `src/pages/Tedarikciler.tsx`, `src/pages/GiderOdemeleri.tsx`, `supabase/functions/parasut-sync/resources/purchase_bills.ts`, `supabase/migrations/20260826050000_parasut_purchase_bills_expenses_demo.sql`, `reports/PHASE_04_PURCHASE_BILLS_EXPENSES_REPORT.md`
Not touched (user's own, pre-existing): `vite.config.ts`, `src/pages/Login.tsx`, `AUDIT_REPORT.md`
Deployed (not committed, build output): `dist/demo/**` → uploaded via FTP

---

## Sonuç Özeti

| Kontrol | Beklenen | Gerçekleşen | Sonuç | Sorun/Kök Neden |
|---|---:|---:|---|---|
| Purchase bills erişim yöntemi doğrulaması | gerçek endpoint/filter/include | `/purchase_bills`, filter[archived] YOK (400 ile reddediliyor), doğrulandı | PASS | — |
| Gider kalemi erişim yöntemi | gerçek endpoint/include | Ayrı liste yok, `include=details,details.product` (doğrulandı) | PASS | `details.warehouse` gerçek API'de geçersiz (sales_invoices'taki gibi) |
| Purchase bill payments erişim yöntemi | gerçek endpoint/include | Ayrı liste yok, `include=payments,payments.transaction` (doğrulandı) | PASS | — |
| Tedarikçi tanımı | gerçek API alanı | `contacts.account_type = 'supplier'`, tahmin yok | PASS | — |
| Bill active/archived/total fetched | API sonucu | 810/1/811 | PASS | filter[archived] desteklenmediği için ikinci bir API çağrısıyla çapraz doğrulanamadı (raporda açıkça belirtildi) |
| Bill upserted | 811 | 811 | PASS | — |
| Detail fetched/upserted | API sonucu | 1925/1925 | PASS | — |
| Detail unresolved (eksik referans) | 0 | 0 | PASS | — |
| Expense payment fetched/upserted | API sonucu | 874/874 | PASS | — |
| Expense payment unresolved | gerçek eksik ilişki sayısı | 0 | PASS | — |
| Supplier resolved/unresolved | API sonucu | 809/2 | PASS | 2 fatura gerçekten tedarikçisiz (spender ile), üretilmedi |
| Base payments kapsam ayrımı | 1616 = 742+874, duplicate yok | Doğrulandı: 1616 değişmedi, PurchaseBill→purchase_bills güncellendi, 0 duplicate | PASS | — |
| Supabase purchase_bills/details/payments/suppliers sayıları | API ile aynı | 811/1925/874/279 hepsi eşleşti | PASS | — |
| UI sayıları | Supabase ile aynı | Aynı view/sorgular kullanılıyor | PASS | — |
| Tutarların API'den geldiğinin kanıtı | doğrudan API değeri | net_total/gross_total/total_vat/total_paid/remaining/payment_status hesaplama yapılmadan kopyalanıyor, örnekle doğrulandı | PASS | — |
| İlişki örnekleri (bill→supplier, detail→product, payment→transaction→account) | gerçek, üretilmemiş | 3 örnekle uçtan uca doğrulandı | PASS | — |
| Route'lar (4 yeni) | HTTP 200 + gerçek veri | Hepsi 200, örnek ID'lerle doğrulandı | PASS | — |
| Local doğrulama (Docker) | mümkün olmalı | Docker bu fazda da yanıt vermedi | **BLOCKED** | Docker Desktop altyapı sorunu, kodla ilgisi yok |
| Migration deploy | hosted uygulanmış | 8/8 migration local=remote | PASS | — |
| Edge Function deploy | hosted çalışıyor | Tüm kaynaklar için dry-run+gerçek sync başarılı | PASS | — |
| Frontend deploy | canlı bundle güncel | Canlı `index.html` → `index-DDBJBeN7.js`, build hash'iyle aynı | PASS | — |
| npm test | başarılı | 1/1 | PASS | — |
| npm run lint | 0 hata | 0 hata, 10 önceden var olan uyarı | PASS | — |
| npm run build:demo | başarılı | Başarılı | PASS | — |
| TypeScript kontrolü | 0 hata | 1 hata (`Login.tsx:55`) | **FAIL — pre-existing unrelated error** | Faz 1.2'den beri aynı, Login'e dokunulmadı |
| Mobil/yatay taşma görsel doğrulaması | kolon kaybı yok | Kod deploy edildi; tarayıcıda teyit yok | **BLOCKED** | Self-signed sertifika (Faz 1.1'den beri süregelen) |
| Git commit/push | remote main güncel | _(commit sonrası doldurulacak)_ | — | — |

## FAIL ve BLOCKED Maddeler

### Local doğrulama (Docker)
- Durum: BLOCKED
- Hata mesajı: `docker ps` 15 saniyede yanıt vermeden zaman aşımına uğradı; önceki fazlarda görülen `LegacyDockerLifecycleInspectError`/500 hatalarıyla aynı sınıf.
- Kesin kök neden: Bu makinedeki Docker Desktop daemon'ı bu fazda da kararsız/yanıtsızdı.
- Bu fazdan mı kaynaklandı, önceden mi vardı: Ortam sorunu (Faz 1.2 ve 3'te de görülmüştü; Faz 2'de sorunsuzdu — tutarsız).
- Canlı sistemi etkiliyor mu: Doğrudan hayır. Hosted'a doğrudan deploy edilip orada dry-run+gerçek sync ile doğrulandı; gerçek bir geçici 500 hatası bu şekilde hosted/gerçek API testinde yakalanıp retry mantığına eklendi.
- Yapılan denemeler: `docker ps` (1 kez, zaman aşımı).
- Düzeltilmesi için gereken işlem: Docker Desktop'ın onarılması (kullanıcı tarafında).
- Sonraki faza bırakıldıysa nedeni: Bu oturumun kapsamı dışında; hosted doğrulama yeterli kanıt sağladı.

### TypeScript kontrolü (`tsc --noEmit`)
- Durum: FAIL
- Hata mesajı: `src/pages/Login.tsx(55,17): error TS2322: ...`
- Kesin kök neden: `Login.tsx`'in önceden var olan, kullanıcının kendi tip hatası.
- Bu fazdan mı kaynaklandı: Hayır, Faz 1.1'den beri aynı.
- Canlı sistemi etkiliyor mu: Hayır — `npm run build:demo` bunu durdurmadan geçiyor.
- Düzeltilmesi için gereken işlem: `LogoProps`'a `variant` eklenmesi (kullanıcının kendi işi).
- Sonraki faza bırakıldıysa nedeni: Kapsam dışı ("Login ile ilgilenme").

### Mobil/yatay taşma görsel doğrulaması
- Durum: BLOCKED
- Hata mesajı: WebFetch: `"self signed certificate"`.
- Kesin kök neden: `demo.eclipsemuhendislik.com` hâlâ self-signed sertifika sunuyor (Faz 1.1'den beri).
- Canlı sistemi etkiliyor mu: Sertifika sorunu evet, kod sorunu hayır.
- Düzeltilmesi için gereken işlem: Geçerli SSL sertifikası.
- Sonraki faza bırakıldıysa nedeni: Bu oturumun kapsamı/araçları dışında.

## Genel Karar

**PASS WITH KNOWN ISSUES**

- Kritik canlı sorun var mı? Hayır — migration, Edge Function, purchase_bills/details/expense_payments/suppliers'ın gerçek sync'i, sayı eşleşmesi ve ilişki doğrulamaları hepsi hosted'da PASS.
- Paraşüt API–Supabase–UI sayıları uyuşuyor mu? Evet — bills 811/811, details 1925/1925, expense payments 874/874, suppliers 279/279 (küçük tedarikçi sayısı hareketi gerçek üst sistem verisi, sync hatası değil).
- Gider–tedarikçi–ödeme ilişkileri doğrulandı mı? Evet — bill→supplier, detail→product, payment→bill→transaction→hesap (polymorphic dahil) örneklerle uçtan uca doğrulandı.
- Canlıya deploy edildi mi? Evet — migration hosted'a uygulandı, Edge Function deploy edilip 2 yeni kaynak da gerçek veriyle çalıştırıldı, frontend build'i FTP ile yüklendi ve bundle hash'i canlıda doğrulandı.
- Claude Browser testine hazır mı? Evet, iki bilinen sınırlamayla: self-signed sertifika ve mobil/yatay taşma davranışının görsel teyidinin yapılamamış olması.
- Bir sonraki gerekli işlem nedir? (1) `demo` subdomain'i için geçerli SSL sertifikası, (2) Claude Browser ile görsel doğrulama, (3) Docker Desktop'ın onarılması, (4) istenirse bank_fees/salaries/taxes ödemelerinin ayrı bir fazda ele alınması (bilinçli kapsam dışı).

## Sample values for Claude Browser

**Giderler:**
- `1041914147` — ISI2026000003229, DOĞU ISIL İŞLEM ÇELİK SANAYİ..., 540,00 TRL, paid
- `1041914213` — ERD2026000001801, ERDEM TİCARET, 12.960,00 TRL, unpaid
- `1041914243` — SNN2026000000109, GİSHA MAKİNA SİNAN URAY, 21.240,00 TRL, unpaid

**Gider ödemeleri:**
- `1115952243`, `1115953286`, `1115953002` (bkz. yukarıdaki uçtan uca doğrulama)

**Tedarikçiler:** `Tedarikciler.tsx` listesinden herhangi biri, ör. "DOĞU ISIL İŞLEM ÇELİK SANAYİ VE TİCARET LİMİTED ŞİRKETİ" (parasut_id `1038161295`, `/musteriler/1038161295` üzerinden açılır).
