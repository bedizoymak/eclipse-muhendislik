# Phase 07 — Satış Teklifleri

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/satislar/teklifler
**Kod commit SHA:** (aşağıda, ikinci commit'te doldurulacak)
**Rapor commit SHA:** (push sonrası doldurulacak)

## 1. Dokümantasyon ve gerçek API keşfi

İsim tahmin edilmedi; gerçek isteklerle doğrulandı. Denenen adaylar: `sales_offers` (✅ 200), `e_offers`/`offers`/`estimates`/`sales_estimates`/`quotes` (hepsi 404 "No route matches"). **Gerçek, çalışan uç nokta: `/v4/{company_id}/sales_offers`.**

- **Liste:** `GET /sales_offers` — 200, JSON:API listesi, sayfalama var.
- **Tekil detay:** aynı yapı, `/sales_offers/{id}` (ayrıca doğrulanmadı çünkü liste zaten tek kaydın tam attribute/relationship setini veriyor; gerek kalmadı).
- **`filter[archived]`:** **çalışıyor** — `=true` ve `=false` ayrı `meta.total_count` döndürüyor (false→1, true→0) — API'nin kendi bad-filter hata mesajı yalnızca `issue_date, contact_id`'yi "Acceptable" listeler ama `archived` filtresi gerçekte kabul ediliyor. Bu, önceki fazlarda da defalarca doğrulanmış aynı örüntü: hata mesajındaki "Acceptable" listesi eksik/güncel değil.
- **Geçerli include ilişkileri (gerçek 400 yanıtlarıyla doğrulandı):** `contact`, `details`, `details.product`, `sales_invoice`. Denenen ama reddedilen: `activities`, `sharings`, `details.warehouse`, `details.category` — hepsi `400 "... is not a valid relation. Acceptable: contact, details, details.product, sales_invoice"`. Bu dört gerçek relationship dışında include edilebilecek başka bir ilişki yok.
- **Pagination meta:** `current_page, total_pages, total_count, per_page`, ayrıca teklife özgü toplamlar: `net_total`, `invoiced_net_total`.
- **Teklif kalemleri:** ayrı bir `sales_offer_details` resource tipi olarak `relationships.details.data` dizisinde referans veriliyor, `include=details` ile `included` içinde tam olarak dönüyor (sales_invoices/sales_invoice_details ile birebir aynı desen).
- **İlişkili contact:** `relationships.contact.data` gerçek `{id,type:"contacts"}`, `include=contact` ile tam contact nesnesi `included`'da dönüyor.
- **Product ilişkisi:** her `sales_offer_details` kaydının kendi `relationships.product.data` var; `include=details.product` ile ürün nesnesi de `included`'da tam geliyor.
- **Sales invoice ilişkisi:** `relationships.sales_invoice.data` — teklif bir faturaya dönüştürülmüşse dolu olacak gerçek bir alan; mevcut tek kayıtta `null` (teklif henüz faturaya dönüştürülmemiş, reddedilmiş durumda).
- **Warehouse/category ilişkisi:** yok — `details.warehouse`/`details.category` API tarafından reddediliyor (400), swagger/hata mesajının "acceptable" listesinde de bulunmuyorlar; bu ilişkiler bu resource için gerçekten mevcut değil.

Dokümantasyon ile fark: API'nin kendi 400 hata mesajı `filter[archived]`'i "acceptable" listesinde göstermiyor ama gerçekte çalışıyor — kanıt yukarıda (200 + ayrı `total_count`).

## 2. Tam ham API envanteri

Hesaptaki **tüm** teklifler (aktif+arşivli, tam pagination) çekildi: toplam **1 kayıt** (aktif), **0 arşivli**. Bu, hesabın gerçek ve tam veri kümesi — daha fazla kayıt yok.

**Root:** `id, type, attributes, relationships, meta`. Resource-level `links` yok; resource-level `meta` var (`created_at`/`updated_at` — attributes ile aynı, ek veri değil).

**Attributes (1/1 kayıt, `found=1` her satırda):**

| Alan | Değer/tip | Null mü |
|---|---|---|
| `created_at`, `updated_at` | string | dolu |
| `description` | "asfsdf" | dolu |
| `content` | "sdfsdfsdf" | dolu |
| `issue_date`, `due_date` | "2025-12-05" | dolu |
| `net_total` | "1480.8" (string) | dolu |
| `net_total_in_trl` | "1480.8" (string) | dolu |
| `currency` | "TRL" | dolu |
| `gross_total` | "1234.0" (string) | dolu |
| `withholding_rate`, `withholding` | "0.0" | dolu |
| `total_excise_duty`, `total_communications_tax`, `total_accommodation_tax` | "0.0" | dolu |
| `total_vat` | "246.8" | dolu |
| `vat_withholding`, `vat_withholding_rate`, `total_vat_withholding` | "0.0" | dolu |
| `total_discount`, `total_invoice_discount` | "0.0" | dolu |
| `archived` | false | dolu |
| `invoice_discount`, `invoice_discount_type` | "0.0" / "percentage" | dolu |
| `exchange_rate` | "1.0" | dolu |
| `billing_address` | dolu string | dolu |
| `billing_phone`, `billing_fax` | — | **null** |
| `is_abroad` | false | dolu |
| `district`, `city` | — | **null** |
| `tax_number`, `tax_office` | dolu | dolu |
| `contact_type` | "company" | dolu |
| `sharings_count` | 0 | dolu |
| `status` | "rejected" | dolu |
| `display_exchange_rate_in_pdf` | false | dolu |
| `order_no`, `order_date` | — | **null** |

`net_total`/`gross_total`/vb. API'de **string** dönüyor; base tabloda `numeric` — değer kaybı yok.

**Relationships:** `contact` (dolu → 1011029197/contacts), `sales_invoice` (data: **null**, gerçek — henüz dönüştürülmemiş), `details` (dizi, 1 eleman → 1007359467/sales_offer_details), `activities` (yalnızca `{"meta":{}}`), `sharings` (yalnızca `{"meta":{}}`).

**sales_offer_details attribute'ları (1/1 kayıt):** `created_at, updated_at, description(null), net_total, unit_price, vat_rate, quantity, discount_type, discount_value(null), communications_tax_rate, excise_duty_type, excise_duty_value(null), invoice_discount, excise_duty, excise_duty_rate, discount, communications_tax, detail_no, net_total_without_invoice_discount, vat_withholding, vat_withholding_rate, accommodation_tax_rate, accommodation_tax, accommodation_tax_exempt`. Relationship: `product` (dolu → 1055806717/products).

`included` resource tipleri (tüm include'lar birlikte istendiğinde): `contacts` (1), `sales_offer_details` (1), `products` (1).

## 3. Kapsam ve sayı mutabakatı

`filter[archived]` desteklendiği doğrulandığı için **aktif ve arşivli akışlar ayrı pagination ile** çekildi (`fetchActiveAndArchived` — projenin mevcut standart deseni).

| Sayaç | Değer |
|---|---|
| `active_fetched_count` | 1 |
| `archived_fetched_count` | 0 |
| `total_fetched_count` | 1 |
| `details_fetched_count` | 1 |
| included (contacts/sales_offer_details/products) | 1/1/1 |
| `upserted_count` (offers) | 1 |
| `detail_upserted_count` | 1 |
| `duplicate_count` | 0 |
| `unresolved_count` (contact ilişkisi çözülemeyen) | 0 |
| `error_count` | 0 |

Aynı kayıt iki kez upsert edilmedi (aktif/arşivli akışlar ayrık, ID kesişmiyor).

## 4. Supabase modeli

`parasut.sales_offers` ve `parasut.sales_offer_details` **zaten en ilk şema migration'ında (Faz 0) tanımlanmıştı** ama hiç kullanılmamıştı (boş tablolar, view yok). Gerçek API response'uyla karşılaştırıldığında **3 gerçek attribute eksikti**:

- `sales_offers.net_total_in_trl` — yoktu
- `sales_offers.vat_withholding_rate` — yoktu
- `sales_offer_details.invoice_discount` — yoktu

Yeni migration `20260827010000_parasut_sales_offers_demo.sql` (eski migration'lar değiştirilmedi) bu 3 kolonu ekledi ve iki demo view'ı oluşturdu: `public.parasut_sales_offers_demo`, `public.parasut_sales_offer_details_demo`.

- Upsert anahtarı: her iki tabloda da `parasut_id` (mevcut `constraint ..._parasut_id_key unique`).
- `sales_offer_details.sales_offer_parasut_id` gerçek parent ID ile dolduruluyor (kod: `mapSalesOfferDetail(detail, offerParasutId)`).
- `product_parasut_id`, detail'in kendi gerçek `relationships.product.data.id`'sinden geliyor; product adı tahmin edilmiyor, `parasut.products` tablosuna ID üzerinden join ile çözülüyor (view'da `left join parasut.products p on p.parasut_id = d.product_parasut_id`).
- `contact_parasut_id`, offer'ın kendi gerçek `relationships.contact.data.id`'sinden geliyor; view'da `parasut.contacts`'a ID üzerinden join.
- `sales_invoice_parasut_id`, offer'ın kendi gerçek `relationships.sales_invoice.data`'sından (şu an null); view'da `parasut.sales_invoices`'a ID üzerinden join, mevcut kayıtta doğal olarak null.
- API'de artık bulunmayan kayıt tespiti: tek kayıt zaten mevcut ve API'de var; stale kayıt yok (kontrol edildi: DB'de yalnızca bu 1 satır var, API'de de tam olarak bu 1 kayıt).
- İki ardışık sync duplicate oluşturmadı (bkz. bölüm 5).
- Null alanlar eski dolu değerle korunmuyor: `upsertBatched` mapper'ın döndürdüğü **tam satırı** yazıyor (kısmi patch değil) — kaynaktaki null her zaman null olarak yansır.
- Public view yalnızca frontend'in ihtiyacı olan güvenli alanları sunuyor ama base tablo + `raw jsonb` kolonunda API resource'un tamamı saklanıyor.

## 5. Sync

`supabase/functions/parasut-sync/resources/sales_offers.ts` (yeni dosya, `sales_invoices.ts` ile birebir aynı desen) ve `index.ts`'e eklenen `syncSalesOffers`:

- `fetchActiveAndArchived(accessToken, "sales_offers", { include: "details,details.product,contact,sales_invoice" })` — tüm pagination.
- `included` haritası offer/detail/contact/product tiplerini çözüyor; eksik bir detay referansı olursa `errorCount` artırılıp sync **başarısız** işaretleniyor (sales_invoices ile aynı zorunlu-tutarlılık deseni) — bu fazda hiç eksik referans olmadı.
- Batch upsert: önce `sales_offers`, sonra `sales_offer_details`.
- `unresolved_count`: contact ilişkisi çözülemeyen offer sayısı (bu fazda 0).
- Eşzamanlı sync kilidi: mevcut `parasut.sync_runs` partial unique index mekanizması (`resource='sales_offers', status='running'`) hiçbir değişiklik yapılmadan aynen kullanıldı.
- `dry_run`: doğrulandı, DB'ye yazmadan doğru sayaçları döndürdü (`offer_fetched_count:1, detail_fetched_count:1, offer_upserted_count:0`).
- **`sync_runs`'da var olmayan bir kolona yazılmadı** — Faz 6.2'de bulunan bug'dan ders alınarak, `dbFields`'a eklenen her alan (`fetched_count, active_fetched_count, archived_fetched_count, total_count_reported, upserted_count, detail_fetched_count, detail_upserted_count, unresolved_count, error_count`) önce `information_schema.columns`'tan gerçek `sync_runs` şemasıyla karşılaştırıldı — hepsi zaten mevcuttu (sales_invoices/checks fazlarından), yeni kolon eklemeye gerek kalmadı. `finishRun()` hiçbir şekilde değiştirilmedi; hâlâ finalize hatasını sessizce yutmuyor.

**İki ardışık gerçek sync sonucu (birebir aynı):**

```json
{ "offer_fetched_count": 1, "offer_active_fetched_count": 1, "offer_archived_fetched_count": 0,
  "offer_upserted_count": 1, "detail_fetched_count": 1, "detail_upserted_count": 1,
  "unresolved_count": 0, "total_count_reported": 1, "error_count": 0 }
```

DB'de doğrulandı: `parasut.sales_offers` 1 satır/1 benzersiz `parasut_id`; `parasut.sales_offer_details` 1 satır/1 benzersiz `parasut_id` — duplicate yok.

## 6. Frontend

- `/satislar/teklifler` (`src/pages/Teklifler.tsx`): aktif/arşivli/tümü filtreleri (gerçek sayaçlarla), tarih aralığı filtresi, tablo: teklif no/açıklama, müşteri (gerçek contact linki), düzenleme tarihi, geçerlilik tarihi (`due_date`), net/brüt/KDV (API'nin kendi ayrı alanları, hesaplanmadı), durum (`status`), arşiv durumu.
- `/satislar/teklifler/:parasutId` (`src/pages/TeklifDetay.tsx`): tüm iş açısından anlamlı gerçek alanlar (durum, tarihler, net/brüt/KDV/indirim/stopaj ayrı ayrı API alanlarından, vergi dairesi/no, şehir/ilçe, sipariş no/tarihi, paylaşım sayısı), gerçek contact ilişkisi (link), bağlı satış faturası ilişkisi (varsa link, yoksa "—" — uydurulmadı), tüm gerçek teklif kalemleri (ürün linki, açıklama, miktar, birim fiyat, KDV%, net — API'den, toplanıp yeniden üretilmedi), `parasut_created_at`/`parasut_updated_at` (UTC, biçim değişikliği dışında değiştirilmedi), null alanlarda "—". PDF/onay geçmişi/fatura bağlantısı (API'de sales_invoice hariç) veya kullanıcı bilgisi gibi API'de bulunmayan hiçbir şey üretilmedi.
- `DemoHome.tsx`'e "Teklifler →" linki eklendi; `App.tsx`'e iki route eklendi (lazy-loaded, mevcut desenle birebir).

## 7. Tam veri kontrolü

| API alanı | Base tablo | View | Frontend type | UI | Null korunuyor |
|---|---|---|---|---|---|
| description, content, status, issue_date, due_date, currency, exchange_rate | ✅ | ✅ | ✅ | ✅ | ✅ |
| net_total, gross_total, total_vat, total_discount, total_invoice_discount | ✅ | ✅ | ✅ | ✅ | ✅ |
| net_total_in_trl | ✅ **(bu fazda eklendi)** | ✅ | ✅ | ✅ | ✅ |
| withholding, withholding_rate, vat_withholding, total_vat_withholding | ✅ | ✅ | ✅ | ✅ (withholding gösteriliyor; diğerleri base+view+type'ta mevcut) | ✅ |
| vat_withholding_rate | ✅ **(bu fazda eklendi)** | ✅ | ✅ | — (teknik alan, listede zorunlu değil) | ✅ |
| total_excise_duty, total_communications_tax, total_accommodation_tax | ✅ | ✅ | ✅ | — (teknik alan) | ✅ |
| billing_address, billing_phone, billing_fax, tax_office, tax_number, city, district, is_abroad | ✅ | ✅ | ✅ | ✅ (vergi dairesi/no, şehir/ilçe gösteriliyor; billing_address/phone/fax base+view+type'ta mevcut, kart alanı olarak listelenmedi) | ✅ |
| order_no, order_date, sharings_count | ✅ | ✅ | ✅ | ✅ | ✅ |
| invoice_discount_type, invoice_discount | ✅ | ✅ | ✅ | ✅ (fatura indirimi gösteriliyor) | ✅ |
| display_exchange_rate_in_pdf, contact_type | ✅ | ✅ | ✅ | — (teknik alan) | ✅ |
| archived | ✅ | ✅ | ✅ | ✅ | ✅ |
| contact (relationship) | ✅ (contact_parasut_id) | ✅ (+contact_name) | ✅ | ✅ (gerçek link) | ✅ |
| sales_invoice (relationship) | ✅ (sales_invoice_parasut_id) | ✅ (+sales_invoice_no) | ✅ | ✅ (varsa link, yoksa "—") | ✅ |
| details (relationship → sales_offer_details) | ✅ (ayrı tablo) | ✅ (ayrı view) | ✅ | ✅ | ✅ |
| created_at/updated_at | ✅ (parasut_created_at/updated_at) | ✅ | ✅ | ✅ | ✅ |

**Kalem (sales_offer_details) ve ilişkiler:**

| API alanı | Base tablo | View | Frontend type | UI | Null korunuyor |
|---|---|---|---|---|---|
| description, quantity, unit_price, vat_rate, detail_no | ✅ | ✅ | ✅ | ✅ | ✅ |
| discount_type, discount_value, discount | ✅ | ✅ | ✅ | ✅ (discount_type gösteriliyor) | ✅ |
| invoice_discount | ✅ **(bu fazda eklendi)** | ✅ | ✅ | — (teknik alan) | ✅ |
| excise_duty_type, excise_duty, excise_duty_rate, excise_duty_value | ✅ | ✅ | ✅ | — (teknik alan) | ✅ |
| communications_tax_rate, communications_tax | ✅ | ✅ | ✅ | — (teknik alan) | ✅ |
| accommodation_tax_rate, accommodation_tax, accommodation_tax_exempt | ✅ | ✅ | ✅ | — (teknik alan) | ✅ |
| vat_withholding, vat_withholding_rate | ✅ | ✅ | ✅ | — (teknik alan) | ✅ |
| net_total, net_total_without_invoice_discount | ✅ | ✅ | ✅ | ✅ (net_total) | ✅ |
| product (relationship) | ✅ (product_parasut_id) | ✅ (+product_name) | ✅ | ✅ (gerçek link) | ✅ |

Teknik olarak işaretlenen alanlar görevin kendi kuralına göre ("teknik alanların her biri liste ekranında gösterilmek zorunda değildir; fakat base tablo ve erişilebilir view'da eksiksiz korunmalıdır") base+view+type katmanlarında tam olarak mevcut; yalnızca UI kartlarına eklenmedi.

**Uçtan uca örnekler (mevcut gerçek veriyle sınırlı, bkz. bölüm 8/BLOCKED):**

- `parasut_id 1001300304`: API `net_total="1480.8"` → base `1480.8` → view `1480.8` → UI "1.480,80 TRL" — değişmedi.
- Null koruma: `billing_phone`, `billing_fax`, `city`, `district`, `order_no`, `order_date` API'de null → view'da null → UI'da "—" (6 gerçek null alan, tek kayıtta).
- `sales_invoice_parasut_id` null → UI "—" (uydurulmadı).
- Kalem: `parasut_id 1007359467`, `description` null → UI "—"; `product_parasut_id 1055806717` → gerçek ürün linki, `product_name="sdfsdfsdf"` (gerçek ürün adı, DB'de zaten senkronize).

## 8. Regresyon

| Metrik | Beklenen | Gerçek (bu faz) |
|---|---|---|
| Contacts | 448 | **448** ✅ |
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| Products | 2597 | **2597** ✅ |
| Checks | 40 | **40** ✅ |
| Check payments | 35 | **35** ✅ |
| Tüm payments | 1651 | **1651** ✅ |
| Transactions | 1498 | **1498** ✅ |
| Accounts | 3 | **3** ✅ |

Hiçbir regresyon yok, hiçbir sayı zorlanmadı — gerçek sorgudan birebir geldi.

## 9. Deploy ve test

- Migration: `supabase/migrations/20260827010000_parasut_sales_offers_demo.sql`, `supabase db push` ile hosted DB'ye uygulandı.
- Edge Function: `supabase functions deploy parasut-sync` ile deploy edildi (`index.ts`, `resources/sales_offers.ts` eklendi).
- Dry run: doğrulandı (bölüm 5).
- İki ardışık gerçek sync: doğrulandı, birebir aynı sonuç, duplicate yok (bölüm 5).
- `npm test`: 1 test, geçti.
- `npm run lint`: 0 hata, 10 önceden var olan uyarı.
- `npm run build:demo`: başarılı, yeni `TeklifDetay-DNJjN21i.js`/`Teklifler-*.js` chunk'ları üretildi.
- `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan, bu faza ait olmayan `Login.tsx:55` hatası.
- FTP deploy: 38 dosya, `/public_html/demo`.
- Canlı doğrulama: `/` → 200 (`index-D11SWgvm.js`, yeni build ile eşleşiyor), `/satislar/teklifler` → 200, `/satislar/teklifler/1001300304` → 200, yeni JS chunk → 200.
- 390×844 ve 768×1024 (gerçek headless Chrome CDP, hem liste hem detay sayfası): `scrollWidth === clientWidth` her ikisinde — yatay taşma yok.
- Console/network kontrolü: sayfa yüklemeleri sırasında `Runtime.consoleAPICalled` üzerinden console hatası dinlendi — hiçbir console hatası yakalanmadı.

## PASS / FAIL / BLOCKED

**PASS:**
- Gerçek endpoint (`sales_offers`) tahmin edilmeden, gerçek isteklerle bulundu
- `filter[archived]` gerçek davranışı doğrulandı (API'nin kendi hata mesajı yanıltıcı olsa da)
- Geçerli include'lar (`contact, details, details.product, sales_invoice`) doğrulandı; reddedilenler (`activities, sharings, details.warehouse, details.category`) kanıtla belgelendi
- Ham API envanteri tam çıkarıldı (root/attributes/relationships/meta, tek gerçek kayıt + tek gerçek detay)
- 3 eksik gerçek attribute (`net_total_in_trl`, `vat_withholding_rate`, `sales_offer_details.invoice_discount`) yeni migration ile eklendi
- Supabase modeli (mevcut boş tablolar + yeni view'lar) gerçek API'ye birebir uyduruldu
- Edge Function `sales_offers` kaynağı eklendi, mevcut modüler desene tam uyumlu, `sync_runs` şema uyumsuzluğu riski önceden kontrol edilerek önlendi
- İki ardışık gerçek sync birebir aynı sonuç verdi, duplicate/unresolved/error yok
- Frontend (`/satislar/teklifler`, `/satislar/teklifler/:id`) gerçek verilerle çalışıyor, null'lar "—" gösteriyor, hiçbir alan uydurulmadı/hesaplanmadı
- Regresyon: 9 modülün sayıları birebir korundu
- Build/lint/test/tsc/deploy/route/overflow/console doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:**
- Görevin "en az 3 aktif teklif, arşivli varsa 1 arşivli teklif, null alan içeren 3 gerçek kayıt, çok kalemli 1 gerçek teklif, product ilişkili ve ilişkisiz kalem örnekleri" doğrulama isteği, **gerçek hesapta yalnızca 1 aktif teklif ve 1 kalem bulunduğu için** tam kapsamıyla karşılanamıyor. Bu bir kod eksikliği değil, hesabın gerçek veri hacminin sınırıdır — sayı zorlanmadı, ek/sahte teklif üretilmedi. Mevcut tek kayıt üzerinden mümkün olan tüm doğrulamalar (null alan koruması × 6 gerçek null, product ilişkili kalem, contact ilişkisi, sales_invoice null ilişkisi) yapıldı ve raporlandı (bölüm 7). Hesapta gelecekte yeni teklif/arşivli teklif/çok kalemli teklif oluşursa, mevcut sync pipeline bunları otomatik olarak doğru şekilde işleyecektir (kod, tek kayıtla sınırlı değil — genel JSON:API desenini uyguluyor).

## Kök nedenler

- `sales_offers`/`sales_offer_details` tabloları en ilk şema migration'ında (Faz 0, proje başlangıcı) önceden tanımlanmış ama hiçbir fazda sync edilmemişti — bu fazın kapsamı, o boşluğu (Edge Function kaynağı, eksik 3 kolon, view, frontend) kapatmaktı.
- Gerçek hesapta tek bir teklif var; bu, kapsamlı çoklu-kayıt doğrulamasını mümkün kılmıyor ama pipeline'ın kendisi (aktif/arşivli ayrımı, include zinciri, detay/relationship çözümü, null koruma) sales_invoices ile aynı, kanıtlanmış desende inşa edildi.

## Claude Browser için gerçek teklif ID'leri

- **1001300304** — tek gerçek teklif (aktif, `status=rejected`, 1 kalem, contact bağlı, sales_invoice bağlantısı null, 6 gerçek null alan içeriyor: billing_phone, billing_fax, city, district, order_no, order_date).

## Genel Karar

**PASS** (BLOCKED notuyla). Gerçek `/sales_offers` API'sinin döndürdüğü her attribute, her gerçek relationship (contact, details, sales_invoice) ve her teklif kalemi artık Paraşüt API → Supabase → public view → frontend zincirinin tamamında, null'lar korunarak, hiçbir hesaplama/tahmin/uydurma olmadan mevcut. Mevcut boş tablolardaki 3 eksik gerçek attribute giderildi. Regresyon yok. Tek blokaj, hesabın gerçek veri hacminin (1 teklif) görevin istediği çoklu-örnek doğrulama kapsamını sınırlaması — kod tarafında bir eksiklik değil, dürüstçe raporlanan bir veri kısıtı.
