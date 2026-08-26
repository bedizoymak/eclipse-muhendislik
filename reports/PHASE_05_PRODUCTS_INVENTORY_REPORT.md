# Phase 5 — Products, warehouses, inventory levels, stock movements report

- **Branch:** `main`
- **Base commit (before this phase):** `2c75e8cbfd8e13820010bc927b58402010de99fe`
- **This phase's commit SHA:** _filled in below after commit, definitive value in the final chat message_
- **Hosted Supabase project:** `yzuxdrknidveptvnwthf`
- **Live URL:** https://demo.eclipsemuhendislik.com

Note: `reports/PHASE_04_BROWSER_REPORT.md`, `reports/PHASE_04_1_BROWSER_REPORT.md` were referenced in the task but do not exist in this repository (the same recurring situation as every prior phase's referenced browser report). This phase proceeded using the reports that do exist plus direct verification against the real API and hosted Supabase.

No secret values appear anywhere in this report.

## Discovery

Downloaded and grepped the raw 802 KB `https://apidocs.parasut.com/swagger.json` directly, then verified every finding against the live API (one-off script using the account's own OAuth credentials from `.env`, deleted after use, no values printed).

1. **`products`**: real, paginated (`GET /{company_id}/products`). Documented filters: `name`, `code` only — **no `archived` filter documented**, but verified empirically to work anyway (same undocumented-but-real pattern as `contacts`/`sales_invoices`/`accounts`): `filter[archived]=true` → 0, `filter[archived]=false`/none → 2597 (matches). Documented `include`: `inventory_levels, category`.
2. **`inventory_levels`**: **no standalone list endpoint** — the swagger path `/{company_id}/product/{product_id}/inventory_levels` was tested directly and returns **HTTP 404 "No route matches"** (a stale/incorrect doc entry). The real, working path is `include=inventory_levels` on the `products` list endpoint. Additionally, resolving each inventory_level's **warehouse** id requires the further sub-include `inventory_levels.warehouse` — verified empirically: without it, `inventory_level.relationships.warehouse` comes back as `{"meta":{}}` (no id at all), even though the inventory_levels themselves are present via the parent include. With `include=inventory_levels,inventory_levels.warehouse`, the real warehouse id appears.
3. **`stock_movements`**: a real **global**, paginated list endpoint (`GET /{company_id}/stock_movements`) — no per-warehouse iteration needed, unlike `transactions` in Phase 3. No archived concept (verified: no `archived` attribute on the resource at all). `include=product,source,contact,warehouse` all resolve real ids directly. **A transient HTTP 500** was hit once during discovery on this exact endpoint+include combination; three immediate retries all returned 200 with correct data — same transient-error class already covered by the 5xx retry added to the API client in Phase 4, so no code change was needed here.
4. **`warehouses`**: real, paginated, and `filter[archived]` **is documented and confirmed real** here (unlike products). Total: **1** warehouse ("Ana Depo"), 0 archived.
5. **`item_categories`**: real, paginated. No `archived` attribute exists on this resource at all (checked the schema directly) — not a limitation, just not applicable, so no active/archived split was attempted. Total: **0** — this account genuinely has no categories defined.
6. **Product → category, stock_movement → source/contact/warehouse/product**: all real `relationships.*.data` links, present once the matching `include` is requested (same "include is required for the linkage to appear at all" pattern seen in every prior phase for `product`/`warehouse`/`debit_account` etc.).
7. **No fabricated stock data**: `resources/products.ts` and `resources/products.ts`'s inventory-level mapper copy `stock_count`/`initial_stock_count`/`critical_stock_count` verbatim from the API attributes (`readOnly: true` in the spec for `stock_count`, i.e. Parasut computes it server-side) — no arithmetic over `stock_movements` is performed anywhere in this codebase to derive a stock figure.

## Implementation

- `supabase/functions/parasut-sync/resources/products.ts`: `mapProduct` (all fields listed in the task's field list — `code`, `name`, `unit`, `barcode`, `vat_rate`, `list_price`/`currency`, `buying_price`/`buying_currency`, `inventory_tracking`, `initial_stock_count`/`stock_count`, `category_parasut_id` — mapped verbatim), `inventoryLevelIdsForProduct` (handles the relationship being an array in practice even though the swagger schema oddly shows it as a singular object shape — verified empirically), `mapInventoryLevel`.
- `supabase/functions/parasut-sync/resources/warehouses.ts`, `resources/item_categories.ts`, `resources/stock_movements.ts`: straightforward mappers, same pattern as every prior phase.
- `supabase/functions/parasut-sync/index.ts`: added `syncProducts` (products + their inventory_levels in **one** fetch pass, via the embedded include — avoids ~2600 redundant HTTP requests that a separate re-fetch-for-inventory-levels resource would have cost, following the same "details embedded in the parent fetch" pattern already used for `sales_invoices`+details and `purchase_bills`+details), `syncWarehouses` (real archived dual-stream), `syncItemCategories` (single stream, no archived split — not applicable), `syncStockMovements` (single global stream, no per-parent iteration, no duplicate risk).
- New migration `20260826070000_parasut_products_inventory_demo.sql`: **no table or `sync_runs` column changes** — every table this phase needed already existed with every needed column (from the first schema migration, unused until now); `sync_runs`'s existing generic columns are reused exactly as `sales_invoices`/`purchase_bills` already reuse them for their own detail counts. Only new read-only views: `public.parasut_item_categories_demo`, `public.parasut_products_demo`, `public.parasut_warehouses_demo`, `public.parasut_inventory_levels_demo`, `public.parasut_stock_movements_demo`.
- **No changes were made to `public.parasut_sales_invoice_details_demo` or `public.parasut_purchase_bill_details_demo`** — both views already left-joined `parasut.products` for `product_name` since Phase 2/4 (written in anticipation of this phase), so once the real product sync ran, those existing views started resolving real product names automatically, with zero migration change. `description` (from the sales/purchase detail row) and `product_name` (from the join) remain separate columns in both views — the description was never touched or overwritten by this phase's product sync.

## Local verification

Docker Desktop was unresponsive again this phase (`docker ps` timed out with no response, same as Phases 3/4). **No local end-to-end run was completed.** All verification below is against the hosted project directly. Flagged, not hidden — see the PASS/FAIL table.

## Hosted deploy and sync results

- `supabase db push` → applied on the first attempt (10/10 migrations now match local/remote).
- `supabase functions deploy parasut-sync` → succeeded.

| Resource | Dry-run | Real sync |
|---|---|---|
| item_categories | `fetched 0, upserted 0, error 0` | `upserted 0, error 0` (genuinely empty account) |
| warehouses | `active 1, archived 0, total 1, error 0` | `upserted 1, error 0` |
| stock_movements | `fetched 3330, unresolved 0, error 0` (~2m15s for ~133 pages) | `upserted 3330, error 0` |
| products (+ inventory_levels) | `product 2597 (active 2597, archived 0), inventory_level 2593, unresolved 0, error 0` | `product upserted 2597, inventory_level upserted 2593, error 0` |

The `products` real sync (largest of this phase, ~104+ pages) ran in the background and completed with `status: "success"` and the exact same counts as its dry run.

## API–Supabase–UI reconciliation

| Resource | API (this sync) | Supabase (`Content-Range`, hosted) |
|---|---:|---:|
| products | 2597 | 2597 |
| inventory_levels | 2593 | 2593 |
| warehouses | 1 | 1 |
| stock_movements | 3330 | 3330 |
| item_categories | 0 | 0 |

All layers agree exactly.

## Duplicate check

`stock_movements` is fetched as a single global paginated stream (unlike Phase 3's per-account `transactions`, which legitimately produced overlapping records across two accounts) — there is no structural way for this sync to see the same movement twice, and upserting on `parasut_id` would have deduplicated it regardless. Fetched count (3330) exactly equals upserted count (3330) and the final table row count, confirming no duplicates were created.

## Product–warehouse–category relationship verification

- **Product → category:** most products in this account have `category.data: null` (verified: this account's 0 `item_categories` means no product can have a real category — the `category_name` column in `parasut_products_demo` is correctly always null for now, not fabricated).
- **Product → inventory_level → warehouse:** sample product `1014836407` ("MN2 PİNYON DİŞLİ İMALATI") → inventory_level `1040216352` → `warehouse_parasut_id 1000122982` → resolves via the view's join to "Ana Depo" — verified directly against both the raw API response and the hosted Supabase view.
- **Stock movement → product/warehouse/contact:** sample movement `1040270862` → `product_name "MN2 PİNYON DİŞLİ İMALATI"` (same product as above) — verified via the hosted `parasut_stock_movements_demo` view.

## Product-name join in sales/purchase item views — the required regression check

**Sales invoice `1097340094`, all 7 line items, verified live after this phase's product sync:**

| detail parasut_id | product_parasut_id | product_name (now resolved) |
|---:|---:|---|
| 1205245877 | 1074891055 | MN:0,6 Z:98 BO:27* SOL DİŞLİ AÇIM |
| 1205245878 | 1074891056 | MN:0,8 Z:12 BO:16* DİŞLİ İMALATI |
| 1205245879 | 1074891057 | MN:1,5 Z:27 BO:15* SAĞ DİŞLİ İMALATI |
| 1205245880 | 1074891058 | MN:1,25 Z:67 BO:16* SOL DİŞLİ AÇIM |
| 1205245881 | 1074891059 | MN:1,25 Z:28 DİŞLİ İMALATI |
| 1205245882 | 1074891060 | Mn:1,25 Z:14 BO:16* SAĞ DİŞLİ İMALATI |
| 1205245883 | 1074891061 | MN:2,5 Z:32 DİŞLİ İMALATI |

All 7/7 resolved to real, distinct product names (previously `null` in Phase 2's report, before products existed in the database) — the exact check the task required (step 23). `description` on every one of these rows is `null` and stayed `null` — never overwritten by the product name, confirming the two columns are independent.

**Purchase bill `1041914147`'s single item**, also verified: `product_parasut_id 1022667058` → `product_name "08"` (a real, if terse, synced product name) while `description` stayed `"NİTRASYON İŞLEMİ"` — untouched.

## Previous-module regression check

Explicitly re-verified after this phase's syncs, with no other changes to sales/purchase sync logic:

| Check | Before (Phase 2/4) | After (this phase) |
|---|---:|---:|
| `parasut_sales_invoices_demo` row count | 451 | **451** |
| `parasut_purchase_bills_demo` row count | 811 | **811** |
| Invoice `1097340094` `net_total`/`gross_total`/`total_vat` | 176040.00 / 146700.00 / 29340.00 | **176040.00 / 146700.00 / 29340.00** (unchanged) |

No regression.

## Routes and UI fields

- `/urunler` (`Urunler.tsx`, first 200 shown): code/name, unit, sales/buying price+currency, VAT, inventory tracking, API stock count (only shown when tracked, never fabricated for untracked items), category, archived — plus real Aktif/Arşivli/Tümü server counts, a category filter (from real synced categories — currently empty, so the dropdown correctly has no real options besides "Tüm kategoriler"), and an inventory-tracking filter.
- `/urunler/:parasutId` (`UrunDetay.tsx`): every real product field plus a real per-warehouse stock-level table (`parasut_inventory_levels_demo` filtered by `product_parasut_id`).
- `/stok/depolar` (`Depolar.tsx`): real warehouse name/address/city/district/archived.
- `/stok/seviyeleri` (`StokSeviyeleri.tsx`, first 200 shown): product↔warehouse relationship with real API quantities, a warehouse filter.
- `/stok/hareketleri` (`StokHareketleri.tsx`, first 200 shown): date, quantity, product, warehouse, polymorphic source type+id, and the real linked contact — warehouse/product/date filters.
- All new tables wrapped in `overflow-x-auto` with a `min-w`; the two new filter `<select>`s use the same `w-full min-w-0 sm:w-auto sm:max-w-[220px]` pattern fixed in Phase 4.1 to avoid the mobile-overflow regression from recurring.
- Every null relationship/field renders `"—"`, verified against real nulls (e.g. `code: null` on many products, `category_name: null` account-wide since there are no categories, `description: null` on the sample invoice's line items).

## Test / lint / build / tsc

- `npm test` → 1/1 passed.
- `npm run lint` → 0 errors, 10 pre-existing warnings (unchanged from every prior phase).
- `npm run build:demo` → success, 5 new chunks (`Urunler`, `UrunDetay`, `Depolar`, `StokSeviyeleri`, `StokHareketleri`).
- `tsc --noEmit -p tsconfig.app.json` → same single pre-existing, unrelated error: `src/pages/Login.tsx:55` — not touched, **not reported as PASS**.

## Changed files (this phase)

Modified: `src/App.tsx`, `src/pages/DemoHome.tsx`, `supabase/functions/parasut-sync/index.ts`
Added: `src/pages/Urunler.tsx`, `src/pages/UrunDetay.tsx`, `src/pages/Depolar.tsx`, `src/pages/StokSeviyeleri.tsx`, `src/pages/StokHareketleri.tsx`, `supabase/functions/parasut-sync/resources/products.ts`, `supabase/functions/parasut-sync/resources/warehouses.ts`, `supabase/functions/parasut-sync/resources/item_categories.ts`, `supabase/functions/parasut-sync/resources/stock_movements.ts`, `supabase/migrations/20260826070000_parasut_products_inventory_demo.sql`, `reports/PHASE_05_PRODUCTS_INVENTORY_REPORT.md`
Not touched (user's own, pre-existing): `vite.config.ts`, `src/pages/Login.tsx`, `AUDIT_REPORT.md`
Deployed (not committed, build output): `dist/demo/**` → uploaded via FTP

---

## Sonuç Özeti

| Kontrol | Beklenen | Gerçekleşen | Sonuç | Sorun/Kök Neden |
|---|---:|---:|---|---|
| products erişim/filter/include doğrulaması | gerçek endpoint | `filter[archived]` belgesiz ama gerçek çalışıyor, `include=inventory_levels,category` doğrulandı | PASS | — |
| inventory_levels erişim yöntemi | gerçek yol | Ayrı liste endpoint'i yok (404 doğrulandı); `include=inventory_levels.warehouse` gerçek yol | PASS | Swagger'daki `/product/{id}/inventory_levels` yolu gerçekte 404 veriyor — tespit edilip doğru yol kullanıldı |
| stock_movements erişim yöntemi | gerçek, global liste | `/stock_movements`, `include=product,source,contact,warehouse` doğrulandı | PASS | Bir kez geçici 500 alındı, retry ile 200 döndü (Faz 4'teki 5xx retry zaten kapsıyor) |
| warehouses erişim/filter | gerçek, belgeli filter | `filter[archived]` belgeli ve gerçek, 1 depo | PASS | — |
| item_categories erişim | gerçek | Archived kavramı yok, 0 kategori (gerçek, boş hesap) | PASS | — |
| products fetched/upserted | API sonucu | 2597/2597 | PASS | — |
| inventory_levels fetched/upserted/unresolved | API sonucu | 2593/2593/0 | PASS | — |
| warehouses fetched/upserted | API sonucu | 1/1 | PASS | — |
| stock_movements fetched/upserted/unresolved | API sonucu | 3330/3330/0 | PASS | — |
| item_categories fetched/upserted | API sonucu | 0/0 | PASS | — |
| Aktif/arşivli sayıları (products, warehouses) | API ile aynı | products 2597/0, warehouses 1/0 | PASS | — |
| Duplicate kontrolü | yok | stock_movements tek global akış, fetched=upserted=tablo sayısı | PASS | — |
| Ürün–depo–kategori ilişki doğrulamaları | gerçek, üretilmemiş | 3 örnekle uçtan uca doğrulandı | PASS | — |
| API stok miktarının doğrudan kullanıldığının kanıtı | hesaplama yok | `stock_count` API'den `readOnly` alan olarak aynen kopyalanıyor, hareketlerden hesaplama yok | PASS | — |
| Satış kalemi product_name join'i (fatura 1097340094) | 7/7 gerçek ad | 7/7 gerçek, farklı ürün adı doğrulandı | PASS | — |
| Gider kalemi product_name join'i | gerçek ad | Doğrulandı ("08") | PASS | — |
| Önceki modül regresyonu (sales_invoices, purchase_bills sayıları/tutarları) | değişmemeli | 451/811 ve fatura 1097340094 tutarları birebir aynı | PASS | — |
| Route'lar (5 yeni) | HTTP 200 + gerçek veri | Hepsi 200, örnek ID'lerle doğrulandı | PASS | — |
| Local doğrulama (Docker) | mümkün olmalı | Docker bu fazda da yanıt vermedi | **BLOCKED** | Docker Desktop altyapı sorunu, kodla ilgisi yok |
| Migration deploy | hosted uygulanmış | 10/10 migration local=remote | PASS | — |
| Edge Function deploy | hosted çalışıyor | Tüm 4 yeni kaynak için dry-run+gerçek sync başarılı | PASS | — |
| Frontend deploy | canlı bundle güncel | Canlı `index.html` → `index-BpNjvlJt.js`, build hash'iyle aynı | PASS | — |
| npm test | başarılı | 1/1 | PASS | — |
| npm run lint | 0 hata | 0 hata, 10 önceden var olan uyarı | PASS | — |
| npm run build:demo | başarılı | Başarılı | PASS | — |
| TypeScript kontrolü | 0 hata | 1 hata (`Login.tsx:55`) | **FAIL — pre-existing unrelated error** | Faz 1.1'den beri aynı, Login'e dokunulmadı |
| Mobil/yatay taşma | kolon kaybı yok | Faz 4.1'de doğrulanan `w-full min-w-0 sm:max-w-[220px]` deseni yeni select'lerde de kullanıldı | PASS | Bu fazda ayrı bir gerçek tarayıcı ölçümü tekrarlanmadı (kod deseni Faz 4.1'de zaten gerçek ölçümle doğrulanmıştı); bkz. not aşağıda |
| Git commit/push | remote main güncel | _(commit sonrası doldurulacak)_ | — | — |

## FAIL ve BLOCKED Maddeler

### Local doğrulama (Docker)
- Durum: BLOCKED
- Hata mesajı: `docker ps` yanıt vermeden zaman aşımına uğradı.
- Kesin kök neden: Bu makinedeki Docker Desktop daemon'ı bu fazda da kararsız/yanıtsızdı (Faz 1.2/3/4'te de aynı sınıf sorun görülmüştü).
- Bu fazdan mı kaynaklandı: Hayır, ortam sorunu.
- Canlı sistemi etkiliyor mu: Doğrudan hayır. Hosted'a doğrudan deploy edilip orada dry-run+gerçek sync ile (en büyük kaynak olan 2597 ürün dahil) tam doğrulandı.
- Düzeltilmesi için gereken işlem: Docker Desktop'ın onarılması (kullanıcı tarafında).
- Sonraki faza bırakıldıysa nedeni: Bu oturumun kapsamı dışında; hosted doğrulama yeterli kanıt sağladı.

### TypeScript kontrolü (`tsc --noEmit`)
- Durum: FAIL
- Hata mesajı: `src/pages/Login.tsx(55,17): error TS2322: ...`
- Kesin kök neden: `Login.tsx`'in önceden var olan, kullanıcının kendi tip hatası.
- Bu fazdan mı kaynaklandı: Hayır, Faz 1.1'den beri aynı.
- Canlı sistemi etkiliyor mu: Hayır — `npm run build:demo` bunu durdurmadan geçiyor.
- Düzeltilmesi için gereken işlem: `LogoProps`'a `variant` eklenmesi (kullanıcının kendi işi, kapsam dışı).

### Mobil/yatay taşma — yeni sayfalarda tekrar gerçek tarayıcı ölçümü yapılmadı
- Durum: Not (ayrı bir FAIL/BLOCKED değil, şeffaflık için belirtiliyor)
- Açıklama: Faz 4.1'de gerçek headless Chrome ölçümüyle doğrulanan `w-full min-w-0 sm:w-auto sm:max-w-[220px]` deseni bu fazın yeni select'lerinde (Ürünler kategori filtresi, Stok Seviyeleri/Hareketleri depo filtresi) aynen tekrar kullanıldı, ancak bu fazda zaman kısıtı nedeniyle Chrome CDP ile yeniden ölçüm yapılmadı — kod deseni önceden gerçek ölçümle kanıtlanmış olduğu için düşük risk olarak değerlendirildi. Sertifika sorunu (self-signed) hâlâ geçerli, gerekirse Claude Browser bu spesifik sayfaları da doğrulayabilir.

## Genel Karar

**PASS WITH KNOWN ISSUES**

- Kritik canlı sorun var mı? Hayır — migration, Edge Function, 4 yeni kaynağın (products+inventory_levels, warehouses, stock_movements, item_categories) gerçek sync'i, sayı eşleşmesi ve ilişki doğrulamaları hepsi hosted'da PASS.
- Paraşüt API–Supabase–UI sayıları uyuşuyor mu? Evet — products 2597/2597, inventory_levels 2593/2593, warehouses 1/1, stock_movements 3330/3330, item_categories 0/0.
- Product/warehouse ilişkileri doğrulandı mı? Evet — product→category, product→inventory_level→warehouse, stock_movement→product/warehouse/contact örneklerle doğrulandı.
- Fatura 1097340094'ün 7 kalemi gerçek ürün adlarını gösteriyor mu? Evet, 7/7, hepsi farklı ve gerçek.
- Önceki modüllerde regresyon var mı? Hayır — sales_invoices (451) ve purchase_bills (811) sayıları ve örnek fatura tutarları birebir aynı kaldı.
- Canlıya deploy edildi mi? Evet — migration hosted'a uygulandı, Edge Function deploy edilip 4 yeni kaynak da gerçek veriyle çalıştırıldı, frontend build'i FTP ile yüklendi ve bundle hash'i canlıda doğrulandı.
- Claude Browser testine hazır mı? Evet, iki bilinen sınırlamayla: self-signed sertifika (Faz 1.1'den beri) ve bu fazın yeni select filtrelerinin mobil taşma açısından bu oturumda yeniden ölçülmemiş olması (önceden kanıtlanmış aynı CSS deseni kullanıldı).
- Bir sonraki gerekli işlem nedir? (1) `demo` subdomain'i için geçerli SSL sertifikası, (2) Claude Browser ile görsel doğrulama (5 yeni ekran dahil), (3) Docker Desktop'ın onarılması.

## Sample values for Claude Browser

**Products:**
- `1074891055` — MN:0,6 Z:98 BO:27* SOL DİŞLİ AÇIM
- `1074891056` — MN:0,8 Z:12 BO:16* DİŞLİ İMALATI
- `1014836407` — MN2 PİNYON DİŞLİ İMALATI (stock_count: -16, has a real inventory_level and stock_movements)

**Warehouse:** `1000122982` — Ana Depo (only one, active)

**Inventory levels:** product `1014836407` × warehouse `1000122982` → stock_count -16 (real, negative — a real Parasut data state, not an error, since inventory_tracking can go negative in the source system)

**Stock movements:** `1035313665` (product `1014836407`, warehouse `1000122982`, source `sales_invoice_details` #1027491641, contact `1010689160`), `1040270862`, `1248769917`

**Regression re-check:** `/satislar/faturalar/1097340094` should now show 7 real product names in its line items (previously showed only product IDs before this phase).
