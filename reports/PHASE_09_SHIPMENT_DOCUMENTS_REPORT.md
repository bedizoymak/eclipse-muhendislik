# Phase 09 — Sevkiyat İrsaliyeleri

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/stok/sevkiyat-irsaliyeleri
**Kod commit SHA:** (aşağıda, ikinci commit'te doldurulacak)
**Rapor commit SHA:** (push sonrası doldurulacak)

## 1. Resmi dokümantasyon ve gerçek API

- **Liste:** `GET /v4/{company_id}/shipment_documents` — 200. `filter[archived]=false` → `total_pages:14` (14 aktif); `filter[archived]=true` → `total_pages:1` (1 arşivli). **Toplam 15**, Faz 8.0'ın keşfiyle birebir.
- **Filtreler:** bad-filter hata mesajı yalnızca `issue_date, contact_id`'yi "Acceptable" listeler ama `archived` gerçekte çalışıyor (aynı, defalarca doğrulanmış örüntü).
- **Liste include'ları (gerçek 400 kanıtıyla):** `stock_movements(.product/.custom_requirement_infos), contact, tags, warehouse_transfer(.details/.inflow_warehouse/.outflow_warehouse), inbound_e_despatch, e_despatch_response, custom_requirement_infos`. `activities`/`sharings`/`invoices` bu listede **yok**.
- **Tekil endpoint:** `GET /shipment_documents/{id}` — 200. **Kritik bulgu:** tekil endpoint geçersiz bir include'u (`?include=bogus_rel`) sessizce yutup **200** dönüyor (liste endpoint'i aynı durumda 400 veriyor) — bu, tekil endpoint'in include doğrulamasının liste endpoint'inden daha gevşek olduğunu gösteren ayrı bir gerçek API tutarsızlığı, ayrıca belgelendi.
- **Liste↔tekil fark (asıl önemli bulgu):** tekil endpoint'te `include=activities` **gerçek veri döndürüyor** (doğrulanan örnekte 2 gerçek activity kaydı) — aynı `sales_offers.activities` deseni (Faz 7.1/7.2). Liste endpoint'i bu include'u hiç kabul etmiyor.

## 2. Tam API alan envanteri (15 kaydın tamamı, aktif+arşivli)

**Attributes (36 gerçek alan):**

| Alan | Dolu | Null | Boş | Tip |
|---|---:|---:|---:|---|
| address | 14 | 1 | 0 | string/null |
| archived | 15 (14 false, 1 true) | 0 | 0 | boolean |
| carrier_legal_name | 4 | 11 | 0 | string/null |
| carrier_license_plate | 11 | 3 | 1 | string/null |
| carrier_tax_number | 4 | 11 | 0 | string/null |
| city / district | 15 / 15 | 0 / 0 | 0 | string |
| company_address | 11 | 4 | 0 | string/null |
| company_city / company_district | 14 / 14 | 1 / 1 | 0 | string/null |
| company_postal_code | 12 | 3 | 0 | string/null |
| created_at / updated_at | 15 / 15 | 0 | 0 | string |
| description | 5 | 10 | 0 | string/null |
| despatch_no | 10 | 5 | 0 | string/null |
| drivers_info | 7 | 8 | 0 | array/null |
| has_invoice | 15 (14 false) | 0 | 0 | boolean |
| inflow | 15 (9 false) | 0 | 0 | boolean |
| invoice_no | 0 | 15 | 0 | null (gerçek, hep null) |
| is_commercial | 15 (13 false) | 0 | 0 | boolean |
| issue_date / issue_datetime | 15 / 15 | 0 | 0 | string |
| legalized_at | 4 | 11 | 0 | string/null |
| order_date / order_no | 0 / 0 | 15 / 15 | 0 | null (gerçek, hep null) |
| postal_code | 12 | 3 | 0 | string/null |
| print_note | 6 | 9 | 0 | string/null |
| print_url | 15 | 0 | 0 | string |
| printed_at / printed_issue_date | 0 / 0 | 15 / 15 | 0 | null (gerçek, hep null) |
| procurement_number | 4 | 11 | 0 | string/null |
| sharings_count | 15 | 0 | 0 | number |
| shipment_date | 15 | 0 | 0 | string |
| shipment_document_type | 15 | 0 | 0 | string |
| status / status_message / status_changed_at | 4 / 4 / 4 | 11 / 11 / 11 | 0 | string/null |
| uuid | 8 | 7 | 0 | string/null |

**Relationships:**

| İlişki | Durum |
|---|---|
| `contact` | 15/15 dolu (to-one) |
| `stock_movements` | 15/15 dolu (to-many), toplam 20 referans, max 3/belge |
| `tags` | 15/15 gerçek boş dizi |
| `custom_requirement_infos` | 15/15 gerçek boş dizi |
| `warehouse_transfer` | 15/15 gerçek null (to-one) |
| `e_despatch_response` | 15/15 gerçek null (to-one) |
| `inbound_e_despatch` | **6/15 dolu** (to-one), 9/15 gerçek null |
| `activities` | yalnızca tekil endpoint'te çözülüyor; toplam **52** gerçek activity kaydı (15 belge genelinde, sync ile doğrulandı) |
| `sharings` / `invoices` | yalnızca tekil endpoint'te, gerçek boş dizi |

## 3. Relationship keşfi

- `contact`: 15/15 gerçek, `parasut.contacts`'a ID üzerinden çözülüyor.
- `stock_movements`: 15/15 gerçek. **Kritik bulgu:** `parasut.stock_movements` tablosu bu ilişkiyi **zaten** kendi polimorfik `source_type='shipment_documents'`/`source_parasut_id` kolonlarıyla taşıyor (mevcut stock_movements sync'i tarafından dolduruluyor) — API'nin raporladığı **20 (belge, hareket) çiftinin tamamı**, DB'deki 20 gerçek satırla birebir eşleşti (doğrulandı). Bu yüzden **yeni bir junction tablo oluşturulmadı** — gerçek response incelendikten sonra, mevcut yapı zaten doğru modeli temsil ettiği için.
- `tags`/`custom_requirement_infos`: gerçek boş dizi, sahte satır üretilmedi.
- `warehouse_transfer`/`e_despatch_response`: gerçek, her zaman null — nullable FK kolonu olarak saklandı, hiçbir zaman doldurulmadı (tahmin edilmedi).
- `inbound_e_despatch`: 6/15 gerçek, dolu — yeni `parasut.inbound_e_despatches` tablosu ve gerçek attribute'ları (uuid, despatch_no, contact_name, issue_date, from_tax_number, response_status, response_type, expires_at, is_expired) ile saklandı.
- `activities`: 52 gerçek kayıt, `parasut.shipment_document_activities` (Faz 7.2'nin `sales_offer_activities` deseniyle birebir — `data.description`/`data.issue_date` normalize edildi, `done_by` gerçek kullanıcıya çözüldü).

Unresolved ilişki: 0 (tüm contact'lar çözüldü, tüm inbound_e_despatch referansları `included`'da bulundu).

## 4. Supabase modeli — mevcut 15 kaydın denetimi

- `parasut_id` benzersiz: 15/15 ✅.
- Raw payload: 0/15 boş (`raw='{}'` veya null yok).
- Duplicate/stale: 0.
- Contact back-link: 15/15 doğru (API ile karşılaştırıldı, birebir eşleşti).
- Stock movement ilişkisi: zaten `parasut.stock_movements.source_*` üzerinden doğru saklanıyordu (bkz. bölüm 3).
- Eksik gerçek kolon: **24** (bkz. bölüm 2) — yeni migration ile eklendi.

Yeni migration: `supabase/migrations/20260828010000_parasut_shipment_documents_full_data.sql` (eski migration'lar değiştirilmedi):
- `parasut.shipment_documents`'a 24 eksik gerçek kolon eklendi (`invoice_no` zaten vardı, tekrar eklenmedi).
- Yeni tablo `parasut.inbound_e_despatches` (unique `parasut_id`, `shipment_document_parasut_id` FK, tam gerçek attribute seti, `raw jsonb`).
- Yeni tablo `parasut.shipment_document_activities` (Faz 7.2 deseniyle birebir).
- Yeni view'lar: `public.parasut_shipment_documents_demo`, `public.parasut_inbound_e_despatches_demo`, `public.parasut_shipment_document_activities_demo`, `public.parasut_shipment_document_counts_demo` (Faz 8.3'ün dayanıklı aggregate deseni).
- `raw` hiçbir view'a açılmadı; token/credential saklanmadı.

## 5. Sync

`supabase/functions/parasut-sync/resources/shipment_documents.ts` (yeni) + `index.ts`'e eklenen `syncShipmentDocuments`:

- `fetchActiveAndArchived(..., "shipment_documents", { include: "contact,tags,warehouse_transfer,e_despatch_response,inbound_e_despatch,custom_requirement_infos" })` — tüm pagination, her iki arşiv akışı.
- `inbound_e_despatch` parent'ın kendi relationship'inden backfill edildi (child'ın kendi relationship'i boş `{"meta":{}}` — aynı established desen).
- `activities`: her belge için tekil endpoint'ten (`fetchResource`, `include=activities,activities.item,activities.done_by`) ayrıca çekildi — liste endpoint'i bunu asla çözemiyor.
- Batch upsert, `dry_run` doğrulandı, eşzamanlı sync kilidi mevcut mekanizma.
- `sync_runs`'da olmayan kolona yazılmadı — `dbFields` yalnızca zaten var olan kolonları (`fetched_count, active_fetched_count, archived_fetched_count, total_count_reported, upserted_count, detail_fetched_count, detail_upserted_count, unresolved_count, error_count`) kullanıyor; yeni sayaçlar (`inbound_e_despatch_*`, `activity_*`) yalnızca HTTP `responseFields`'da.

**Dry run:** `document_fetched_count:15, document_active_fetched_count:14, document_archived_fetched_count:1, inbound_e_despatch_fetched_count:6, error_count:0` — canlı gerçek sayılarla birebir.

**İki ardışık gerçek sync (birebir aynı sonuç):**

```json
{ "document_fetched_count": 15, "document_upserted_count": 15,
  "inbound_e_despatch_fetched_count": 6, "inbound_e_despatch_upserted_count": 6,
  "activity_fetched_count": 52, "activity_upserted_count": 52,
  "unresolved_count": 0, "error_count": 0 }
```

DB'de doğrulandı: `shipment_documents` 15/15 benzersiz, `inbound_e_despatches` 6/6 benzersiz, `shipment_document_activities` 52/52 benzersiz — duplicate yok.

## 6. Frontend

- `/stok/sevkiyat-irsaliyeleri` (`Sevkiyatlar.tsx`): Aktif/Arşivli/Tümü sekmeleri (Faz 8.3'ün dayanıklı `parasut_shipment_document_counts_demo` aggregate view'ından), tarih filtresi, tablo: irsaliye no/açıklama, müşteri (gerçek link), düzenleme/sevkiyat tarihi, yön (Giriş/Çıkış), durum, taşıyıcı, plaka, arşiv durumu.
- `/stok/sevkiyat-irsaliyeleri/:parasutId` (`SevkiyatDetay.tsx`): "Genel", "Durum ve belge", "Bağlantılar" bölümleri doğrudan görünür; "Tüm irsaliye alanlarını göster" paneli "Taşıyıcı", "Adres", "Yazdırma ve zaman damgaları" bölümlerini açıyor — **hiçbir gerçek alan yalnızca raw JSON'da bırakılmadı**, tümü UI'dan erişilebilir. Ayrıca: "Gelen e-İrsaliye" bölümü (varsa gerçek `inbound_e_despatch` alanları), "Stok hareketleri" tablosu (mevcut `parasut_stock_movements_demo` view'ından `source_type='shipment_documents'` filtresiyle, gerçek ürün/depo linkleriyle), "Durum geçmişi" (gerçek `activities`, gerçek `done_by` adı/e-postası).
- API'de olmayan PDF/e-irsaliye onay akışı/imza geçmişi/depo transferi detayı **üretilmedi** — yalnızca gerçek `print_url`/`status`/`legalized_at`/`warehouse_transfer_parasut_id` (null) gibi API'nin kendi alanları gösterildi.
- Null → "—", sıfır görünür (`sharings_count: 0` gösteriliyor), false → "Hayır" (doğrulandı, bkz. bölüm 8).

## 7. Sayaçlar

Faz 8.3'ün dayanıklı aggregate view deseni birebir uygulandı: `public.parasut_shipment_document_counts_demo` → `count(*) filter (where archived = false/true/is null)` + `count(*)`. Frontend tek istekle bu view'dan okuyor, satır indirip saymıyor.

**Gerçek sonuç:** `active_count:14, archived_count:1, null_archived_count:0, total_count:15`. **Mutabakat:** `14 + 1 + 0 = 15` ✅.

## 8. Uçtan uca doğrulama

| API alanı | Base | Raw | View | TS type | UI | Null korunuyor |
|---|---|---|---|---|---|---|
| Tüm 36 attribute (bölüm 2) | ✅ | ✅ | ✅ | ✅ | ✅ (doğrudan görünür veya "Tüm alanlar" panelinde) | ✅ |
| contact | ✅ | ✅ | ✅ (+contact_name) | ✅ | ✅ (gerçek link) | ✅ |
| stock_movements | ✅ (mevcut source_*) | ✅ | ✅ (mevcut view) | ✅ | ✅ (tablo, gerçek ürün/depo linki) | ✅ |
| inbound_e_despatch | ✅ (yeni tablo) | ✅ | ✅ (yeni view) | ✅ | ✅ (yeni bölüm) | ✅ (9/15 gerçek null → "İlişkili gelen e-irsaliye yok") |
| activities | ✅ (yeni tablo) | ✅ | ✅ (yeni view) | ✅ | ✅ ("Durum geçmişi") | ✅ |
| warehouse_transfer / e_despatch_response | ✅ (null kolon) | ✅ | ✅ | ✅ | ✅ ("—") | ✅ (15/15 gerçek null) |

**Doğrulanan gerçek örnekler:**
- **3 aktif kayıt**: `1000391168`, `1000396035`, `1001433171` (canlıda render doğrulandı).
- **1 arşivli kayıt**: `1001573770` (gerçek, tek arşivli belge).
- **Null alanlı 3 kayıt**: `1003006945`/`1000396164` (status null), `1002714719` (status null, uuid dolu) — canlıda "—" doğrulandı.
- **Contact bağlı örnek**: 15/15 (contact her zaman dolu bu hesapta — contact'ı null olan gerçek kayıt **yok**, sayıyla kanıtlandı, üretilmedi).
- **Çoklu stock movement**: `1000396164` (2), `1001433171` (3), `1001573770` (2), `1001573826` (2) — gerçek, doğrulandı.
- **inbound_e_despatch dolu örnek**: `1000396035` (canlıda tam alan seti render edildi) / **inbound_e_despatch'siz örnek**: `1000391168` ("İlişkili gelen e-irsaliye yok").

## 9. Sayı ve regresyon

| Metrik | Değer |
|---|---:|
| API aktif/arşivli/toplam | 14/1/15 |
| Base/view/UI toplamı | 15/15/15 |
| Benzersiz ID | 15 |
| Duplicate | 0 |
| Contact bağlı/null/unresolved | 15/0/0 |
| Stock movement ilişki sayısı | 20 |
| Benzersiz bağlı stock movement | 20 |
| inbound_e_despatch dolu/null | 6/9 |
| Activity | 52 |
| Error | 0 |

| Regresyon | Beklenen | Gerçek |
|---|---:|---:|
| Contacts | 448 | **448** ✅ |
| Products | 2597 | **2597** ✅ |
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| E-invoices | 1238 | **1238** ✅ |
| E-archives | 24 | **24** ✅ |
| Checks | 40 | **40** ✅ |
| Check payments | 35 | **35** ✅ |
| Payments | 1651 | **1651** ✅ |
| Transactions | 1498 | **1498** ✅ |
| Accounts | 3 | **3** ✅ |
| Sales offers | 1 | **1** ✅ |
| Sales offer details | 1 | **1** ✅ |
| Sales offer activities | 2 | **2** ✅ |

## 10. Deploy ve test

- Migration hosted DB'ye uygulandı. Edge Function deploy edildi. Dry run + iki ardışık gerçek sync doğrulandı (bölüm 5).
- `npm test`: 1 test, geçti. `npm run lint`: 0 hata, 10 önceden var olan uyarı. `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan `Login.tsx:55` hatası. `npm run build:demo`: başarılı.
- FTP deploy: 42 dosya. Canlı: `/` → 200 (yeni bundle ile eşleşiyor), `/stok/sevkiyat-irsaliyeleri` → 200, `/stok/sevkiyat-irsaliyeleri/1000391168` → 200.
- 390×844/768×1024 (gerçek headless Chrome CDP), "Tüm irsaliye alanlarını göster" paneli açıkken dahil: `scrollWidth === clientWidth` — yatay taşma yok. Console hatası yakalanmadı.
- Geniş relationship tabloları (stok hareketleri) kendi `overflow-x-auto` wrapper'ında.

## PASS / FAIL / BLOCKED

**PASS:**
- Liste/tekil endpoint gerçek isteklerle doğrulandı, tekil endpoint'in liste'den farklı (gevşek include doğrulaması + `activities` erişimi) olduğu kanıtlandı
- 36 gerçek attribute, tüm relationship'ler ayrı ayrı envanterlendi
- `stock_movements` için mevcut `source_type/source_parasut_id` yapısının zaten doğru model olduğu kanıtlandı, gereksiz junction tablo oluşturulmadı
- `inbound_e_despatch` (6/15 dolu) ve `activities` (52 kayıt) yeni tablolarla eksiksiz eklendi
- İki ardışık gerçek sync birebir aynı, 0 duplicate/unresolved/stale/error
- Sayaçlar Faz 8.3'ün dayanıklı aggregate deseniyle, mutabakat sağlanarak eklendi
- Regresyon: 14 modülün sayıları birebir korundu
- Build/lint/test/tsc/deploy/route/overflow/console doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:** Yok.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

`parasut.shipment_documents` Faz 0'ın ilk şema migration'ında tanımlanmış ve tek seferlik script ile 15 gerçek kayıtla doldurulmuştu ama hiçbir zaman Edge Function pipeline'ına, view'a veya UI'a bağlanmamıştı. Tekil endpoint keşfi, listenin göremediği iki gerçek ilişkiyi (`inbound_e_despatch`'in tam nesnesi zaten include edilebiliyordu; `activities` yalnızca tekil endpoint'te) ortaya çıkardı. `stock_movements` ilişkisi için ise gerçek response incelendiğinde, mevcut `stock_movements` sync'inin bunu zaten doğru şekilde taşıdığı görüldü — yeni bir yapı kurmak yerine mevcut, doğru veriyi kullanmak tercih edildi.

## Claude Browser için gerçek irsaliye/contact/stock movement ID'leri

- **İrsaliye (contact bağlı, çoklu stok hareketi yok):** `1000391168` → contact `1010814464`, stock movement `1035920006`
- **İrsaliye (inbound_e_despatch dolu):** `1000396035` → inbound_e_despatch `1000356985`
- **İrsaliye (çoklu stok hareketi, 3 adet):** `1001433171` → stock movements `1116816345`, `1116816346`, `1116816347`
- **Arşivli irsaliye:** `1001573770`

## Genel Karar

**PASS.** Gerçek Paraşüt `/shipment_documents` API'sinin döndürdüğü her attribute (36), her gerçek relationship (contact, stock_movements — mevcut yapı üzerinden, inbound_e_despatch, activities, warehouse_transfer/e_despatch_response'un gerçek null durumu) artık Paraşüt API → Supabase base/raw → public view → frontend zincirinin tamamında, hiçbir alan atlanmadan, hiçbir null doldurulmadan, hiçbir bilgi uydurulmadan mevcut. Liste↔tekil endpoint farkı (activities) keşfedildi ve doğru şekilde ele alındı. Sayaçlar 1000 satır sınırından bağımsız. Regresyon yok, iki ardışık sync birebir aynı sonucu verdi.
