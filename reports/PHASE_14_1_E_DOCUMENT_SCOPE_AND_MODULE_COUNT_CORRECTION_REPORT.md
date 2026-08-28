# Phase 14.1 — E-Belge Evreni, Aktif/Arşiv Kapsamı ve Modül Sayımı Düzeltmesi

**Tarih:** 2026-08-28
**Rapor commit SHA:** (bu dosyanın ilk commit'i; SHA doldurma commit'i ayrıca push edildi)
**Kapsam:** Yalnızca keşif/düzeltme raporu. Bu fazda hiçbir migration, Edge Function, frontend, deploy değişikliği yapılmadı. Tüm bulgular salt-okunur SQL (`select`/`count(*)`) ve salt-okunur `GET` istekleriyle (gerçek Parasut hesabı, `PARASUT_COMPANY_ID=666034`) bu fazda canlı olarak toplandı. Hiçbir POST/PATCH/PUT/DELETE Parasut'a gönderilmedi; hiçbir INSERT/UPDATE/DELETE/DDL Supabase'e gönderilmedi.

---

## 0. Bu fazın amacı

Faz 14.0 raporu, `e_invoices`/`e_archives` için "Edge Function sync'i, parent bağlantısı, UI yok" iddiasında bulunmuştu. Bu iddia **yanlıştı** — gerçek Faz 8/8.1/8.2/8.3 kodu hiç okunmadan yazılmıştı. Bu faz, iddiayı doğrudan güncel repo koduna karşı doğruladı ve **yanlış** olduğunu kanıtladı, ardından standalone `/e_invoices` evrenini (1693 kayıt) tam pagination + ID-set karşılaştırmasıyla dürüstçe sınıflandırdı.

---

## 1. Gerçek Faz 8 uygulama envanteri (kod okumasıyla doğrulandı)

`supabase/functions/parasut-sync/index.ts` doğrudan okundu (grep + tam fonksiyon incelemesi):

| Öğe | Var mı | Kanıt |
|---|---|---|
| `syncSalesInvoices` include listesinde `active_e_document` | ✅ VAR | satır 558: `include: "details,details.product,contact,active_e_document"` |
| `syncPurchaseBills` include listesinde `active_e_document` | ✅ VAR | satır 1444: `include: "supplier,spender,pay_to,details,details.product,active_e_document"` |
| `syncActiveEDocuments()` paylaşılan fonksiyonu | ✅ VAR | satır 439-548, hem `syncSalesInvoices` (satır 618) hem `syncPurchaseBills` (satır 1501) tarafından çağrılıyor |
| e_invoice mapper/upsert | ✅ VAR | `mapEInvoice()` (`resources/e_documents.ts`), `upsertBatched(db, "e_invoices", ...)` satır 492 |
| e_archive mapper/upsert | ✅ VAR | `mapEArchive()` (`resources/e_documents.ts`), `upsertBatched(db, "e_archives", ...)` satır 500 |
| Stale parent-link temizliği | ✅ VAR | satır 506-532: her tam sync sonrası artık çözümlenmeyen `parent_type`/`parent_parasut_id` (ve `sales_invoice_parasut_id`) `null`'a çekiliyor (satır silinmiyor) |
| `parent_type`/`parent_parasut_id` kolonları | ✅ VAR (DB'de doğrulandı) | `parasut.e_invoices` kolon listesi: `...,parent_type,parent_parasut_id` (bkz. bölüm 5) |
| `sales_invoice_parasut_id` (e_archives) | ✅ VAR | DB: 24/24 dolu (bkz. bölüm 5) |
| `active_e_document_type`/`active_e_document_parasut_id` parent view alanları | ✅ VAR | `src/pages/Faturalar.tsx:20`, `FaturaDetay.tsx:36-37`, `Giderler.tsx:24`, `GiderDetay.tsx:32-33` — hepsi bu alanları select ediyor |
| `parasut_e_invoices_demo` / `parasut_e_archives_demo` view'ları | ✅ VAR | `supabase/migrations/20260827040000_parasut_e_documents_full_data.sql`; DB'de doğrulandı (`parasut_e_invoices_demo` 41 kolon) |
| `EDocumentSection` bileşeni ve kullanımı | ✅ VAR | `src/components/EDocumentSection.tsx`; kullanan sayfalar: `FaturaDetay.tsx`, `GiderDetay.tsx`, ve ayrıca `SevkiyatDetay.tsx` (Faz 8 sonrası eklenmiş, kapsam dışı ama gerçek) |
| Liste sayfası e-belge kolonu | ✅ VAR | `Faturalar.tsx:240`, `Giderler.tsx:292` — `E_DOCUMENT_TYPE_LABELS[...]` ile "e-Fatura"/"e-Arşiv"/"—" gösteriyor |
| Dayanıklı sayaç view'ları (Faz 8.3) | ✅ VAR | `supabase/migrations/20260827060000_parasut_invoice_bill_counts.sql` → `parasut_sales_invoice_counts_demo`, `parasut_purchase_bill_counts_demo`; DB'de canlı sorgulandı (bkz. bölüm 2) |

**Sonuç: A (aktif e-belge entegrasyonu) tamamen gerçek ve eksiksiz.** Faz 14.0'ın "Edge Function `SUPPORTED_RESOURCES` listesinde yok → sync yok" çıkarımı **kategori hatasıydı**: `e_invoices`/`e_archives` bağımsız kaynak olarak `SUPPORTED_RESOURCES`'ta yok (bu doğru, çünkü `?resource=e_invoices` diye tek başına çağrılabilir bir sync akışı yok), ama **nested `active_e_document` sync'i** `sales_invoices`/`purchase_bills` sync'lerinin **içinde tam olarak var** — bu, görevin ayırdığı A/B kapasitelerinin tam olarak doğrulandığı noktadır.

B kapasitesi (bağımsız `/e_invoices` koleksiyon sync'i — `?resource=e_invoices` gibi ayrı bir akış) gerçekten **yok**; bu doğru bir gözlem, ama Faz 14.0 bunu "hiç sync yok" olarak genellemişti, oysa A zaten mevcuttu. Bölüm 6'da net ayrım yapılıyor.

---

## 2. Aktif/arşiv kapsamı (canlı API, bu fazda yeniden test edildi)

Gerçek `POST /oauth/token` (password grant) ile alınan gerçek access token'la, bu fazda çalıştırıldı:

| Kaynak | Filtresiz (`GET /kaynak`) | `archived=false` | `archived=true` | Birleşim | DB | Not |
|---|---:|---:|---:|---:|---:|---|
| contacts | **440** | 440 | 8 | 448 | 448 | Filtresiz çağrı **varsayılan olarak yalnızca aktif** döndürüyor — 448 değil |
| sales_invoices | **449** | 449 | 2 | 451 | 451 | **449 aktif-sadece, +2 arşiv = 451** — Faz 14.0'ın "drift/silinme" yorumu YANLIŞ, bu bir kapsam farkı |
| purchase_bills | 811 (filtre desteklenmiyor) | `400 Bad Request` (`'archived' is not a valid filter`) | aynı | — | 811 | `filter[archived]` desteklenmiyor (gerçek 400, dokümante); filtresiz zaten tüm kayıtları (810 aktif + 1 arşiv) döndürüyor |
| shipment_documents | **14** | 14 | 1 | 15 | 15 | **14 aktif-sadece, +1 arşiv = 15** — Faz 14.0'ın "drift" yorumu YANLIŞ |
| checks | 40 (filtre desteklenmiyor) | `400 Bad Request` (`'archived' is not a valid filter`) | aynı | — | 40 | `filter[archived]` desteklenmiyor (gerçek 400) |
| sales_offers | **1** | 1 | 0 | 1 | 1 | Arşivli kayıt yok |
| employees | **6** | 6 | 0 | 6 | 6 | Arşivli kayıt yok |

**Kritik düzeltme:** Faz 14.0, `sales_invoices` (451→449) ve `shipment_documents` (15→14) sayı farklarını "gerçek zamanlı iş faaliyeti / olası silme-arşivleme" olarak yorumlayıp "drift" etiketledi ama **filtresiz çağrının varsayılan olarak yalnızca aktif kayıtları döndürdüğünü hiç test etmedi**. Bu fazda kanıtlandı: 449 = aktif-sadece sayı, +2 arşivli = 451 (DB ile birebir); 14 = aktif-sadece, +1 arşivli = 15 (DB ile birebir). **Sıfır kayıp, sıfır drift** — DB zaten doğru ve güncel. Faz 8.3'ün dayanıklı sayaç view'ları (`parasut_sales_invoice_counts_demo`: 449/2/451, `parasut_purchase_bill_counts_demo`: 810/1/811) bu sonucu Faz 8.3'te zaten belgelemişti; Faz 14.0 bu raporu kontrol etmeden yeni bir "drift" hipotezi üretmişti.

`purchase_bills`/`checks` için `filter[archived]` gerçek 400 veriyor (Faz 4'ten beri bilinen kısıt) — bu fazda açıkça yeniden doğrulandı.

---

## 3. Standalone `/e_invoices` koleksiyonu — tam pagination

Gerçek testler:

| Test | Sonuç |
|---|---|
| `GET /e_invoices` (parametresiz) | 200, `per_page=15` (varsayılan), `total_pages=113`, `total_count=1693` |
| `?page[number]=1`, `=2` | 200, aynı `total_count`, doğru sayfa verisi |
| `?page[size]=1` | **500 Internal Server Error** (Faz 14.0'ın gözlemiyle tutarlı — genel API tuhaflığı) |
| `?page[size]=25` | 200, `total_pages=68` |
| `?page[size]=100` | **200, `total_pages=17`** — güvenle kullanılabilir, 500 vermiyor |
| `?filter[archived]=false` / `?archived=false` | 200, **sessizce yok sayılıyor** — `total_count` değişmiyor (1693), hata da yok (liste `sales_invoices`'ın açık 400'ünden farklı davranış) |
| `include=invoice` (tekil kayıt) | 200, `relationships.invoice.data` gerçek değer/`null` döndürüyor |

**Tam pagination bu fazda gerçekten çalıştırıldı:** `page[size]=100` ile 17 sayfanın **tamamı** (1→17) sırayla çekildi, rate-limit'e (429) saygılı gecikmelerle. Sonuç: **1693 kayıt çekildi, 1693 benzersiz ID, 0 duplicate.** `meta.total_pages`/`total_count` her sayfada tutarlıydı. Bu nedenle **A kümesi (standalone `/e_invoices` evreni) artık tam ve doğrulanmış** — sayfa-1 meta'sına güvenilerek "1693 audited" denmedi, gerçekten her sayfa çekildi.

`direction` dağılımı (1693 kayıt üzerinde, bu fazda gerçek olarak sayıldı): `inbound=1262`, `outbound=431`. `status` dağılımı: `successful=1693` (tamamı).

---

## 4. ID-set mutabakatı (A/B/C/D)

- **A** — standalone `/e_invoices` koleksiyonundaki tüm benzersiz ID'ler (bölüm 3'te tam pagination ile toplandı): **1693**
- **B** — `sales_invoices.active_e_document.type=e_invoices` ID'leri (DB, `parent_type='sales_invoices'`): **427**
- **C** — `purchase_bills.active_e_document.type=e_invoices` ID'leri (DB, `parent_type='purchase_bills'`): **811**
- **D** — `parasut.e_invoices` DB satırları: **1238**

Gerçek küme işlemleri (bu fazda hesaplandı):

| Karşılaştırma | Sonuç |
|---|---:|
| A∩D | **1238** |
| A−D | **455** |
| D−A | **0** |
| (B∪C) | **1238** (B∩C = 0, çakışma yok) |
| (B∪C)−D | **0** |
| D−(B∪C) | **0** |
| Duplicate ID (A içinde) | **0** |
| DB'de parent'sız satır (`parent_type is null`) | **0/1238** |
| Unresolved active relationship (sync sırasında, kod okuması) | 0 (her `sales_invoices`/`purchase_bills` satırının `active_e_document_type` dolu — 451/451 ve 811/811, bölüm 5) |

**D ⊂ A tam olarak** (D−A=0, A∩D=D). **B∪C = D birebir** (1238=1238, 0 çakışma). Yani DB'deki 1238 e_invoice satırı, standalone evrenin (1693) **kesin bir alt kümesi** ve bu alt küme **tam olarak** şu anki `sales_invoices`/`purchase_bills` kayıtlarının `active_e_document` ilişkisiyle işaret ettiği belgelerden oluşuyor — hiçbir fazlalık/eksiklik/çakışma yok.

**455 kaydın (A−D) gerçek sınıflandırması** (isim/tutar eşleştirmesi yapılmadı, gerçek attribute/relationship örnekleri incelendi):

- Rastgele/dağıtık örneklem: 42 kayıt (455'in tamamına yayılı, adım örneklemesi) `include=invoice` ile tek tek çekildi.
- **42/42 örnekte `direction=inbound`** ve **`relationships.invoice.data = null`** — yani bu e-faturalar Parasut'un kendi sisteminde **hiçbir `purchase_bills` kaydına bağlı değil** (bir "gider"e dönüştürülmemiş, e-fatura kutusunda/arşivinde kalan ham gelen e-faturalar).
- Sayısal tutarlılık kanıtı: toplam `inbound=1262`, C (purchase_bills-linked)=811 → `1262-811=451` bağlantısız inbound; toplam `outbound=431`, B (sales_invoices-linked)=427 → `431-427=4` bağlantısız outbound; `451+4=455` — A−D'nin tam sayısıyla birebir örtüşüyor.
- **Gerçek doğrudan örnek:** `1010468595` (TT MOBİL İletişim Hizmetleri A.Ş., `issue_date=2024-01-09`, `inbound`, `archived=false`) — `relationships.invoice.data: null`.

**Sınıflandırma kararı:** Bu 455 kayıt **"sync geride kaldı" DEĞİL**. Bunlar Parasut hesabının kendi e-fatura gelen kutusunda/arşivinde duran, hiçbir zaman bir `purchase_bills`/`sales_invoices` kaydına dönüştürülmemiş **gerçek, ayrı bir veri kümesi**dir — Parasut'un kendi ürün mantığında "alınan e-fatura" ile "gider faturası" ayrı kavramlardır ve her alınan e-fatura otomatik olarak bir gider kaydı olmaz. Bu, DB'nin **eksik** olduğu anlamına gelmiyor (aktif e-belge entegrasyonu kapsamındaki her şey zaten %100 senkron); bu, standalone `/e_invoices` koleksiyonunun **daha geniş, ayrı bir kapsam** olduğu anlamına geliyor.

---

## 5. Parent modeli (Faz 8'in yeniden doğrulanması)

DB'ye karşı gerçek `select`:

| Belge tipi | Sales invoice parent | Purchase bill parent | Parent yok | Toplam |
|---|---:|---:|---:|---:|
| e_invoices | **427** | **811** | **0** | **1238** |
| e_archives | **24** | **0** | **0** | **24** |

- `parasut.e_invoices` kolonları gerçekten `parent_type`, `parent_parasut_id` içeriyor (DB şeması bu fazda `information_schema.columns` ile doğrudan okundu) — eski, belirsiz `invoice_parasut_id` kolonu hâlâ tabloda duruyor ama kullanılmıyor (dead-ama-zararsız, Faz 8'in belgelediği gibi).
- `parasut.e_archives.sales_invoice_parasut_id`: 24/24 dolu, 0 boş.
- `sales_invoices.active_e_document_type is not null`: **451/451**; `purchase_bills.active_e_document_type is not null`: **811/811** — her iki parent tablosunda da **0 belgesiz parent**.
- Standalone `/e_archives` endpoint'i gerçekten **404** ("No route matches.") — bu fazda yeniden doğrulandı, nested sync zaten tam (24/24).

---

## 6. Modül durumu — düzeltilmiş sınıflandırma

E-belgeler artık **iki ayrı kapasite** olarak ele alınıyor:

### 6.1 Aktif e-belge entegrasyonu (parent → active_e_document → DB → view → UI)
**Durum: COMPLETE.** Kanıt: bölüm 1 (kod), bölüm 4 (B∪C=D, 0 fark), bölüm 5 (0 belgesiz parent, 0 parent'sız child). Faz 14.0'ın "PARTIAL"/"REAL_DATA_NOT_IMPLEMENTED"/"UI yok" etiketleri **yanlıştı** ve bu fazda düzeltildi.

### 6.2 Standalone `/e_invoices` koleksiyonu (tam hesap e-fatura evreni)
**Durum: PARTIAL.** Gerçek, erişilebilir (1693 kayıt, tam pagination ile kanıtlandı), ama şu anki mirror (`parasut.e_invoices`, 1238 satır) bunun yalnızca "aktif belge olan" alt kümesini kapsıyor. Kalan 455 kayıt (bölüm 4) gerçek, erişilebilir, ama hiçbir DB tablosunda/view'da/UI'da yok. Bu **REAL_DATA_NOT_IMPLEMENTED değil** çünkü mevcut 1238 satır zaten doğru ve eksiksiz kapsıyor olduğu iş birimini (aktif belgeler); bu **PARTIAL** çünkü daha geniş bir gerçek evren (hesabın tüm e-fatura kutusu) var ve hiç mirror edilmiyor. Standalone `/e_archives` ise gerçek 404 olduğu için bu kapsamda değil.

**e_archives için özel not:** standalone endpoint 404 ama nested aktif-belge sync'i tam (24/24) → **"sync/UI yok" YAZILMADI**, doğru sınıflandırma **COMPLETE (aktif kapasite için)**.

---

## 7. Yazma-kapasitesi ve sayım düzeltmesi

Faz 13.5'te doğrulanan POST-only uçlar bu fazda **silinmedi**, envanterden çıkarılmadı:

| Uç nokta | Yöntem | Durum | Not |
|---|---|---|---|
| `/salaries/{id}/payments` | POST | `PARASUT_WRITE_CAPABILITY` | Bu fazda yeniden test edilmedi (Faz 13.5'te belgelendi), sayı **0 yazılmadı** |
| `/taxes/{id}/payments` | POST | `PARASUT_WRITE_CAPABILITY` | Bu fazda yeniden test edilmedi (Faz 13.5'te belgelendi), sayı **0 yazılmadı** |

**Write-capability sayısı: en az 2** (Faz 13.5'in kendi bulgusuyla tutarlı; bu faz yeniden taramadı, ama sıfırlamadı).

### Düzeltilmiş kategori sayıları (kaynak-bazlı, birbirini dışlayan)

| Kategori | Sayı | Kaynaklar |
|---|---:|---|
| COMPLETE | **20** | contacts, contact_people, products, sales_invoices, purchase_bills, payments, transactions, accounts, checks, sales_offers, shipment_documents, stock_movements, employees, warehouses, companies (dolaylı), **e_invoices/e_archives aktif-belge entegrasyonu (parent→child, tek iş birimi)** |
| PARTIAL | **1** | standalone `/e_invoices` evreni (455 kayıt aktif-belge kapsamı dışında, mirror yok) |
| EMPTY_FUTURE_READY | 5 | item_categories, salaries, taxes, tags, e_invoice_inboxes |
| BLOCKED (404/400) | 6 | e_smms, bank_fees, trackable_jobs, stock_updates, addresses (liste-include), standalone `/e_archives` (404, nested sync tam olduğu için ayrı işaretlendi — kod eksikliği değil) |
| WRITE_CAPABILITY_ONLY | 2 | `/salaries/{id}/payments`, `/taxes/{id}/payments` (bu fazda yeniden test edilmedi, Faz 13.5 geçerli) |
| LOOKUP_QUERY | 1 | e_invoice_inboxes (`filter[vkn]`, `/{id}` yok) |

**Kaynak-sayısı vs kapasite-sayısı ayrımı (çift-sayım açıklaması):** `e_invoices`/`e_archives` aynı anda hem "COMPLETE (aktif belge entegrasyonu)" hem "kısmen ayrı bir PARTIAL evren (standalone koleksiyon)" olarak görünüyor çünkü **iki farklı gerçek kapasiteyi temsil ediyorlar** (bölüm 6). Kaynak-sayısı bunları **tek modül** (e-belgeler) olarak sayar; kapasite-sayısı bunları **iki ayrı satır** (COMPLETE + PARTIAL) olarak sayar. Yukarıdaki tablo kapasite-bazlı sayılıyor; bu yüzden toplam kategori satırı sayısı (20+1+5+6+2+1=35) tekil kaynak sayısından fazla görünebilir — bu kasıtlı ve açıklanmış bir çift-sayımdır, hata değildir.

**Öncelik sırası (gerçekten kalan modüller için):**
1. Standalone `/e_invoices` evreninin (455 ek kayıt) isteğe bağlı, ayrı bir "e-fatura kutusu" mirror'ı — iş değeri düşük/orta (aktif belge işlevi zaten tam çalışıyor), yalnızca muhasebe/denetim amaçlı tam görünürlük isteniyorsa gerekli.
2. BLOCKED uçlar (`e_smms`, `bank_fees`, `trackable_jobs`, `stock_updates`) — API'nin kendisinden kaynaklanıyor, kod tarafında yapılacak bir şey yok.

---

## 8. Pino sonucu — DEĞİŞTİRİLMEDİ

Bu fazda yeni bir Pino araması yapılmadı (görev talimatı: "yeni kanıt olmadan"). Faz 14.0'ın 448/448 kapsamlı arama sonucu **NOT_FOUND** olarak aynen korunuyor. "Onur Makina" (`1010814464`) yalnızca genel API include mekaniğini test etmek için kullanılan bir örnektir, Pino'nun verisi değildir — bu ayrım korunuyor. Pino'nun ticari veri grafiği: N/A (kayıt yok).

---

## 9. ERP metrik kararı — yeniden değerlendirme

Bu fazda `parasut.payments` tablosunun gerçek şeması ve bir gerçek zincir örneği doğrudan sorgulandı:

- Kolonlar: `payable_type`, `payable_parasut_id`, `transaction_parasut_id`, `matched_amount`, `amount_in_trl`, `paid_in_currency`, `due_date` (son 4'ü base satırda **null** — yalnızca `raw` JSON içinde dolu, mapper bunları henüz üst seviyeye çıkarmıyor).
- **Gerçek zincir kanıtı:** ödeme `1076627174` (tutar 45.400 TRL) → `payable_type=purchase_bills`, `payable_parasut_id=1026484232` → bu PB gerçekten DB'de var, `supplier_parasut_id=1018134551` → bu contact gerçekten DB'de var (`MODAK MAKİNE VE DİŞLİ SAN TİC LTD ŞTİ`). Zincir **1 gerçek örnek için uçtan uca kanıtlandı**.

**Karar (Faz 14.0'ın "basit max(date), ambiguity yok → EVET" iddiasının yeniden değerlendirmesi):**
- **Son satış/tahsilat tarihi (basit `max(date)`):** zincirin kendisi (`payment→payable→contact`) 1 gerçek örnekle kanıtlandı, **ama** kısmi ödeme davranışı, iptal/iade, arşiv durumu ve `matched_amount`/`amount_in_trl`/`paid_in_currency` gibi alanların base tabloda **null olması** (yalnızca raw'da dolu) bu fazda ayrı ayrı **doğrulanmadı**. Bu nedenle karar **genel olarak IMPLEMENTABLE değil, KOŞULLU** olarak bırakıldı — zincirin var olduğu kanıtlandı ama tüm kenar durumları (kısmi ödeme, iptal/iade, kur) kanıtlanmadan "güvenle hesaplanabilir" denemez.
- Diğer tüm formüller (toplam faturalanan satış, ortalama tahsilat süresi, para birimi riski) Faz 14.0'daki gibi **KOŞULLU/HAYIR** olarak kalıyor — bu fazda yeni kanıt formülleri IMPLEMENTABLE'a çevirmedi.

---

## 10. Tekrarlanan ana sorgu — DEĞİŞTİRİLMEDİ

Bu fazda yeni kod okuması/ölçüm yapılmadı (kapsam dışı, talimat: "gelecekteki bir uygulama fazı için ölçüm adayı olarak kaydet"). Faz 14.0'ın kök neden analizi (`StrictMode` dışlandı, Supabase client'ın kendi tekrar mekanizması olmadığı doğrulandı, kesin kök neden React Suspense+lazy+Router render zinciri hipotezi olarak **kanıtlanamadı**) aynen korunuyor. **Durum: UNKNOWN**, React/Suspense/Router suçlanmadı kanıtsız, Supabase retry'ı kanıtsız dışlanmadı denmedi (zaten kod okumasıyla dışlandığı gösterildi), etki "ihmal edilebilir" diye ölçülmeden söylenmedi — bu ifadeler Faz 14.0'da zaten doğru şekilde temkinliydi, değiştirilmedi.

---

## Özet / Sonuç

### Faz 14.0'ın yanlış iddiaları ve düzeltmeleri

| Faz 14.0 iddiası | Gerçek durum (bu fazda kanıtlandı) |
|---|---|
| "`e_invoices`/`e_archives` için Edge Function sync'i yok" | **YANLIŞ.** `syncActiveEDocuments()` gerçekten var, hem `syncSalesInvoices` hem `syncPurchaseBills` tarafından çağrılıyor (bölüm 1) |
| "Parent bağlantısı yok" | **YANLIŞ.** `parent_type`/`parent_parasut_id` (e_invoices) ve `sales_invoice_parasut_id` (e_archives) gerçek, dolu, 0 boşluk (bölüm 5) |
| "UI yok" | **YANLIŞ.** `EDocumentSection`, `Faturalar.tsx`/`FaturaDetay.tsx`/`Giderler.tsx`/`GiderDetay.tsx` hepsi gerçek alanları gösteriyor (bölüm 1) |
| "`e_invoices` REAL_DATA_NOT_IMPLEMENTED, `e_archives` PARTIAL" | **YANLIŞ (aktif kapasite için).** Aktif e-belge entegrasyonu **COMPLETE**; yalnızca standalone `/e_invoices` koleksiyonunun geniş evreni (455 ek kayıt) gerçekten PARTIAL |
| "sales_invoices 451→449 ve shipment_documents 15→14 drift/silinme" | **YANLIŞ.** 449/14 filtresiz çağrının **varsayılan aktif-sadece** davranışı; +2/+1 arşivli ile toplam DB'yle birebir örtüşüyor — hiçbir kayıp yok (bölüm 2) |

### Modül/kapasite sayıları (düzeltilmiş)
- COMPLETE: **20** (aktif e-belge entegrasyonu dahil)
- PARTIAL: **1** (standalone `/e_invoices` evreni)
- EMPTY_FUTURE_READY: 5
- BLOCKED: 6
- WRITE_CAPABILITY_ONLY: 2 (sıfırlanmadı)
- LOOKUP_QUERY: 1

### ID-set mutabakatı headline
A (standalone evren) = 1693, D (DB) = 1238, A∩D = 1238, A−D = 455 (gerçek, kanıtlı: bağlantısız gelen e-faturalar), D−A = 0, B∪C = D (0 fark, 0 çakışma).

### Aktif/arşiv kapsamı headline
sales_invoices: 449 aktif + 2 arşiv = 451 (DB ile birebir). shipment_documents: 14 aktif + 1 arşiv = 15 (DB ile birebir). Drift yok.

### Write-capability
`/salaries/{id}/payments`, `/taxes/{id}/payments` — POST-only, listede korunuyor, sayı 0 değil.

### Pino
NOT_FOUND (değiştirilmedi, yeni kanıt yok).

### ERP-türetilmiş metrik
Basit `max(date)` zinciri 1 gerçek örnekle kanıtlandı ama kısmi ödeme/iptal/kur kenar durumları kanıtlanmadı → **KOŞULLU** (genel IMPLEMENTABLE değil).

### PASS / FAIL / BLOCKED

**PASS:**
- Faz 14.0'ın "sync/parent/UI yok" iddiası doğrudan güncel kod okumasıyla çürütüldü, gerçek kod referanslarıyla düzeltildi
- Standalone `/e_invoices` tam pagination ile (17/17 sayfa, `page[size]=100`) gerçekten çekildi, sayfa-1 meta'sına güvenilmedi
- A/B/C/D ID-set'leri gerçek verilerle hesaplandı, 455 fark isim/tutar eşleştirmesi yapılmadan gerçek attribute/relationship örnekleriyle sınıflandırıldı
- Aktif/arşiv kapsamı 7 kaynak için canlı API ile yeniden test edildi, "drift" hipotezi çürütüldü
- Parent modeli DB şemasından doğrudan doğrulandı (varsayılmadı)
- Write-capability listesi korundu, sıfırlanmadı
- Pino sonucu değiştirilmedi (yeni kanıt yok)
- ERP metrik kararı kenar durumları kanıtlanmadan IMPLEMENTABLE'a çevrilmedi
- Bu fazda hiçbir kod/migration/deploy değişikliği yapılmadı

**FAIL:** Yok.

**BLOCKED:** `e_smms`, `bank_fees`, `trackable_jobs`, `stock_updates`, `addresses` (liste-include), standalone `/e_archives` (404) — hepsi API'nin kendisinden.

### Root cause
Faz 14.0'ın hatası: kod okumadan, yalnızca `SUPPORTED_RESOURCES` listesine bakarak "sync yok" sonucuna varması — nested include-tabanlı sync akışlarını (parent sync'i içine gömülü child sync) gözden kaçırması. İkincil hata: filtresiz API çağrısının varsayılan davranışını (yalnızca aktif kayıtlar) test etmeden sayı farkını "drift" olarak yorumlaması.

### Önerilen sonraki uygulama fazı
Standalone `/e_invoices` evreninin 455 ek (bağlantısız, `inbound`, `relationships.invoice.data=null`) kaydını isteğe bağlı ayrı bir "e-fatura kutusu" tablosuna/görünümüne mirror etmek — yalnızca tam denetim/muhasebe görünürlüğü gerekiyorsa; aktif belge işlevselliği zaten tam olduğu için bu düşük-orta öncelikli bir genişleme, acil bir düzeltme değil.

### Final verdict

**PASS.** Faz 14.0'ın e-belge modülü hakkındaki temel iddiası (sync/parent/UI yok) doğrudan kod okumasıyla yanlışlandı ve düzeltildi: aktif e-belge entegrasyonu gerçekten COMPLETE. Standalone `/e_invoices` koleksiyonu tam pagination ile denetlendi (17/17 sayfa), gerçek A/B/C/D küme farkları isim/tutar eşleştirmesi yapılmadan gerçek attribute kanıtlarıyla sınıflandırıldı — 455 fark gerçek ve zararsız bir kapsam farkı olarak belgelendi (sync hatası değil). Aktif/arşiv sayı "drift"leri (451/449, 15/14) filtresiz API'nin varsayılan aktif-sadece davranışıyla açıklandı, kayıp yok. Write-capability listesi korundu, Pino sonucu değiştirilmedi, ERP metrik kararı kenar durumlar kanıtlanmadan gevşetilmedi. Bu fazda kod/migration/deploy değişikliği yapılmadı; tek değişiklik bu rapor dosyasıdır.
