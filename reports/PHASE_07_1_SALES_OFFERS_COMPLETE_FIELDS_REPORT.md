# Phase 07.1 — Satış Teklifleri Tam Alan ve Tekil Endpoint Düzeltmesi

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/satislar/teklifler/1001300304
**Kod commit SHA:** `194faa599419e8c8891d062319ad7a9874e0a292`
**Rapor commit SHA:** (bu commit)

## 1. Tekil endpoint doğrulaması

`GET /v4/{company_id}/sales_offers/1001300304` gerçek isteklerle sorgulandı.

- **Include yok:** `200`, `data.relationships` = `{contact:{meta:{}}, sales_invoice:{meta:{}}, details:{meta:{}}, activities:{meta:{}}, sharings:{meta:{}}}` — liste endpoint'inin no-include hâliyle **birebir aynı**.
- **`include=contact`:** `200`, `included: [contacts]` — liste ile aynı contact nesnesi.
- **`include=details`:** `200`, `included: [sales_offer_details]` — liste ile aynı detay.
- **`include=details.product`:** `200`, `included: [sales_offer_details, products]` — liste ile aynı ürün.
- **`include=sales_invoice`:** `200`, `relationships.sales_invoice.data: null` — liste ile aynı (gerçek null, teklif henüz faturaya dönüştürülmemiş).
- **404 testi** (var olmayan ID `9999999999`): `404 {"errors":[{"title":"Record was not found","detail":"SalesOffer-9999999999"}]}` — gerçek, uydurulmadı.

**Kritik bulgu — liste ile tekil endpoint arasında gerçek bir fark:**

- `include=activities` → **LİSTE endpoint'inde 400**: `"activities is not a valid relation. Acceptable: contact, details, details.product, sales_invoice"`.
- `include=activities` → **TEKİL endpoint'inde 200**, gerçek `included: [activities, activities]` — **2 gerçek activity kaydı** dönüyor.
- Tekil endpoint'in kendi bozuk-include hata mesajı (`include=bogus_rel` denendi) şu "Acceptable" listesini veriyor: `details, details.product, contact, contact.contact_people, contact.contact_people.contact, contact.category, sales_invoice, activities, activities.item, activities.done_by, sharings, sharings.*` — **liste endpoint'inden daha geniş**, activities/sharings'i gerçekten içeriyor.
- `include=sharings` → tekil endpoint'te `200`, `data: []` (gerçek boş dizi, reddedilme değil).

**Sonuç:** Liste sync'i bu teklifin `activities` ilişkisini **hiçbir zaman göremiyordu** çünkü liste endpoint'i bu include'u kategorik olarak reddediyor — swagger/hata mesajı sorunu değil, **gerçek ve doğrulanmış bir endpoint-seviyesi API tutarsızlığı**. Bu, Faz 7'nin "activities/sharings yalnızca boş meta" varsayımını (yalnızca liste endpoint'i test edilerek yapılmıştı) **yanlışlıyor** — gerçek veri var, sadece farklı bir uç noktadan erişilebiliyor.

## 2. Liste ↔ tekil endpoint alan karşılaştırması

| Alan/İlişki | Liste endpoint | Tekil endpoint | Fark |
|---|---|---|---|
| Tüm `attributes` | Aynı değerler | Aynı değerler | Yok |
| `contact` (include ile) | 1011029197/contacts, tam | 1011029197/contacts, tam | Yok |
| `details` (include ile) | 1007359467/sales_offer_details, tam | 1007359467/sales_offer_details, tam | Yok |
| `details.product` (include ile) | 1055806717/products, tam | 1055806717/products, tam | Yok |
| `sales_invoice` | `data: null` | `data: null` | Yok |
| `activities` | **400, erişilemez** | **200, 2 gerçek kayıt** | **VAR — düzeltildi** |
| `sharings` | **400, erişilemez** | **200, gerçek boş `[]`** | Veri yok ama erişilebilirlik farklı — dokümante edildi |

Liste sync'i **eksik bırakıyordu** (activities). Kök neden: liste endpoint'inin kendi include reddi, kod hatası değil. Düzeltme: activities, her teklif için tekil endpoint'ten ayrıca çekiliyor (bkz. bölüm 7/9).

## 3. Teklif detayında eklenen alanlar

Önceki (Faz 7) ekranda "teknik alan" gerekçesiyle gösterilmeyen veya hiç render edilmeyen, ama base/view/type'ta zaten var olan gerçek alanlar artık dört bölüm hâlinde tam gösteriliyor:

**Genel:** description (ayrı satır), content, status, archived, issue_date, due_date, parasut_created_at, parasut_updated_at, sharings_count, display_exchange_rate_in_pdf (yeni tipe eklendi).
**Tutar ve para birimi:** currency, exchange_rate, gross_total, net_total, net_total_in_trl, total_vat, total_discount, total_invoice_discount, invoice_discount, invoice_discount_type.
**Stopaj ve vergiler:** withholding, withholding_rate, vat_withholding, vat_withholding_rate, total_vat_withholding, total_excise_duty, total_communications_tax, total_accommodation_tax.
**Fatura/adres:** billing_address, billing_phone, billing_fax, is_abroad, city, district, tax_number, tax_office, contact_type, order_no, order_date.
**İlişkiler:** contact (link), sales_invoice (link veya "—").

## 4. Teklif kalemlerinde eklenen alanlar

Ana tabloda temel kolonlar (ürün, açıklama, miktar, birim fiyat, KDV%, net) kalıyor; her satırın sonuna bir **"Detay" açılır panel** eklendi (görevin önerdiği desen). Panelde: parasut_id, detail_no, net_total_without_invoice_discount, discount_type, discount_value, discount, invoice_discount, excise_duty_type, excise_duty_value, excise_duty, excise_duty_rate, communications_tax_rate, communications_tax, vat_withholding, vat_withholding_rate, accommodation_tax_rate, accommodation_tax, accommodation_tax_exempt, parasut_created_at, parasut_updated_at, product (link zaten ana satırda).

Canlı doğrulama (gerçek render, headless Chrome): panel açıldığında tüm bu alanlar metin olarak görünüyor, `0` değerleri "0" gösteriyor (boş değil), null'lar "—" gösteriyor (bkz. bölüm 5).

## 5. View ve type denetimi

### Teklif (`sales_offers` / `parasut_sales_offers_demo`)

| API alanı | Base | Raw | Public view | TS type | UI | Gerçek değer (1001300304) |
|---|---|---|---|---|---|---|
| description | ✅ | ✅ | ✅ | ✅ | ✅ | "asfsdf" |
| content | ✅ | ✅ | ✅ | ✅ | ✅ | "sdfsdfsdf" |
| status | ✅ | ✅ | ✅ | ✅ | ✅ | "rejected" |
| archived | ✅ | ✅ | ✅ | ✅ | ✅ | false |
| issue_date/due_date | ✅ | ✅ | ✅ | ✅ | ✅ | "2025-12-05" |
| created_at/updated_at → parasut_created_at/updated_at | ✅ | ✅ | ✅ | ✅ | ✅ | UTC, doğrulandı |
| sharings_count | ✅ | ✅ | ✅ | ✅ | ✅ | 0 |
| display_exchange_rate_in_pdf | ✅ | ✅ | ✅ | ✅ **(bu fazda tipe eklendi)** | ✅ **(bu fazda UI'a eklendi)** | false |
| currency, exchange_rate | ✅ | ✅ | ✅ | ✅ | ✅ **(bu fazda UI'a eklendi)** | "TRL", 1 |
| net_total, gross_total, net_total_in_trl, total_vat | ✅ | ✅ | ✅ | ✅ | ✅ | 1480.8 / 1234 / 1480.8 / 246.8 |
| total_discount, total_invoice_discount, invoice_discount, invoice_discount_type | ✅ | ✅ | ✅ | ✅ | ✅ **(invoice_discount_type UI'a eklendi)** | 0/0/0/"percentage" |
| withholding, withholding_rate, vat_withholding, vat_withholding_rate, total_vat_withholding | ✅ | ✅ | ✅ | ✅ | ✅ **(bu fazda UI'a eklendi)** | hepsi 0 |
| total_excise_duty, total_communications_tax, total_accommodation_tax | ✅ | ✅ | ✅ | ✅ | ✅ **(bu fazda UI'a eklendi)** | hepsi 0 |
| billing_address/phone/fax | ✅ | ✅ | ✅ | ✅ | ✅ **(bu fazda UI'a eklendi)** | dolu/null/null |
| is_abroad | ✅ | ✅ | ✅ | ✅ | ✅ **(bu fazda UI'a eklendi)** | false |
| city, district | ✅ | ✅ | ✅ | ✅ | ✅ | null/null |
| tax_number, tax_office | ✅ | ✅ | ✅ | ✅ | ✅ | dolu |
| contact_type | ✅ | ✅ | ✅ | ✅ | ✅ **(bu fazda UI'a eklendi)** | "company" |
| order_no, order_date | ✅ | ✅ | ✅ | ✅ | ✅ | null/null |
| contact (relationship) | ✅ | ✅ | ✅ (+contact_name) | ✅ | ✅ | 1011029197 |
| sales_invoice (relationship) | ✅ | ✅ | ✅ (+sales_invoice_no) | ✅ | ✅ | null |
| **activities (relationship)** | ✅ **(bu fazda yeni tablo)** | ✅ | ✅ **(bu fazda yeni view)** | ✅ **(bu fazda yeni tip)** | ✅ **(bu fazda yeni bölüm)** | 2 gerçek kayıt |
| sharings (relationship) | — (gerçek boş, saklanacak veri yok) | n/a | n/a | n/a | dokümante edildi, tablo/ekran üretilmedi | `[]` |

### Teklif kalemi (`sales_offer_details` / `parasut_sales_offer_details_demo`)

| API alanı | Base | Raw | Public view | TS type | UI | Gerçek değer (1007359467) |
|---|---|---|---|---|---|---|
| description | ✅ | ✅ | ✅ | ✅ | ✅ | null → "—" |
| detail_no | ✅ | ✅ | ✅ | ✅ | ✅ **(panelde)** | 1 |
| quantity, unit_price, vat_rate | ✅ | ✅ | ✅ | ✅ | ✅ | 1 / 1234 / 20 |
| net_total, net_total_without_invoice_discount | ✅ | ✅ | ✅ | ✅ | ✅ (net_total ana tabloda, diğeri panelde) | 1480.8 / 1480.8 |
| discount_type, discount_value, discount | ✅ | ✅ | ✅ | ✅ | ✅ **(panelde)** | "percentage" / null → "—" / 0 |
| invoice_discount | ✅ **(Faz 7'de eklenmişti)** | ✅ | ✅ | ✅ | ✅ **(panelde)** | 0 |
| excise_duty_type, excise_duty_value, excise_duty, excise_duty_rate | ✅ | ✅ | ✅ | ✅ | ✅ **(panelde)** | "percentage" / null → "—" / 0 / 0 |
| communications_tax_rate, communications_tax | ✅ | ✅ | ✅ | ✅ | ✅ **(panelde)** | 0 / 0 |
| vat_withholding, vat_withholding_rate | ✅ | ✅ | ✅ | ✅ | ✅ **(panelde)** | 0 / 0 |
| accommodation_tax_rate, accommodation_tax, accommodation_tax_exempt | ✅ | ✅ | ✅ | ✅ | ✅ **(panelde)** | 0 / 0 / false |
| created_at/updated_at → parasut_created_at/updated_at | ✅ | ✅ | ✅ (Faz 7'den beri view'da vardı) | ✅ **(bu fazda tipe/UI'a eklendi)** | ✅ **(panelde)** | UTC, doğrulandı |
| product (relationship) | ✅ | ✅ | ✅ (+product_name) | ✅ | ✅ (ana tabloda, gerçek link) | 1055806717/"sdfsdfsdf" |

### Teklif aktivitesi (`sales_offer_activities` / `parasut_sales_offer_activities_demo`) — **bu fazda yeni**

| API alanı | Base | Raw | Public view | TS type | UI | Gerçek değer |
|---|---|---|---|---|---|---|
| activity_type | ✅ | ✅ | ✅ | ✅ | ✅ | "new_sales_offer" / "sales_offer_status_updated" |
| date | ✅ | ✅ | ✅ | ✅ | ✅ | UTC, doğrulandı |
| data (iç içe JSON snapshot) | ✅ (jsonb, olduğu gibi) | ✅ | ✅ | — (UI'da ayrıştırılmadı, ham veri korunuyor) | — | saklanıyor, ayrıştırılmadı |
| done_by_email | ✅ | ✅ | ✅ | ✅ | ✅ | null → gösterilmedi (koşullu) |
| done_by (relationship) | ✅ (gerçek: boş) | ✅ | ✅ | — | — | `{"meta":{}}`, veri yok |
| item (relationship) | ✅ (gerçek: boş) | ✅ | ✅ | — | — | `{"meta":{}}`, veri yok |

**View'da eksik kalan gerçek alan bulunmadı** (dokümantasyon dışında) — yeni migration yalnızca `sales_offer_activities` için gerekliydi (yeni tablo, hiç var olmadığı için), mevcut `sales_offers`/`sales_offer_details` view'ları Faz 7'den beri zaten tüm gerçek attribute'ları içeriyordu; eksik olan yalnızca frontend render'ıydı.

## 6. Null ve sıfır koruması

Gerçek kayıt `1001300304` / kalem `1007359467` üzerinde doğrulandı (canlı sayfa render'ından):

| Alan | Kaynak | UI |
|---|---|---|
| billing_phone | null | "—" ✅ |
| billing_fax | null | "—" ✅ |
| city | null | "—" ✅ |
| district | null | "—" ✅ |
| order_no | null | "—" ✅ |
| order_date | null | "—" ✅ |
| sales_invoice | null | "—" ✅ |
| detail description | null | "—" ✅ |
| detail discount_value | null | "—" ✅ |
| detail excise_duty_value | null | "—" ✅ |
| withholding_rate, vat_withholding_rate, total_vat_withholding, total_excise_duty, vb. (0 olan tüm vergi/stopaj alanları) | 0 (gerçek) | **"0" / "0,00 TRL"** — boş gösterilmedi ✅ |

`formatValue()` yardımcı fonksiyonu `null`/`undefined`'ı "—" gösterirken sayısal/boolean `0`/`false` değerlerini kendi gerçek metnine çeviriyor (`0` → "0", `false` → "Hayır") — null ile sıfır asla karıştırılmadı.

## 7. Relationship kontrolü

- `contact`: dolu, ID/ad/link doğru (1011029197, "ONUR YEDEK PARÇA MAKİNA KALIP SANAYİ VE TİCARET LİMİTED ŞİRKETİ").
- `details`: 1 gerçek kalem, tam.
- `details.product`: 1 gerçek ürün ilişkisi, tam (link + isim).
- `sales_invoice`: gerçek `null`, UI "—" gösteriyor, uydurulmadı.
- `activities`: **2 gerçek kayıt**, artık base/view/UI'da (bkz. bölüm 5).
- `sharings`: gerçek boş `[]` (tekil endpoint'te doğrulandı) — hiçbir tablo/UI üretilmedi, çünkü saklanacak gerçek veri yok; bu boşluk kanıtla (ham `data: []`) belgelendi.

## 8. Sync ve sayılar

Sayaçlar yeniden doğrulandı (gerçek sorgu, zorlama yok):

| Sayaç | Değer |
|---|---|
| Aktif teklif | 1 |
| Arşivli teklif | 0 |
| Toplam teklif | 1 |
| Teklif kalemi | 1 |
| Contact relationship | 1 |
| Product relationship | 1 |
| Sales invoice relationship | 0 (gerçek null) |
| **Activity relationship (bu fazda eklendi)** | **2** |
| Duplicate | 0 |
| Unresolved | 0 |

UI-only bir değişiklik yeterli değildi — activities gerçek bir veri kaybıydı, bu yüzden migration + Edge Function deploy + gerçek sync gerçekleştirildi (bkz. bölüm 9).

## 9. Regresyon

| Metrik | Beklenen | Gerçek (bu faz) |
|---|---|---|
| Contacts | 448 | **448** ✅ |
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| Products | 2597 | **2597** ✅ |
| Checks | 40 | **40** ✅ |
| Check payments | 35 | **35** ✅ |
| Payments | 1651 | **1651** ✅ |
| Transactions | 1498 | **1498** ✅ |
| Accounts | 3 | **3** ✅ |

Hiçbir regresyon yok.

## 10. Deploy ve test

- **Yeni migration:** `supabase/migrations/20260827020000_parasut_sales_offer_activities.sql` (`parasut.sales_offer_activities` tablosu + `public.parasut_sales_offer_activities_demo` view) — eski migration'lar değiştirilmedi. `supabase db push` ile hosted DB'ye uygulandı.
- **Edge Function değişti** (`index.ts`, `parasut_client.ts`'e yeni `fetchResource` helper'ı, `resources/sales_offers.ts`'e `mapSalesOfferActivity`) → `supabase functions deploy parasut-sync` ile deploy edildi.
- Dry run: doğrulandı (activities dry run'da çekilmiyor — DB'ye yazılmayan bir dry run için ekstra API çağrısı yapılmıyor; `activity_fetched_count: 0` dry run'da beklenen ve dürüst).
- **İki ardışık gerçek sync:** birebir aynı sonuç: `offer_fetched_count:1, detail_fetched_count:1, activity_fetched_count:2, activity_upserted_count:2, error_count:0`. DB'de doğrulandı: `sales_offer_activities` 2 satır/2 benzersiz `parasut_id`, duplicate yok.
- `npm test`: 1 test, geçti.
- `npm run lint`: 0 hata, 10 önceden var olan uyarı.
- `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan, bu faza ait olmayan `Login.tsx:55` hatası.
- `npm run build:demo`: başarılı, yeni `TeklifDetay-B39mkL2M.js` chunk.
- FTP deploy: 38 dosya, `/public_html/demo`.
- Canlı doğrulama: `/` → 200 (`index-D6sB8vR3.js`, yeni build ile eşleşiyor), `/satislar/teklifler` → 200, `/satislar/teklifler/1001300304` → 200, yeni JS chunk → 200.
- 390×844 ve 768×1024 (gerçek headless Chrome CDP), **kalem detay paneli açıkken de dahil**: `scrollWidth === clientWidth` her ikisinde — yatay taşma yok.
- Geniş kalem alanları: ana tabloda taşmıyor (temel kolonlar), "Detay" panelinde `grid` düzeniyle responsive gösteriliyor — genişlik testinde doğrulandı.
- Console/network kontrolü: sayfa yüklemesi ve panel açma sırasında console hatası yakalanmadı.
- Gerçek render doğrulaması: sayfanın tam metni çekildi, tüm yeni alanlar (bölüm 3-4) ve "Durum geçmişi" bölümündeki 2 gerçek activity kaydı ekranda görüldü.

## PASS / FAIL / BLOCKED

**PASS:**
- Tekil endpoint gerçek isteklerle doğrulandı, liste ile karşılaştırıldı, gerçek bir fark (`activities`) bulundu ve düzeltildi
- 404 durumu gerçek response'la doğrulandı, veri uydurulmadı
- Teklif ve kalemdeki tüm gerçek attribute'lar artık UI'da erişilebilir (genel/tutar/vergi/adres bölümleri + kalem detay paneli)
- `activities` ilişkisi (gerçek, 2 kayıt) yeni migration + sync + UI ile eksiksiz eklendi
- `sharings`in gerçekten boş olduğu tekil endpoint'te kanıtlandı, sahte tablo/ekran üretilmedi
- Null/sıfır ayrımı her alanda doğru (sıfırlar gösteriliyor, null'lar "—")
- Tarih/saat UTC'de, kaynak an değiştirilmeden gösteriliyor
- `net_total_in_trl` frontend'de hesaplanmadı, ham API değeri
- İki ardışık gerçek sync birebir aynı, duplicate/unresolved/error yok
- Regresyon: 9 modülün sayıları birebir korundu
- Build/lint/test/tsc/deploy/route/overflow/console doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:** Yok.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

Faz 7'nin `activities`/`sharings`'i "yalnızca boş meta" olarak belgelemesi, **yalnızca liste endpoint'i test edilerek** yapılmıştı — görev tanımının kendisi de liste sync'ine dayandığından bu doğal bir sınırdı. Faz 7.1'in zorunlu kıldığı tekil-endpoint doğrulaması, liste ve tekil endpoint'in **gerçekten farklı include kabul ettiğini** ortaya çıkardı: `activities` tekil endpoint'te gerçek veri döndürüyor. Kök neden Parasut API'sinin kendi tutarsızlığı; düzeltme, activities'i tekil endpoint üzerinden (yeni `fetchResource` yardımcı fonksiyonuyla) per-offer olarak çekmek oldu.

## Claude Browser için gerçek teklif ve kalem ID'si

- **Teklif:** 1001300304
- **Kalem:** 1007359467
- **Activity'ler:** 1347475910 ("new_sales_offer", 2025-12-05), 1427639960 ("sales_offer_status_updated", 2026-03-13)

## Genel Karar

**PASS.** Tekil endpoint gerçek API'ye karşı doğrulandı ve liste endpoint'iyle karşılaştırıldı; bu karşılaştırma gerçek bir veri kaybı (`activities` ilişkisi) ortaya çıkardı ve aynı fazda düzeltildi — yeni migration, yeni sync mantığı (`fetchResource` ile per-offer tekil endpoint çağrısı), yeni view, yeni UI bölümü. Teklif ve kalemdeki her gerçek API attribute'u artık base → raw → view → type → UI zincirinin tamamında erişilebilir; hiçbiri "teknik alan" gerekçesiyle gizlenmedi. Null'lar "—", sıfırlar "0"/"0,00" olarak doğru gösteriliyor. Regresyon yok. Tek gerçek `sharings` ilişkisi boş olduğu için ekran üretilmedi — bu, veri kaybı değil, kanıtlanmış gerçek bir boşluk.
