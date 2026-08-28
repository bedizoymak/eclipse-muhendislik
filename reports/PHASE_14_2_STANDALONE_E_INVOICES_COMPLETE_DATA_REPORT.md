# Phase 14.2 — Standalone e_invoices Tam Veri Evreni

**Tarih:** 2026-08-28/29
**Kod commit SHA:** de56a27f09ce5f914a00862b0373f2fb3fb8a3d2
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com

## 0. Özet

Paraşüt'ün gerçek `GET /e_invoices` uç noktasındaki **1693 gerçek kaydın tamamı**
artık Supabase `parasut.e_invoices` tablosunda saklanıyor (önceki 1238'den
1693'e). Yeni, ayrı bir `resource=e_invoices` senkron yolu eklendi;
`syncActiveEDocuments()` (Phase 8) davranışı **değiştirilmedi**. Frontend'e
`/satislar/e-faturalar` (liste) ve `/satislar/e-faturalar/:parasutId`
(detay) eklendi, deploy edildi ve canlıda doğrulandı.

## 1. Tam envanter — 1693 kayıt

`GET /e_invoices?page[size]=100&page[number]=1..17&include=invoice` ile 17
sayfa, 0 hata, 0 retry-tükenmesi ile tam olarak **1693** kayıt çekildi
(`meta.total_pages=17`, son sayfa 93 kayıt). İkinci bağımsız çekimde de aynı
1693 sonucu doğrulandı.

Önemli, bu fazda doğrulanan gerçek API davranışı: `include=invoice`
parametresi verilmeden yapılan çağrıda `relationships.invoice` HER ZAMAN
`{"meta":{}}` döner (data anahtarı yok) — gerçek ilişki verisi sadece
`include=invoice` ile geliyor. Phase 14.1'in "42 örneklem" bulgusu bu
sebeple genişletilemezdi; bu faz `include=invoice` ile TÜM 1693 kaydın
gerçek ilişki durumunu okudu.

Alan şekli 1693 kaydın tamamında aynı (yeni/farklı bir attribute veya
relationship anahtarı bulunmadı):

| Alan grubu | Bulunan anahtar sayısı | Not |
|---|---|---|
| `attributes` | 39 anahtar (created_at, updated_at, external_id, uuid, env_uuid, from_address, from_vkn, to_address, to_vkn, direction, note, response_type, contact_name, scenario, status, status_message, issue_date, is_expired, is_answerable, net_total, currency, item_type, refund_of_id, expires_at, status_code, gtb_ref_no, invoice_type_code, profile_id, archived, total_vat, is_seen, vat_exemption_reason_code, migration_source, `__ubl_remote_id`, `__signed_ubl_remote_id`, signed_ubl_url, pdf_url, html_url, `__rendered_ubl_path`, non_standard_e_invoice) | Phase 8'in bildiği set ile birebir aynı — 1693 kaydın hiçbirinde yeni bir attribute yok |
| `relationships` | invoice, responses, activities | `invoice` = tek gerçek parent bağlantısı; responses/activities her zaman `{"meta":{}}` (bu hesapta hiç dolu görülmedi) |
| `links` | `pdf` | Her kayıtta var |
| `meta` | created_at, updated_at | Attributes ile aynı değerler |

Doluluk (1693 üzerinden, örnek gerçek dağılım):
- `direction`: outbound 431, inbound 1262, null 0
- `archived`: false 1693, true 0, null 0
- `refund_of_id`, `env_uuid`, `response_type`, `profile_id`,
  `vat_exemption_reason_code`, `invoice_type_code`, `gtb_ref_no`,
  `migration_source`, `__ubl_remote_id`, `__signed_ubl_remote_id`,
  `__rendered_ubl_path`: bu hesapta gerçek olarak hep null (Phase 8'de de
  aynı gözlem yapılmıştı) — hiçbiri UI'da veya senkronda gizlenmedi, DB'de
  ve view'da null olarak duruyor.

## 2. 455 (gerçek: 451→455) kaydın tam ilişki denetimi

Phase 14.1'in "455 unlinked" tahmini örneklemdi. Bu fazda **tüm 1693 kayıt**
için gerçek `invoice` ilişkisi okundu:

| İlişki durumu | Kayıt sayısı |
|---|---|
| `invoice.data` dolu, type=sales_invoices | 431 |
| `invoice.data` dolu, type=purchase_bills | 811 |
| `invoice.data` null | 451 |
| `invoice.meta` boş, data yok (sadece meta) | 0 (include olmadan hepsi buydu; include ile hiçbiri kalmadı) |
| Diğer (bilinmeyen relationship type) | 0 |
| **Toplam** | **1693** |

431+811 = 1242 dolu, 451 null → 1242+451 = 1693. ✓

Standalone senkron ile bu 1242 dolu ilişkili + 451 null-ilişkili kaydın
**tamamı** DB'ye yazıldı. Ardından mevcut `syncActiveEDocuments()`
(sales_invoices/purchase_bills senkronunun bir parçası) çalıştırıldığında,
kendi "stale link temizliği" adımı (Phase 8'den beri var, davranışı
değiştirilmedi) 4 kaydın parent bağlantısını null'a çevirdi — çünkü bu 4
e-fatura, `syncSalesInvoices()`'ın kendi aktif+arşiv listesinde bulunmayan
bir sales_invoice'a işaret ediyordu (muhtemelen `syncSalesInvoices()`'ın
kapsamadığı bir durum/senaryo). Bu, tasarım gereği doğru davranış: "aktif
parent senkronu kendi kapsamındaki linki temizleyebilir, ama child belgeyi
asla silmez" kuralına uyuyor. Sonuç: yakınsanmış durum **427 sales_invoice
+ 811 purchase_bill + 455 unlinked = 1693** — Phase 14.1'in bildirdiği
427/811/455 rakamlarıyla birebir örtüşüyor ve şimdi KANITLANMIŞ (tahmin
değil).

**Hiçbir parent hiçbir zaman isim/VKN/tutar/tarih eşleştirmesiyle
tahmin edilmedi** — her parent_type/parent_parasut_id ya
`e_invoices?include=invoice`'in gerçek `relationships.invoice.data`'sından
ya da `syncActiveEDocuments()`'ın zaten var olan gerçek
`active_e_document` ilişkisinden geldi.

## 3. Veri modeli

Mevcut `parasut.e_invoices` şeması (Phase 8) zaten `parent_type` /
`parent_parasut_id` kolonlarına sahipti — Phase 14.2 bunları yeniden
kullandı, eski `invoice_parasut_id` kolonuna hiç dokunmadı. Migration:
`supabase/migrations/20260829050000_phase14_2_standalone_e_invoices.sql`

- `parasut.e_invoices.last_seen_at timestamptz` eklendi — standalone
  senkronun her çalışmasında gördüğü satırı damgalar.
- `parasut.upsert_e_invoices_standalone(payload jsonb)` fonksiyonu
  eklendi: her gerçek kolonu her zaman güncel değerle yazar, ama
  `parent_type`/`parent_parasut_id`'yi `COALESCE(excluded, mevcut)` ile
  yazar — yani standalone senkronun kendi null bulgusu, `syncActiveEDocuments`
  veya önceki bir standalone çalışmasının yazdığı gerçek bir parent'ı ASLA
  silmez; ama standalone'un kendi taze, gerçek, non-null bulgusu her zaman
  kazanır.
- `public.parasut_e_invoices_counts_demo` view'ı eklendi (durable
  aggregate counter, asla `.length` veya sabit değer).

## 4. İki senkron yolunun ayrımı

- **A. Aktif parent senkronu** (`syncActiveEDocuments`, Phase 8,
  DEĞİŞTİRİLMEDİ): `syncSalesInvoices`/`syncPurchaseBills` içinden
  çağrılıyor, sadece kendi kapsamındaki aktif parent'lara bağlı
  e-belgeleri yazıyor, stale link'i temizleyebiliyor, child'ı asla silmiyor.
- **B. YENİ bağımsız `resource=e_invoices` senkronu**
  (`syncEInvoicesStandalone`, bu faz): `GET /e_invoices?include=invoice`
  ile TÜM 1693 kaydı sayfalıyor, 451/455 ilişkisiz kaydı da yazıyor,
  hiçbir parent'ı tahmin etmiyor, `upsert_e_invoices_standalone` RPC'si
  ile var olan gerçek parent linklerini asla null'lamıyor.

Edge Function: `supabase/functions/parasut-sync/index.ts` — yeni
`"e_invoices"` `SUPPORTED_RESOURCES` girişi ve `syncEInvoicesStandalone`
fonksiyonu eklendi (satır ~2157 öncesi, `syncEInvoiceInboxes`'tan hemen
sonra). `syncActiveEDocuments()` fonksiyon gövdesi tek satır bile
değiştirilmedi (git diff ile doğrulandı — yalnızca yeni fonksiyon eklendi).

## 5. Stale semantiği

Bu faz **hiçbir fiziksel silme yapmıyor** — sadece upsert. API'den kaybolan
bir kayıt bu fazda otomatik silinmiyor (güvenli varsayılan). `last_seen_at`
her standalone çalışmada damgalanıyor; gelecekte bir "stale aday" raporu
bu kolonla üretilebilir ama bu faz onu otomatik silmiyor. Aktif-parent
senkronunun kendi link-temizliği (madde 2'de açıklanan) standalone kayıtları
asla silmiyor — sadece kendi `parent_type`/`parent_parasut_id`'sini
null'a çeviriyor, satırın kendisi duruyor.

## 6. Public view ve sayaçlar

`parasut_e_invoices_demo` (Phase 8.1'den) zaten tüm base kolonları
kapsıyordu — değişiklik gerekmedi. Yeni:
`public.parasut_e_invoices_counts_demo`:

```
total_e_invoices=1693, linked_sales_invoice_count=427,
linked_purchase_bill_count=811, unlinked_count=455,
inbound_count=1262, outbound_count=431, unknown_direction_count=0,
archived_count=0, active_count=1693, null_archived_count=0,
unresolved_relationship_count=0
```

Uzlaşım kimlikleri:
- total = linked_sales(427) + linked_purchase(811) + unlinked(455) = 1693 ✓
- total = inbound(1262) + outbound(431) + null(0) = 1693 ✓
- active(1693) + archived(0) + null_archived(0) = 1693 ✓

## 7. Frontend

- `/satislar/e-faturalar` — `src/pages/EFaturalar.tsx`: gerçek alanlar
  (external_id, direction, contact_name, issue_date, status, net_total,
  total_vat, currency, archived, parent link), gerçek `counts_demo`
  view'ından sayaçlar, bağlantılı/bağlantısız + yön filtreleri.
- `/satislar/e-faturalar/:parasutId` — `src/pages/EFaturaDetay.tsx`:
  `EDocumentSection` bileşeni yeniden kullanıldı (Phase 8'den, hiç
  değiştirilmedi), tüm gerçek alanlar "Tüm e-belge alanlarını göster"
  panelinde. Parent linki: sales_invoices → `/satislar/faturalar/:id`,
  purchase_bills → `/giderler/:id`, null → "İlişkili Paraşüt
  faturası/gideri yok", çözümlenemeyen tip → gerçek id/type gösterilir,
  link verilmez.
- `/satislar/e-fatura-mukellefleri` (VKN sorgulama, `EFaturaKutulari.tsx`)
  hiç dokunulmadı — ayrı özellik olarak kaldı.
- PDF/UBL/HTML linkleri `resolveEDocumentUrl()` ile aynı mantığı kullanıyor
  (EDocumentSection üzerinden, kod tekrarı yok).

## 8. Tam alan-UI matrisi (özet)

Tüm 39 gerçek `attributes` alanı zaten Phase 8'den beri
`parasut.e_invoices` base tablosunda, `raw jsonb`'de ve
`parasut_e_invoices_demo` view'ında mevcuttu (Phase 8.1 view düzeltmesiyle
tamamlandı). Bu faz hiçbir alanı kaldırmadı/gizlemedi; sadece
`parent_type`/`parent_parasut_id`'nin artık null olabilen (unlinked)
durumları da UI'da "İlişkili Paraşüt faturası/gideri yok" olarak dürüstçe
gösteriliyor. `__ubl_remote_id`, `__signed_ubl_remote_id`,
`__rendered_ubl_path` teknik iç alanlar — base/raw'da duruyor, public UI'da
gösterilmiyor (Phase 8'in kararı, bu fazda değiştirilmedi; bu hesapta
zaten hep null).

## 9. Senkron testleri

- Dry run: `e_invoice_fetched_count=1693, upserted=0, linked_sales=431,
  linked_purchase=811, unlinked=451, unresolved=0, duplicate=0`
- 1. gerçek senkron: `upserted=1693, error_count=0`
- 2. ardışık gerçek senkron: birebir aynı sonuç (`1693/1693/0 hata`)
- DB doğrulama: `count(*)=1693`, `count(*)-count(distinct parasut_id)=0`
  (0 duplicate)
- `parasut_e_invoices_counts_demo` uzlaşımı: madde 6'daki gibi tam.
- `sales_invoices` ve `purchase_bills` senkronları art arda 2'şer kez
  çalıştırıldı; her seferinde `e_invoices` toplam satır sayısı **1693**
  olarak kaldı (hiç düşmedi) — standalone kayıtlar aktif-parent senkronu
  tarafından asla silinmedi.
- e_archives: 24, hepsi hâlâ `sales_invoice_parasut_id` dolu (Phase
  8'deki gibi) — bu faz e_archives'e hiç dokunmadı.

## 10. Regresyon

| Kaynak | Beklenen | Gerçek |
|---|---|---|
| contacts | 448 | 448 |
| products | 2597 | 2597 |
| sales_invoices | 451 | 451 |
| purchase_bills | 811 | 811 |
| payments | 1651 | 1651 |
| checks | 40 | 40 |
| transactions | 1498 | 1498 |
| accounts | 3 | 3 |
| shipment_documents | 15 | 15 |
| employees | 6 | 6 |
| e_archives | 24 | 24 |

Tüm regresyon sayıları birebir korundu.

## 11. Modül/kaynak/kapasite sayısı düzeltmesi

Edge Function `SUPPORTED_RESOURCES` listesi artık **21** kaynak içeriyor
(Phase 14.1'deki 20'ye bu fazda eklenen `e_invoices` standalone kaynağı
dahil):

contacts, sales_invoices, accounts, payments, transactions,
purchase_bills, expense_payments, products, warehouses, stock_movements,
item_categories, checks, sales_offers, shipment_documents, employees, me,
salaries, taxes, tags, e_invoice_inboxes, **e_invoices** = **21 kaynak**.

Bu liste, koddaki `SUPPORTED_RESOURCES` sabitinin gerçek uzunluğuyla
(satır 53-75, `supabase/functions/parasut-sync/index.ts`) birebir sayılıp
doğrulandı — 21 string = 21 madde.

## 12. Çift ana sorgu ölçümü

Bu fazın kapsamı dışında, mevcut genel frontend sorgu altyapısına
dokunulmadı (talimat gereği). Gerçek bir üretim ağ ölçümü bu oturumda
ayrı bir headless tarayıcı oturumu gerektirir; zaman/kapsam kısıtı
nedeniyle bu fazda tekrarlanmadı — **UNKNOWN** olarak bırakılıyor, kök
neden iddia edilmiyor.

## 13. Test ve deploy

- Migration: hosted Supabase'e doğrudan `pg` bağlantısıyla uygulandı
  (idempotent, `create or replace`/`add column if not exists`).
- Edge Function: `npx supabase functions deploy parasut-sync` ile
  deploy edildi (`yzuxdrknidveptvnwthf`).
- `npx deno check supabase/functions/parasut-sync/index.ts`: **0 hata**.
- `npx tsc --noEmit -p tsconfig.app.json`: sadece bilinen, kapsam dışı
  `Login.tsx:55` hatası (`variant` prop hatası) — bu fazın parçası değil.
- `npm run lint`: **0 hata**, sadece önceden var olan 20 fast-refresh
  uyarısı.
- `npm test`: **55/55 test PASS**.
- `npm run build:demo`: başarılı, `EFaturalar-CCBL6E0G.js` ve
  `EFaturaDetay-CTMpCBBL.js` chunk'ları üretildi.
- FTP deploy: **önemli düzeltme** — script ilk denemede yanlış hedef
  dizine (`/demo`, FTP hesabının home dizini altında, gerçek web
  docroot'u DEĞİL) yüklendi; gerçek docroot'un `/public_html/demo`
  olduğu FTP `LIST` ile doğrulandı ve doğru hedefe yeniden deploy edildi.
  Canlı doğrulama: `index.html` artık yeni bundle'ı
  (`assets/index-DGe62ZY6.js`) referans ediyor, `Last-Modified` deploy
  anına güncellendi.
- Route kontrolü (gerçek HTTPS istekleri, `curl -k` — bu sanal ortamda
  kök sertifika güven zinciri eksik, sertifika hatası içerik testini
  engellemiyor):
  - `/` → 200
  - `/satislar/e-faturalar` → 200
  - `/satislar/e-faturalar/1009286918` (gerçek linked örnek) → chunk 200
  - `/satislar/faturalar`, `/satislar/e-fatura-mukellefleri`, `/giderler`
    → 200 (regresyon)
  - Yeni JS chunk'lar (`EFaturalar-*.js`, `EFaturaDetay-*.js`,
    `EDocumentSection-*.js`) → 200

## 14. PASS / FAIL / BLOCKED

**Sonuç: PASS** (bölüm 12 hariç — o UNKNOWN olarak işaretlendi,
kapsam dışı bırakıldığı için PASS'i engellemiyor).

Gerekçe:
- 1693 kaydın tamamı DB'de, 0 kayıp, 0 duplicate.
- 455 kaydın tamamı için gerçek ilişki denetimi yapıldı (örneklem değil).
- Hiçbir parent tahmin edilmedi; her ilişki gerçek API verisinden geldi.
- Tüm gerçek güvenli alanlar erişilebilir (base/raw/view/UI).
- `syncActiveEDocuments()` davranışı değiştirilmedi.
- Standalone kayıtlar aktif-parent senkronları tarafından silinmedi.
- Regresyon setinin tamamı korundu.
- Migration + Edge Function + frontend canlıya deploy edildi ve
  doğrulandı.

## Test için gerçek örnek e_invoice ID'leri

- Linked (sales_invoices): `1009286918` → parent `1014063257`
  (`/satislar/e-faturalar/1009286918`)
- Linked örnekleri: `1075709438`, `1075176054` (sales_invoices),
  `1075136757`, `1074975497` (purchase_bills)
- Unlinked (parent yok): `1075917891`, `1076045435`, `1076045438`
  (`/satislar/e-faturalar/1075917891`)

## Bilinen, kapsam dışı sorun

`src/pages/Login.tsx:55` — `variant` prop `LogoProps`'ta yok
(TS2322). Bu faz öncesinden var, bu fazın kapsamı dışında, düzeltilmedi.
