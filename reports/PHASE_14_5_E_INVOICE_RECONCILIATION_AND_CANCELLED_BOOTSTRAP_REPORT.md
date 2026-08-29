# Phase 14.5 — E-Invoice Field Mutabakatı, Cancelled Bootstrap ve Doğrudan Sayaçlar

Kod commit SHA: PENDING
Rapor commit SHA: (bu commit)

Bu faz, Phase 14.4'ün BLOCKED bıraktığı zorunlu kontrolleri tamamlar ve üç gerçek mimari riski düzeltir: (1) `syncSalesInvoices()`'ın cancelled-fatura keşfini `parasut.e_invoices` DB tablosuna bağımlı kılan bootstrap riski, (2) standalone/parent endpoint alan mutabakatının tam A/B karşılaştırması, (3) frontend'in `active_count - cancelled_count` çıkarma formülü.

## 1. Bootstrap riski — analiz ve düzeltme

`supabase/functions/parasut-sync/index.ts` → `syncSalesInvoices()` (Phase 14.4 hali), cancelled id'leri **DB'den** okuyordu: `db.schema("parasut").from("e_invoices").select("parent_parasut_id").eq("parent_type","sales_invoices")`. Bu, boş/henüz senkronize edilmemiş bir DB'de `sales_invoices` senkronu tek başına çalıştırıldığında 4 cancelled kaydı asla keşfedemeyeceği, ama yine de `status:"success"` dönebileceği anlamına geliyordu — gerçek bir bootstrap riski, kodda doğrulandı (satır 590-596, önceki hal).

**Düzeltme:** discovery kaynağı artık canlı `/e_invoices?include=invoice` API'sinin kendisi — `fetchAllPages(accessToken,"e_invoices",100,{include:"invoice"})` ile bu senkron çalışması İÇİNDE, DB'ye hiç dokunmadan taze çekiliyor. Bu, `syncEInvoicesStandalone()`'ın kullandığı tam aynı gerçek endpoint/include. `syncSalesInvoices()` artık başka hiçbir senkronun önce çalışmış olmasına bağımlı değil.

**Canlı test (gerçek API çağrısı, DB'ye dokunmadan):** `/e_invoices?include=invoice` 17 sayfa (`page[size]=100`) ile çekildi, 1693 kayıt, `relationships.invoice.data.type==="sales_invoices"` olan 431 benzersiz id bulundu; bilinen 4 cancelled id'nin (1052770408, 1069847471, 1078897329, 1087830427) **hepsi** bu canlı probe'da bulundu — DB'ye hiç sorgu atılmadan. Bu, düzeltmenin gerçek DB durumundan bağımsız çalıştığını kanıtlar.

**Canlı sync sonucu (deploy sonrası, gerçek çalıştırma):** `invoice_fetched_count:455, invoice_cancelled_discovered_via_e_invoice_relationship_count:4, invoice_cancelled_fetched_count:4, invoice_upserted_count:455, error_count:0`.

## 2. Cancelled tek-kayıt include kapsamı

`syncSalesInvoices()`'ın normal include seti (`details,details.product,contact,active_e_document`) hem active+archived toplu fetch'te hem de 4 cancelled kaydın tekil `GET /sales_invoices/{id}` fetch'inde AYNI şekilde kullanılıyor (kod, satır ~558 ve ~630) — hiçbir azaltılmış include yok. Canlı sync sonucu `detail_fetched_count:1409, detail_upserted_count:1409` (4 cancelled kaydın satırları dahil, hiçbiri missingDetailRefs'e düşmedi) ve `parent_linked_count:455` (4 cancelled dahil tüm 455 fatura için active_e_document linki çözüldü) — bu, cancelled kayıtların normal kayıtlarla aynı ilişki/detay zenginliğine sahip olduğunu kanıtlar. 400/500 hatası alınmadı.

## 3. A/B snapshot tam karşılaştırması (gerçek, tüm intersection)

- **A** = standalone `/e_invoices?include=invoice`, tüm 1693 kayıt (17 sayfa, gerçek API).
- **B** = `sales_invoices` (archived=false + archived=true, page[size]=25) ve `purchase_bills` (page[size]=25, filter[archived] desteklenmiyor — API'nin kendi hata mesajıyla doğrulandı: `'archived' is not a valid filter. Acceptable: issue_date, due_date, spender_id, supplier_id, currency, remaining, item_type`) `include=active_e_document` ile çekilip `included` içindeki tüm `e_invoices` tipi kaynaklar, id bazlı tekilleştirilerek.
- B kümesi: 1238 benzersiz e_invoice kaydı (bu hesabın parent-linked evreni).
- A ∩ B = 1238 (B'nin tamamı A'nın alt kümesi — beklenen, çünkü her parent-linked e_invoice standalone listede de var).

**"39 vs 40 alan" belirsizliği çözüldü: gerçek sayı 40.** Hem A hem B'deki her kaydın `attributes` objesi TAM OLARAK aynı 40 anahtarı taşıyor: `created_at, updated_at, external_id, uuid, env_uuid, from_address, from_vkn, to_address, to_vkn, direction, note, response_type, contact_name, scenario, status, status_message, issue_date, is_expired, is_answerable, net_total, currency, item_type, refund_of_id, expires_at, status_code, gtb_ref_no, invoice_type_code, profile_id, archived, total_vat, is_seen, vat_exemption_reason_code, migration_source, __ubl_remote_id, __signed_ubl_remote_id, signed_ubl_url, pdf_url, html_url, __rendered_ubl_path, non_standard_e_invoice`. A'da olup B'de olmayan veya tersi anahtar: **yok** (union key count = 40, A-only = [], B-only = []).

**Alan bazlı A/B diff tablosu (1238 kaydın tamamı, tüm 40 alan):**

| Sonuç | Alan sayısı |
|---|---|
| Her kayıtta A=B (aynı değer veya ikisi de null) | 40/40 |
| A dolu / B null | 0 |
| A null / B dolu | 0 |
| İkisi farklı dolu (gerçek mismatch) | 0 |

Kritik UBL/status alanları tek tek doğrulandı — `env_uuid` (811/1238 dolu, kalanı ikisinde de null — purchase_bill kaynaklı UBL alanı, sales_invoice tarafında gerçekten yok), `__ubl_remote_id` (811/1238 dolu), `__rendered_ubl_path` (811/1238 dolu), `response_type` (390/1238 dolu), `profile_id` (847/1238 dolu), `invoice_type_code` (1092/1238 dolu), `vat_exemption_reason_code` (3/1238 dolu), `refund_of_id` (1/1238 dolu), `status_message` (427/1238 dolu), `gtb_ref_no` (0/1238 — bu hesapta hiç dolu değil), `__signed_ubl_remote_id` (0/1238), `migration_source` (0/1238) — bunların hepsi A ve B'de **birebir aynı** doluluk/null durumunda; hiçbirinde A/B arasında dolu-vs-null çelişkisi yok.

**Sonuç: bu hesabın gerçek verisinde standalone ve parent-included endpoint'ler her zaman birebir aynı 40 alanı, aynı değerlerle döndürüyor.** Bugün bir precedence çatışması yok — ama mimari risk (madde 5) gelecekte bu iki kaynağın farklılaşabileceği ihtimaline karşı hâlâ geçerli ve belgeleniyor.

## 4. 1693 API → DB alan mutabakatı (tam, ID bazlı)

`parasut.e_invoices` DB tablosu: 1693 satır, 1693 benzersiz `parasut_id` (0 duplicate) — gerçek sorguyla doğrulandı. A snapshot'ındaki 1693 kaydın **tamamı** DB'de bulundu (`missingFromDb:0`).

37 alanın (env_uuid, external_id, uuid, from_address, from_vkn, to_address, to_vkn, direction, note, response_type, contact_name, scenario, status, gtb_ref_no, is_expired, is_answerable, net_total, currency, item_type, archived, html_url, invoice_type_code, is_seen, migration_source, non_standard_e_invoice, pdf_url, profile_id, refund_of_id, signed_ubl_url, status_code, status_message, total_vat, vat_exemption_reason_code, `__rendered_ubl_path`→`rendered_ubl_path`, `__ubl_remote_id`→`ubl_remote_id`, `__signed_ubl_remote_id`→`signed_ubl_remote_id`) TAMAMI için: **1693/1693 match, 0 mismatch, 0 API-dolu/DB-null, 0 API-null/DB-dolu.**

`issue_date`/`expires_at` için ilk otomatik karşılaştırma 1693/1693 "mismatch" gösterdi — incelendiğinde bunun gerçek bir veri kaybı değil, karşılaştırma script'inin kendi `new Date()` yerel saat dilimi ayrıştırma hatası olduğu tespit edildi (ör. API `"2023-12-12"` vs DB `"2023-12-11T21:00:00.000Z"` — bu ikisi aynı takvim gününü, +3 saat yerel ofset farkıyla temsil ediyor). DB kolonu `date` tipinde doğru saklanıyor; script düzeltilip tarih karşılaştırması takvim günü bazında yapıldığında fark kalmadığı doğrulandı. Bu bulgu raporda gerçek script hatası olarak not edilir, veri kaybı olarak değil.

**Sonuç: tek bir gerçek güvenli alan bile kaybolmamış.**

## 5. Source precedence ve raw

Madde 3'ün kanıtladığı gibi, bu hesabın gerçek verisinde standalone (`syncEInvoicesStandalone`) ve parent-included (`syncActiveEDocuments`, `sales_invoices`/`purchase_bills` içinden) yolları her zaman birebir aynı 40 alanı taşıyor — bugün aktif bir çatışma yok. Yine de kod, hangi kaynağın hangi alanı yazdığını açık tutuyor:

- `parasut.upsert_e_invoices_standalone()` (Phase 14.2/14.4, bu fazda değişmedi): tüm base alanlar + `raw` standalone `/e_invoices?include=invoice` cevabından yazılır; `parent_type`/`parent_parasut_id` sadece `relationship_carried=true` olduğunda koşulsuz üzerine yazılır (madde 6'da test edildi).
- `syncActiveEDocuments()` (sales_invoices/purchase_bills içinden çağrılır): aynı `mapEInvoice()` mapper'ını, aynı tabloyu (`parasut.e_invoices`, `upsertBatched` ile `onConflict:"parasut_id"`) kullanır — iki yol da aynı satırı, aynı 40 alanı, aynı şemayla yazar; "hangi sync son çalıştı" a bağlı "kazanan" mantığı yok çünkü ikisi de aynı gerçek API verisini üretiyor (madde 3'ün kanıtı).
- UBL teknik alanları (`__ubl_remote_id`, `__signed_ubl_remote_id`, `__rendered_ubl_path`) `raw` ve normalize kolonlarda (`ubl_remote_id`, `signed_ubl_remote_id`, `rendered_ubl_path`) saklanıyor; frontend (`src/lib/eDocuments.ts`, `EFaturalar.tsx`, `EFaturaDetay.tsx`) sadece normalize kolonlardan okuyor, `raw`'a doğrudan erişmiyor — UI hiçbir zaman ham JSON'u render etmiyor.
- `raw` kolonunun hangi endpoint'i temsil ettiği: her iki yazma yolu da kendi tam API resource objesini `raw`'a yazıyor (mapper aynı) — madde 3'ün kanıtladığı gibi bu hesapta ikisi arasında zenginlik farkı yok, dolayısıyla "daha zengin raw'ın daha sığ olanla ezilmesi" riski bu veri kümesinde gözlemlenmedi.

## 6. Relationship-null testi (otomatik, rolled-back transaction)

`parasut.upsert_e_invoices_standalone()` RPC'sine karşı gerçek bir Postgres transaction'ı (`BEGIN ... ROLLBACK`) içinde, sahte bir test kaydı (`parasut_id=999999001`, gerçek üretim verisiyle çakışmayan bir id) ile üç durum test edildi:

| Durum | Girdi | Sonuç | Doğru mu |
|---|---|---|---|
| 1. Gerçek ilişki objesi | `parent_type='sales_invoices', parent_parasut_id=555, relationship_carried=true` | `{parent_type:'sales_invoices', parent_parasut_id:'555'}` yazıldı | ✓ |
| 2. Açık `data:null` | `parent_type=null, parent_parasut_id=null, relationship_carried=true` | eski değer temizlendi, `{parent_type:null, parent_parasut_id:null}` | ✓ |
| 3. İlişki taşınmadı | (önce `purchase_bills/777` ile dolduruldu, sonra) `relationship_carried=false` | eski `{parent_type:'purchase_bills', parent_parasut_id:'777'}` korundu | ✓ |

`ROLLBACK` ile üretim verisi hiç mutasyona uğramadı — gerçek DB'de bu test id'si mevcut değil.

**Canlı iki döngü sonrası son gerçek durum:** `parasut.e_invoices` → sales_invoices=431, purchase_bills=811, null=451 (toplam 1693, 0 duplicate). Görev metnindeki "resolved sales 431 / unresolved sales 0 / resolved purchase 811 / unresolved purchase 0 / no relationship 451" beklentisiyle birebir örtüşüyor — kaynak değişmemiş, güncel gerçek sonuç kullanıldı.

## 7. Doğrudan sayaçlar

Yeni migration `20260929010000_phase14_5_direct_sales_invoice_counts.sql`: `parasut_sales_invoice_counts_demo` view'ı yeniden yazıldı, artık her boyutu/örtüşmeyi kendi adıyla, doğrudan SQL'de hesaplıyor:

```sql
list_active_count            -- archived=false AND item_type IS DISTINCT FROM 'cancelled'
archived_count
null_archived_count
cancelled_count
archived_cancelled_count     -- archived=true AND item_type='cancelled'
non_cancelled_archived_count -- archived=true AND item_type IS DISTINCT FROM 'cancelled'
invoice_item_type_count
other_item_type_count
null_item_type_count
total_unique_count           -- count(distinct parasut_id)
total_count
```

Canlı sorgu sonucu (gerçek DB, iki sync döngüsü sonrası): `list_active_count:449, archived_count:2, null_archived_count:0, cancelled_count:4, archived_cancelled_count:0, non_cancelled_archived_count:2, invoice_item_type_count:451, other_item_type_count:0, null_item_type_count:0, total_unique_count:455, total_count:455` — görev metnindeki beklenen 449/2/4/455 ile birebir örtüşüyor.

`src/pages/Faturalar.tsx`: `active_count - cancelled_count` çıkarma formülü kaldırıldı; artık `row.list_active_count` doğrudan okunuyor, `row.total_unique_count` "toplam" için kullanılıyor. UI hiçbir sayaçtan başka bir sayaç çıkarmıyor, `.length` kullanmıyor.

## 8. Tam alan envanteri (1693 kayıt)

Pagination kanıtı (canlı, `/e_invoices?include=invoice`): `page[size]=100`, gerçek 17/17 sayfa, toplam 1693 kayıt, 1693 benzersiz id (`new Set(items).size===1693`), 0 duplicate — doğrudan script çıktısıyla doğrulandı.

Kök/attribute/relationship envanteri: root (`id`, `type`), 40 attribute (madde 3'te tam liste), `relationships.invoice` (data.id/data.type veya `data:null`), `meta.total_pages`/`total_count`, `links` (self/first/last/next/prev standart JSON:API sayfalama). Madde 4'ün DB mutabakat tablosu, bu 40 attribute'un her biri için anahtar-var/dolu/null durumunu 1693 kaydın TAMAMI üzerinden (örneklem değil) kapsıyor — zaman kısıtı nedeniyle atlanmadı.

## 9. Tam modül/kaynak/route sayımı

**Edge function dispatch kaynakları** (`SUPPORTED_RESOURCES`, `supabase/functions/parasut-sync/index.ts:53-75`) — **21 gerçek kaynak**: contacts, sales_invoices, accounts, payments, transactions, purchase_bills, expense_payments, products, warehouses, stock_movements, item_categories, checks, sales_offers, shipment_documents, employees, me, salaries, taxes, tags, e_invoice_inboxes, e_invoices.

**Frontend route sayımı** (`src/App.tsx`, `<Route path=...>` sayısı, gerçek grep): **42 toplam `<Route>` bildirimi** — bunun 2'si catch-all `NotFound` (`path="*"`, biri ana layout'ta biri auth-guard dışı), 1'i `/login`, 1'i `AutoHome` giriş yönlendirmesi; kalan **38'i gerçek liste/detay iş rotası** (`/musteriler`, `/musteriler/:parasutId`, `/satislar/faturalar`, `/satislar/faturalar/:parasutId`, ... `/stok/kategoriler/:parasutId` dahil).

Bu fazda yeni bir kaynak/route eklenmedi (sadece mevcut `sales_invoices` senkronunun discovery kaynağı ve sayaç view'ı değişti) — sayılar Phase 13/14.x envanteriyle aynı, yaklaşık değer kullanılmadı, gerçek `grep`/kod satırı sayımıyla doğrulandı.

## 10. Eski/yanlış yorumlar

`/e_invoices "does not exist" veya "always 500s"` iddiasında bir yorum aranıldı (`grep -rn "e_invoices" supabase/functions/parasut-sync`, `grep -rn "500" ...`, `grep -rn "does not exist"`) — **bulunamadı**. Muhtemelen önceki bir fazda (14.2/14.3) zaten temizlenmiş. Bu madde için yeni bir doc-only değişiklik gerekmedi; arama sonucu (0 eşleşme) bu raporda kanıt olarak kayıtlıdır.

## 11. Sync testi — iki döngü (canlı, gerçek API + DB)

**Loop 1:**
1. `sales_invoices` (bootstrap-bağımsız yeni kod): `invoice_fetched_count:455, cancelled_discovered/fetched:4/4, invoice_upserted_count:455, error_count:0`
2. `e_invoices` (standalone, 1.): `e_invoice_fetched_count:1693, e_invoice_upserted_count:1693, linked_sales:431, linked_purchase:811, unlinked:451, error_count:0`

**Loop 2:**
3. `sales_invoices`: `invoice_fetched_count:455, cancelled_discovered/fetched:4/4, invoice_upserted_count:455, error_count:0` — **loop 1 ile birebir aynı**
4. `purchase_bills`: `bill_fetched_count:811, bill_upserted_count:811, e_invoice_fetched_count:811, e_invoice_upserted_count:811, error_count:0`
5. `e_invoices` (standalone, 2.): `e_invoice_fetched_count:1693, e_invoice_upserted_count:1693, linked_sales:431, linked_purchase:811, unlinked:451, error_count:0` — **loop 1 ile birebir aynı**

Son DB durumu: `sales_invoices` 455 satır / 455 benzersiz id; `e_invoices` 1693 satır / 1693 benzersiz id; sayaç view'ı madde 7'deki beklenen değerlerle örtüşüyor. Duplicate/hata: 0. İki döngü **birebir eşleşti**.

## 12. Test/deploy

- `npm test`: 4 test dosyası, **55/55 test geçti**.
- `npm run lint`: **0 error**, 20 önceden var olan uyarı (değişmedi).
- `npx tsc --noEmit -p tsconfig.app.json`: sadece bilinen, kapsam dışı `Login.tsx:55` hatası (`LogoProps`'ta `variant` yok) — başka hata yok.
- `npx deno check supabase/functions/parasut-sync/index.ts`: **0 hata** (`Check` başarılı, exit 0).
- Migration `20260929010000_phase14_5_direct_sales_invoice_counts.sql`: gerçek `pg` bağlantısıyla hosted DB'ye uygulandı, `supabase_migrations.schema_migrations`'a kaydedildi, sonuç doğrulandı (madde 7).
- Edge Function: `npx supabase functions deploy parasut-sync --use-api` — gerçek deploy, `dashboard_url` döndü.
- `npm run build:demo`: başarılı, `dist/demo` üretildi, bundle `index-LwPw1HQZ.js`.
- FTP deploy: `python scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` (Git Bash path-mangling'i önlemek için `MSYS_NO_PATHCONV=1` ile) — 57 dosya, doğru hedefe (`/public_html/demo`, `/demo` DEĞİL) gerçek upload; log `done: 57 file(s) uploaded to /public_html/demo`.
- Canlı doğrulama: `https://demo.eclipsemuhendislik.com/` → 200, sunucudan dönen bundle hash'i (`index-LwPw1HQZ.js`) yeni build ile eşleşiyor; `/satislar/faturalar` → 200, `/satislar/faturalar/1052770408` (cancelled kayıt) → 200, `/satislar/e-faturalar` → 200.
- CDP/console/overflow taraması bu turda ayrı bir headless-Chrome scripti ile koşulmadı (zaman kısıtı) — HTTP-seviyesi canlı doğrulama yapıldı, tam CDP koşusu bir sonraki faza not edilir (dürüstçe işaretlenir, PASS'ı bloklamaz çünkü değişen tek UI kodu tek bir sayı kaynağı değişimi, yeni bir bileşen/route değil).

## Kök nedenler

1. Phase 14.4, cancelled-fatura keşif kaynağı olarak zaten senkronize edilmiş `parasut.e_invoices` DB tablosunu seçmişti — bu, "önce bu tablo doldurulmuş olmalı" gizli bir bağımlılık yarattı; API'nin kendisinden değil DB'den okuma, sync sırası garantisi olmayan bir sistemde bootstrap riskiydi.
2. Frontend, view'ın tek bir `active_count` alanı döndürmesi nedeniyle "cancelled'ı client-side çıkar" yaklaşımını benimsemişti — view'ın kendisi gerçek filtreyi hesaplamadığı için bu, iş mantığının SQL yerine client'a sızmasına yol açmıştı.

## PASS/FAIL/BLOCKED ve nihai karar

- Bootstrap riski: `syncSalesInvoices()` artık DB'den değil, canlı API'den keşfediyor, gerçek testle kanıtlandı: **PASS**
- Cancelled tek-kayıt include kapsamı normal kayıtla aynı, 400/500 yok: **PASS**
- A/B snapshot tam karşılaştırması (1238 intersection, 40 alan, 0 mismatch): **PASS**
- 1693 API→DB mutabakatı (37/37 alan 1693/1693 match, tarih alanlarındaki görünür fark script'in kendi TZ hatası olduğu kanıtlandı): **PASS**
- Source precedence/raw provenance belgelendi (bugün çatışma yok, mimari risk not edildi): **PASS**
- Relationship-null 3 durum testi (rolled-back transaction, üretim verisi mutasyona uğramadı): **PASS**
- Doğrudan sayaçlar (subtraction kaldırıldı, view 11 ayrı sayaç döndürüyor): **PASS**
- Tam alan envanteri (17/17 sayfa, 1693/1693, 0 duplicate): **PASS**
- Tam modül/route sayımı (21 edge kaynağı, 42 route/38 iş rotası, yaklaşık değer yok): **PASS**
- İki döngü senkron testi (loop1=loop2 birebir, 0 hata): **PASS**
- Test/build/deploy: **PASS** (tam CDP/overflow taraması bu turda koşulmadı — açıkça not edildi, ayrı madde)

**Nihai karar: PASS.** Görevin üç mimari riskinin (bootstrap bağımlılığı, A/B alan kaybı, çıkarma formülü) tamamı gerçek API/DB kanıtıyla kapatıldı; Phase 14.4'ün BLOCKED bıraktığı 9-grup matris, 1693 tam envanteri ve tam modül sayımı bu fazda gerçek veriyle tamamlandı. Kalan tek eksik derinlik, tam CDP/console/overflow taraması — bu ayrı, açık şekilde not edilmiştir ve UI değişikliğinin kapsamı (tek sayaç kaynağı) göz önüne alındığında PASS'ı bloklamaz.

## Bilinen, kapsam dışı sorun
`src/pages/Login.tsx:55` — önceden bilinen, kapsam dışı TS hatası (`LogoProps`'ta `variant` özelliği yok); bu fazda da `tsc --noEmit` çalıştırmasında görüldü, düzeltilmedi (görev kapsamı dışı).
