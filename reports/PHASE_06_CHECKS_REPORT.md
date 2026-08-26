# Phase 6 — Checks ("çekler") API discovery report

- **Branch:** `main`
- **Base commit (before this phase):** `fb0ddf13254be0ae8fbf210d27aaf4edbfc4bc67`
- **This phase's commit SHA:** `c6928fe42bde9ba2b2597bb2c7d269745705ead8` (`c6928fe`)
- **Push result:** `fb0ddf1..c6928fe main -> main` — success
- **Hosted Supabase project:** `yzuxdrknidveptvnwthf`
- **Live URL:** https://demo.eclipsemuhendislik.com

Note: `reports/PHASE_03_BROWSER_REPORT.md` and `reports/PHASE_05_BROWSER_REPORT.md` were referenced in the task but do not exist in this repository (the same recurring situation as every prior phase's referenced browser report). This phase proceeded using the reports that do exist plus direct verification against the real API, hosted Supabase, and — for the first time this session, using the technique established in Phase 4.1 — a real headless-browser measurement of the live page.

No secret values appear anywhere in this report.

## Is there a separate checks endpoint? **Yes — a real, working, but completely undocumented one.**

Downloaded and grepped the raw 802 KB `https://apidocs.parasut.com/swagger.json` for `check`, `cheque`, `çek`, `senet`, `promissory` (case-insensitive, whole file): **6 matches, all identical** — `"checks"` appears only as an enum member inside the polymorphic `payable`/`pay_to` relationship type lists on other resources (e.g. `Payment.relationships.payable.data.type` can be `sales_invoices | purchase_bills | taxes | bank_fees | salaries | checks`). **Zero path definitions and zero schema definitions exist for checks anywhere in the spec.**

Per the task's own rule ("Ayrı çek endpoint'i yoksa varmış gibi tablo/model oluşturma"), this alone would mean: no dedicated check data, fall back to `transaction_type` filtering. But the task also requires testing real API access directly (keşif step 2), and that test found something the documentation doesn't mention at all:

```
GET /v4/{company_id}/checks           -> 200, real data, 40 checks
GET /v4/{company_id}/check            -> 404 "No route matches"
GET /v4/{company_id}/cheques          -> 404
GET /v4/{company_id}/promissory_notes -> 404
GET /v4/{company_id}/senetler         -> 404
```

**`/{company_id}/checks` is real and fully functional** — paginated (`meta.total_pages`/`total_count`, confirmed `page[size]=25` → 2 pages, 25+15=40, matching `total_count`), with real `filter`/`sort`/`include` support discoverable from its own 400-error messages (since nothing about it is documented):

- `filter[archived]` and `filter[status]` are **not** valid — the API's own error names the real acceptable filters: `due_date, issue_date, currency, amount, net_total`. So (like `purchase_bills`/`item_categories` in earlier phases) there is no active/archived dual-stream for this resource — a single full listing is the correct, complete fetch.
- `include=issued_by,given_to` are real, valid relationships (error-message-confirmed acceptable includes: `category, issued_by, given_to, details, payments, tags, refund_of, sharings, recurrence_plan`). `include=contact` is **not** valid (tested, rejected) — `issued_by`/`given_to` are the real relationship names, not `contact`.
- `payments.transaction` (a sub-include that would have chained check → payment → transaction) is explicitly rejected by the API — confirmed not available, not pursued further; no transaction linkage is stored for checks in this phase.

**Conclusion: this account does have real, dedicated check data reachable through a genuine (if undocumented) endpoint.** This is a materially better data source than reinterpreting `transaction_type` values, so it became this phase's primary source — see below for why, and the `transaction_type` discovery (still explicitly required by the task) is reported separately underneath.

## All real `transaction_type` values (required discovery, steps 3–4)

Queried directly against the hosted, already-synced `parasut.transactions` table (1498 rows, from Phase 3) — every unique value and its real server count:

| `transaction_type` | count |
|---|---:|
| `contact_debit` | 817 |
| `contact_credit` | 644 |
| `check_cash_in` | 32 |
| `check_cash_out` | 3 |
| `purchase_bill_payment` | 2 |
| **Total** | **1498** |

**"check" içeren type'lar:** `check_cash_in` (32) + `check_cash_out` (3) = **35** transactions.

**Why these are not used as the check data source:** `check_cash_in`/`check_cash_out` are cash-flow *transactions* recording when a check was cashed in/out — a real, meaningful signal, but a different concept from the check *instrument* itself (which has its own serial number, bank, due date, issuer, status, independent of whether/when it was cashed). Using these 35 transaction rows as "the checks" would have required either (a) inventing check-specific fields (serial number, bank) that these transaction rows simply do not have — forbidden by the task's own rules — or (b) parsing the free-text `description` field to try to recover them — explicitly forbidden ("Transaction açıklamasını ayrıştırıp yeni alanlar üretme"). The dedicated `/checks` endpoint provides all of this as real, structured API fields instead, with no parsing or guessing. This is reported as the discovery result, not silently dropped.

## Real fields the `/checks` API actually returns

Every field below was read directly from real API responses (2 full sample checks quoted in full during discovery, one `is_in` and one `is_out` example):

| Field | Type | Example (real) |
|---|---|---|
| `id` | string (parasut_id) | `"1000245233"` |
| `currency` | string | `"TRL"` |
| `description` | string \| null | `"31,05,2024 vade"` or `null` |
| `due_date` | date | `"2023-12-15"` |
| `issue_date` | date | `"2024-01-05"` |
| `net_total` | number | `"55440.0"` |
| `remaining` | number | `"0"` |
| `remaining_in_trl` | number | `"0.0"` |
| `payment_status` | string | `"paid"`, `"unpaid"` |
| `is_cashed` | boolean | `true` |
| `is_in` | boolean | `true` (received) |
| `is_out` | boolean | `false` (issued) |
| `is_transferred` | boolean | `false` |
| `days_overdue` | number | `985` |
| `days_till_due_date` | number | `-985` |
| `bank_identifier` | string | `"ISBANK"`, `"HALKBANK"`, `"KUVEYTTURK"` |
| `bank_name` | string | `""` (empty string, real — `bank_identifier` is the populated field in this account's data) |
| `serial_number` | string | `"421052332"` |
| `relationships.issued_by` | `{id, type}` | `{"id":"1010894214","type":"contacts"}` |
| `relationships.given_to` | `{id, type}` \| null | real, null on received checks in this account's data |

**This directly answers task step 6:** çek numarası (`serial_number`), vade (`due_date`), banka (`bank_identifier`/`bank_name`), keşideci (`issued_by`), lehtar/verilen (`given_to`), durum (`payment_status`, `is_cashed`) — **all genuinely present**, none fabricated.

## Fields NOT added to the UI because the API does not provide them

- No check image/scan URL.
- No `histories` detail (the relationship exists — `relationships.histories` — but comes back `{"meta":{}}`, i.e. Parasut doesn't expose its content through this endpoint the way it does `issued_by`/`given_to`; not pursued further since chasing it would require guessing an undocumented include that may not exist).
- No linked `transaction` (verified `payments.transaction` sub-include is rejected by the API — see above).
- No "hangi hesaba tahsil edildi" (which account it was cashed into) — not present as a resolvable field on the check resource itself within this phase's scope.

## Senet (promissory note) verdict

**No senet data exists in this API scope.** `/senetler` and `/promissory_notes` both return `404 "No route matches."`. No senet-related string appears anywhere in the swagger. No senet screen or data was created — per the task's explicit instruction, this is reported as "API kapsamında veri bulunamadı," not silently omitted.

## Implementation

- `supabase/functions/parasut-sync/resources/checks.ts`: `mapCheck` — every column copied verbatim from the real attributes listed above; `issued_by`/`given_to` store both id and type (the relationship is polymorphic per the schema, even though every observed sample in this account resolves to `type: "contacts"` — storing the type avoids ever mislabeling a future non-contact value, same discipline as Phase 3's `debit_account`/`credit_account`).
- `supabase/functions/parasut-sync/index.ts`: added `syncChecks` — single full listing (no archived dual-stream, confirmed unsupported), `include=issued_by,given_to`, `unresolved_count` = checks where *neither* relationship resolved (informational, not an error — many real checks legitimately have only one side populated, e.g. a received check has `issued_by` but `given_to: null`).
- New migration `20260826080000_parasut_checks.sql`: **creates `parasut.checks` from scratch** — no such table existed in any prior migration (checks were never part of the original Phase 0 schema, unlike every resource in Phases 1–5). Follows the exact same shape as every other `parasut.*` table (`parasut_id` unique, mapped columns + `raw jsonb`, service_role-only RLS, `updated_at` trigger) and adds one new demo view, `public.parasut_checks_demo` (real left joins to `parasut.contacts` for `issued_by_name`/`given_to_name`, only when the real relationship type is `'contacts'`). No existing migration was touched.
- **No duplicate-check risk:** each real check transformed into exactly one `parasut.checks` row, upserted on its own real `parasut_id` — never split across, or merged from, transaction records. Confirmed: fetched count == upserted count == final table row count (40 == 40 == 40).

## Local verification

Docker Desktop was unresponsive again this phase (`docker ps` timed out). **No local end-to-end run was completed.** All verification below is against the hosted project directly, consistent with every prior phase's Docker situation. Flagged, not hidden.

## Hosted deploy and sync results

- `supabase db push` → applied on the first attempt (11/11 migrations now match local/remote).
- `supabase functions deploy parasut-sync` → succeeded.
- Dry-run: `{"status":"dry_run","total_fetched_count":40,"upserted_count":0,"unresolved_count":0,"total_count_reported":40,"error_count":0}`
- Real sync: `{"status":"success","total_fetched_count":40,"upserted_count":40,"unresolved_count":0,"total_count_reported":40,"error_count":0}`

## API–Supabase–UI reconciliation, by check type

| Direction (`is_in`/`is_out`) | API (this sync) | Supabase (`Content-Range`, hosted) |
|---|---:|---:|
| Alınan (`is_in = true`) | 34 | 34 |
| Verilen (`is_out = true`) | 6 | 6 |
| Toplam | 40 | 40 |

All layers agree (34 + 6 = 40 exactly — no third/unclassified state exists in this account's real data).

## Duplicate / unresolved check

- Duplicate: none possible or observed — single linear fetch, `parasut_id`-keyed upsert, fetched (40) == upserted (40) == final row count (40).
- Unresolved (neither `issued_by` nor `given_to` resolved): **0** of 40.

## Sample real transaction/check `parasut_id`s and polymorphic relationship verification

- Check `1001320671` — seri no `4844273`, HALKBANK, vade 2026-10-31, 100.000,00 TRL, `unpaid`, `is_in: true` → `issued_by` resolves to real contact "FIRAT HUDAY".
- Check `1001296008` — seri no `3127841`, ISBANK, vade 2026-09-04, 451.107,89 TRL, `unpaid`, `is_in: true` → `issued_by` "PİNO MAKİNE SANAYİ VE TİCARET LİMİTED ŞİRKETİ".
- Check `1001320668` — seri no `0027315`, KUVEYTTURK, vade 2026-08-12, 111.636,00 TRL, `paid`, `is_in: true` → `issued_by` "FIRAT HUDAY" again (same real customer, two different checks).
- Polymorphic verification (same discipline as Phase 3's transactions): every `issued_by`/`given_to` observed in this account resolves to `type: "contacts"` — stored with its type regardless, so a future non-contact value (if this account ever has one) will never be mislabeled.

## Previous transaction/account regression check

| Check | Before this phase | After this phase |
|---|---:|---:|
| `parasut_transactions_demo` row count | 1498 (Phase 3) | **1498** |
| Account "Kasa Hesabı" balance | 6.235.457,75 TRL | **6.235.457,75 TRL** |
| Account "HAYRETTİN DAYAN" balance | 5.130.140,10 TRL | **5.130.140,10 TRL** |
| Account "HAYRETTİN DAYAN CEHA DİŞLİ SANAYİ" balance | 0,00 TRL | **0,00 TRL** |

No regression — this phase never touched `transactions` or `accounts` sync logic.

## Routes and UI fields

- `/nakit/cekler` (`Cekler.tsx`): serial number, bank, due date, amount+currency, remaining, payment status, direction (Alınan/Verilen, from real `is_in`/`is_out`), issued-by/given-to (linked to `/musteriler/:id` when resolved) — real Tümü/Alınan/Verilen server counts, a due-date range filter. A visible note states this data comes from the undocumented-but-real `/checks` endpoint.
- `/nakit/cekler/:parasutId` (`CekDetay.tsx`): every real field from the table above, plus an explicit on-page note listing what is *not* shown because the API doesn't provide it (check image, payment history, transaction link) — consistent with the task's instruction not to hide the limitation.
- Every null relationship/field renders `"—"`, verified against real nulls (e.g. `given_to_name: null` on every received check in this account, `description: null` on many checks).
- Table wrapped in `overflow-x-auto` with a `min-w`; filter layout uses the same `min-w-0`/full-width-on-mobile pattern fixed and measured in Phase 4.1.

## Real headless-browser responsive verification (390×844, 768×1024)

Using the Chrome DevTools Protocol technique established in Phase 4.1 (local Chrome, `--ignore-certificate-errors` for this session's own testing only), measured the **live** `/nakit/cekler` page directly:

| Viewport | `document.documentElement.scrollWidth` | `clientWidth` | Overflow? | Table wrapper |
|---|---:|---:|---|---|
| 390×844 | 390 | 390 | **No** | `overflow-x: auto`, table `scrollWidth` 1000 > wrapper `clientWidth` 340 — scrolls internally |
| 768×1024 | 753 | 753 | **No** | same, wrapper `clientWidth` 703 |

Real button labels captured from the live DOM at 390px: `"Tümü (40)"`, `"Alınan (is_in) (34)"`, `"Verilen (is_out) (6)"` — confirming the live page renders real, correct data, not a static shell.

## Test / lint / build / tsc

- `npm test` → 1/1 passed.
- `npm run lint` → 0 errors, 10 pre-existing warnings (unchanged from every prior phase).
- `npm run build:demo` → success, 2 new chunks (`Cekler`, `CekDetay`).
- `tsc --noEmit -p tsconfig.app.json` → same single pre-existing, unrelated error: `src/pages/Login.tsx:55` — not touched, **not reported as PASS**.

## Changed files (this phase)

Modified: `src/App.tsx`, `src/pages/DemoHome.tsx`, `supabase/functions/parasut-sync/index.ts`
Added: `src/pages/Cekler.tsx`, `src/pages/CekDetay.tsx`, `supabase/functions/parasut-sync/resources/checks.ts`, `supabase/migrations/20260826080000_parasut_checks.sql`, `reports/PHASE_06_CHECKS_REPORT.md`
Not touched (user's own, pre-existing): `vite.config.ts`, `src/pages/Login.tsx`, `AUDIT_REPORT.md`
Deployed (not committed, build output): `dist/demo/**` → uploaded via FTP

---

## Sonuç Özeti

| Kontrol | Beklenen | Gerçekleşen | Sonuç | Sorun/Kök Neden |
|---|---:|---:|---|---|
| Ayrı çek endpoint'i var mı | gerçek API testi | `/checks` var, gerçek, çalışıyor (swagger'da hiç yok) | PASS | — |
| Swagger keşif kanıtı | tüm dosyada arama | 6 eşleşme, hepsi sadece enum değeri, path/schema yok | PASS | — |
| transaction_type değerleri ve sayıları | hosted gerçek sayım | 5 tip, 1498 toplam, ayrıntılı tablo | PASS | — |
| Çek kabul edilen type'lar | gerekçeli liste | `/checks` kaynağı esas alındı; `check_cash_in`(32)/`check_cash_out`(3) ayrı raporlandı, kullanılmadı, gerekçe yazıldı | PASS | — |
| Her çek type için API/Supabase/UI sayıları | eşleşmeli | is_in 34/34, is_out 6/6, toplam 40/40 | PASS | — |
| Toplam çek hareketi | API sonucu | 40 | PASS | — |
| Duplicate/unresolved sayıları | 0 | 0/0 | PASS | — |
| API'de gerçekten bulunan çek alanları | tam liste | serial_number, bank_identifier/name, due_date, payment_status, is_in/is_out, vb. — tümü doğrulandı | PASS | — |
| API'de bulunmayan alanlar | açıkça belirtilmeli | Çek görseli, histories detayı, transaction linki — UI'da not olarak belirtildi, eklenmedi | PASS | — |
| Senet verisi | var/yok kesin | Yok — 404 doğrulandı, ekran üretilmedi | PASS | — |
| En az 3 gerçek transaction/check parasut_id | doğrulanmalı | 3 örnek uçtan uca doğrulandı | PASS | — |
| Polymorphic ilişki örnekleri | Faz 3 modeliyle | issued_by/given_to tip+id ayrı saklanıyor, örnekle doğrulandı | PASS | — |
| Önceki transaction/account regresyonu | 1498 ve bakiyeler değişmemeli | Birebir aynı | PASS | — |
| 390×844 / 768×1024 responsive | scrollWidth ≤ clientWidth | Gerçek headless Chrome ile ikisi de eşit, taşma yok | PASS | — |
| Local doğrulama (Docker) | mümkün olmalı | Docker bu fazda da yanıt vermedi | **BLOCKED** | Docker Desktop altyapı sorunu, kodla ilgisi yok |
| Migration deploy | hosted uygulanmış | 11/11 migration local=remote | PASS | — |
| Edge Function deploy | hosted çalışıyor | dry-run+gerçek sync başarılı | PASS | — |
| Frontend deploy | canlı bundle güncel | Canlı `index.html` → `index-qlaDZBNz.js`, build hash'iyle aynı | PASS | — |
| npm test | başarılı | 1/1 | PASS | — |
| npm run lint | 0 hata | 0 hata, 10 önceden var olan uyarı | PASS | — |
| npm run build:demo | başarılı | Başarılı | PASS | — |
| TypeScript kontrolü | 0 hata | 1 hata (`Login.tsx:55`) | **FAIL — pre-existing unrelated error** | Faz 1.1'den beri aynı, Login'e dokunulmadı |
| Git commit/push | remote main güncel | `c6928fe`, `fb0ddf1..c6928fe main -> main` başarılı | PASS | — |

## FAIL ve BLOCKED Maddeler

### Local doğrulama (Docker)
- Durum: BLOCKED
- Hata mesajı: `docker ps` yanıt vermeden zaman aşımına uğradı.
- Kesin kök neden: Bu makinedeki Docker Desktop daemon'ı bu fazda da kararsız/yanıtsızdı (Faz 1.2/3/4/5'te de aynı sınıf sorun görülmüştü).
- Bu fazdan mı kaynaklandı: Hayır, ortam sorunu.
- Canlı sistemi etkiliyor mu: Doğrudan hayır. Hosted'a doğrudan deploy edilip orada dry-run+gerçek sync ile tam doğrulandı; ayrıca bu fazda gerçek headless tarayıcı ölçümüyle canlı sayfa da doğrulandı (Docker'a bağlı olmayan, bağımsız bir doğrulama yolu).
- Düzeltilmesi için gereken işlem: Docker Desktop'ın onarılması (kullanıcı tarafında).
- Sonraki faza bırakıldıysa nedeni: Bu oturumun kapsamı dışında; hosted + gerçek tarayıcı doğrulaması yeterli kanıt sağladı.

### TypeScript kontrolü (`tsc --noEmit`)
- Durum: FAIL
- Hata mesajı: `src/pages/Login.tsx(55,17): error TS2322: ...`
- Kesin kök neden: `Login.tsx`'in önceden var olan, kullanıcının kendi tip hatası.
- Bu fazdan mı kaynaklandı: Hayır, Faz 1.1'den beri aynı.
- Canlı sistemi etkiliyor mu: Hayır — `npm run build:demo` bunu durdurmadan geçiyor.
- Düzeltilmesi için gereken işlem: `LogoProps`'a `variant` eklenmesi (kullanıcının kendi işi, kapsam dışı).

## Genel Karar

**PASS**

- Kritik canlı sorun var mı? Hayır — migration, Edge Function, gerçek sync, sayı eşleşmesi ve ilişki doğrulamaları hepsi hosted'da PASS.
- Ayrı çek endpoint'i bulundu mu? Evet — `/checks`, gerçek ve çalışıyor, swagger'da hiç belgeli değil.
- Çek alanları gerçek mi? Evet — serial_number, banka, vade, durum, is_in/is_out tümü doğrudan API'den, hiçbiri üretilmedi.
- API–Supabase–UI sayıları uyuşuyor mu? Evet — 40/40, is_in 34/34, is_out 6/6.
- Senet verisi var mı? Hayır — açıkça "API kapsamında veri bulunamadı" olarak raporlandı, sahte ekran üretilmedi.
- Önceki modüllerde regresyon var mı? Hayır — transactions (1498) ve hesap bakiyeleri birebir aynı kaldı.
- Mobil/tablet taşma sorunu var mı? Hayır — gerçek tarayıcı ölçümüyle 390px ve 768px'te doğrulandı.
- Canlıya deploy edildi mi? Evet — migration hosted'a uygulandı, Edge Function deploy edilip gerçek veriyle çalıştırıldı, frontend build'i FTP ile yüklendi ve bundle hash'i canlıda doğrulandı.
- Claude Browser testine hazır mı? Evet. (Self-signed sertifika sorunu hâlâ geçerli olabilir, ama bu fazda kendi headless Chrome testimle asıl işlevsellik zaten doğrulandı.)
- Bir sonraki gerekli işlem nedir? (1) `demo` subdomain'i için geçerli SSL sertifikası (Faz 1.1'den beri bilinen, kodla ilgisiz), (2) Docker Desktop'ın onarılması, (3) istenirse `/checks` kaynağının `payments`/`histories` ilişkilerinin ileride API tarafından daha iyi desteklenmesi durumunda genişletilmesi.

## Sample values for Claude Browser

- `1001320671` — seri no 4844273, HALKBANK, vade 2026-10-31, 100.000,00 TRL, unpaid, alınan, keşideci FIRAT HUDAY
- `1001296008` — seri no 3127841, ISBANK, vade 2026-09-04, 451.107,89 TRL, unpaid, alınan, keşideci PİNO MAKİNE SANAYİ VE TİCARET LİMİTED ŞİRKETİ
- `1001320668` — seri no 0027315, KUVEYTTURK, vade 2026-08-12, 111.636,00 TRL, paid, alınan, keşideci FIRAT HUDAY
