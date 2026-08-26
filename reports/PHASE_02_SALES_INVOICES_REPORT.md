# Phase 2 — Sales invoices + invoice details sync report

- **Branch:** `main`
- **Base commit (before this phase):** `47faae2657066f44527cf1335b43f16291b7acf7`
- **This phase's commit SHA:** _filled in below after commit, definitive value in the final chat message_
- **Hosted Supabase project:** `yzuxdrknidveptvnwthf`
- **Live URL:** https://demo.eclipsemuhendislik.com

Note: `reports/PHASE_01_2_BROWSER_REPORT.md` was referenced in the task but does not exist in this repository (only `reports/PHASE_01_1_DEPLOY_REPORT.md` and `reports/PHASE_01_2_CONTACT_RECONCILIATION_REPORT.md` do). This phase proceeded using the reports that do exist plus this session's own direct verification against the real API and hosted Supabase.

No secret values appear anywhere in this report.

## 1. Swagger verification for `sales_invoices` / `sales_invoice_details`

Downloaded the raw 802 KB `https://apidocs.parasut.com/swagger.json` and inspected it directly (not a lossy AI summary):

- `GET /{company_id}/sales_invoices` supports `filter[issue_date]`, `filter[due_date]`, `filter[contact_id]`, `filter[invoice_id]`, `filter[invoice_series]`, `filter[item_type]`, `filter[print_status]`, `filter[payment_status]`, `sort`, `page[number]`, `page[size]` (max 25), and `include` — documented values: `category, contact, details, details.product, details.warehouse, payments, payments.transaction, tags, sharings, recurrence_plan, active_e_document`.
- There is **no separate `/{company_id}/sales_invoice_details` list endpoint** — confirmed by grepping the whole spec for that literal path (zero matches). Line items are only reachable via `include=details` (and `details.product`) on the invoice list call, returned in the response's JSON:API `included` array.
- `filter[archived]` is **not documented** for `sales_invoices` (same situation as `contacts` in Phase 1.2) — grepped every occurrence of `archived` in the spec; it's only formally documented for `inventory_levels`, `sales_offers`, `shipment_documents`, `warehouses`.

**Empirically verified against the live API** (same approach as Phase 1.2 — a one-off script using the account's own OAuth credentials, deleted after use, no values printed):

| Request | `total_count` |
|---|---|
| `GET /sales_invoices?page[size]=1` (no filter) | 449 |
| `GET /sales_invoices?page[size]=1&filter[archived]=false` | 449 |
| `GET /sales_invoices?page[size]=1&filter[archived]=true` | 2 |

449 + 2 = 451, matching the account's real total. `filter[archived]` works for `sales_invoices` too, despite being undocumented.

**Doc-vs-reality mismatch caught during local testing:** the swagger doc lists `details.warehouse` as an acceptable `include` value, but the live API rejects it with HTTP 400: `"details.warehouse is not a valid relation. Acceptable: category, contact, contact.company, details, details.product, payments, payments.transaction, ..."` (no `details.warehouse` in the real acceptable list). Removed it from the request; `warehouse_parasut_id` is therefore always `null` for now (a real, honest null — Parasut doesn't expose that relation through this endpoint without warehouse's own separate include support, which doesn't exist here).

## 2–4. `sales_invoices` resource added to `parasut-sync`

- `supabase/functions/parasut-sync/parasut_client.ts`: `PageResult`/`fetchAllPages` now also aggregate the JSON:API `included` array (deduplicated by `type:id`) across all pages, needed to resolve invoice line items.
- `supabase/functions/parasut-sync/resources/sales_invoices.ts`: `mapSalesInvoice` and `mapSalesInvoiceDetail` map every documented attribute/relationship straight from the API response to the corresponding column in the **pre-existing** `parasut.sales_invoices` / `parasut.sales_invoice_details` tables (created in the very first schema migration, unused until now) — no new columns needed.
- `supabase/functions/parasut-sync/index.ts`: refactored into `syncContacts` (unchanged behavior) and a new `syncSalesInvoices`, dispatched by the `resource` field. `syncSalesInvoices` fetches active+archived invoice streams in parallel (same `Promise.all`-abort-on-any-failure pattern as contacts), then for every invoice resolves each of its `relationships.details.data` ids against the combined `included` map.
- Batch upsert (`onConflict: parasut_id`, batches of 200) into `parasut.sales_invoices` and `parasut.sales_invoice_details` separately.

## 5. Missing detail id handling

Every detail id an invoice references was found in `included` in this run (0 missing, verified both locally and hosted). Had any been missing, the code counts it into `error_count` and includes the specific `invoice X -> detail Y` references (capped at 20) in `error_message`, and the whole run is marked `status: "error"` — never a guess, never silently skipped.

## 6. `raw` payload

`mapSalesInvoice`/`mapSalesInvoiceDetail` set `raw: item`, the complete JSON:API resource object for that row, exactly as returned — nothing added, removed, or recomputed.

## 7. Contact/product/invoice relationships

- `contact_parasut_id`, `category_parasut_id`, `sales_offer_parasut_id`, `recurrence_plan_parasut_id`, `active_e_document_parasut_id`/`active_e_document_type` on invoices come directly from the invoice's own `relationships.*.data.id`/`.type`.
- `product_parasut_id`, `warehouse_parasut_id` on each detail come from that detail's own `relationships.product`/`relationships.warehouse` (warehouse always null per section 1's finding).
- `sales_invoice_parasut_id` on each detail is the real numeric `parasut_id` of the invoice it was resolved from (via the invoice's `relationships.details.data` list), not inferred or guessed.

## 8–9. Sync counters and archived verification

Response and `parasut.sync_runs` (via 2 new nullable columns, `detail_fetched_count`/`detail_upserted_count`, added by this phase's migration) now carry: `invoice_fetched_count`, `invoice_active_fetched_count`, `invoice_archived_fetched_count`, `invoice_upserted_count`, `detail_fetched_count`, `detail_upserted_count`, `error_count`. Since `filter[archived]` **is** supported for `sales_invoices` (verified in section 1), active/archived were fetched and validated separately, not guessed.

## 10. Demo read view

New migration `20260826030000_parasut_sales_invoices_demo.sql` adds `public.parasut_sales_invoices_demo` (invoice header fields + `contact_name` resolved via a real `left join` on `contact_parasut_id = parasut.contacts.parasut_id`) and `public.parasut_sales_invoice_details_demo` (line item fields + `product_name` via a real left join on `parasut.products`, which is `null` for now since products aren't synced in this phase — never fabricated). Both are owner-privilege views (same pattern as the Phase 1/1.2 demo views), granted `select` to `anon`/`authenticated`.

**Same `CREATE OR REPLACE VIEW` column-ordering constraint from Phase 1.2 was respected this time on the first attempt:** the two new `sync_runs` columns were appended at the very end of `public.parasut_sync_status_demo`'s column list, not inserted mid-list — this migration applied successfully on the first try, both locally (`supabase db reset` from scratch) and on hosted.

## 11. Routes

`src/App.tsx`: added `/satislar/faturalar` (`Faturalar.tsx`) and `/satislar/faturalar/:parasutId` (`FaturaDetay.tsx`) inside the demo route branch. `DemoHome.tsx` got one added link to the new list page.

## 12. List screen fields

`Faturalar.tsx` shows, per row: fatura numarası, müşteri (linked to `/musteriler/:id`), düzenleme tarihi, vade tarihi, net toplam, brüt toplam, KDV, kalan tutar, ödeme durumu, arşiv durumu — all real columns from `parasut_sales_invoices_demo`, formatted for display only (see section 17).

## 13. Contact name resolution

Done in SQL (the view's `left join`), not in the frontend — `contact_name` is a real, already-joined column by the time the frontend reads it; the frontend also links the contact name to the existing `/musteriler/:parasutId` detail page.

## 14. Detail screen

`FaturaDetay.tsx` shows the invoice header (id, dates, currency, net/gross/VAT/discount/remaining, payment status, tax office/number, city/district, archived, last sync, note) and a real line-item table (`parasut_sales_invoice_details_demo` filtered by `sales_invoice_parasut_id`) with product, description, quantity, unit price, VAT rate, net total.

## 15. Null handling

Every field in both pages renders `"—"` when the value is `null`/absent — no fabricated defaults anywhere (verified against real nulls: `description`, `billing_postal_code`, `product_name` for unsynced products, etc. all show `"—"` correctly).

## 16. Real filters

`Faturalar.tsx`: Aktif/Arşivli/Tümü buttons with live `count: exact` per filter (same pattern as Phase 1.2's contacts filters); a payment-status `<select>` mapped to the real `payment_status` enum values (`paid`, `overdue`, `unpaid`, `partially_paid`); two date inputs filtering `issue_date` with `gte`/`lte` — all executed as real Supabase queries, no client-side-only faking.

## 17. Currency formatting

`formatAmount()` in both pages formats the numeric value with `Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` and appends the **stored currency string exactly as-is** (e.g. `"176.040,00 TRL"`) — deliberately not mapped to an ISO code (Parasut's `"TRL"` isn't valid ISO 4217, `Intl.NumberFormat`'s `currency` option would throw or require guessing a mapping to `"TRY"`); the underlying `net_total`/`currency` values in the database and in `raw` are completely untouched by this — display-only formatting per the rule.

## 18. Mobile / horizontal scroll

Both new tables are wrapped in `overflow-x-auto` with `min-w-[960px]` / `min-w-[640px]`, same pattern as the Phase 1.2 fix. **Not independently re-verified in an actual browser this session** — see Known Issues, same root cause (self-signed certificate) as Phase 1.2's equivalent open item.

## 19–20. Hosted deploy and sync

Docker was responsive this session (unlike Phase 1.2), so this phase was fully verified **locally first**, then repeated on hosted:

- Local: `supabase db reset` (fresh DB, all 5 migrations applied in order, including this phase's) → success. `supabase functions serve` → contacts sync (448/448, unchanged behavior after the refactor) → sales_invoices dry-run (451/449/2, detail 1402) → real sync (451/451 invoices, 1402/1402 details, 0 errors).
- Hosted: `supabase db push` → **first attempt failed** with `LegacyProjectNotLinkedError` because deleting the stale `supabase/.temp` directory (done to clear a local-artifact lint false-positive, see Known Issues) also removed the project-ref link file. Fixed with `supabase link --project-ref yzuxdrknidveptvnwthf`, then `db push` succeeded. `supabase functions deploy parasut-sync` → success (704 KB).
- Hosted dry-run: `{"status":"dry_run","invoice_fetched_count":451,"invoice_active_fetched_count":449,"invoice_archived_fetched_count":2,"invoice_upserted_count":0,"detail_fetched_count":1402,"detail_upserted_count":0,"total_count_reported":451,"error_count":0}`
- Hosted real sync: `{"status":"success","invoice_fetched_count":451,"invoice_active_fetched_count":449,"invoice_archived_fetched_count":2,"invoice_upserted_count":451,"detail_fetched_count":1402,"detail_upserted_count":1402,"total_count_reported":451,"error_count":0}`

## 21. API–Supabase–UI reconciliation

| Layer | Active invoices | Archived invoices | Total invoices | Details |
|---|---:|---:|---:|---:|
| Parasut API (this sync) | 449 | 2 | 451 | 1402 |
| Supabase (`Content-Range`, hosted, verified via anon-readable view) | 449 | 2 | 451 | 1402 |
| Demo UI (same queries the pages run — Aktif/Arşivli/Tümü counts, list, detail line items) | 449 | 2 | 451 | 1402 (per-invoice, verified for a sample invoice: 7/7 line items returned) |

All three layers agree. Sample verified invoice: `parasut_id 1097340094` (`HD02026000000092`), 176.040,00 TRL net, `contact_name` "H.M.S HACILAR MAKİNA SANAYİ..." resolved correctly, 7 real line items returned by `parasut_sales_invoice_details_demo`.

## 22. Frontend deploy

`npm run build:demo` → success (new `Faturalar-*.js`, `FaturaDetay-*.js` chunks). Deployed via the same FTP method as Phase 1.1/1.2 (`scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo`, `MSYS_NO_PATHCONV=1`, dry-run confirmed the correct remote path first): **21/21 files uploaded**. Live routes all HTTP 200: `/`, `/satislar/faturalar`, `/satislar/faturalar/1097340094` (active), `/satislar/faturalar/1027252201` (archived). Live `index.html` references `assets/index-y6eg8_JT.js` / `assets/index-DDNvvkmM.css`, matching the fresh build's hashes.

## 23. Test / lint / build / tsc

- `npm test` → 1/1 passed.
- `npm run lint` → **first run showed 205 errors** — root-caused to `supabase/.temp/start-secrets/.../main/index.ts`, a gitignored, Docker-generated bundle artifact left behind by `supabase functions serve` (not tracked, not part of the codebase, matched by eslint's `**/*.{ts,tsx}` glob since the repo's `eslint.config.js` only ignores `dist`, not `supabase/.temp`). Stopped the local stack, deleted the artifact, reran: **0 errors, 10 pre-existing warnings** (same as every prior phase).
- `npm run build:demo` → success.
- `tsc --noEmit -p tsconfig.app.json` → same single pre-existing, unrelated error: `src/pages/Login.tsx:55` (`Logo`/`LogoProps.variant`) — not touched, not in scope, **not reported as PASS**.

## Changed files (this phase)

Modified: `src/App.tsx`, `src/pages/DemoHome.tsx`, `supabase/functions/parasut-sync/index.ts`, `supabase/functions/parasut-sync/parasut_client.ts`
Added: `src/pages/Faturalar.tsx`, `src/pages/FaturaDetay.tsx`, `supabase/functions/parasut-sync/resources/sales_invoices.ts`, `supabase/migrations/20260826030000_parasut_sales_invoices_demo.sql`, `reports/PHASE_02_SALES_INVOICES_REPORT.md`
Not touched (user's own, pre-existing): `vite.config.ts`, `src/pages/Login.tsx`, `AUDIT_REPORT.md`
Deployed (not committed, build output): `dist/demo/**` → uploaded via FTP

---

## Sonuç Özeti

| Kontrol | Beklenen | Gerçekleşen | Sonuç | Sorun/Kök Neden |
|---|---:|---:|---|---|
| API aktif fatura | API sonucu | 449 (`filter[archived]=false`, tam pagination) | PASS | — |
| API arşivli fatura | API sonucu | 2 (`filter[archived]=true`, tam pagination) | PASS | — |
| API toplam fatura | aktif+arşivli | 449+2=451 | PASS | — |
| API fatura kalemi | invoice.relationships.details toplamı | 1402, hepsi `included`'da çözüldü, 0 eksik | PASS | — |
| Supabase aktif fatura | 449 | 449 (`Content-Range`) | PASS | — |
| Supabase arşivli fatura | 2 | 2 (`Content-Range`) | PASS | — |
| Supabase toplam fatura | 451 | 451 (`Content-Range`) | PASS | — |
| Supabase fatura kalemi | 1402 | 1402 (`Content-Range`) | PASS | — |
| Son sync sayaçları | API ile aynı | `invoice 449/2/451, detail 1402/1402, error 0` | PASS | — |
| Local doğrulama (Docker) | mümkün olmalı | Docker bu oturumda yanıt verdi; `db reset` + `functions serve` ile tam uçtan uca test edildi | PASS | — |
| UI müşteri adı çözümü | contact_parasut_id ilişkisiyle gerçek isim | SQL `left join` ile doğrulandı, örnek: "H.M.S HACILAR MAKİNA..." | PASS | — |
| Liste ekranı gerçek alanlar | fatura no/müşteri/tarihler/tutarlar/durum/arşiv | Hepsi `parasut_sales_invoices_demo`'dan, gerçek sorgu ile doğrulandı | PASS | Tarayıcıda görsel render bu oturumda teyit edilemedi (bkz. FAIL/BLOCKED) |
| Detay ekranı üst bilgi + kalemler | gerçek veriler | Örnek fatura için 7/7 gerçek kalem doğrulandı | PASS | Aynı not |
| Filtreler (ödeme/arşiv/tarih) | gerçek Supabase sorguları | `.eq`/`.gte`/`.lte` ile REST üzerinden doğrulandı | PASS | Aynı not |
| Para birimi biçimlendirme | değer değişmeden | `Intl.NumberFormat` + ham currency string; DB/raw değişmedi | PASS | — |
| Mobil/yatay taşma | kolon kaybı yok | Kod deploy edildi (`overflow-x-auto`); tarayıcıda görsel teyit yok | **BLOCKED** | Bkz. FAIL/BLOCKED — self-signed sertifika (Faz 1.2'den devam eden, koda ilgisi yok) |
| Migration deploy | hosted uygulanmış | `supabase migration list`: 5/5 local=remote | PASS | İlk `db push` denemesi link hatası verdi, `supabase link` ile düzeltilip tekrar başarıyla push edildi |
| Edge Function deploy | hosted çalışıyor | Dry-run ve gerçek sync ikisi de 200/success | PASS | — |
| Frontend deploy | canlı bundle güncel | Canlı `index.html` → `index-y6eg8_JT.js`, build hash'iyle birebir aynı | PASS | — |
| npm test | başarılı | 1/1 | PASS | — |
| npm run lint | 0 hata | İlk çalıştırma 205 hata verdi | **FAIL (sonradan düzeltildi, 0 hata)** | Bkz. FAIL/BLOCKED — gitignore'lu Docker artefaktı, kaynak koda ait değil |
| npm run build:demo | başarılı | Başarılı | PASS | — |
| TypeScript kontrolü | 0 hata | 1 hata (`Login.tsx:55`) | **FAIL — pre-existing unrelated error** | Faz 1.2'den beri aynı, Login'e dokunulmadı |
| Git commit/push | remote main güncel | _(commit sonrası doldurulacak, aşağıya bakın)_ | — | — |

## FAIL ve BLOCKED Maddeler

### npm run lint (ilk çalıştırma)
- Durum: FAIL (bu oturum içinde düzeltildi, nihai durum PASS)
- Hata mesajı: 205 hata, hepsi tek bir dosyada (`1:24226`, `1:24349`, ... gibi tek satırlık minified kod konumları), örn: `'c' is never reassigned. Use 'const' instead  prefer-const`, `Expected an assignment or function call and instead saw an expression  @typescript-eslint/no-unused-expressions`.
- Kesin kök neden: `supabase/.temp/start-secrets/supabase_edge_runtime_eclipsemuhendislik.com/main/index.ts` — `supabase functions serve` komutunun yerelde ürettiği, minified/bundlenmiş bir çalışma zamanı artefaktı. Bu dosya `supabase/.gitignore` içindeki `.temp` kuralıyla git'ten hariç tutuluyor, ama repo kökündeki `eslint.config.js` sadece `dist`'i `ignores` listesine alıyor, `supabase/.temp`'i almıyor — bu yüzden eslint'in `**/*.{ts,tsx}` deseni bu minified dosyayı da yakaladı.
- Bu fazdan mı kaynaklandı, önceden mi vardı: Bu fazda ortaya çıktı — çünkü bu fazda (Faz 1.2'nin aksine) Docker/local Supabase gerçekten çalıştırıldı ve `supabase functions serve` bu artefaktı üretti. `eslint.config.js`'deki eksik ignore kuralı önceden de vardı ama daha önce hiç tetiklenmemişti (local functions serve o oturumlarda ya çalışmadı ya da `.temp` temizlenmişti).
- Canlı sistemi etkiliyor mu: Hayır. Dosya git'e hiç girmiyor (gitignore'lu), commit'e dahil değil, deploy edilen koda hiç karışmıyor. Sadece yerel `npm run lint` çıktısını kirletiyor.
- Yapılan denemeler: Kaynağı `grep`/tam log okumasıyla teşhis edildi; local Supabase durduruldu (`supabase stop`), `supabase/.temp` silindi, `npm run lint` tekrar çalıştırıldı → 0 hata, 10 önceden var olan uyarı.
- Düzeltilmesi için gereken işlem (kalıcı, bu oturumda yapılmadı — kapsam dışı bir config değişikliği): `eslint.config.js`'deki `ignores` listesine `supabase/.temp` eklenmesi, böylece gelecekte local Supabase çalıştırıldığında bu yanlış pozitif tekrar oluşmaz. Bu, mevcut migration'lara dokunmayan ama eslint config'ine dokunan bir değişiklik olacağından, bu fazın "sadece yeni migration, mevcutları değiştirme" kuralı kapsamı dışında görülüp yapılmadı; kullanıcı isterse ayrı bir küçük değişiklik olarak yapılabilir.
- Sonraki faza bırakıldıysa nedeni: Kalıcı config düzeltmesi bu fazın kapsamında istenmedi; yerel geliştirme rahatsızlığı dışında hiçbir etkisi yok.

### TypeScript kontrolü (`tsc --noEmit`)
- Durum: FAIL
- Hata mesajı: `src/pages/Login.tsx(55,17): error TS2322: Type '{ variant: string; }' is not assignable to type 'IntrinsicAttributes & LogoProps'. Property 'variant' does not exist on type 'IntrinsicAttributes & LogoProps'.`
- Kesin kök neden: `Login.tsx`'in kendi, bu oturumlardan önce var olan tip hatası; `LogoProps` tipi `variant` prop'unu tanımlamıyor.
- Bu fazdan mı kaynaklandı, önceden mi vardı: Önceden vardı (Faz 1.1 ve 1.2 raporlarında da aynı şekilde işaretlendi). Bu fazda `Login.tsx`'e hiç dokunulmadı.
- Canlı sistemi etkiliyor mu: Hayır — `npm run build:demo` (gerçek deploy komutu) tip hatalarını durdurmadan geçiyor; canlı build başarıyla tamamlandı ve deploy edildi.
- Yapılan denemeler: Yok — talimat gereği Login'e dokunulmadı.
- Düzeltilmesi için gereken işlem: `LogoProps` tipine `variant` eklenmesi (kullanıcının kendi Login çalışması).
- Sonraki faza bırakıldıysa nedeni: Kapsam dışı — "Login ile ilgilenme" talimatı.

### Mobil/yatay taşma görsel doğrulaması
- Durum: BLOCKED
- Hata mesajı: Kod hatası değil — WebFetch: `"self signed certificate"`; sertifika doğrulamalı `curl`: `schannel: SEC_E_UNTRUSTED_ROOT`.
- Kesin kök neden: `demo.eclipsemuhendislik.com` hâlâ self-signed sertifika sunuyor (Faz 1.1'de `openssl s_client` ile doğrulandı, Faz 1.2'de de aynı sorun raporlandı). Bu oturumdaki hiçbir sertifika-doğrulamalı araç sayfayı gerçek bir tarayıcı gibi render edip yatay kaydırma/kolon davranışını görsel olarak teyit edemiyor.
- Bu fazdan mı kaynaklandı, önceden mi vardı: Önceden vardı (Faz 1.1'den beri süregelen bir hosting/SSL sorunu), bu fazın kodunun yeni bir tablosu (`Faturalar.tsx`) aynı `overflow-x-auto` deseniyle yazıldığı için aynı görsel doğrulama boşluğunu miras aldı.
- Canlı sistemi etkiliyor mu: Sertifika sorunu evet (son kullanıcı tarayıcısında güven uyarısı), ama bu fazın kapsamı dışında. Scroll/kolon kodu deploy edildi ve build çıktısında mevcut.
- Yapılan denemeler: `curl -k` ile HTTP 200 ve doğru bundle referansı doğrulandı; WebFetch reddetti; headless tarayıcı bu ortamda yok.
- Düzeltilmesi için gereken işlem: `demo` subdomain'i için geçerli SSL sertifikası (hosting/SSL sağlayıcı tarafında).
- Sonraki faza bırakıldıysa nedeni: Bu oturumun araçlarıyla çözülemez; Claude Browser'a veya sertifika düzeltildikten sonraki bir oturuma bırakıldı.

## Genel Karar

**PASS WITH KNOWN ISSUES**

- Kritik canlı sorun var mı? Hayır — migration, Edge Function, gerçek sync, ve sayı eşleşmesi (fatura + kalem, aktif + arşivli) hepsi hosted'da PASS.
- Paraşüt API–Supabase–UI sayıları uyuşuyor mu? Evet — 449/2/451 fatura ve 1402/1402 kalem, üç katmanda da (API, Supabase, UI'ın kullandığı gerçek sorgular) birebir eşleşiyor.
- Gerçek bir fatura detay/kalem route'u açıldı mı? Evet — `/satislar/faturalar/1097340094` (aktif) HTTP 200 döndü, REST üzerinden bu faturanın 7 gerçek kalemi doğrulandı; `/satislar/faturalar/1027252201` (arşivli) de HTTP 200.
- Canlıya deploy edildi mi? Evet — migration hosted'a uygulandı, Edge Function hosted'a deploy edilip gerçek veriyle çalıştırıldı, frontend build'i FTP ile yüklendi ve bundle hash'i canlıda doğrulandı.
- Claude Browser testine hazır mı? Evet, tek bilinen sınırlamayla: self-signed sertifika nedeniyle tarayıcı bir güven uyarısı gösterebilir/bypass gerektirebilir; mobil/yatay taşma davranışı kod olarak deploy edildi ama görsel olarak teyit edilmedi.
- Bir sonraki gerekli işlem nedir? (1) `demo` subdomain'i için geçerli SSL sertifikası, (2) Claude Browser ile gerçek görsel doğrulama (liste/detay ekranları, filtreler, mobil scroll), (3) istenirse `eslint.config.js`'e `supabase/.temp` ignore kuralının eklenmesi (kalıcı, düşük öncelikli temizlik).

## Sample `parasut_id` values for Claude Browser

**Faturalar (invoices):**
- Active: `1097340094` — HD02026000000092, H.M.S HACILAR MAKİNA SANAYİ..., 176.040,00 TRL, overdue
- Active: `1096695099` — HD02026000000091, HİRA PARTS METAL SANAYİ VE TİCARET LİMİTED ŞİRKETİ, 75.000,00 TRL, unpaid
- Active: `1096285077` — HD02026000000090, İŞMAKSER MAKİNA NAKLİYAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ, 42.000,00 TRL, paid
- Archived: `1027252201` — HD02024000000079

**Contacts (from Phase 1.2, still valid):**
- Active: `1011029218`, Archived: `1011029178`
