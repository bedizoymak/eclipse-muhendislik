# Phase 09.2 — Inbound E-Despatch Zamanları ve Ham Activity Type

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/stok/sevkiyat-irsaliyeleri
**Kod commit SHA:** (aşağıda, ikinci commit'te doldurulacak)
**Rapor commit SHA:** (push sonrası doldurulacak)

## Özet

Faz 9.1'in "panel yer kısıtı" gerekçesiyle gizlediği iki gerçek alan grubu düzeltildi: `inbound_e_despatch.parasut_created_at`/`parasut_updated_at` artık "Gelen e-İrsaliye" bölümünde gösteriliyor; her activity kartına ham `activity_type` değeri (Türkçe etiketin yanında, onu değiştirmeden) eklendi. **Base/raw/view/type zaten eksiksizdi** (Faz 9.1'de doğrulanmıştı) — bu yalnızca bir UI düzeltmesi, migration/Edge Function deploy/resync yapılmadı.

## 1. Inbound e-despatch UI

`SevkiyatDetay.tsx`'in `InboundEDespatchRow` arayüzüne `parasut_created_at`/`parasut_updated_at` eklendi, Supabase sorgusunun `select` listesine eklendi, "Gelen e-İrsaliye" `<dl>`'ine iki yeni `Field` eklendi. Değerler `formatApiTimestamp()` ile — kaynak an değiştirilmeden, yalnızca UTC olarak biçimlendirilerek — gösteriliyor; yerel saat dönüşümü yok, başka bir timestamp alanından türetilmedi.

**Canlı doğrulama (irsaliye `1000396035` → despatch `1000356985`):**

| Alan | API/view ham değer | UI |
|---|---|---|
| parasut_created_at | `2023-12-16T09:10:08.731Z` | "16.12.2023 09:10:08 UTC" |
| parasut_updated_at | `2023-12-19T10:20:56.133Z` | "19.12.2023 10:20:56 UTC" |

Birebir eşleşiyor — saat kaydırılmadı.

## 2. Activity type

Her activity kartına `activity_type (ham değer)` alanı eklendi — `formatValue(act.activity_type)`, doğrudan view'ın kendi `activity_type` kolonundan, etiketten tersine üretilmeden. Türkçe etiket (`ACTIVITY_LABELS[...]`) aynı satırın başlığında ayrıca gösterilmeye devam ediyor — ikisi birbirinin yerine geçmiyor, ikisi de aynı anda erişilebilir.

**Canlı doğrulanan 4 örnek:**

| Activity ID | İrsaliye | Etiket | Ham `activity_type` | Eşleşme |
|---|---|---|---|---|
| 786808817 | 1000391168 | "İrsaliye güncellendi" | `shipment_document_update` | ✅ |
| 786808567 | 1000391168 | "İrsaliye oluşturuldu" | `new_shipment_document` | ✅ |
| 786811375 | 1000391172 | "İrsaliye onaylandı" | `shipment_document_legalize` | ✅ |
| 1177753041 | 1001573770 | "İrsaliye arşivlendi" | `shipment_document_archived` | ✅ |

Dördü de canlı sayfadan DOM metniyle doğrulandı — hem etiket hem ham değer aynı anda görünüyor.

## 3. Tam alan tekrar denetimi

### Inbound e-despatch

| API alanı | Base | Raw | View | TS type | UI | Gerçek değer (1000356985) |
|---|---|---|---|---|---|---|
| parasut_id | ✅ | ✅ | ✅ | ✅ | ✅ | 1000356985 |
| uuid | ✅ | ✅ | ✅ | ✅ | ✅ | "95be831d-..." |
| despatch_no | ✅ | ✅ | ✅ | ✅ | ✅ | "IRS2023000002453" |
| contact_name | ✅ | ✅ | ✅ | ✅ | ✅ | "SEZERSAN MATBAACILIK..." |
| issue_date | ✅ | ✅ | ✅ | ✅ | ✅ | UTC |
| from_tax_number | ✅ | ✅ | ✅ | ✅ | ✅ | "7680490456" |
| response_status | ✅ | ✅ | ✅ | ✅ | ✅ | "legalized" |
| response_type | ✅ | ✅ | ✅ | ✅ | ✅ | "accepted" |
| expires_at | ✅ | ✅ | ✅ | ✅ | ✅ | UTC |
| is_expired | ✅ | ✅ | ✅ | ✅ | ✅ | true |
| **parasut_created_at** | ✅ | ✅ | ✅ | ✅ **(bu fazda eklendi)** | ✅ **(bu fazda eklendi)** | UTC |
| **parasut_updated_at** | ✅ | ✅ | ✅ | ✅ **(bu fazda eklendi)** | ✅ **(bu fazda eklendi)** | UTC |

**UI sütununda artık hiçbir "gösterilmiyor" kalmadı.**

### Activity

| API alanı | Base | Raw | View | TS type | UI | Gerçek değer (786808817) |
|---|---|---|---|---|---|---|
| parasut_id | ✅ | ✅ | ✅ | ✅ | ✅ | 786808817 |
| activity_type (ham) | ✅ | ✅ | ✅ | ✅ | ✅ **(bu fazda eklendi)** | "shipment_document_update" |
| okunabilir etiket | n/a (türetilmiş) | n/a | n/a | n/a | ✅ (Faz 9'dan) | "İrsaliye güncellendi" |
| date | ✅ | ✅ | ✅ | ✅ | ✅ | UTC |
| parasut_created_at | ✅ | ✅ | ✅ | ✅ | ✅ (Faz 9.1'den) | UTC |
| parasut_updated_at | ✅ | ✅ | ✅ | ✅ | ✅ (Faz 9.1'den) | UTC |
| done_by_email (activity'nin kendi alanı) | ✅ | ✅ | ✅ | ✅ | ✅ (Faz 9.1'den) | null → "—" |
| done_by ID/type/name/email | ✅ | ✅ | ✅ | ✅ | ✅ (Faz 9.1'den) | 800086/users/"Hayrettin Dayan"/"hayridayan58@gmail.com" |
| item ID/type/link | ✅ | ✅ | ✅ | ✅ | ✅ (Faz 9.1'den) | 1000391168/shipment_documents/link |
| data.description | ✅ | ✅ | ✅ | ✅ | ✅ (Faz 9.1'den) | "İrsaliye" |
| data.issue_date | ✅ | ✅ | ✅ | ✅ | ✅ (Faz 9.1'den) | "2023-12-15" |

## 4. Regresyon

| Metrik | Beklenen | Gerçek |
|---|---:|---:|
| Shipment documents | 15 | **15** ✅ |
| Active/archived/null/total | 14/1/0/15 | **14/1/0/15** ✅ |
| Stock movement ilişkisi | 20 | **20** ✅ |
| Inbound e-despatch | 6 | **6** ✅ |
| Activities | 52 | **52** ✅ |
| Invoice ilişkisi | 1 | **1** ✅ |
| Print URL dolu | 15/15 | **15/15** ✅ |
| Duplicate/unresolved/stale/error | 0 | **0/0/0/0** ✅ |

Faz 9.1'de eklenen gerçek invoice bağlantısı ve `print_url` kaybolmadı. API'de olmayan hiçbir yeni alan/ilişki eklenmedi — yalnızca zaten var olan iki alan grubu (`inbound.parasut_created_at/updated_at`, `activity.activity_type` ham değeri) UI'a taşındı.

## 5. Test ve deploy

- **Migration/Edge Function deploy yapılmadı** — base/raw/view/type zaten eksiksizdi (Faz 9.1'de doğrulanmıştı), yalnızca `SevkiyatDetay.tsx` değişti.
- `npm test`: 1 test, geçti. `npm run lint`: 0 hata, 10 önceden var olan uyarı. `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan `Login.tsx:55` hatası. `npm run build:demo`: başarılı.
- FTP deploy: 42 dosya. Canlı: `/` → 200 (yeni bundle ile eşleşiyor), `/stok/sevkiyat-irsaliyeleri/1000391168` → 200, `/stok/sevkiyat-irsaliyeleri/1000396035` → 200.
- Gerçek render doğrulaması: inbound zaman damgaları ve 4 farklı activity_type (786808817, 786808567, 786811375/legalize, 1177753041/archived) canlı sayfadan metin olarak çekildi, bölüm 1-2'deki tabloyla birebir eşleşti.
- 390×844/768×1024 (gerçek headless Chrome CDP), "Tüm irsaliye alanlarını göster" paneli açıkken: `scrollWidth === clientWidth` — yatay taşma yok. Console hatası yakalanmadı.

## PASS / FAIL / BLOCKED

**PASS:**
- `inbound_e_despatch.parasut_created_at`/`parasut_updated_at` artık UI'dan erişilebilir, kaynak an değiştirilmeden UTC gösteriliyor
- Her activity kartında ham `activity_type` değeri, Türkçe etiketin yanında, onu değiştirmeden erişilebilir
- 4 farklı gerçek `activity_type` (update/new/legalize/archived) canlıda DOM↔view karşılaştırmasıyla doğrulandı
- Inbound e-despatch'in tüm 12 alanı, activity'nin tüm 11 alanı artık UI'da — hiçbir "gösterilmiyor" kalmadı
- Regresyon: 8 metrik birebir korundu, Faz 9.1'in invoice bağlantısı ve print_url kaybolmadı
- API'de olmayan hiçbir yeni bilgi eklenmedi
- Build/lint/test/tsc/deploy/route/overflow/console doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:** Yok.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

Faz 9.1, `inbound_e_despatch.parasut_created_at`/`parasut_updated_at`'in base/raw/view/type'ta zaten var olduğunu doğru şekilde tespit etti ama UI'a eklerken "panel yer kısıtı" gerekçesiyle atladı — bu, görevin kesin kuralına (gerçek alan yer kısıtı gerekçesiyle gizlenemez) aykırıydı. Aynı şekilde, activity kartları okunabilir Türkçe etiket eklerken ham `activity_type` değerini ayrıca göstermeyi atlamıştı. Kök neden, önceki fazın "zaten temsil ediliyor" (etiket üzerinden) varsayımıydı — etiket, ham değerin yerini tutmuyor.

## Claude Browser için gerçek ID'ler

- **Inbound timestamp örneği:** irsaliye `1000396035` → despatch `1000356985`
- **Activity örnekleri:** `786808817` (update, irsaliye 1000391168), `786808567` (new, irsaliye 1000391168), `786811375` (legalize, irsaliye 1000391172), `1177753041` (archived, irsaliye 1001573770)

## Genel Karar

**PASS.** `inbound_e_despatch.parasut_created_at`/`parasut_updated_at` artık UI'dan erişilebilir, kaynak an değiştirilmeden UTC gösteriliyor. Her activity kartında ham `activity_type` değeri, Türkçe etiketin yanında, erişilebilir — 4 farklı gerçek tür (update/new/legalize/archived) canlıda doğrulandı. Base/raw/view/type zaten eksiksiz olduğu için yalnızca UI değişti, migration/deploy/resync gerekmedi. Regresyon yok, Faz 9.1'in invoice bağlantısı ve print_url'i kaybolmadı.
