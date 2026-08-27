# Phase 08.0 — Paraşüt API Kapsam Envanteri ve Sonraki Modül Seçimi

**Tarih:** 2026-08-27
**Rapor commit SHA:** (push sonrası doldurulacak)
**Not:** Bu fazda kod/migration/deploy değişikliği yapılmadı. Yalnızca kanıt toplama (salt okunur SQL sorguları + güvenli GET istekleri) ve bu rapor.

## 1. Tamamlanan modüller matrisi

| Kaynak | API | Base | Raw | View | Sync | Liste UI | Detay UI | Son karar |
|---|---|---|---|---|---|---|---|---|
| Contacts | ✅ | ✅ | ✅ | ✅ `parasut_contacts_demo` | ✅ `contacts.ts` | ✅ `Musteriler.tsx` | ✅ `MusteriDetay.tsx` | **Tamamlandı** |
| Products (+inventory_levels, warehouses, stock_movements, item_categories) | ✅ | ✅ | ✅ | ✅ (4 view) | ✅ `products.ts`/`warehouses.ts`/`stock_movements.ts`/`item_categories.ts` | ✅ `Urunler.tsx`/`Depolar.tsx`/`StokSeviyeleri.tsx`/`StokHareketleri.tsx` | ✅ `UrunDetay.tsx` | **Tamamlandı** (`item_categories` gerçek hesapta 0 kayıt — boru hattı tam ama veri yok) |
| Sales invoices | ✅ | ✅ | ✅ | ✅ | ✅ `sales_invoices.ts` | ✅ `Faturalar.tsx` | ✅ `FaturaDetay.tsx` | **Kısmen** — `active_e_document` ilişkisi mapper'da alan olarak var (`active_e_document_type/parasut_id`) ama sync'in kendi `include` parametresi (`"details,details.product,contact"`) bu ilişkiyi hiç istemiyor; DB'de 451/451 satırda bu alan **null** (bkz. bölüm 2/5) |
| Purchase bills / Expenses | ✅ | ✅ | ✅ | ✅ | ✅ `purchase_bills.ts` | ✅ `Giderler.tsx`/`Tedarikciler.tsx` | ✅ `GiderDetay.tsx` | **Kısmen** — aynı `active_e_document` boşluğu (811/811 satırda null) |
| Accounts | ✅ | ✅ | ✅ | ✅ | ✅ `accounts.ts` | ✅ `Hesaplar.tsx` | — (ayrı detay route yok) | **Tamamlandı** (hesaplar tek listede yeterince detaylı; ayrı detay ekranı gerekmiyor) |
| Transactions | ✅ | ✅ | ✅ | ✅ | ✅ (accounts sync içinde `syncTransactions`) | ✅ `HesapHareketleri.tsx` | — (defter kaydı, ayrı detay gerekmiyor) | **Tamamlandı** |
| Checks | ✅ | ✅ | ✅ | ✅ | ✅ `checks.ts` | ✅ `Cekler.tsx` | ✅ `CekDetay.tsx` | **Tamamlandı** (Faz 6–6.2) |
| Payments | ✅ (nested only) | ✅ | ✅ | ✅ | ✅ `payments.ts` (sales_invoices/purchase_bills/checks üzerinden) | ✅ (Tahsilatlar.tsx/GiderOdemeleri.tsx içinde) | ✅ (TahsilatDetay.tsx içinde) | **Tamamlandı** |
| Sales offers | ✅ | ✅ | ✅ | ✅ | ✅ `sales_offers.ts` | ✅ `Teklifler.tsx` | ✅ `TeklifDetay.tsx` | **Tamamlandı** (Faz 7) |
| Sales offer details | ✅ | ✅ | ✅ | ✅ | ✅ (aynı sync) | ✅ (detay sayfasında) | ✅ | **Tamamlandı** (Faz 7) |
| Sales offer activities | ✅ (yalnızca tekil endpoint) | ✅ | ✅ | ✅ | ✅ (aynı sync, `fetchResource` ile) | — | ✅ (detay sayfasında "Durum geçmişi") | **Tamamlandı** (Faz 7.1–7.2) |

## 2. Mevcut ama UI'a bağlanmamış kaynaklar

Hosted DB'deki her `parasut.*` tablosunun gerçek satır sayısı (salt okunur `select count(*)`, bu fazda çalıştırıldı):

| Tablo | Satır | Base | View | Edge Function sync | Frontend | Durum |
|---|---:|---|---|---|---|---|
| `addresses` | **1** | ✅ | ❌ | ❌ | ❌ | Yalnızca `scripts/sync_parasut.py` (ayrı, tek seferlik script) ile dolduruldu; gerçek API'de `contacts?include=addresses` **400** veriyor (bkz. bölüm 4) — erişim yolu belirsiz, düşük öncelik |
| `companies` | **1** | ✅ | ❌ | ❌ | ❌ | `GET /v4/me` üzerinden (hesabın kendi şirket profili) — tek satır, "liste" değil, düşük iş değeri |
| `contact_people` | **2** | ✅ | ❌ | ❌ | ❌ | Gerçek, `contact_parasut_id` ile **tam bağlı** (2/2), `contacts?include=contact_people` çalışıyor (200) |
| `e_invoices` | **1236** | ✅ | ❌ | ❌ | ❌ | Gerçek, ama `invoice_parasut_id` **tüm satırlarda null** — üst kayda geri bağlantı kayıp (bkz. bölüm 5) |
| `e_archives` | **23** | ✅ | ❌ | ❌ | ❌ | Gerçek, `sales_invoice_parasut_id` **tüm satırlarda null** — aynı bağlantı kaybı |
| `e_smms` | 0 | ✅ | ❌ | ❌ | ❌ | Bu hesapta gerçek kayıt yok |
| `e_invoice_inboxes` | 0 | ✅ | ❌ | ❌ | ❌ | Gerçek API'de de `total_count:0` (doğrulandı) |
| `employees` | **6** | ✅ | ❌ | ❌ | ❌ | Gerçek, `GET /employees` çalışıyor (`total_count:6`, doğrulandı) |
| `shipment_documents` | **15** | ✅ | ❌ | ❌ | ❌ | Gerçek, `contact_parasut_id` **tam bağlı** (14/15 — 1 kaydın contact'ı gerçekten yok), `stock_movements` ilişkisi dolu |
| `bank_fees` | 0 | ✅ | ❌ | ❌ | ❌ | Bağımsız liste endpoint'i **yok** (script'in kendi notu: yalnızca POST/{id}) |
| `salaries` | 0 | ✅ | ❌ | ❌ | ❌ | Gerçek API'de `total_count:0` (doğrulandı) |
| `taxes` | 0 | ✅ | ❌ | ❌ | ❌ | Gerçek API'de boş `data:[]` (doğrulandı) |
| `tags` | 0 | ✅ | ❌ | ❌ | ❌ | Gerçek API'de `total_count:0` (doğrulandı) |
| `stock_updates` / `stock_update_details` | 0 | ✅ | ❌ | ❌ | ❌ | `GET /stock_updates` **404** — bu hesap/versiyon için bağımsız liste endpoint'i yok |
| `trackable_jobs` | 0 | ✅ | ❌ | ❌ | ❌ | Bu hesapta gerçek kayıt yok |
| `item_categories` | 0 | ✅ | ✅ `parasut_item_categories_demo` | ✅ `item_categories.ts` | ✅ (Edge Function'da `SUPPORTED_RESOURCES` içinde) | Boru hattı **tam**, gerçek hesapta 0 kayıt — "eksik" değil, veri yok |

**Junction/relationship tablosu:** yok (checks-payments ve sales_offers-payments zaten mevcut `payable_type`/`payable_parasut_id` desenini yeniden kullanıyor, ayrı junction tablo hiç gerekmedi — Faz 6.2/7 kararı).

**Raw JSON'da görülen ama normalize edilmemiş ayrı resource type'lar:** `e_invoices`/`e_archives`/`e_smms` (sales_invoices/purchase_bills'in `active_e_document` ilişkisi üzerinden, polimorfik) — base tabloları var ama Edge Function pipeline'ı hiç dokunmuyor, yalnızca ad-hoc script'in tek seferlik taramasıyla dolu. `users` (sales_offer_activities'in `done_by` ilişkisi, Faz 7.2'de `done_by_name`/`done_by_user_email` olarak zaten denormalize edildi, ayrı tablo yok — kapsam dışı, mevcut faz bunu çözdü).

## 3. Resmi API kaynak envanteri (bu fazda doğrudan test edilenler)

| Resource | Gerçek liste endpoint'i | Tekil endpoint | Include'lar (gerçek, 400 kanıtıyla) | Pagination | Erişim sonucu |
|---|---|---|---|---|---|
| `employees` | `GET /employees` | doğrulanmadı (kapsam dışı, güvenli GET yeterliydi) | `category` (200) | `total_pages:3, total_count:6, per_page:2` | ✅ 200, gerçek veri |
| `shipment_documents` | `GET /shipment_documents` | doğrulanmadı | `contact,tags,stock_movements` (200) | `archived=false→14, archived=true→1, toplam 15` | ✅ 200, gerçek veri |
| `item_categories` | `GET /item_categories` | — | `parent_category` | `total_count:0` | ✅ 200, gerçek ama boş |
| `tags` | `GET /tags` | — | — | `total_count:0` | ✅ 200, gerçek ama boş |
| `taxes` | `GET /taxes` | — | `category,tags,payments` | `data:[]` | ✅ 200, gerçek ama boş |
| `salaries` | `GET /salaries` | — | `employee,category,tags,payments` | `data:[]` | ✅ 200, gerçek ama boş |
| `e_invoice_inboxes` | `GET /e_invoice_inboxes` | — | — | `total_count:0` | ✅ 200, gerçek ama boş |
| `stock_updates` | yok | — | — | — | **BLOCKED — 404** `"No route matches."` |
| `e_invoices` | yok (yalnızca nested) | — | — | — | **BLOCKED — 500** `{"status":500,"error":"Internal Server Error"}` (gerçek sunucu hatası, doğrudan liste yok) |
| `e_archives` | yok | — | — | — | **BLOCKED — 404** `"No route matches."` |
| `e_smms` | yok | — | — | — | **BLOCKED — 404** `"No route matches."` |
| `addresses` | yok (bağımsız) | — | `contacts?include=addresses` | — | **BLOCKED — 400** `"addresses is not a valid relation. Acceptable: category, contact_portal, contact_people, company, tags, price_list"` |
| `companies` | yok | — | `GET /v4/me` (200, gerçek: kullanıcı 800086 + ilişkili şirket) | — | ✅ dolaylı erişim var, doğrudan `/companies` **404** |
| `contacts?include=contact_people` | (mevcut contacts modülünün parçası) | — | `contact_people` (200), `category` (200), `addresses` (400) | — | ✅ 200 |

`active_e_document` (sales_invoices üzerinden, bu fazda tekrar doğrulandı): `GET /sales_invoices?include=active_e_document` → **200**, `relationships.active_e_document.data: {id:"1009286918", type:"e_invoices"}`, `included` içinde tam e_invoice nesnesi (bkz. bölüm 5).

## 4. Güvenli gerçek API keşfi — özet kanıtlar

Tüm istekler yalnızca `GET`, `page[size]≤3`, gerçek hesaba karşı, yazma/action isteği yok. Ham örnekler:

- `GET /employees?page[size]=2` → `200`, `meta.total_count:6`.
- `GET /shipment_documents?filter[archived]=false&page[size]=1` → `200`, `total_pages:14`; `archived=true` → `total_pages:1`. Toplam 15, DB'deki 15 ile birebir örtüşüyor.
- Örnek `shipment_documents` kaydı (`1000391168`): gerçek adres/tarih/taşıyıcı bilgileri, `contact` ilişkisi dolu (`1010814464`), `stock_movements` ilişkisi dolu (`1035920006`), `tags` gerçek boş dizi, `warehouse_transfer`/`activities`/`sharings`/`invoices` yalnızca boş `{"meta":{}}`.
- Örnek `employees` kaydı (`1000110946`): "mahmut dayan", `category` ilişkisi gerçek `null` (Parasut'un kendi verdiği null, tahmin değil).
- `GET /sales_invoices?include=active_e_document&page[size]=1` → `200`, gerçek `included[0]` bir `e_invoices` nesnesi: `external_id:"HD02023000000001"`, `status:"successful"`, `net_total:"8400.0"`, `pdf_url`, `signed_ubl_url` — tamamen gerçek, üretilmiş değil.

## 5. İlişkilerden gelen eksik resource tipleri

- **`e_invoices`/`e_archives`/`e_smms`** (sales_invoices/purchase_bills'in `active_e_document` polimorfik ilişkisi): gerçek, dolu, ama **liste endpoint'inde reddediliyor, yalnızca nested include ile erişilebiliyor** (aynı `payments` deseni — Faz 1.2/4'te zaten çözülmüş bir örüntü). **Kritik bulgu:** mevcut Edge Function sync'i (`syncSalesInvoices`/`syncPurchaseBills`) bu include'u hiç istemiyor — DB'de 451/451 ve 811/811 satırda `active_e_document_type` **null**. Ayrıca ad-hoc script'in doldurduğu 1236 `e_invoices` + 23 `e_archives` satırının **hiçbiri** üst faturaya geri bağlı değil (`invoice_parasut_id`/`sales_invoice_parasut_id` tüm satırlarda null) — gerçek bir veri bağlantısı kaybı, Faz 8 adayı olarak önem taşıyor.
- **`users`** (sales_offer_activities'in `done_by` ilişkisi): Faz 7.2'de zaten çözüldü (`done_by_name`/`done_by_user_email`), ayrı bir `parasut.users` tablosu kurulmadı — kapsam dışı, tekrar ele alınmasına gerek yok.
- **Liste↔tekil endpoint farkı (Faz 7.1'de keşfedilen desen) başka yerde tekrar arandı:** bu fazda ek bir liste/tekil endpoint tutarsızlığı bulunmadı (yalnızca zaten bilinen `sales_offers.activities` örneği var).
- **Boş `{"meta":{}}` ilişkiler (resource varmış gibi sayılmadı):** `shipment_documents.warehouse_transfer/inbound_e_despatch/e_despatch_response/activities/sharings/invoices/custom_requirement_infos`, `employees.managed_by_user/managed_by_user_role/activities/comments/tags`, `contacts.contact_portal/last_sales_invoice/e_invoice_inboxes/sharings/tags/comments/operated_by` (Faz 7 raporundan hatırlanan) — hiçbiri için tablo/UI üretilmedi.

## 6. Aday modülleri önceliklendirme

| Sıra | Aday | Gerçek kayıt | İş değeri | Bağımlılık | API riski | Öneri |
|---:|---|---:|---|---|---|---|
| 1 | **E-Belgeler (e_invoices + e_archives, `active_e_document` üzerinden)** | 1236 + 23 = **1259** (gerçek, ama bağlantısız) | **Çok yüksek** — her faturanın/gider belgesinin resmi e-fatura/e-arşiv durumu, PDF/UBL linki | **Çok yüksek** — sales_invoices (451) ve purchase_bills (811) ile doğrudan 1:1 | Düşük-orta — desen zaten kanıtlı (payments/checks-payments), ama sync'in `include` listesini genişletmek + gerçek geri-bağlantıyı (backfill) kurmak gerekiyor | **Faz 8 için seçildi** |
| 2 | Sevkiyat İrsaliyeleri (`shipment_documents`) | 15 (temiz, tam bağlı) | Orta-yüksek — fiziksel sevkiyat kayıtları, contacts+stock_movements ile bağlantılı | Orta — contacts ve stock_movements'a bağlı ama onları değiştirmiyor | Çok düşük — endpoint/include'lar net, veri zaten temiz | Güçlü yedek aday, sonraki faz |
| 3 | Çalışanlar (`employees`) | 6 | Düşük-orta — `salaries` (0 kayıt) olmadan izole, tek başına sınırlı değer | Düşük | Çok düşük | Düşük öncelik |
| 4 | Yetkili kişiler (`contact_people`) | 2 | Düşük — contacts'ın bir alt-alanı, muhtemelen MusteriDetay'a küçük bir ek olarak yeterli, ayrı modül gerektirmiyor | Yüksek (contacts'a bağlı) ama veri hacmi çok küçük | Çok düşük | Ayrı faz yerine ileride küçük bir ek olarak değerlendirilebilir |
| 5 | Şirket profili (`companies`) | 1 | Çok düşük — tek satır, "modül" değil | — | Düşük | Öncelik dışı |
| — | Adresler (`addresses`) | 1 | Çok düşük + erişim yolu belirsiz (`contacts?include=addresses` 400) | — | Belirsiz | Seçilmedi — gerçek erişim kanıtlanamadı |
| — | `bank_fees`/`salaries`/`taxes`/`tags`/`e_invoice_inboxes`/`stock_updates`/`trackable_jobs` | 0 | — | — | — | Seçilmedi — bu hesapta gerçek kayıt yok |

## 7. Faz 8 için seçilen modül

**E-Belgeler (e-Fatura / e-Arşiv) — `sales_invoices.active_e_document` ve `purchase_bills.active_e_document` üzerinden `e_invoices`/`e_archives`.**

### Seçim gerekçesi

- Gerçek, çalışan bir erişim yolu var (`include=active_e_document` — bu fazda `200` ile yeniden doğrulandı, taklit/tahmin değil).
- Hesapta **1259 gerçek kayıt** var (`e_invoices` 1236 + `e_archives` 23) — bu projedeki tek bir modülün sahip olduğu en büyük gerçek veri kümelerinden biri.
- Henüz uçtan uca tamamlanmamış: base tablo var ama view/sync/UI yok, üstelik mevcut geri-bağlantı (`invoice_parasut_id`/`sales_invoice_parasut_id`) **tamamen kayıp** — bu, "kapsam dışı" denilerek bırakılmış gerçek bir veri kaybı, tam olarak projenin daha önceki fazlarda (6.1, 6.2, 7.1, 7.2) defalarca düzelttiği türden bir defect.
- **Mevcut iki tamamlanmış modülle (sales_invoices, purchase_bills) en yüksek ilişki yoğunluğu** — bu, görevin "ayrılmaz parçası" kuralına uyuyor: e-belge, faturanın kendisinden ayrı bir iş akışı değil, faturanın resmi durumunun bir uzantısı.
- Mock/tahmin gerekmiyor: tüm alanlar gerçek API'den (`external_id, uuid, status, net_total, pdf_url, signed_ubl_url` vb.) geliyor.
- Teknik desen zaten kanıtlanmış: Faz 6.2'nin checks→payments ve Faz 4'ün purchase_bills payments'ı, polimorfik `payable_type/payable_parasut_id` ve nested-include-only kaynaklarla nasıl başa çıkılacağını zaten gösterdi; bu fazda aynı desen `active_e_document_type/active_e_document_parasut_id` için tekrarlanacak.

`e_smms` bu hesapta gerçek kayıt içermediği için (0 satır) aynı fazda **eklenmeyecek** — yalnızca gerçek veri bulunursa (şema zaten hazır) ileride otomatik kapsanır; zorla üretilmeyecek.

### Uygulama için gerçek endpoint/include bilgileri

- Ek include: `syncSalesInvoices` → `include: "details,details.product,contact,active_e_document"`; `syncPurchaseBills` → mevcut include listesine `active_e_document` eklenmeli (zaten `pay_to` gibi diğerlerini içeriyor).
- `active_e_document` polimorfik: `type` gerçekte `"e_invoices"` veya `"e_archives"` (bu hesapta gözlenen) olabilir; `included` içindeki nesne `mapEInvoice`/`mapEArchive` gibi tip-özel mapper'larla işlenmeli (attribute setleri farklı — bkz. `scripts/sync_parasut.py`'deki `RESOURCES["e_invoices"]`/`RESOURCES["e_archives"]` attr listeleri, gerçek API ile zaten doğrulanmış).
- Geri-bağlantı (`invoice_parasut_id`/`sales_invoice_parasut_id`) **parent'ın kendi `active_e_document` ilişkisinden** backfill edilmeli (child kendi relationships'inde bu bilgiyi vermiyor — `payments`/`sales_invoice_details` ile aynı, projede zaten kurulu desen).
- Yeni migration(lar) gerekli: `e_invoices`/`e_archives` tabloları zaten var (Faz 0 şemasından) ama `invoice_parasut_id`/`sales_invoice_parasut_id` dışında eksik gerçek alan olup olmadığı Faz 8'in kendi "ham API envanteri" adımında doğrulanmalı (bu faz onu yapmadı — yalnızca varlık/erişim/bağlantı durumunu tespit etti). Yeni public view'lar (`parasut_sales_invoice_e_document_demo` benzeri) gerekecek.
- Regresyon: sales_invoices (451) ve purchase_bills (811) sync'i değişeceği için **iki ardışık gerçek sync zorunlu**, ve bu iki modülün var olan tüm alanlarının bozulmadığı ayrıca doğrulanmalı (Faz 6.2/7.2'de kurulan disiplin).

### Claude Code'a verilecek Faz 8 uygulama promptunda bulunması gereken kapsam

1. `sales_invoices`/`purchase_bills` sync'lerine `active_e_document` include'unu ekle; gerçek `e_invoices`/`e_archives` attribute/relationship envanterini (bu fazdaki gibi) tam çıkar.
2. `e_invoices`/`e_archives` için mapper dosyaları (`resources/e_documents.ts` benzeri) yaz; polimorfik tipi ayırt et.
3. Geri-bağlantıyı (`invoice_parasut_id`/`sales_invoice_parasut_id`) parent'ın relationship verisinden backfill et — child'ın kendi verisine güvenme.
4. Yeni migration: eksik gerçek alan varsa ekle, `public.parasut_e_invoices_demo`/`parasut_e_archives_demo` (veya birleşik) view'ları oluştur.
5. `FaturaDetay.tsx`/`GiderDetay.tsx`'e gerçek e-belge durumu/linkleri ekle (uydurma PDF/onay akışı değil, yalnızca API'nin verdiği `status`/`pdf_url`/`signed_ubl_url` vb.).
6. Dry run + iki ardışık gerçek sync; sales_invoices/purchase_bills'in mevcut 451/811 satırının hiçbir alanının bozulmadığını doğrula.
7. Regresyon: bu raporun bölüm 8'indeki tüm sayıları yeniden doğrula.
8. Rapor: `reports/PHASE_08_E_DOCUMENTS_REPORT.md` (veya benzeri), commit/push.

## 8. Regresyon sayıları

Salt okunur sorgularla doğrulandı (bu fazda hiçbir yazma işlemi yapılmadı):

| Metrik | Beklenen | Gerçek (bu faz) |
|---|---:|---:|
| Contacts | 448 | **448** ✅ |
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| Products | 2597 | **2597** ✅ |
| Checks | 40 | **40** ✅ |
| Check payments | 35 | **35** ✅ |
| Payments | 1651 | **1651** ✅ |
| Transactions | 1498 | **1498** ✅ |
| Accounts | 3 | **3** ✅ |
| Sales offers | 1 | **1** ✅ |
| Sales offer details | 1 | **1** ✅ |
| Sales offer activities | 2 | **2** ✅ |

Hiçbir sapma yok, hiçbir sayı zorlanmadı.

## PASS / FAIL / BLOCKED

**PASS:**
- Tamamlanan 11 modülün gerçek durumu (base/raw/view/sync/UI) kanıtla çıkarıldı, kısmi olanlar (`active_e_document` boşluğu) açıkça işaretlendi
- Hosted DB'deki her `parasut.*` tablosunun gerçek satır sayısı verildi, boş tablo dolu gösterilmedi
- Aday kaynaklara güvenli GET istekleriyle gerçek erişim doğrulandı (employees, shipment_documents, item_categories, tags, taxes, salaries, e_invoice_inboxes)
- Erişilemeyen/reddedilen endpoint'ler gerçek HTTP durumu ve body'siyle BLOCKED olarak işaretlendi (e_invoices 500, e_archives/e_smms/stock_updates 404, addresses-via-contacts 400)
- İlişkilerden gelen eksik resource tipleri (`e_invoices`/`e_archives`/`e_smms`) ve bunların gerçek bağlantı kaybı (invoice_parasut_id null) kanıtla belgelendi
- Önceliklendirme tablosu yalnızca gerçek kaydı olan adaylara dayanıyor
- Faz 8 için tek, ayrılmaz bir modül grubu (e-Belgeler) gerekçesiyle seçildi
- Regresyon sayıları birebir doğrulandı
- Bu fazda hiçbir migration/Edge Function/frontend değişikliği veya deploy yapılmadı (yalnızca salt okunur SQL + güvenli GET)

**FAIL:** Yok.

**BLOCKED (API'nin kendisinden, kod eksikliği değil):**
- `GET /e_invoices` → 500 (gerçek sunucu hatası)
- `GET /e_archives`, `GET /e_smms`, `GET /stock_updates` → 404 (bağımsız liste endpoint'i yok)
- `GET /contacts?include=addresses` → 400 (gerçek kabul edilmeyen ilişki)
- `GET /v4/{company_id}` ve `GET /companies` → 404 (bağımsız companies endpoint'i yok, yalnızca `/v4/me` üzerinden dolaylı erişim var)

## Genel Karar

**PASS.** Tamamlanan modüllerin gerçek durumu, hosted şemadaki her tablonun gerçek satır sayısı, resmi API kaynaklarının erişim sonuçları ve ilişkilerden gelen eksik resource tipleri kanıta dayalı olarak çıkarıldı — hiçbir endpoint/resource adı tahmin edilmedi, hiçbir mock veri kullanılmadı. Faz 8 için **E-Belgeler (e_invoices/e_archives, `active_e_document` ilişkisi üzerinden)** seçildi: gerçek, dolu (1259 kayıt), erişilebilir, mevcut iki tamamlanmış modülle (sales_invoices, purchase_bills) en yüksek ilişkiye sahip, ve şu anda gerçek bir veri kaybı (kayıp geri-bağlantı) içeren tek aday. Bu fazda kod/migration/deploy değişikliği yapılmadı.
