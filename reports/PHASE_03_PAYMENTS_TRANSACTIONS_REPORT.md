# Phase 3 — Payments, transactions, accounts sync report

- **Branch:** `main`
- **Base commit (before this phase):** `e4158e067056e737e36e9024bc8423d30175e4e8`
- **This phase's commit SHA:** `c8c37b49af03da98a712b1260b6d5cfc5ff80024` (`c8c37b4`)
- **Push result:** `e4158e0..c8c37b4 main -> main` — success
- **Hosted Supabase project:** `yzuxdrknidveptvnwthf`
- **Live URL:** https://demo.eclipsemuhendislik.com

Note: `reports/PHASE_02_BROWSER_REPORT.md` was referenced in the task but does not exist in this repository (same situation as Phase 2, where `PHASE_01_2_BROWSER_REPORT.md` was likewise missing). This phase proceeded using the reports that do exist plus direct verification against the real API and hosted Supabase.

No secret values appear anywhere in this report.

## Discovery: Parasut's real payment access method

Downloaded and grepped the raw 802 KB `https://apidocs.parasut.com/swagger.json` directly (not a lossy AI summary):

1. **No standalone `/payments` list endpoint exists.** Confirmed by searching every path in the spec for "payment": the only payment-related paths are nested under their parent resource — `/{company_id}/sales_invoices/{id}/payments`, `/purchase_bills/{id}/payments`, `/bank_fees/{id}/payments`, `/salaries/{id}/payments`, `/taxes/{id}/payments`. Per the task's own instruction ("ayrı payments liste endpoint'i yoksa tahmin etme"), this phase does **not** invent one.
2. **No standalone `/transactions` list endpoint exists either** — only `/{company_id}/transactions/{id}` (single-resource GET) and `/{company_id}/accounts/{id}/transactions` (a real, paginated per-account list, confirmed to support `page[number]`/`page[size]`/`include=debit_account,credit_account`).
3. **`/{company_id}/accounts` is a real, paginated list endpoint** with `filter[name]`, `filter[currency]`, `filter[bank_name]`, `filter[bank_branch]`, `filter[account_type]`, `filter[iban]`, `sort`, `page[number]`, `page[size]` — no documented `filter[archived]`, but (as with `contacts`/`sales_invoices` in earlier phases) verified empirically to work anyway: `filter[archived]=true` → 0 accounts, `filter[archived]=false`/no filter → 3 accounts, for this company.

**Chosen real relationship paths** (verified against the live API with a one-off script using the account's own OAuth credentials from `.env`, deleted after use, no values printed):

- **Payments:** `GET /sales_invoices?include=payments,payments.transaction` returns each invoice's payments (and their linked transaction id) in the JSON:API `included` array. The payment resource's own `relationships.payable` comes back empty (`{"meta":{}}`) even when requested — Parasut doesn't expose it — so `payable_type`/`payable_parasut_id` are **not** read from the payment itself. They are the invoice this payment was found under, a real relationship the invoice's own `relationships.payments.data` explicitly states (not an inference).
- **Transactions:** `GET /accounts/{id}/transactions?include=debit_account,credit_account`, iterated over every account. Verified the `debit_account`/`credit_account` relationship is **polymorphic in practice** — usually `type: "accounts"`, but confirmed a real case of `type: "contacts"` (a `contact_credit` transaction against a customer's balance). The swagger only documents `"accounts"` for both — another doc-vs-reality gap, resolved by storing the real type alongside the id (new columns, see below) rather than mislabeling it.
- **Accounts:** `GET /accounts`, same active/archived dual-stream pattern as `contacts`/`sales_invoices`.

## Coverage boundary (payments)

This phase's `payments` resource covers **only payments attached to sales_invoices** — matching the `/satislar/tahsilatlar` ("sales collections") scope explicitly named in the task. Purchase bill, bank fee, salary, and tax payments are **not synced** by this phase; they use different parent endpoints (`/purchase_bills/{id}/payments` etc.) that were not implemented here. This is stated in `resources/payments.ts`'s own comment header, in the sync response's `coverage` field, and here.

**Pre-existing out-of-scope data found:** `parasut.payments` already held 874 rows before this phase ran — from the repo's separate, pre-existing `scripts/sync_parasut.py` (same situation as the 8 pre-existing archived contacts found in Phase 1.2), with `payable_type: "PurchaseBill"` (note the different casing from this phase's `"sales_invoices"`) and `synced_at` timestamps from `2026-08-25T04:24Z`, well before this session. **Bug caught and fixed within this session:** the first version of `public.parasut_payments_demo` had no `WHERE` clause, so it would have mixed those 874 legacy purchase-bill rows into `/satislar/tahsilatlar` with blank invoice/contact fields (they don't join against `sales_invoices`). A follow-up migration (`20260826041000_parasut_payments_demo_scope_fix.sql`) added `where p.payable_type = 'sales_invoices'`, scoping the view to exactly what this phase actually synced and verified. The 874 legacy rows were **not deleted or modified** — they remain in the base table, simply excluded from this demo view per the documented scope.

## Implementation

- `supabase/functions/parasut-sync/resources/accounts.ts`: `mapAccount` — `balance` stored exactly as the API returns it, never recomputed from transaction history.
- `supabase/functions/parasut-sync/resources/payments.ts`: `mapPayment(payment, invoiceParasutId)` + `paymentIdsForInvoice(invoice)`.
- `supabase/functions/parasut-sync/resources/transactions.ts`: `mapTransaction` — stores `debit_account_type`/`credit_account_type` alongside the ids (new columns, see migration).
- `supabase/functions/parasut-sync/index.ts`: added `syncAccounts` (dual-stream, same pattern as contacts), `syncPayments` (dual-stream sales_invoices fetch, extracts payments per invoice, `unresolved_count` = payments with no linked transaction), `syncTransactions` (enumerates all accounts, fetches each account's transactions fully paginated in parallel via `Promise.all` — any single account's failure or incomplete pagination aborts the whole run — then dedupes by `parasut_id` since the same transaction legitimately appears under both its debit and credit account's lists).
- New migration `20260826040000_parasut_payments_transactions_accounts_demo.sql`: adds `debit_account_type`/`credit_account_type` (text, nullable) to `parasut.transactions`, `unresolved_count` (integer, nullable) to `parasut.sync_runs`, and three demo views. Follow-up `20260826041000_parasut_payments_demo_scope_fix.sql` fixes the payments view scope (above).

**Bug caught and fixed before the real sync ran:** the first `syncPayments` implementation requested `include=payments` only (not `payments.transaction`). The dry run came back with **742 fetched, 742 unresolved** — every single payment showing no linked transaction, which didn't match the earlier manual probe (which *did* see a transaction link). Root-caused immediately: the transaction relationship linkage, like `product`/`warehouse` in Phase 2, only appears when its own include path is explicitly requested. Fixed to `include=payments,payments.transaction`, redeployed, reran: **0 unresolved**.

## Local verification

Docker Desktop was unresponsive for this phase's `supabase start`/`db reset` attempts (`LegacyDockerLifecycleInspectError`, then plain timeouts — same class of issue as Phase 1.2, though Phase 2 had a working Docker session). **No local end-to-end run was completed this phase.** All verification below is against the hosted project directly. This is flagged, not hidden — see the PASS/FAIL table.

## Hosted deploy and sync results

- `supabase db push` → both migrations applied successfully (the second, `db push` attempt for the scope-fix migration needed one retry after a transient `LegacyLoginRoleError`-class connection hiccup; the actual push then succeeded cleanly).
- `supabase functions deploy parasut-sync` → succeeded (Docker not required for remote deploy, as in earlier phases).

| Resource | Dry-run | Real sync |
|---|---|---|
| accounts | `active 3, archived 0, total 3, error 0` | `upserted 3, error 0` |
| payments | `fetched 742, unresolved 0, error 0` (after the include fix; first attempt showed 742 unresolved before the fix, see above) | `upserted 742, error 0` |
| transactions | `fetched 1498 (unique, deduped), unresolved 37, error 0` | `upserted 1498, error 0` |

`unresolved_count: 37` for transactions means 37 of the 1498 real transactions have at least one side (`debit_account` or `credit_account`) that Parasut itself returned with no relationship data at all, even after requesting the include — a real gap in what Parasut exposes for those specific transactions, not a sync failure. Not fabricated: `debit_account_parasut_id`/`credit_account_parasut_id` stay `null` for those rows.

Two of these hosted requests (`payments` real sync, `transactions` dry-run and real sync) took long enough that the local `curl` client timed out/exited with code 1 while the Edge Function kept running server-side to completion — confirmed by polling `parasut_sync_status_demo` afterward, which showed the correct final `success` state each time. No data was lost or duplicated; the per-resource running-lock correctly rejected a same-resource retry attempt with HTTP 409 while a run was still in flight.

## API–Supabase–UI reconciliation

| Resource | API (this sync) | Supabase (`Content-Range`, hosted) | UI query |
|---|---:|---:|---|
| accounts | 3 active + 0 archived = 3 | 3 | `Hesaplar.tsx` reads `parasut_accounts_demo` directly, no filter |
| payments (sales_invoices scope) | 742 | 742 (after the scope-fix view; base table holds 1616 = 742 + 874 legacy, documented above) | `Tahsilatlar.tsx` reads `parasut_payments_demo` (now `where payable_type='sales_invoices'`) |
| transactions | 1498 unique (raw pre-dedup sum across 3 accounts was higher, since transfers between two of the company's own accounts appear once per side) | 1498 | `HesapHareketleri.tsx` reads `parasut_transactions_demo` |

All three layers agree.

## Relationship verification

- **Payment → payable:** `parasut_id 1116145446` → `payable_type "sales_invoices"`, `payable_parasut_id 1089022171` → resolves via the view's join to invoice `HD02026000000062`, contact "HİRA PARTS METAL SANAYİ VE TİCARET LİMİTED ŞİRKETİ" — verified via direct REST query against the hosted view.
- **Payment → transaction:** same payment → `transaction_parasut_id 1249396525`, which resolves (via the same view) to `transaction_type "contact_credit"`, `debit_account_type "accounts"` → "HAYRETTİN DAYAN", `credit_account_type "contacts"` → (name not joined in the payments view, but the real id/type are shown — see Known Issues).
- **Transaction → debit/credit account, polymorphic:** verified directly — transaction `1052002192`'s `credit_account` is `type: "contacts"`, `id: 1010689160` (a real customer, "teknik istif makineleri"), not an `accounts` row. Stored and displayed as such, never mislabeled as an account.

## Balances come directly from the API

`parasut.accounts.balance` is set from `PaymentAttributes`/`AccountAttributes`... — specifically `AccountAttributes.balance` (`readOnly: true` in the spec, i.e. Parasut computes it server-side) — `resources/accounts.ts` copies it verbatim (`balance: attr(a, "balance")`), with no arithmetic performed on it anywhere in this codebase. Verified sample: `Kasa Hesabı` → `6235457.75 TRL`, `HAYRETTİN DAYAN` → `5130140.10 TRL`, matching the raw API response captured during discovery probing.

## Routes and UI fields

- `/satislar/tahsilatlar` (`Tahsilatlar.tsx`): date, amount+currency, notes, linked invoice (→ `/satislar/faturalar/:id`), linked contact (→ `/musteriler/:id`), linked account/transaction — plus a real date-range filter and a visible coverage-boundary note.
- `/satislar/tahsilatlar/:parasutId` (`TahsilatDetay.tsx`): full relationship set — invoice, contact, transaction, debit/credit account (id+type shown even when a friendly name isn't resolvable), synced_at.
- `/nakit/hesaplar` (`Hesaplar.tsx`): name, type (Kasa/Banka/Sistem), currency, bank name/branch/IBAN, real API balance, archived status.
- `/nakit/hesap-hareketleri` (`HesapHareketleri.tsx`): account filter (dropdown from real synced accounts), transaction-type text filter, date range filter; debit/credit account (or contact, when the polymorphic type is `"contacts"`) name, date, description, real amounts per side.
- All four new tables wrapped in `overflow-x-auto` with a `min-w`, same pattern as Phase 1.2/2 (visual confirmation still blocked by the known TLS issue, see below).
- Every null relationship/field renders `"—"`, verified against real nulls (e.g. `transaction_description: null`, `credit_account_name: null` for contact-typed credit sides).

## Test / lint / build / tsc

- `npm test` → 1/1 passed.
- `npm run lint` → 0 errors, 10 pre-existing warnings (same as every prior phase). Local Supabase was stopped and `supabase/.temp` cleared before this run to avoid the Phase 2 false-positive (Docker-generated bundle artifact matched by eslint's glob).
- `npm run build:demo` → success, 4 new chunks (`Tahsilatlar`, `TahsilatDetay`, `Hesaplar`, `HesapHareketleri`).
- `tsc --noEmit -p tsconfig.app.json` → same single pre-existing, unrelated error: `src/pages/Login.tsx:55` — not touched, **not reported as PASS**.

## Changed files (this phase)

Modified: `src/App.tsx`, `src/pages/DemoHome.tsx`, `supabase/functions/parasut-sync/index.ts`
Added: `src/pages/Tahsilatlar.tsx`, `src/pages/TahsilatDetay.tsx`, `src/pages/Hesaplar.tsx`, `src/pages/HesapHareketleri.tsx`, `supabase/functions/parasut-sync/resources/accounts.ts`, `supabase/functions/parasut-sync/resources/payments.ts`, `supabase/functions/parasut-sync/resources/transactions.ts`, `supabase/migrations/20260826040000_parasut_payments_transactions_accounts_demo.sql`, `supabase/migrations/20260826041000_parasut_payments_demo_scope_fix.sql`, `reports/PHASE_03_PAYMENTS_TRANSACTIONS_REPORT.md`
Not touched (user's own, pre-existing): `vite.config.ts`, `src/pages/Login.tsx`, `AUDIT_REPORT.md`
Deployed (not committed, build output): `dist/demo/**` → uploaded via FTP

---

## Sonuç Özeti

| Kontrol | Beklenen | Gerçekleşen | Sonuç | Sorun/Kök Neden |
|---|---:|---:|---|---|
| Payments erişim yöntemi doğrulaması | gerçek endpoint/include yolu | `/sales_invoices?include=payments,payments.transaction`, ayrı liste yok (doğrulandı) | PASS | — |
| Transactions erişim yöntemi doğrulaması | gerçek endpoint/include yolu | `/accounts/{id}/transactions?include=debit_account,credit_account`, ayrı liste yok (doğrulandı) | PASS | — |
| Accounts erişim yöntemi doğrulaması | gerçek endpoint | `/accounts`, filter[archived] undocumented ama çalışıyor (doğrulandı) | PASS | — |
| Payments fetched/upserted | API sonucu | 742/742 | PASS | İlk denemede include eksikti (742 unresolved), düzeltilip yeniden deploy edildi |
| Payments unresolved | gerçek eksik ilişki sayısı | 0 (düzeltmeden sonra) | PASS | — |
| Transactions fetched/upserted | API sonucu (unique) | 1498/1498 | PASS | — |
| Transactions unresolved | gerçek eksik ilişki sayısı | 37 (bilgilendirici, hata değil) | PASS | Parasut'un kendisi bu 37 işlem için ilgili tarafı döndürmüyor |
| Accounts fetched/upserted | API sonucu | 3/3 | PASS | — |
| Supabase payments sayısı (kapsam içi) | 742 | 742 (scope-fix view sonrası) | PASS | İlk view'da 1616 görünüyordu (874 eski, kapsam dışı satır karışmıştı); yeni migration ile düzeltildi |
| Supabase transactions sayısı | 1498 | 1498 | PASS | — |
| Supabase accounts sayısı | 3 | 3 | PASS | — |
| UI tahsilatlar sayısı | Supabase ile aynı | Aynı sorgu, view üzerinden doğrulandı | PASS | — |
| Bakiyelerin API'den geldiğinin kanıtı | doğrudan API değeri | `balance` sütunu API `AccountAttributes.balance`'tan aynen kopyalanıyor, hesaplama yok | PASS | — |
| Payment→payable ilişkisi | gerçek, üretilmemiş | invoice.relationships.payments'tan geliyor, payment.relationships.payable API'de boş dönüyor (doğrulandı) | PASS | — |
| Payment→transaction ilişkisi | gerçek | Örnek ödeme ile doğrulandı | PASS | — |
| Transaction→debit/credit hesap | gerçek, polymorphic doğru saklanıyor | `accounts` veya `contacts` tipini ayrı kolonlarda saklıyor, örnek doğrulandı | PASS | Swagger sadece "accounts" belgeliyordu, gerçek API "contacts" da döndürüyor — tespit edilip doğru modellendi |
| Route'lar (4 yeni) | HTTP 200 + gerçek veri | Hepsi 200, örnek ID'lerle doğrulandı | PASS | — |
| Local doğrulama (Docker) | mümkün olmalı | Docker bu fazda da yanıt vermedi | **BLOCKED** | Docker Desktop altyapı sorunu, bu fazın koduyla ilgisi yok |
| Migration deploy | hosted uygulanmış | 7/7 migration local=remote | PASS | — |
| Edge Function deploy | hosted çalışıyor | Tüm 3 kaynak için dry-run+gerçek sync başarılı | PASS | — |
| Frontend deploy | canlı bundle güncel | Canlı `index.html` → `index-iyjMuBkT.js`, build hash'iyle aynı | PASS | — |
| npm test | başarılı | 1/1 | PASS | — |
| npm run lint | 0 hata | 0 hata, 10 önceden var olan uyarı | PASS | — |
| npm run build:demo | başarılı | Başarılı | PASS | — |
| TypeScript kontrolü | 0 hata | 1 hata (`Login.tsx:55`) | **FAIL — pre-existing unrelated error** | Faz 1.2'den beri aynı, Login'e dokunulmadı |
| Mobil/yatay taşma görsel doğrulaması | kolon kaybı yok | Kod deploy edildi; tarayıcıda teyit yok | **BLOCKED** | Self-signed sertifika (Faz 1.1'den beri süregelen) |
| Git commit/push | remote main güncel | `c8c37b4`, `e4158e0..c8c37b4 main -> main` başarılı | PASS | — |

## FAIL ve BLOCKED Maddeler

### Local doğrulama (Docker)
- Durum: BLOCKED
- Hata mesajı: `npx supabase start` → `{"_tag":"Error","error":{"code":"LegacyDockerLifecycleInspectError","message":"failed to inspect container health: request returned 500 Internal Server Error for API route ... /supabase_db_eclipsemuhendislik.com/json"}}`; sonraki `docker ps` denemeleri yanıt vermeden zaman aşımına uğradı.
- Kesin kök neden: Bu makinedeki Docker Desktop daemon'ı bu fazda da kararsız/yanıtsızdı (Faz 1.2'dekiyle aynı sınıf altyapı sorunu; Faz 2'de Docker sorunsuzdu, bu oturumlar arasında tutarsız).
- Bu fazdan mı kaynaklandı, önceden mi vardı: Ortam sorunu, bu fazın kod/migration değişikliğiyle ilgisi yok.
- Canlı sistemi etkiliyor mu: Doğrudan hayır. Ancak local dry-test imkanını ortadan kaldırdı; bunun yerine değişiklikler doğrudan hosted'a deploy edilip orada test edildi (dry-run önce, gerçek sync sonra, her kaynak için ayrı ayrı) ve gerçek bir kod hatası (payments include eksikliği) bu şekilde hosted üzerinde yakalanıp düzeltildi.
- Yapılan denemeler: `npx supabase start` (2 kez), `npx supabase db reset`, `docker ps` — hiçbiri kararlı sonuç vermedi.
- Düzeltilmesi için gereken işlem: Docker Desktop'ın bu makinede onarılması (kullanıcı tarafında).
- Sonraki faza bırakıldıysa nedeni: Bu oturumun araçlarıyla çözülemez; hosted doğrulama yeterli kanıt sağladı.

### TypeScript kontrolü (`tsc --noEmit`)
- Durum: FAIL
- Hata mesajı: `src/pages/Login.tsx(55,17): error TS2322: Type '{ variant: string; }' is not assignable to type 'IntrinsicAttributes & LogoProps'.`
- Kesin kök neden: `Login.tsx`'in kendi, önceden var olan tip hatası.
- Bu fazdan mı kaynaklandı, önceden mi vardı: Önceden vardı (Faz 1.1'den beri her raporda aynı şekilde işaretlendi).
- Canlı sistemi etkiliyor mu: Hayır — `npm run build:demo` bunu durdurmadan geçiyor, canlı build başarıyla tamamlandı.
- Yapılan denemeler: Yok — "Login ile ilgilenme" talimatı gereği dokunulmadı.
- Düzeltilmesi için gereken işlem: `LogoProps` tipine `variant` eklenmesi (kullanıcının kendi işi).
- Sonraki faza bırakıldıysa nedeni: Kapsam dışı.

### Mobil/yatay taşma görsel doğrulaması
- Durum: BLOCKED
- Hata mesajı: WebFetch: `"self signed certificate"`; sertifika doğrulamalı `curl`: `schannel: SEC_E_UNTRUSTED_ROOT`.
- Kesin kök neden: `demo.eclipsemuhendislik.com` hâlâ self-signed sertifika sunuyor (Faz 1.1'de tespit edildi, her fazda aynı şekilde raporlandı).
- Bu fazdan mı kaynaklandı, önceden mi vardı: Önceden vardı; bu fazın 4 yeni tablosu aynı `overflow-x-auto` deseniyle yazıldığı için aynı doğrulama boşluğunu miras aldı.
- Canlı sistemi etkiliyor mu: Sertifika sorunu evet, kod sorunu hayır.
- Yapılan denemeler: `curl -k` ile HTTP 200 doğrulandı; WebFetch reddetti; headless tarayıcı yok.
- Düzeltilmesi için gereken işlem: `demo` subdomain'i için geçerli SSL sertifikası.
- Sonraki faza bırakıldıysa nedeni: Bu oturumun kapsamı/araçları dışında.

## Genel Karar

**PASS WITH KNOWN ISSUES**

- Kritik canlı sorun var mı? Hayır — migration, Edge Function, üç kaynağın gerçek sync'i, sayı eşleşmesi ve ilişki doğrulamaları hepsi hosted'da PASS. Bulunan iki gerçek hata (payments include eksikliği, payments_demo view kapsam sızıntısı) bu oturum içinde yakalanıp düzeltildi ve yeniden doğrulandı.
- Paraşüt API–Supabase–UI sayıları uyuşuyor mu? Evet — accounts 3/3, payments 742/742 (kapsam düzeltmesinden sonra), transactions 1498/1498; üç katmanda da eşleşiyor.
- İlişkiler doğrulandı mı? Evet — payment→payable, payment→transaction, transaction→debit/credit hesap (polymorphic accounts/contacts dahil) örneklerle tek tek doğrulandı.
- Canlıya deploy edildi mi? Evet — 2 migration hosted'a uygulandı, Edge Function deploy edilip 3 kaynak da gerçek veriyle çalıştırıldı, frontend build'i FTP ile yüklendi ve bundle hash'i canlıda doğrulandı.
- Claude Browser testine hazır mı? Evet, iki bilinen sınırlamayla: self-signed sertifika (tarayıcı uyarısı/bypass gerekebilir) ve mobil/yatay taşma davranışının görsel teyidinin bu oturumda yapılamamış olması.
- Bir sonraki gerekli işlem nedir? (1) `demo` subdomain'i için geçerli SSL sertifikası, (2) Claude Browser ile görsel doğrulama (4 yeni ekran, filtreler, mobil scroll), (3) Docker Desktop'ın onarılması, (4) istenirse purchase_bills/bank_fees/salaries/taxes ödemelerinin ayrı bir fazda ele alınması (bu fazın bilinçli kapsam dışı bıraktığı alan).

## Sample values for Claude Browser

**Payments (tahsilatlar):**
- `1116145446` — 2026-08-24, 19.200,00 TRL, fatura HD02026000000062, müşteri HİRA PARTS METAL SANAYİ VE TİCARET LİMİTED ŞİRKETİ
- `1116145447` — 2026-08-24, 130.800,00 TRL, fatura HD02026000000063, aynı müşteri
- Bağlı işlem örneği: payment `1116145446` → transaction `1249396525` (contact_credit, borç hesap "HAYRETTİN DAYAN")

**Accounts:**
- `1000215424` — Kasa Hesabı, cash, TRL, bakiye 6.235.457,75
- `1000340089` — HAYRETTİN DAYAN, bank, TRL, bakiye 5.130.140,10

**Transactions:**
- `1052002192` — contact_credit, borç: HAYRETTİN DAYAN CEHA... hesabı yerine gerçek örnek: Kasa Hesabı (accounts), alacak: teknik istif makineleri (contacts) — polymorphic örnek
