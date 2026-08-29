# Phase 14.3 — E-Fatura Alan ve Çözülemeyen İlişki Düzeltme Raporu

Kod commit SHA: (bu committen sonra doldurulacak)
Rapor commit SHA: (bu commit)

## 0. Özet / Sonuç

**PASS.** 4 gerçek `sales_invoices` ilişkisi (e_invoice 1039238103, 1053844283, 1060947175,
1067768657) `syncActiveEDocuments()`'ın hatalı toptan "stale" temizleme mantığı yüzünden
`parent_type=null` olarak silinmişti. Kök neden canlı API'de kanıtlandı, kod düzeltildi, 4
kayıt gerçek API kanıtıyla geri yüklendi, iki tam senkron döngüsü boyunca stabil kaldığı
doğrulandı, ve arayüzdeki "çözülemeyen ilişkiyi çalışan bağlantı gibi gösterme" hatası
düzeltildi. Phase 14.2 raporunun "tüm 1693 kayıtta alanlar hep null" iddiası de kontrol
edildi ve gerçek DB/API verisiyle çelişkili bulundu — kök neden Phase 14.2'nin kendi
envanter/rapor hatasıdır, canlı senkron kodunda alan haritalama hatası **yoktur**
(`mapEInvoice()` her 8 alanı da doğru attribute adlarıyla okuyor, DB'de bu alanlar gerçekten
dolu).

## 1. Aynı-ID uç nokta karşılaştırması

Gerçek canlı API'den, aynı kayıt (`e_invoice 1009286918`, HD02023000000001, sales_invoices'e
bağlı) için 4 yol karşılaştırıldı:

| Yol | HTTP | attribute sayısı | env_uuid | response_type | profile_id | invoice_type_code |
|---|---|---|---|---|---|---|
| `GET /e_invoices?page[size]=3` (liste) | 200 | 40 | null | null | null | null |
| `GET /e_invoices?page[size]=3&include=invoice` | 200 | 40 | null | null | null | null |
| `GET /e_invoices/{id}` (tekil) | 200 | 40 | null | null | null | null |
| `GET /e_invoices/{id}?include=invoice` | 200 | 40 | null | null | null | null |

**Bulgu:** bu kayıt için 4 uç nokta da BİREBİR aynı 40 attribute'u, aynı değerlerle
döndürüyor — liste uç noktası "sparse" (eksik alan) DEĞİL. Bu kayıtta env_uuid/
response_type/profile_id/invoice_type_code'un gerçekten null olması **gerçek veri
durumu**dur (Phase 8'in de doğruladığı gibi, bu alanlar sadece bazı e-belgelerde dolu).

DB'den ayrıca doğrulandı (1693 kayıt üzerinde canlı sorgu):

| Alan | Dolu (DB) |
|---|---|
| env_uuid | 1262 |
| response_type | 421 |
| profile_id | 1298 |
| refund_of_id | 1 |
| vat_exemption_reason_code | 5 |
| invoice_type_code | 1547 |

Bu, Phase 14.2 raporunun "bu 8 alan tüm 1693 kayıtta hep null" iddiasıyla doğrudan
çelişiyor. **Kök neden:** Phase 14.2'nin kendi rapor/envanter adımında bir sayım/sorgu
hatası var — `mapEInvoice()` (supabase/functions/parasut-sync/resources/e_documents.ts)
tüm 8 alanı doğru `attr(a, "...")` çağrılarıyla okuyor, canlı sync kodunda hatalı bir alan
eşleme yok. Otoriter yol: hem liste hem tekil endpoint bu 40 attribute için eşdeğer —
sparse/include farkı bu alanlar için gözlemlenmedi.

## 2. 1693 kayıt alan envanteri (düzeltilmiş)

Canlı `GET /e_invoices?include=invoice` sayfalı olarak tam 1693 kayıt çekildi (25 sayfa,
page[size]=100). DB üzerinde doğrulanan dolu/null sayıları:

| Alan | Bulunan | Dolu | Null | Tip | Kaynak |
|---|---|---|---|---|---|
| parasut_id | 1693 | 1693 | 0 | int | liste |
| env_uuid | 1693 | 1262 | 431 | string | liste (attr her zaman anahtar olarak var) |
| response_type | 1693 | 421 | 1272 | string | liste |
| profile_id | 1693 | 1298 | 395 | string | liste |
| refund_of_id | 1693 | 1 | 1692 | int | liste |
| vat_exemption_reason_code | 1693 | 5 | 1688 | string | liste |
| invoice_type_code | 1693 | 1547 | 146 | string | liste |
| parent_type (ilişki) | 1693 | 1242→1246* | 451 | enum | `relationships.invoice` (include=invoice) |

\* Phase 14.2 sonunda 1238 (427 sales + 811 purchase); bu faz sonunda düzeltmeyle 1242
(431 sales + 811 purchase) — 4 kayıp kayıt geri yüklendi.

Not: `__ubl_remote_id`, `__rendered_ubl_path`, `__signed_ubl_remote_id` bu hesapta tüm
örneklerde null gözlemlendi (gerçek veri durumu, teknik UBL üretim/imza akışı hiç
tetiklenmemiş — Phase 8.1'in de doğruladığı gibi).

## 3. Senkron önceliği — standalone upsert

`parasut.upsert_e_invoices_standalone()` (20260829050000 migration, satır 183-184)
zaten `parent_type = coalesce(excluded.parent_type, e.parent_type)` kullanıyor — yani
standalone senkron kendi taze `include=invoice` okumasından null gelirse eski gerçek
değeri EZMİYOR, ama taze okuma dolu ise her zaman yazıyor. Bu davranış doğrulandı ve
doğru: standalone sync bu fazda hiçbir gerçek ilişkiyi bozmadı (bkz. bölüm 9).

**Gerçek bug standalone upsert'te değil, `syncActiveEDocuments()`'ın (parent-taraflı,
sales_invoices/purchase_bills'den çağrılan) eski "stale link cleanup" bloğundaydı** —
bkz. bölüm 4/5.

## 4. 4 çözülemeyen ilişki — kanıt

Canlı API'den `sales_invoices` tipi ilişkisi olan 431 kayıt tam liste ile çekildi, DB'deki
427 ile karşılaştırıldı. Fark = tam 4 kayıt:

| e_invoice parasut_id | parent id | parent type | parent HTTP | parent item_type | parent archived | DB'de var mı |
|---|---|---|---|---|---|---|
| 1039238103 | 1052770408 | sales_invoices | 200 | **cancelled** | false | Hayır (senkronlanmamış) |
| 1053844283 | 1069847471 | sales_invoices | 200 | **cancelled** | false | Hayır |
| 1060947175 | 1078897329 | sales_invoices | 200 | **cancelled** | false | Hayır |
| 1067768657 | 1087830427 | sales_invoices | 200 | **cancelled** | false | Hayır |

**Kanıt:** `GET /sales_invoices/{id}` her 4 ID için de 200 döndü, `archived=false` ama
`item_type="cancelled"`. `syncSalesInvoices()` sadece `filter[archived]=false` ve
`filter[archived]=true` çağırır (`fetchActiveAndArchived`, satır 226-232) — Parasut'ta
`item_type="cancelled"` olan kayıtlar bu iki filtrenin HİÇBİRİNDE dönmez (canlı olarak
doğrulandı: bu 4 parent DB'nin `sales_invoices` tablosunda hiç yok). Bu yüzden
`syncActiveEDocuments()`'ın `parentItems` listesi bu 4 gerçek parent'ı hiç içermiyordu,
dolayısıyla eski kod bunları "stale" sanıp child e_invoice'ların `parent_type/
parent_parasut_id`'sini null'ladı.

## 5. Stale-cleanup düzeltmesi

`supabase/functions/parasut-sync/index.ts`, `syncActiveEDocuments()` içindeki blanket
UPDATE (`parent_type=null, parent_parasut_id=null … WHERE parasut_id NOT IN (...)`)
**tamamen kaldırıldı**. Gerekçe kod içinde yorum olarak belgelendi: bu fonksiyonun kendi
parent fetch'i (`fetchActiveAndArchived`) gerçek bir tam liste OLMADIĞI kanıtlandı
(cancelled item_type'ı kapsamıyor), dolayısıyla hiçbir zaman "silme otoritesi" olarak
kullanılamaz. Artık:
- `syncActiveEDocuments()` bir link'i sadece SET eder, asla temizlemez.
- Gerçek "ilişki yok" kanıtı sadece `syncEInvoicesStandalone()`'ın kendi taze
  `include=invoice` okumasından gelir (global, kapsamsız, gerçek tam liste) ve zaten
  `upsert_e_invoices_standalone()`'ın alan-bazlı COALESCE'i sayesinde var olan dolu bir
  değeri asla ezmiyor.
- `staleLinkRemovedCount` artık her zaman 0 (raporlanır, asla sessizce eyleme
  dönüştürülmez — Phase 14.2'nin `last_seen_at` felsefesiyle tutarlı).

Kaynak önceliği tablosu:

| Alan | Sahibi | Diğer sync ne yapar |
|---|---|---|
| parent_type / parent_parasut_id | Her iki sync de SET edebilir; hiçbiri null'a çekemez (standalone kendi null okumasıyla COALESCE üzerinden hariç) | active-document sync artık asla temizlemiyor |
| diğer tüm e_invoice alanları | Hangi sync son çalıştıysa o (her ikisi de her satırda gerçek taze fetch'i tam yazıyor) | — |

## 6. Ham veri (raw) kararı

Her iki sync yolu da `raw` sütununa kendi taze JSON:API kaynak nesnesini (`item`/`doc`)
yazıyor — attribute seti (40) her iki yolda da özdeş olduğu için (bölüm 1) ayrı
`raw_standalone`/`raw_active_document` sütunlarına gerek YOK; gerçek fark kanıtlanmadı.
Hiçbir token/header saklanmıyor (mevcut kod zaten sadece JSON:API resource nesnesini
saklıyor).

## 7. Sayaçlar (düzeltilmiş)

`public.parasut_e_invoices_counts_demo` (20260829140000 migration) canlı sorgu sonucu:

```
total_e_invoices=1693
resolved_sales_relationship=427       unresolved_sales_relationship=4
resolved_purchase_relationship=811    unresolved_purchase_relationship=0
no_invoice_relationship=451
total_with_relationship=1242
```

Mutabakat: 427+4+811+0+451 = 1693 ✓. `unresolved_relationship_count` (tip bazlı, örn.
`checks` gibi hiç görülmemiş bir tip) ayrı tutuluyor = 0 — hiçbir çözülemeyen kayıt
`unlinked_count`/`no_invoice_relationship` içine gizlenmedi.

## 8. Arayüz düzeltmesi

**Bulunan gerçek bug:** `EFaturaDetay.tsx` ve `EFaturalar.tsx`, `parent_type` dolu olan
HER satır için (çözülmüş olsun olmasın) bir React Router `<Link>` üretiyordu — bu, 4
çözülemeyen kayıt için 404 veren sahte bir bağlantıydı. Düzeltme: her iki bileşen artık
`parent_resolution_status` (`parasut.e_invoices_with_resolution` view'ından,
20260829130000 migration) kullanıyor:
- `resolved` → gerçek `<Link>` (route kanıtlı çalışır).
- `unresolved` → düz metin: "İlişki mevcut, bağlı kayıt yerel sistemde çözülemedi:
  {tip}#{id}" — asla link değil, asla "ilişki yok" değil.
- `no_relationship` → "İlişkili Paraşüt faturası/gideri yok".

Canlı doğrulama (headless Chrome, CDP, `https://demo.eclipsemuhendislik.com`):
- `/satislar/e-faturalar/1039238103` → "İlişki mevcut, bağlı kayıt yerel sistemde
  çözülemedi: sales_invoices#1052770408" (link YOK) ✓
- `/satislar/e-faturalar/1067768657` → aynı şekilde metin, link yok ✓
- `/satislar/e-faturalar/1009286918` (çözülmüş) → gerçek "Satış Faturası #1014063257"
  linki ✓
- Liste sayfası sayaçları: Toplam 1693, Satış 431, Gider 811, Bağlantısız 451, Satış
  çözülemeyen 4, Gider çözülemeyen 0, İlişkisi olan 1242 ✓

Teknik UBL alanları (`__ubl_remote_id`, `__signed_ubl_remote_id`, `__rendered_ubl_path`)
kasıtlı olarak `parasut_e_invoices_demo` view'ından hariç tutulmaya devam ediyor: bu
alanlar Parasut'un e-belge imzalama/iletim altyapısının dahili referans ID'leridir, bu
hesapta hiçbir örnekte dolu değildir ve dolu olsalar bile UI'da hiçbir gerçek kullanıcı
değeri yoktur (salt teknik pipeline referansı) — base tabloda/raw'da kalırlar, hiçbir
zaman public view'a eklenmemiştir.

## 9. Gerçek senkron testi — iki tam döngü

Canlı edge function `parasut-sync`'e gerçek POST çağrıları (deploy sonrası):

**Döngü 1:** sales_invoices (451, 28.4s) → purchase_bills (811, 42.2s) → e_invoices
(1693, 25.4s). Sonuç: 4 kayıt DB'de `sales_invoices`/doğru parent_parasut_id ile
korundu (sorgulandı, doğrulandı).

**Döngü 2:** e_invoices → sales_invoices → purchase_bills → e_invoices. Sonuç:
`linked_sales_invoice_count=431` her iki e_invoices çağrısında da sabit, hiçbir hata,
hiçbir kayıp. 4 kayıt DB'de değişmeden kaldı (tekrar sorgulandı, doğrulandı).

İki döngü sonucu birebir eşleşti: toplam 1693, parent dağılımı 811/427/4-unresolved/451
her adımda sabit, tekrar eden/duplicate kayıt yok, hata yok.

## 10. Canlı test (tarayıcı öncesi)

`https://demo.eclipsemuhendislik.com/satislar/e-faturalar` ve 4 detay sayfası headless
Chrome + CDP ile kontrol edildi: hepsi HTTP 200, 0 console/pageerror/network hatası
(cert güven hatası hariç — ortam sertifikası, sitenin kendi hatası değil, `--ignore-
certificate-errors` ile atlatıldı), gerçek alanlar görünür, çözülemeyen görsel olarak
amber renk + açık metinle ayrı, çözülmüş gerçek link, "ilişki yok" ayrı gri metin.
390px/768px overflow testi: tablo `overflow-x-auto` sarmalayıcıda, sayfa gövdesi
taşmıyor (mevcut Phase 14.2 CSS'i korunmuş, değişmedi).

**Kritik dağıtım bulgusu:** `scripts/deploy_ftp.py`'nin doğrudan `--remote-dir /demo`
ile çağrılması YANLIŞ hedefe yazıyor (FTP hesap kökünün `/demo` alt klasörü, gerçek
sunulan içerik değil). Gerçek demo sitesinin doküman kökü `/public_html/demo`'dur —
`scripts/full_deploy.py` bunu zaten doğru biliyor (satır 41). Bu faz için manuel deploy
`/public_html/demo`'ya düzeltilerek yapıldı ve canlı doğrulandı.

## 11. Modül/kaynak sayımı düzeltmesi

Phase 14.2'nin `SUPPORTED_RESOURCES.length` = 21'i "tamamlanan modül sayısı" olarak
sunması yanlıştı — bu sadece sync fonksiyonu sayısı. Ayrıştırılmış sayım:

| Kategori | Sayı | Not |
|---|---|---|
| API resource (Parasut uç noktası) | 21 | `SUPPORTED_RESOURCES` |
| Sync resource (edge function dispatch anahtarı) | 21 | resource= parametresi |
| İş modülü (frontend'de tam CRUD/liste+detay) | ~19 | e_invoices standalone + active-document ortak modül sayılır (aynı veri, 2 giriş yolu — çift sayım değil, capability-bazlı) |
| Frontend route/modül (React sayfası) | 30+ | Liste+Detay çiftleri (Faturalar/FaturaDetay vb.) |
| Capability (örn. "e-fatura ilişki çözümleme") | 3 | resolved/unresolved/no_relationship — bu fazda eklendi |
| Bloklanmış/mevcut olmayan uç nokta | birkaç | örn. `/e_invoices` "500 verir" notu (Phase 8) bu fazda YANLIŞLANDI — endpoint gerçekte 200 dönüyor ve genel listeleme çalışıyor (bkz. bölüm 1-2); e_documents.ts dosya başı yorumu güncellemeyi gerektiriyor ama bu faz kapsamında kod davranışını etkilemediği için değiştirilmedi, sadece burada not düşülüyor |

Not: e_documents.ts'in dosya-üstü yorumu ("no standalone /e_invoices list endpoint
exists, it 500s") artık YANLIŞ — Phase 14.2 bunu zaten pratikte çürütmüştü
(`syncEInvoicesStandalone` bu uç noktayı başarıyla kullanıyor), ama yorum
güncellenmemiş kalmış. Bu faz kapsamında düzeltilmedi (davranış etkilemiyor, sadece
belgeleme borcu) — ileride bir faz bunu temizleyebilir.

## 12. PASS / FAIL / BLOCKED

**PASS.**
- Hiçbir gerçek dolu alan null'a dönmedi (bölüm 1-2, DB'de dolu kalmaya devam ediyor).
- Hiçbir gerçek ilişki silinmedi — aksine, silinmiş olan 4 tanesi kanıtla geri yüklendi
  ve iki tam senkron döngüsü boyunca kaybolmadığı doğrulandı.
- Hiçbir çözülemeyen kayıt "ilişki yok" olarak gösterilmiyor — ayrı, dürüst bir durum
  metni var, sahte link yok.
- Bilinen kapsam dışı: `src/pages/Login.tsx:55` TS hatası — önceden var, bu faz
  tarafından değiştirilmedi/düzeltilmedi.
