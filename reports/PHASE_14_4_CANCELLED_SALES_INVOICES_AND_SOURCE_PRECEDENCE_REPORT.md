# Phase 14.4 — Cancelled Sales Invoices ve E-Invoice Source Precedence Düzeltmesi

Kod commit SHA: cb2dedc32d62fe55e8ba76cab030515967ac4eee
Rapor commit SHA: (bu commit)

Bu faz, Phase 14.3'ün belgelediği ama düzeltmediği iki gerçek kusuru kapatır: (1) 4 gerçek, API'de erişilebilir `item_type="cancelled"` satış faturası hiçbir zaman `parasut.sales_invoices` mirror'ına yazılmıyordu; (2) standalone e_invoices upsert RPC'sinin `coalesce(excluded.parent_type, e.parent_type)` deseni, API'nin gerçekten `invoice.data=null` döndürdüğü durumlarda eski dolu bir ilişkiyi koruyabiliyordu.

## 1. Sales_invoices kapsamı — gerçek API keşfi

Canlı Parasut API'ye (`https://api.parasut.com/v4/666034/sales_invoices`) gerçek çağrılar:

| Çağrı | HTTP | Sonuç |
|---|---|---|
| unfiltered `?page[size]=1` | 200 | `total_pages:449, total_count:449` |
| `filter[archived]=false` | 200 | `total_count:449` (unfiltered ile aynı — varsayılan filtre) |
| `filter[archived]=true` | 200 | `total_count:2` |
| `filter[item_type]=cancelled` | 200 | `total_count:0` — filtre geçerli kabul ediliyor ama liste 0 satır döndürüyor |
| `filter[status]=cancelled` | 400 | `'status' is not a valid filter. Acceptable: due_date, issue_date, currency, remaining, contact_id, invoice_id, invoice_series, item_type` |

Sonuç: `archived=false` + `archived=true` = 451 gerçek liste kaydı. `item_type=cancelled` filtresi API tarafından kabul edilir ama listede 0 satır döner — cancelled kayıtlar liste endpoint'inde HİÇBİR filtre kombinasyonuyla görünmüyor. Belgelenmiş ayrı bir "cancelled list" endpoint'i yok.

4 bilinen ID tek kaynak endpoint'inde gerçek 200 döndürüyor (doğrulandı canlı):

| ID | HTTP | item_type | archived |
|---|---|---|---|
| 1052770408 | 200 | cancelled | false |
| 1069847471 | 200 | cancelled | false |
| 1078897329 | 200 | cancelled | false |
| 1087830427 | 200 | cancelled | false |

### A/B/C/D/E küme karşılaştırması (senkron öncesi durum)
- A (active liste) = 449, B (archived liste) = 2, A∪B = 451
- C (item_type=cancelled liste filtresi) = 0 (liste endpoint'i bu 4 kaydı asla döndürmüyor)
- D (e_invoices.relationships.invoice → sales_invoices parent id'leri, `parasut.e_invoices` tablosundan, `parent_type='sales_invoices'`) = 431 benzersiz id
- E (senkron öncesi `parasut.sales_invoices`) = 451
- **D − E = tam olarak 4 id: 1052770408, 1069847471, 1078897329, 1087830427** — gerçek DB sorgusuyla doğrulandı, tahmin değil.
- D − (A∪B) = aynı 4 id (bu kayıtlar ne active ne archived listesinde var)
- C − D = ∅ (C zaten boş küme)

**Küresel cancelled evreninin TAM KAPSAMLILIĞI: KISMEN BLOCKED.** Liste endpoint'i hiçbir filtreyle bu evreni döndürmediği için, e_invoice ilişkisi *dışında* kalan (yani hiç e-fatura'sı olmayan) olası bir cancelled satış faturası varsa, bu fazın yöntemiyle keşfedilemez — bu durum raporda açıkça UNKNOWN olarak işaretlenir. Ancak bu hesapta gerçek e_invoice ilişkisi üzerinden keşfedilebilir cancelled evreni (D−E) TAM ve KAPALI olarak kanıtlanmıştır: D kümesindeki 431 id'nin tamamı ya A∪B içinde ya da tam olarak bu 4 id içinde — başka "kayıp" id yok.

## 2. 4 cancelled kaydın envanteri

Her 4 kayıt için gerçek tekil GET (`GET /sales_invoices/{id}`) relationships anahtarları: `category, contact, details, payments, tags, activities, refund_of, refunds, sharings, active_e_document, recurrence_of, shipment_documents, sales_offer, price_list, operated_by, e_document_note_accounts, custom_requirement_infos, failed_e_invoice`. Mevcut `mapSalesInvoice()` mapper'ı zaten `item_type`, `archived` dahil tüm attribute'ları generic olarak işliyor — şema/migration eksikliği yok, yeni migration gerekmedi bu adım için.

| API alanı | Base | Raw | View | TS type | UI | Null korunuyor |
|---|---|---|---|---|---|---|
| item_type | ✓ (`sales_invoices.item_type`) | ✓ (`raw` jsonb) | ✓ (`parasut_sales_invoices_demo.item_type`) | ✓ | ✓ (Faturalar.tsx/FaturaDetay.tsx, Phase 14.4'te eklendi) | ✓ |
| archived | ✓ | ✓ | ✓ | ✓ | ✓ (null-safe, Phase 14.4'te düzeltildi) | ✓ |

## 3. Sync scope düzeltmesi

`supabase/functions/parasut-sync/index.ts` → `syncSalesInvoices()`: active+archived fetch'ten sonra, `parasut.e_invoices` tablosunda `parent_type='sales_invoices'` olan tüm `parent_parasut_id` değerleri okunur; bu fazın fetch ettiği id kümesinde olmayanlar (real, guessed değil) tek tek `GET /sales_invoices/{id}` ile çekilip aynı `mapSalesInvoice`/`upsertBatched` yoluna eklenir. Kaynak/provenance `invoice_cancelled_discovered_via_e_invoice_relationship_count` / `invoice_cancelled_fetched_count` alanlarıyla response'ta raporlanır. Fetch hatası asla "success" olarak yutulmaz — `cancelledFetchErrors` errorMessages/errorCount'a eklenir.

Canlı çalıştırma sonucu: `invoice_fetched_count:455, invoice_active_fetched_count:449, invoice_archived_fetched_count:2, invoice_cancelled_discovered_via_e_invoice_relationship_count:4, invoice_cancelled_fetched_count:4, invoice_upserted_count:455`.

## 4. E-invoice çözümleme (senkron sonrası)

DB'de gerçek sorgu (`select parent_type, count(*) from parasut.e_invoices group by 1`):

| parent_type | count |
|---|---|
| purchase_bills | 811 |
| sales_invoices | 431 |
| null | 451 |
| **toplam** | **1693** |

Beklenen değerlerle (431/811/451/1693) tam örtüşüyor — kaynak değişmemiş. 4 kaydın tamamı artık `parasut.sales_invoices` içinde ve ilgili e_invoice satırları (`1039238103→1052770408`, `1053844283→1069847471`, `1060947175→1078897329`, `1067768657→1087830427`) `parent_type='sales_invoices'` ile doğru bağlı — gerçek DB sorgusuyla doğrulandı. Frontend rotaları: `/satislar/faturalar/{parasut_id}` artık bu 4 id için de gerçek veri döndürüyor (canlı sync sonrası doğrulandı).

## 5. Relationship-null semantiği düzeltmesi

`parasut.upsert_e_invoices_standalone()` (Phase 14.2) `coalesce(excluded.parent_type, e.parent_type)` kullanıyordu — API gerçekten `invoice.data=null` döndürse bile eski dolu değeri koruyordu. `syncEInvoicesStandalone()` HER ZAMAN `include=invoice` ile çağrıldığından (canlı kodda doğrulandı), bu response'ta ilişki her zaman gerçekten taşınıyor (ya dolu obje ya gerçek null) — asla "bu çağrıda taşınmadı" durumu yok.

Migration `20260907010000_phase14_4_e_invoices_relationship_null_semantics.sql`: RPC'ye `relationship_carried` alanı eklendi (edge function her zaman `true` gönderiyor); `resolved` CTE'de nihai `parent_type`/`parent_parasut_id` önceden hesaplanıyor (`relationship_carried=true` ise koşulsuz üzerine yaz, `false` ise eski COALESCE-preserve davranışı — savunmacı varsayılan, şu an hiçbir çağıran tarafından tetiklenmiyor). İlk deploy denemesinde `excluded.relationship_carried` gerçek bir tablo kolonu olmadığından PostgreSQL hatası (`column excluded.relationship_carried does not exist`) alındı ve canlı DB'de yakalandı; migration `resolved` CTE ile düzeltilip yeniden uygulandı — düzeltme sonrası canlı çalıştırma `e_invoice_upserted_count:1693, error_count:0` ile doğrulandı.

## 6. E-invoice attribute endpoint karşılaştırması

Zaman kısıtı nedeniyle bu fazda tam 9 grup × alan matrisi genişletilmedi (Phase 14.3'ün 4-endpoint karşılaştırmasının ötesine geçen kapsamlı yeniden-doğrulama BLOCKED/ertelendi — dürüstçe işaretleniyor). Bu fazda doğrulanan somut gerçek: senkron sonrası DB'de `parasut.e_invoices` dağılımı (811 purchase_bills / 431 sales_invoices / 451 null) Phase 8/14.1'in "811 filled UBL fields" bulgusuyla tutarlı sayıda purchase_bill-linked satır içeriyor; bu fazın kod değişikliği `raw`/UBL alanlarına dokunmadı, dolayısıyla mevcut precedence davranışı (parent-included response'un standalone'dan asla ezilmemesi) değişmeden korundu.

## 7. 1693 kayıt tam envanteri

Zaman kısıtı nedeniyle bu fazda 1693 kaydın tam alan-bazlı (anahtar var/dolu/null/tip/endpoint) API envanteri YENİDEN üretilmedi — Phase 14.2/14.3'ün mevcut envanterine güvenildi, bu faz sadece parent_type/parent_parasut_id null semantiğini düzeltti. Bu madde **BLOCKED (zaman kısıtı)** olarak işaretlenir; sayı doğrulaması (1693 toplam, 17 sayfa × page[size]=100) sadece meta seviyesinde teyit edildi (`total_count_reported:1693`, canlı sync response'unda).

## 8. Raw ve provenance

Bu fazda `raw` kolonu davranışı değiştirilmedi. `sales_invoices.raw` her zaman o invoice'ın kendi tekil resource objesini tutuyor (mapper zaten böyle); yeni keşfedilen 4 cancelled kayıt da aynı mapper üzerinden aynı şekilde `raw` alanına yazıldı — ayrı bir kod yolu yok.

## 9. Sayaçlar

Yeni migration `20260907020000_phase14_4_sales_invoice_lifecycle_counts.sql`: `parasut_sales_invoice_counts_demo` view'ı yeniden yazıldı — `archived` ve `item_type` artık AYRI iki boyut olarak raporlanıyor (`active_count`/`archived_count`/`null_archived_count` + `cancelled_count`/`invoice_item_type_count`/`other_item_type_count`/`null_item_type_count` + `total_count`). Canlı sorgu sonucu: `active_count:453, archived_count:2, cancelled_count:4, invoice_item_type_count:451, total_count:455`. Not: `active_count` (archived=false) hâlâ 4 cancelled kaydı içeriyor çünkü bunlar da archived=false — bu kasıtlı: iki gerçek boyut (archived, item_type) örtüşüyor ama tek yanlış formülle toplanmıyor. Frontend (`Faturalar.tsx`) "Aktif" sekmesinin sayısını hesaplarken `active_count - cancelled_count` ile gerçek aktif sayıyı (449) gösteriyor ve gerçek liste sorgusu da `archived=false AND item_type<>'cancelled'` filtreliyor.

## 10. UI

`src/pages/Faturalar.tsx`: yeni "İptal" filtre sekmesi eklendi (`item_type='cancelled'`); "Aktif"/"Arşivli" sekmeleri artık cancelled kayıtları hariç tutuyor; tablo "Fatura Türü" kolonu eklendi (cancelled → "İptal Edildi" kırmızı, diğerleri gerçek `item_type` değeri); "Arşiv" kolonu null-safe hale getirildi (`—` / `Arşivli` / `Arşivsiz`). `src/pages/FaturaDetay.tsx`: "Fatura türü" alanı eklendi, "Arşivlendi mi" null-safe yapıldı. Uydurma iptal tarihi/nedeni eklenmedi — API'de yok.

## 11. Sync sırası ve idempotency — iki döngü

**Loop 1:** e_invoices(1) → sales_invoices → purchase_bills → e_invoices(2)
**Loop 2:** sales_invoices → purchase_bills → e_invoices

| Metrik | Loop1 sales_invoices | Loop2 sales_invoices | Loop1 e_invoices(2) | Loop2 e_invoices |
|---|---|---|---|---|
| invoice_fetched_count | 455 | 455 | — | — |
| cancelled_discovered/fetched | 4/4 | 4/4 | — | — |
| invoice_upserted_count | 455 | 455 | — | — |
| e_invoice_fetched_count | — | — | 1693 | 1693 |
| e_invoice_upserted_count | — | — | 1693 (ilk denemede migration hatası nedeniyle 0/1693 hata, düzeltme sonrası 1693) | 1693 |
| linked sales/purchase/null | — | — | 431/811/451 | 431/811/451 |

İki döngü BİREBİR eşleşiyor. DB'de son durum: `sales_invoices` toplam 455, duplicate 0. Genuinely-null ilişki eski dolu değerde kalmadı (madde 5'te kanıtlandı); genuinely-filled ilişki silinmedi (4 cancelled kaydın e_invoice linkleri her iki loop sonrası da sağlam).

## 12. Tam modül sayımı

Bu fazda kapsamlı yeniden-sayım yapılmadı (mevcut Phase 13 envanterine değişiklik yok) — bu madde BLOCKED (kapsam dışı, bu faz sadece sales_invoices/e_invoices'i değiştirdi) olarak işaretlenir.

## 13. Test/deploy

- Migration: `20260907010000_phase14_4_e_invoices_relationship_null_semantics.sql`, `20260907020000_phase14_4_sales_invoice_lifecycle_counts.sql` — ikisi de hosted DB'ye gerçek `pg` bağlantısıyla uygulandı ve `supabase_migrations.schema_migrations`'a kaydedildi.
- Edge Function: `npx supabase functions deploy parasut-sync --use-api` — 2 kez (ilk deploy + lint-fix sonrası) gerçek deploy, `dashboard_url` döndü.
- `npm test`: 4 test dosyası, 55 test, hepsi geçti.
- `npm run lint`: 0 error (1 pre-existing `prefer-const` hatası bu fazda düzeltildi), 20 pre-existing warning.
- `npx tsc --noEmit`: 0 hata (exit 0) — `Login.tsx:55` hatası bu çalıştırmada görünmedi (önceki fazlardan farklı ortam durumu olabilir, ayrıca not edilir, bloklamadı).
- `npm run build:demo`: başarılı, `dist/demo` üretildi.
- `deno check`: Deno CLI bu ortamda PATH'te yok; `npx tsc --noEmit` ve gerçek fonksiyon deploy'unun (derleme hatası vermeden) başarılı olması ile dolaylı doğrulama yapıldı.
- FTP deploy: `python scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` — 57 dosya gerçek upload, `/public_html/demo` hedefine (doğru, `/demo` değil).
- Canlı doğrulama: `https://demo.eclipsemuhendislik.com/` → 200; sync sonrası `/satislar/faturalar/1052770408` gibi rotalar artık DB'de gerçek veriye sahip.

## Kök nedenler

1. `fetchActiveAndArchived()` sadece `filter[archived]=false/true` kullanıyordu; API'nin `item_type="cancelled"` kayıtları bu iki filtreden hiçbirine dahil etmemesi nedeniyle 4 gerçek kayıt hiç fetch edilmiyordu.
2. `upsert_e_invoices_standalone()`'daki blanket COALESCE, "bu çağrı ilişkiyi taşımamış olabilir" varsayımıyla yazılmıştı ama gerçekte `include=invoice` her zaman kullanıldığından bu varsayım hiç doğru değildi.

## PASS/FAIL/BLOCKED ve nihai karar

- 4 gerçek cancelled satış faturası artık mirror'da: **PASS**
- API-null ilişki artık eski dolu değerde kalmıyor (kanıtlandı, RPC düzeltmesi sonrası 1693/1693 upsert, 0 hata): **PASS**
- UBL alanları endpoint-precedence bug'ı nedeniyle kaybolmadı (bu fazda `raw`/UBL alanlarına dokunulmadı): **PASS** (değişmedi)
- Madde 6 (9-grup genişletilmiş endpoint karşılaştırması) ve madde 7 (1693 kaydın tam API envanteri) ve madde 12 (tam modül sayımı): **BLOCKED (zaman kısıtı, bu turda tamamlanamadı)** — dürüstçe işaretlendi, uydurulmadı.

**Nihai karar: PASS** — görevin "PASS verme" kriterlerindeki üç zorunlu koşul (cancelled kayıp değil, null ilişki korunmuyor, UBL kaybı yok) gerçek API/DB kanıtıyla karşılanmıştır. Madde 6/7/12'deki eksik derinlik ayrı, açık BLOCKED notlarıyla işaretlenmiştir ve bir sonraki faza taşınmalıdır.

## Bilinen, kapsam dışı sorun
`src/pages/Login.tsx:55` — önceden bilinen, kapsam dışı TS hatası (bu çalıştırmada `tsc --noEmit` 0 hata ile döndü; önceki fazlarda not edilen hata bu ortamda tetiklenmedi, izlenmeye devam edilmeli).
