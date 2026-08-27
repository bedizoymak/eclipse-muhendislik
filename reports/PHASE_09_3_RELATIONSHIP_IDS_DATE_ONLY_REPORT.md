# Phase 09.3 — İlişki Kimlikleri ve Date-Only Gösterim Düzeltmesi

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/stok/sevkiyat-irsaliyeleri
**Kod commit SHA:** (aşağıda, ikinci commit'te doldurulacak)
**Rapor commit SHA:** (push sonrası doldurulacak)

## Özet

Nihai Browser testinin bulduğu 4 eksik UI alanı (`stock_movements.parasut_id`, `activity.done_by_parasut_id`, `activity.done_by_type`, `activity.item_type`) ve bir sahte-saat sorunu (`shipment_date`'e uydurma `00:00:00 UTC` eklenmesi) düzeltildi. Tümü **base/raw/view/type'ta zaten mevcuttu** — yalnızca UI render'ı eksikti; migration/Edge Function deploy/resync yapılmadı.

## 1. Stock movement ID

"Stok hareketleri" tablosuna gerçek `parasut_stock_movements_demo.parasut_id` alanı doğrudan eklendi (ürün ID'sinden, satır sırasından veya açıklamadan türetilmedi) — ayrıca `source_type`/`source_parasut_id` de eklendi (görev bölüm 4'ün istediği gibi, view'da zaten güvenli gerçek alanlar oldukları için).

**Stock movement için gerçek detay route projede yok** (yalnızca `/stok/hareketleri` liste sayfası var, tekil ID route'u yok) — bu yüzden ID **link olarak değil, ham metin** olarak gösteriliyor (görev kuralına birebir uygun). Ürün/depo linkleri mevcut gerçek ilişkileriyle değişmeden çalışmaya devam ediyor.

**Canlı doğrulanan örnekler:**

| İrsaliye | Tablo satırı |
|---|---|
| 1000391168 | Stok hareketi ID `1035920006`, kaynak `shipment_documents #1000391168` |
| 1001433171 | `1116816345`, `1116816346`, `1116816347` — üçü de `shipment_documents #1001433171` kaynağıyla |

Her satır kendi irsaliyesine ait (`source_parasut_id` filtresi zaten sorguda `.eq("source_parasut_id", parasutId)` ile uygulanıyor) — başka irsaliyeye ait hareket karışmıyor. Duplicate yok (view zaten `parasut_id` benzersiz).

## 2. Activity done_by ve item type

Her activity kartına 4 yeni ayrı alan eklendi: `done_by_parasut_id`, `done_by_type`, `item_parasut_id`, `item_type` — hepsi doğrudan `parasut_shipment_document_activities_demo` view'ından, ad/e-posta/route'tan türetilmeden. Mevcut "Yapan (done_by)" (ad+e-posta) ve "İlgili kayıt (item)" (link) alanları **korundu** — yeni alanlar bunların *yerine* değil, *yanına* eklendi.

**Canlı doğrulanan örnek (activity `786808817`):**

| Alan | View | UI |
|---|---|---|
| done_by_parasut_id | 800086 | "800086" |
| done_by_type | "users" | "users" |
| item_parasut_id | 1000391168 | "1000391168" |
| item_type | "shipment_documents" | "shipment_documents" |

Diğer 3 zorunlu örnek (786808567, 786811375, 1177753041) için de aynı desen DB'de doğrulandı — hepsinde `item_type="shipment_documents"` ve kendi gerçek `item_parasut_id`'si kendi irsaliyesine eşit.

## 3. Date-only alanlar

Base tabloda kolon tipleri incelendi:

| Alan | Postgres tipi | Sınıflandırma |
|---|---|---|
| `issue_date` | `date` | date-only |
| `shipment_date` | `date` | date-only |
| `order_date` | `date` | date-only |
| `printed_issue_date` | `date` | date-only |
| `issue_datetime` | `timestamptz` | timestamp (UTC korunmalı) |
| `created_at`/`updated_at` (parasut_created/updated_at) | `timestamptz` | timestamp |
| `legalized_at` | `timestamptz` | timestamp |
| `printed_at` | `timestamptz` | timestamp |
| `status_changed_at` | `timestamptz` | timestamp |

**Düzeltilen tek gerçek hata:** `shipment_date`, kodda yanlışlıkla `formatApiTimestamp()` ile render ediliyordu — bu, gerçek değere (`"2023-12-15"`) API'de var olmayan bir `00:00:00 UTC` saatini ekliyordu. Şimdi `formatValue()` kullanılıyor — ham `YYYY-MM-DD` değeri, saat eklenmeden gösteriliyor. Diğer üç date-only alan (`issue_date`, `order_date`, `printed_issue_date`) **zaten** doğru şekilde `formatValue()` kullanıyordu — kontrol edildi, dokunulmadı. Tüm timestamp alanları (`issue_datetime`, `legalized_at`, `printed_at`, `status_changed_at`, `parasut_created_at`, `parasut_updated_at`) zaten doğru şekilde `formatApiTimestamp()` kullanıyordu (UTC korunuyor) — değiştirilmedi.

**Kanıt (canlı, irsaliye 1000391168):** "SEVKİYAT TARİHİ" alanı artık yalnızca `2023-12-15` gösteriyor, `00:00:00 UTC` **eklenmiyor**.

## 4. Tam UI denetimi

### Stock movement

| Alan | View | TS type | UI | Gerçek değer |
|---|---|---|---|---|
| parasut_id | ✅ | ✅ **(eklendi)** | ✅ **(eklendi)** | 1035920006 |
| date | ✅ | ✅ | ✅ | "2023-12-15" |
| quantity | ✅ | ✅ | ✅ | 5 |
| product_parasut_id/name | ✅ | ✅ | ✅ (link) | 55806717... / "Triger Dişli" |
| warehouse_parasut_id/name | ✅ | ✅ | ✅ | "Ana Depo" |
| source_type | ✅ | ✅ **(eklendi)** | ✅ **(eklendi)** | "shipment_documents" |
| source_parasut_id | ✅ | ✅ **(eklendi)** | ✅ **(eklendi)** | 1000391168 |

### Activity

| Alan | View | TS type | UI | Gerçek değer |
|---|---|---|---|---|
| parasut_id | ✅ | ✅ | ✅ | 786808817 |
| activity_type | ✅ | ✅ | ✅ (ham + etiket) | "shipment_document_update" |
| date | ✅ | ✅ | ✅ | UTC |
| parasut_created_at/updated_at | ✅ | ✅ | ✅ | UTC |
| done_by_email | ✅ | ✅ | ✅ | null → "—" |
| done_by_parasut_id | ✅ | ✅ **(eklendi)** | ✅ **(eklendi)** | 800086 |
| done_by_type | ✅ | ✅ **(eklendi)** | ✅ **(eklendi)** | "users" |
| done_by_name | ✅ | ✅ | ✅ | "Hayrettin Dayan" |
| done_by_user_email | ✅ | ✅ | ✅ | "hayridayan58@gmail.com" |
| item_parasut_id | ✅ | ✅ **(eklendi)** | ✅ **(eklendi)** | 1000391168 |
| item_type | ✅ | ✅ **(eklendi)** | ✅ **(eklendi)** | "shipment_documents" |
| data.description | ✅ | ✅ | ✅ | "İrsaliye" |
| data.issue_date | ✅ | ✅ | ✅ | "2023-12-15" |

**UI sütununda artık hiçbir gerçek alan için "gösterilmiyor" kalmadı.**

## 5. Regresyon

| Metrik | Beklenen | Gerçek |
|---|---:|---:|
| Shipment documents | 15 | **15** ✅ |
| Active/archived/null/total | 14/1/0/15 | **14/1/0/15** ✅ |
| Stock movement ilişkisi | 20 | **20** ✅ |
| Stock movement benzersiz ID | 20 | **20** ✅ |
| Inbound e-despatch | 6 | **6** ✅ |
| Activities | 52 | **52** ✅ |
| Invoice ilişkisi | 1 | **1** ✅ |
| Print URL dolu | 15/15 | **15/15** ✅ |
| Duplicate/unresolved/stale/error | 0 | **0/0/0/0** ✅ |

Faz 9.1–9.2'deki tüm gerçek alanlar (print_url, invoices bağlantısı, inbound timestamp'leri, ham activity_type) korundu. API'de olmayan hiçbir yeni bilgi eklenmedi.

## 6. Test ve deploy

- **Migration/Edge Function deploy yapılmadı** — base/raw/view/type zaten eksiksizdi, yalnızca `SevkiyatDetay.tsx` değişti.
- `npm test`: 1 test, geçti. `npm run lint`: 0 hata, 10 önceden var olan uyarı. `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan `Login.tsx:55` hatası. `npm run build:demo`: başarılı.
- FTP deploy: 42 dosya. Canlı: `/` → 200 (yeni bundle ile eşleşiyor), `/stok/sevkiyat-irsaliyeleri/1000391168` → 200, `/stok/sevkiyat-irsaliyeleri/1001433171` → 200.
- Gerçek render doğrulaması: stock movement ID'leri (`1035920006`, `1116816345/346/347`), activity `786808817`'nin tüm yeni alanları, `shipment_date`'in artık saatsiz gösterildiği (`2023-12-15`) canlı DOM'dan metin olarak doğrulandı.
- 390×844/768×1024 (gerçek headless Chrome CDP), "Tüm irsaliye alanlarını göster" paneli + genişletilmiş stok hareketleri tablosu açıkken: `scrollWidth === clientWidth` — yatay taşma yok. Console hatası yakalanmadı.

## PASS / FAIL / BLOCKED

**PASS:**
- Stock movement `parasut_id` artık "Stok hareketleri" tablosunda, ham ID olarak (gerçek route olmadığı için link üretilmedi)
- `source_type`/`source_parasut_id` de eklendi (view'da zaten güvenli gerçek alanlardı)
- Her activity kartında `done_by_parasut_id`, `done_by_type`, `item_parasut_id`, `item_type` artık ayrı, erişilebilir alanlar — ad/e-posta/link bunların yerine geçmiyor
- `shipment_date` artık API'de olmayan bir saat eklenmeden, date-only gösteriliyor; diğer 3 date-only alan zaten doğruydu, dokunulmadı; tüm timestamp alanları UTC korunarak doğru kaldı
- Tam UI denetim tablosunda stock movement ve activity için hiçbir "gösterilmiyor" kalmadı
- Regresyon: 9 metrik birebir korundu, Faz 9.1–9.2'nin tüm gerçek alanları kayıp değil
- Build/lint/test/tsc/deploy/route/overflow/console doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:** Yok.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

Faz 9–9.2, stock movement ve activity ilişkilerinin **isim/link** temsilini (ürün adı, depo adı, done_by adı, item linki) yeterli kabul etmiş, ama görev kuralının "ID/type değerleri ad veya linkle temsil edilmiş sayılmaz" ilkesini gözden kaçırmıştı — ad/link kullanıcı deneyimi için doğruydu ama ham ID/type ayrıca erişilebilir olmalıydı. `shipment_date` hatası ise, tüm zaman alanlarına tek bir `formatApiTimestamp()` fonksiyonunun körlemesine uygulanmasından kaynaklandı — alanın gerçek Postgres tipi (`date` vs `timestamptz`) kontrol edilmeden.

## Claude Browser için gerçek ID'ler

- **Stock movement ID örnekleri:** irsaliye `1000391168` → `1035920006`; irsaliye `1001433171` → `1116816345`, `1116816346`, `1116816347`
- **Activity ID/type örnekleri:** `786808817` (done_by 800086/users, item 1000391168/shipment_documents), `786808567`, `786811375`, `1177753041`

## Genel Karar

**PASS.** Stock movement `parasut_id` artık "Stok hareketleri" tablosunda erişilebilir (gerçek route olmadığı için ham metin, link değil). Her activity kartında `done_by_parasut_id`, `done_by_type`, `item_parasut_id`, `item_type` artık ad/link'in yanında, onların yerine geçmeden, ayrı alanlar olarak erişilebilir. `shipment_date` artık API'de olmayan bir saat bilgisi eklenmeden gösteriliyor; diğer tüm date-only ve timestamp alanları doğru sınıflandırılmış durumda kaldı. Base/raw/view/type zaten eksiksiz olduğu için yalnızca UI değişti. Regresyon yok, önceki fazların tüm gerçek alanları korundu.
