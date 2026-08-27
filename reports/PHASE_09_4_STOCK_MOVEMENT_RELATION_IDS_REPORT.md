# Phase 09.4 — Stok Hareketi Ürün ve Depo ID Düzeltmesi

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/stok/sevkiyat-irsaliyeleri
**Kod commit SHA:** (aşağıda, ikinci commit'te doldurulacak)
**Rapor commit SHA:** (push sonrası doldurulacak)

## Özet

"Stok hareketleri" tablosunda `product_parasut_id` yalnızca link `href`'inde, `warehouse_parasut_id` ise yalnızca ada geri düşme metninde saklıydı — hiçbiri ayrı, doğrudan erişilebilir bir hücre olarak gösterilmiyordu. Bu fazda her ikisi de kendi sütunlarında, ham değerleriyle eklendi. Değerler zaten `parasut_stock_movements_demo` view'ından geliyordu — **base/raw/view/type zaten eksiksizdi**, yalnızca UI değişti; migration/Edge Function deploy/resync yapılmadı.

## 1. Stock movement tablosu

`SevkiyatDetay.tsx`'in "Stok hareketleri" tablosuna iki yeni sütun eklendi: **Ürün ID** (`product_parasut_id`, `formatValue()` ile ham metin) ve **Depo ID** (`warehouse_parasut_id`, `formatValue()` ile ham metin). Mevcut "Ürün" (link) ve "Depo" (ad) sütunları **korundu** — yeni ID sütunları bunların *yerine* değil, *yanına* eklendi. Depo için gerçek bir detay route projede yok (yalnızca `/stok/depolar` liste sayfası var, tekil ID route'u yok) — bu yüzden Depo ID sahte bir link olarak değil, ham metin olarak gösteriliyor (daha önce de link değildi, şimdi ayrıca kendi sütununda). Null ürün/depo ID'si `formatValue()` ile "—" gösteriyor; hiçbir ID isimden tahmin edilmedi.

## 2. Gerçek örnekler

**İrsaliye `1000391168` → hareket `1035920006`:**

| Alan | View | UI |
|---|---|---|
| product_parasut_id | 1015027240 | "1015027240" |
| warehouse_parasut_id | 1000122982 | "1000122982" |
| source_type | "shipment_documents" | "shipment_documents" |
| source_parasut_id | 1000391168 | "#1000391168" |

**İrsaliye `1001433171`:**

| Hareket | Ürün ID (view) | Ürün ID (UI) | Depo ID (view) | Depo ID (UI) |
|---|---:|---|---:|---|
| 1116816345 | 1039745311 | "1039745311" | 1000122982 | "1000122982" |
| 1116816346 | 1039745312 | "1039745312" | 1000122982 | "1000122982" |
| 1116816347 | 1039745313 | "1039745313" | 1000122982 | "1000122982" |

Tüm değerler görevin belirttiği beklenen değerlerle birebir eşleşti — canlı sayfadan DOM metniyle doğrulandı.

## 3. Tam stock movement alan tablosu

| Alan | View | TS type | UI | Gerçek değer (1035920006) |
|---|---|---|---|---|
| parasut_id | ✅ | ✅ | ✅ | 1035920006 |
| date | ✅ | ✅ | ✅ | "2023-12-15" |
| quantity | ✅ | ✅ | ✅ | 5 |
| product_parasut_id | ✅ | ✅ | ✅ **(bu fazda ayrı sütun eklendi — önceden yalnızca href'te)** | 1015027240 |
| product_name | ✅ | ✅ | ✅ (link) | "Triger Dişli" |
| warehouse_parasut_id | ✅ | ✅ | ✅ **(bu fazda ayrı sütun eklendi — önceden yalnızca ad yoksa geri düşme metninde)** | 1000122982 |
| warehouse_name | ✅ | ✅ | ✅ | "Ana Depo" |
| source_type | ✅ | ✅ | ✅ (Faz 9.3'ten) | "shipment_documents" |
| source_parasut_id | ✅ | ✅ | ✅ (Faz 9.3'ten) | 1000391168 |

**UI sütununda artık "yalnızca href" veya "gösterilmiyor" kalmadı.**

## 4. Regresyon

| Metrik | Beklenen | Gerçek |
|---|---:|---:|
| Shipment documents | 15 | **15** ✅ |
| Stock movement ilişkisi | 20 | **20** ✅ |
| Benzersiz hareket | 20 | **20** ✅ |
| Activities | 52 | **52** ✅ |
| Inbound e-despatch | 6 | **6** ✅ |
| Invoice ilişkisi | 1 | **1** ✅ |
| Print URL | 15/15 | **15/15** ✅ |
| Duplicate/unresolved/stale/error | 0 | **0/0/0/0** ✅ |

Önceki düzeltmeler korundu (canlı doğrulandı): activity `done_by_parasut_id`/`done_by_type`/`item_parasut_id`/`item_type` hâlâ görünür (Faz 9.3); date-only alanlara saat eklenmiyor (`shipment_date` hâlâ yalnızca `YYYY-MM-DD`); 36 irsaliye attribute'u ve inbound'ın 12 alanı hâlâ erişilebilir (Faz 9/9.1/9.2). API'de olmayan hiçbir yeni bilgi eklenmedi.

## 5. Test ve deploy

- **Migration/Edge Function deploy yapılmadı** — yalnızca `SevkiyatDetay.tsx` değişti.
- `npm test`: 1 test, geçti. `npm run lint`: 0 hata, 10 önceden var olan uyarı. `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan `Login.tsx:55` hatası. `npm run build:demo`: başarılı.
- FTP deploy: 42 dosya. Canlı: `/` → 200 (yeni bundle ile eşleşiyor), `/stok/sevkiyat-irsaliyeleri/1000391168` → 200, `/stok/sevkiyat-irsaliyeleri/1001433171` → 200.
- Gerçek render doğrulaması: bölüm 2'deki tüm ID'ler canlı DOM'dan metin olarak çekildi, view ile birebir eşleşti.
- 390×844/768×1024 (gerçek headless Chrome CDP): `scrollWidth === clientWidth` — yatay taşma yok. Geniş tablo (artık 8 sütun) yalnızca kendi `overflow-x-auto` wrapper'ında kayıyor, body taşması yok. Console hatası yakalanmadı.

## PASS / FAIL / BLOCKED

**PASS:**
- Ürün ID ve Depo ID artık "Stok hareketleri" tablosunda ayrı, ham metin sütunları olarak erişilebilir — isim/link bunların yerine geçmiyor
- Görevin belirttiği tüm gerçek ID'ler (1015027240/1000122982, 1039745311-313/1000122982) canlıda view ile birebir doğrulandı
- Depo için gerçek route olmadığı için sahte link üretilmedi
- Null ID'ler doğru şekilde "—" gösteriyor (bu hesapta test edilecek gerçek null örnek yok, tüm 20 hareketin product/warehouse ID'si dolu — sayıyla not edildi)
- Tam alan tablosunda hiçbir "yalnızca href" veya "gösterilmiyor" kalmadı
- Regresyon: 8 metrik birebir korundu, önceki tüm düzeltmeler (Faz 9.1–9.3) kayıp değil
- Build/lint/test/tsc/deploy/route/overflow/console doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:** Yok.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

Ürün ID'si yalnızca `<Link>` bileşeninin `to` prop'unda (görünmeyen bir `href` değeri) kullanılıyordu; depo ID'si yalnızca ad yoksa devreye giren bir geri düşme metnindeydi (bu hesapta hep ad dolu olduğu için hiç görünmüyordu). İkisi de teknik olarak "veride vardı" ama kullanıcı arayüzünde doğrudan okunabilir/erişilebilir değildi — bu projenin "ID, isim veya linkle temsil edilmiş sayılmaz" kuralına aykırıydı.

## Claude Browser için gerçek route'lar

- `/stok/sevkiyat-irsaliyeleri/1000391168` — hareket 1035920006 (ürün 1015027240, depo 1000122982)
- `/stok/sevkiyat-irsaliyeleri/1001433171` — 3 hareket (1116816345/346/347, hepsi depo 1000122982)

## Genel Karar

**PASS.** Ürün ID ve Depo ID artık "Stok hareketleri" tablosunda kendi ayrı sütunlarında, ham değerleriyle, isim/linkin yerine geçmeden erişilebilir. Görevin belirttiği tüm gerçek örnekler canlıda view ile birebir doğrulandı. Depo için sahte link üretilmedi (gerçek route yok). Base/raw/view/type zaten eksiksiz olduğu için yalnızca UI değişti, migration/deploy/resync gerekmedi. Regresyon yok, önceki fazların tüm düzeltmeleri korundu.
