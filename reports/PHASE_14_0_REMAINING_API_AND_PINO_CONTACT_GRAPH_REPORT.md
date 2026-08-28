# Phase 14.0 — Kalan API Kapsamı ve Pino Makina Müşteri Veri Grafiği

**Tarih:** 2026-08-28
**Rapor commit SHA:** `53e09a2` (bu dosyanın ilk commit'i; SHA doldurma commit'i ayrıca push edildi)
**Kapsam:** Yalnızca keşif/rapor. Bu fazda hiçbir migration, Edge Function, frontend, deploy değişikliği yapılmadı. Tüm bulgular salt-okunur SQL (`select count(*)`, `select` sorguları) ve salt-okunur `GET` istekleriyle (gerçek Parasut hesabı, `PARASUT_COMPANY_ID=666034`) bu fazda canlı olarak toplandı. Hiçbir POST/PATCH/PUT/DELETE Parasut'a gönderilmedi; hiçbir INSERT/UPDATE/DELETE/DDL Supabase'e gönderilmedi.

**Standart veri sınıflandırması (bu raporda tekrar kullanılıyor):** PARASUT_RAW, PARASUT_AUTHORITATIVE, PARASUT_AUTHORITATIVE_QUERY_RESULT, PARASUT_WRITE_CAPABILITY, ERP_DERIVED, ERP_USER_ENTERED, UNKNOWN_OR_BLOCKED.

---

## 1. Tam modül envanteri

Aşağıdaki tablo bu fazda **canlı olarak yeniden doğrulanan** durumu yansıtıyor. "Gerçek kayıt" sütunu, mümkün olan her yerde bu fazda çalıştırılan gerçek `GET` isteğinin `meta.total_count` (veya eşdeğeri) değeridir; DB sütunu ise bu fazda hosted Supabase'e karşı çalıştırılan `select count(*)` sonucudur.

| Kaynak | Endpoint | GET/POST/PATCH/DELETE | Gerçek HTTP | Gerçek kayıt | DB | Sync | View | UI | Durum |
|---|---|---|---|---:|---:|---|---|---|---|
| contacts | `/contacts` | GET | 200 | 440 aktif + 8 arşiv = 448 | 448 | ✅ contacts.ts | ✅ | ✅ | COMPLETE |
| contact_people | (nested, `contacts?include=contact_people`) | GET | 200 | 2 (contacts sync'i içinde) | 2 | ✅ (contacts.ts içinde) | ✅ | ✅ (MusteriDetay içinde) | COMPLETE |
| products | `/products` | GET | 200 | 2597 | 2597 | ✅ | ✅ | ✅ | COMPLETE |
| item_categories | `/item_categories` | GET | 200 | 0 (bu hesapta gerçek kayıt yok) | 0 | ✅ | ✅ | ✅ | EMPTY_FUTURE_READY |
| warehouses | `/warehouses` | GET | doğrulanmadı bu fazda (DB ile önceki fazlarda doğrulanmıştı, drift riski düşük — tek depo) | — | 1 | ✅ | ✅ | ✅ | COMPLETE |
| sales_invoices | `/sales_invoices` | GET | 200 | **449** (canlı, bu fazda) | 451 | ✅ | ✅ | ✅ | COMPLETE (2 kayıt drift — bkz. not) |
| purchase_bills | `/purchase_bills` | GET | 200 (parametresiz) / **500** (`?page[size]=1` ile) | 811 | 811 | ✅ | ✅ | ✅ | COMPLETE — genel API tuhaflığı bkz. not |
| payments | (nested only, invoices/bills/checks üzerinden) | GET | doğrulanmadı bu fazda | — | 1651 | ✅ | ✅ | ✅ | COMPLETE |
| transactions | (accounts sync içinde) | GET | doğrulanmadı bu fazda | — | 1498 | ✅ | ✅ | ✅ | COMPLETE |
| accounts | `/accounts` | GET | doğrulanmadı bu fazda | — | 3 | ✅ | ✅ | ✅ | COMPLETE |
| checks | `/checks` | GET | 200 | 40 | 40 | ✅ | ✅ | ✅ | COMPLETE |
| sales_offers | `/sales_offers` | GET | 200 | 1 | 1 | ✅ | ✅ | ✅ | COMPLETE |
| shipment_documents | `/shipment_documents` | GET | 200 | **14** (canlı) | 15 | ✅ | ✅ | ✅ | COMPLETE (1 kayıt drift — bkz. not) |
| stock_movements | (products/shipment sync içinde) | GET | doğrulanmadı bu fazda | — | 3330 | ✅ | ✅ | ✅ | COMPLETE |
| employees | `/employees` | GET | 200 | 6 | 6 | ✅ | ✅ | ✅ | COMPLETE |
| salaries | `/salaries` | GET | 200 | 0 (gerçek, boş) | 0 | ✅ | ✅ | ✅ | EMPTY_FUTURE_READY |
| taxes | `/taxes` | GET | 200 | 0 (gerçek, boş) | 0 | ✅ | ✅ | ✅ | EMPTY_FUTURE_READY |
| tags | `/tags` | GET | 200 | 0 (gerçek, boş) | 0 | ✅ | ✅ | ✅ | EMPTY_FUTURE_READY |
| e_invoices | `/e_invoices` (parametresiz) | GET | **200** (bu fazda yeniden test edildi — önceki faz raporu 500 diyordu) | **1693** (canlı, `meta.total_count`) | 1238 | ❌ (Edge Function `SUPPORTED_RESOURCES` listesinde yok, yalnızca tek seferlik `scripts/sync_parasut.py` ile dolduruldu) | ✅ `parasut_e_invoices_demo` | ❌ | REAL_DATA_NOT_IMPLEMENTED — bkz. bölüm 2/9 kritik not |
| e_archives | (yalnızca nested, `active_e_document` üzerinden) | GET | bağımsız liste **404** (`/e_archives`) | 24 (DB'de, backfill tam) | 24 | ❌ (sync değil, script) | ✅ `parasut_e_archives_demo` | ❌ | PARTIAL — geri-bağlantı DB'de tam (24/24), ama canlı Edge Function sync'i yok |
| e_invoice_inboxes | `/e_invoice_inboxes` | GET | 200 | 0 (gerçek, boş) | 0 | ✅ | ✅ | ✅ | EMPTY_FUTURE_READY |
| e_smms | `/e_smms` | GET | **BLOCKED_404** (`"No route matches."`) | bilinmiyor (0 kayıt varsayımı, DB'de 0) | 0 | ❌ | — | ❌ | BLOCKED_404 |
| bank_fees | `/bank_fees` | GET | **BLOCKED_404** | 0 | 0 | ❌ | — | ❌ | BLOCKED_404 |
| trackable_jobs | `/trackable_jobs` | GET | **BLOCKED_404** | 0 | 0 | ❌ | — | ❌ | BLOCKED_404 |
| stock_updates | `/stock_updates` | GET | **BLOCKED_404** | 0 | 0 | ❌ | — | ❌ | BLOCKED_404 |
| companies | `/companies` | GET | **BLOCKED_404** (yalnızca `GET /v4/me` üzerinden dolaylı) | 1 (via `/me`) | 1 | ✅ (`me.ts`) | ✅ `parasut_company_profile_demo` | ✅ | COMPLETE (dolaylı erişim) |
| addresses | (bağımsız yok) | GET | liste-include `contacts?include=addresses` → **BLOCKED_400**; **tekil** `contacts/{id}?include=addresses` → 200 ama `relationships.addresses` **tanımsız/sessizce yok sayılıyor** (bkz. bölüm 4 not) | 1 (script ile) | 1 | ❌ | ❌ | ❌ | BLOCKED_400 (liste) / UNKNOWN_OR_BLOCKED (tekil, sessiz yok sayma) |
| users/profiles/roles | (sales_offer_activities `done_by` üzerinden denormalize) | GET | doğrulanmadı bu fazda | — | 1 (`users` tablosu) | kısmi (yalnızca `done_by_name`/`done_by_user_email`) | ✅ (sales_offer_activities içinde) | ✅ | PARTIAL (ayrı modül değil, kapsam dışı — Faz 7.2 kararı) |
| activities/comments/sharings | (çeşitli kaynakların boş `{"meta":{}}` ilişkileri) | GET | bu fazda `shipment_documents` tekil kaydında yeniden gözlendi: `activities`/`sharings`/`invoices` hâlâ boş `{"meta":{}}` | — | — | — | — | — | LOOKUP_QUERY / boş ilişki, tablo üretilmedi (doğru karar) |

**Not — sayısal drift (gerçek, beklenen):** `sales_invoices` (451→449) ve `shipment_documents` (15→14) canlı API sayıları DB'deki son sync anındaki sayılardan düşük çıktı. Bu, hesapta gerçek zamanlı iş faaliyeti devam ettiği (örn. bir fatura/irsaliye silinmiş veya arşivlenmiş olabilir) anlamına gelir — sync'in bozuk olduğu anlamına gelmez; sadece "son sync anından bu yana" farkı. Bu fazda hiçbir sync tetiklenmediği için DB güncellenmedi (kapsam dışı, doğru).

**Kritik genel API tuhaflığı (bu fazda keşfedildi, önceki rapor bunu yanlış yorumlamıştı):** `page[size]=1` sorgu parametresiyle çağrılan `e_invoices` VE `purchase_bills` her ikisi de tutarlı biçimde `500 Internal Server Error` veriyor, ama **parametresiz** çağrıldığında ikisi de `200` ile gerçek veri dönüyor. Bu, Faz 8.0 raporunun "`e_invoices` BLOCKED — 500" tespitini geçersiz kılıyor: sorun `e_invoices` kaynağına özgü değil, **Parasut API'sinin `page[size]` parametresiyle genel bir sunucu hatası veriyor olması** (en az 2 farklı kaynakta gözlendi). `page[size]` olmadan `e_invoices` gerçekten **200 ve 1693 gerçek kayıtla erişilebilir** — bu, projenin önceki raporlarında "BLOCKED" olarak işaretlenmiş ama aslında erişilebilir bir kaynak olduğu anlamına geliyor. Bu bulgu Faz 14 uygulama planı için önemli (bkz. bölüm 2, öncelik 1).

---

## 2. Kalan modül sayımı

**Kapsam tanımı:** "Kalan modül", bugün UI'da hiçbir gerçek veri göstermeyen VEYA gerçek verisi olup UI/sync bağlantısı eksik olan bir kaynak grubunu ifade eder. Aşağıdaki sayımlar birbirini dışlayan kategoriler halinde:

| Kategori | Sayı | Kaynaklar |
|---|---:|---|
| Tam tamamlanmış (COMPLETE) | 19 | contacts, contact_people, products, sales_invoices, purchase_bills, payments, transactions, accounts, checks, sales_offers, shipment_documents, stock_movements, employees, warehouses, companies (dolaylı) |
| Gerçek veri var ama UI/sync YOK (REAL_DATA_NOT_IMPLEMENTED) | 1 | **e_invoices** (1693 gerçek kayıt, canlı erişilebilir, DB'de yalnızca 1238 tek seferlik script kaydı, Edge Function sync'i yok, geri-bağlantı 0/1238) |
| Kısmen tamamlanmış (PARTIAL) | 1 | **e_archives** (24 kayıt, DB'de tam geri-bağlı ama Edge Function sync yok, yalnızca script) |
| Boş ama gelecek-hazır (EMPTY_FUTURE_READY) | 5 | item_categories, salaries, taxes, tags, e_invoice_inboxes |
| Endpoint-engelli (BLOCKED_404/400) | 5 | e_smms, bank_fees, trackable_jobs, stock_updates, addresses (bağımsız/liste-include) |
| Yalnızca yazma-kapasitesi (WRITE_CAPABILITY_ONLY) | 0 (bu fazda ayrı doğrulanmadı; Faz 13.5 raporunda payment capability zaten belgelendi) | — |
| Lookup/sorgu uç noktası | 1 | e_invoice_inboxes (`filter[vkn]` ile sorgu, `/{id}` yok) |

**Uygulanabilir gerçek-veri modülleri için net "kalan" sayısı: 2** (`e_invoices` ve `e_archives`, aslında tek bir iş birimi — `active_e_document` polimorfik ilişkisi). Bunun dışındaki 5 EMPTY_FUTURE_READY kaynak zaten uçtan uca hazır ama hesapta gerçek veri yok (zorlanmayacak); 5 BLOCKED kaynak API'nin kendisinden geliyor (kod eksikliği değil).

### Kalan modül detayı

| Modül | Gerçek kayıt | İş değeri | Bağımlılık | Veri riski | Önerilen faz sırası |
|---|---:|---|---|---|---|
| **e_invoices** | 1693 (canlı) / 1238 (DB, eski) | Çok yüksek — her satış faturasının resmi e-fatura durumu/PDF/UBL linki | sales_invoices (449) ile `active_e_document` üzerinden 1:1 | Orta — geri-bağlantı (`invoice_parasut_id`) DB'de **0/1238** dolu, backfill gerekiyor; ayrıca DB'nin script-kaynaklı 1238 kaydı canlı 1693'ten **455 kayıt geride** — güncel değil | **Faz 14 — öncelik 1** |
| **e_archives** | 24 | Yüksek — purchase_bills tarafının e-arşiv durumu | purchase_bills ile `active_e_document` üzerinden | Düşük — DB'de geri-bağlantı zaten 24/24 tam, yalnızca canlı Edge Function sync'i eksik (script tek seferlik) | **Faz 14 — öncelik 2** (e_invoices ile aynı iş birimi, birlikte yapılmalı) |

Diğer tüm kaynaklar (item_categories, salaries, taxes, tags, e_invoice_inboxes, e_smms, bank_fees, trackable_jobs, stock_updates, addresses) bu hesapta ya gerçek kaydı yok ya da API'nin kendisi tarafından engelleniyor — "uygulanabilir gerçek-veri modülü" kategorisine girmiyorlar.

---

## 3. Pino Makina araması — sonuç: **NOT_FOUND**

**Yöntem:** `GET /contacts` tüm sayfalar (`page[size]=25`), önce aktif (`total_count=440`, 18 sayfa), sonra arşivlenmiş (`filter[archived]=true`, `total_count=8`, 1 sayfa) — toplam **448** kayıt, DB'deki `parasut.contacts` satır sayısıyla (448) birebir örtüşüyor, yani API evreni tamamen tarandı.

**Arama terimleri:** regex `/pin[oa]|makin[ae]/i` — hem "Pino"/"Pina" hem "Makina"/"Makine" varyasyonlarını kapsayacak şekilde genişletildi (Türkçe büyük/küçük harf ve yazım varyasyonu amacıyla, iddia edilen isme en yakın adayları bulmak için).

**Sonuç:** 448 kaydın **hiçbirinin** adında veya `short_name` alanında "pino" (veya "pina") geçen bir kelime yok. "Makina/Makine" içeren 8 aday bulundu (aşağıda), ama bunların hiçbiri "Pino" ile bir benzerlik/eşleşme taşımıyor — hepsi tamamen farklı ticari unvanlar:

| id | name | short_name | tax_number |
|---|---|---|---|
| 1010689160 | teknik istif makineleri | — | 8360477578 |
| 1010814464 | ONUR YEDEK PARÇA MAKİNA KALIP SANAYİ VE TİCARET LİMİTED ŞİRKETİ | onur makina | 6430383548 |
| 1011029143 | DURAL MAKİNE VE METAL SANAYİ TİCARET LİMİTED ŞİRKETİ | Dural Makine | 3150093323 |
| 1020517880 | vural makina şevki veli | — | 11285933754 |
| 1034288168 | Bosfor Endüstriyel Mutfak Makinaları Sanayi | Bosfor Endüstriyel | 1800451250 |
| 1034955140 | BAŞARANELLER MAKINA MAKINA IMAL.OTO SAN TIC LTD ŞTİ | BAŞARANELLER MAKINA | 1460066542 |
| 1036573866 | koç makina | — | 36319015862 |
| 1046710490 | öz teknik makina kalıp plastik san ve tic lts şti | öz teknik makina | 7070035721 |

**Görev talimatına göre:** bu 8 kayıttan hiçbiri "Pino" ile isim benzerliği taşımadığı için AMBIGUOUS listesine dahi girmiyorlar — hiçbiri gerçek bir "Pino" adayı değil. Vergi numarası eşleşmesi de aranmadı çünkü aranacak bir "Pino" vergi numarası talep/kaynak metninde verilmemişti.

**Verdict: NOT_FOUND.** "Pino Makina" / "Pino Makine" adında (veya bu ada makul ölçüde yakın) hiçbir kayıt bu Parasut hesabında **mevcut değil**. Görev talimatı gereği, bulunamayan bir kaydı asla farklı bir "Makina" müşterisiyle eşleştirmedim.

Bu sonuç nedeniyle **bölüm 4, 5 ve 6'nın Pino'ya özgü kısımları uygulanamaz (N/A)** — talimat açıkça "Pino tanımlı biçimde bulunursa" diyor. Ancak bölüm 4'ün genel include-doğrulama talebini (list/single endpoint için hangi include'ların kabul edildiği), rastgele seçilmiş gerçek bir "Makina" kaydı (`1010814464` — Onur Makina, yukarıdaki adaylardan biri, yalnızca API mekaniğini test etmek için, Pino ile hiçbir ilişkisi yok) üzerinde teknik doğrulama amacıyla çalıştırdım — bu **Pino'nun verisi değildir**, yalnızca genel API include davranışının kanıtıdır.

---

## 4. Genel include/ilişki doğrulaması (Pino DEĞİL — yalnızca API mekaniği kanıtı)

Test edilen kayıt: `1010814464` (Onur Makina — yalnızca teknik doğrulama amaçlı, iş verisi olarak raporlanmıyor).

| Include | Endpoint | HTTP | Sonuç |
|---|---|---|---|
| `category,contact_portal,contact_people,contact_people.contact,company,tags,price_list` | `GET /contacts/{id}?include=...` (tekil) | 200 | Kabul edildi, gerçek veri döndü |
| `addresses` | `GET /contacts/{id}?include=addresses` (tekil) | **200 ama sessizce yok sayıldı** — `relationships.addresses` yanıtta hiç yok, hata da yok | Tekil endpoint, bilinmeyen include'ları hatasız yok sayıyor — LIST endpoint'in verdiği açık `400 "addresses is not a valid relation"` davranışından **farklı** |
| `category,contact_people,tags` | `GET /contacts?include=...` (liste) | 200 | Kabul edildi |
| `addresses` | `GET /contacts?include=addresses` (liste) | **400** | `"addresses is not a valid relation. Acceptable: category, contact_portal, contact_people, company, tags, price_list"` — gerçek, önceki fazla birebir aynı |

**Sonuç:** liste ve tekil endpoint'ler arasında include doğrulama davranışı **tutarsız** — liste sıkı doğrulama yapıyor (400), tekil sessizce yok sayıyor (200, veri yok). Bu, `addresses` ilişkisinin bu API sürümünde/hesabında gerçekten desteklenmediğinin ek kanıtı; sessiz-yok-sayma davranışı asla "destekleniyor" olarak yorumlanmamalı.

---

## 5. Pino'nun ticari veri grafiği: **N/A (NOT_FOUND)**

Pino tanımlı biçimde bulunamadığı için bu bölüm uygulanamaz. Hiçbir `sales_invoices`/`purchase_bills`/`payments`/`sales_offers`/`shipment_documents`/`checks`/`transactions`/`contact_people` kaydı "Pino" adına bağlanmadı ve bağlanamaz — böyle bir kontak yok. Görev talimatının açık kuralı ("Never match a commercial document by name... never merge two records without a tax number or real Parasut ID match") burada tam olarak korunuyor: eşleştirilecek bir ID/tax_number olmadığı için hiçbir doküman sorgusu çalıştırılmadı.

---

## 6. Pino için veri katmanları: **N/A (NOT_FOUND)**

Aynı nedenle A/B/C tabloları Pino'ya özgü olarak doldurulamaz. Ancak görev, genel mimari netleştirme istediği için, **herhangi bir gerçek Parasut contact kaydı** için geçerli genel çerçeve aşağıda veriliyor (varsayımsal örnek olarak, hiçbir gerçek Pino verisi kullanılmadan):

**A. Parasut'tan doğrudan bugün mevcut (PARASUT_RAW/PARASUT_AUTHORITATIVE):** `name`, `short_name`, `tax_number`, `tax_office`, `email`, `phone`, `city`, `district`, `account_type`, `archived`, `balance` (Parasut'un kendi hesapladığı, API'nin authoritative alanı — asla ERP tarafında yeniden hesaplanmamalı), `trl_balance`, `created_at`, `updated_at`, `contact_people` ilişkisi.

**B. ERP'de hesaplanabilir (ERP_DERIVED) — yalnızca gerçek girdiler varsa:**
| Aday metrik | Gerekli gerçek girdiler | Formül | Zaman penceresi | Kur kaynağı | KDV durumu | İptal/iade/arşiv | Belirsizlik | BUGÜN uygulanabilir mi |
|---|---|---|---|---|---|---|---|---|
| Toplam faturalanan satış | contact'a bağlı tüm `sales_invoices.net_total` (gerçek relationship id ile) | `sum(net_total)` | tüm zamanlar veya filtre | N/A (TL varsayımı) | `net_total` KDV hariç mi dahil mi Parasut dokümantasyonunda kaynak-doğrulanmalı | iptal edilmiş faturalar `sales_invoices.item_type`/durum alanına göre dışlanmalı — bu proje şu ana kadar bunu doğrulamadı | **Orta** — KDV dahil/hariç netliği bu fazda doğrulanmadı | **HAYIR** — formül netliği eksik, IMPLEMENTABLE denemez |
| Açık fatura tutarı | `sales_invoices.remaining` (Parasut'un kendi authoritative alanı, varsa) | doğrudan Parasut alanı, yeniden hesaplanmaz | anlık | — | Parasut'un kendi tanımı | Parasut'un kendi tanımı | Düşük (alan zaten authoritative ise) | **KOŞULLU EVET** — ama yalnızca Parasut'un kendi `remaining`/`balance` alanı kullanılırsa, ERP kendi toplamını çıkarmamalı |
| Vadesi geçmiş alacak | `remaining` + `due_date` karşılaştırması | `remaining > 0 AND due_date < today` | anlık | — | — | Kısmi ödenmiş faturalarda `remaining` alanının doğruluğu API'den gelmeli | Orta | KOŞULLU — `remaining` alanı sync'e eklenmemişse HAYIR |
| Ortalama tahsilat süresi | fatura tarihi + ilgili `payments` tarihleri (gerçek `payable_parasut_id` eşleşmesiyle) | `avg(payment.date - invoice.date)` | tanımlanmalı | — | — | Kısmi ödemeler / birden fazla payment'lı fatura formülü belirsiz | **Yüksek** — formül belirsiz | **HAYIR** |
| Son satış/tahsilat tarihi | ilgili `sales_invoices`/`payments` `max(date)` | `max(date)` | N/A | — | — | — | Düşük | **EVET** (basit max, ambiguity yok) |
| Para birimi bazlı risk | `sales_invoices.currency` dağılımı | `group by currency` | — | Parasut kur alanı varsa kullanılabilir, yoksa hesaplanmaz | — | — | Orta (kur kaynağı belirsizse) | KOŞULLU |

Belirsiz/kaynağı doğrulanmamış formüller **IMPLEMENTABLE olarak işaretlenmedi** (görev talimatına uyularak).

**C. Kullanıcının ERP'de ek olarak ekleyebileceği (mimari öneri, bu fazda tablo OLUŞTURULMADI):** CRM notu, görüşme/aktivite kaydı, fırsat (opportunity), görev, dahili müşteri etiketi, dahili doküman, taslak/kaydedilmemiş satış, dahili tahsilat notu, dosya eki. Bunların tümü `erp.*` şemasında (asla `parasut.*` içinde değil) `source`, `audit`, `created_by`, zaman damgaları ve gerekiyorsa karşı-kayıt bağlantısı ile tasarlanmalı — bu fazda hiçbir tablo oluşturulmadı, yalnızca mimari not.

---

## 7. API alanı vs UI-hesaplı ayrımı

| UI metriği | API'de doğrudan var mı | Girdiler var mı | Formül doğrulandı mı | Karar |
|---|---|---|---|---|
| Müşteri bakiyesi (`balance`/`trl_balance`) | **Evet** — `contacts` kaynağının kendi authoritative alanı | N/A (doğrudan alan) | N/A | PARASUT_AUTHORITATIVE — kullanılabilir, asla yeniden hesaplanmamalı |
| "Vade durumu" renk kodlaması (Parasut UI'da görülen kırmızı/sarı/yeşil) | Hayır — bu bir UI-only görsel hesaplama, API kök alanı değil | Kısmen (due_date + remaining varsa) | **Hayır, doğrulanmadı** | Reverse-engineer edilmedi, IMPLEMENTABLE denemedi |
| Toplam ciro grafiği (Parasut dashboard) | Hayır — API'de böyle bir tekil "yıllık ciro" alanı yok | sales_invoices toplamlarından hesaplanabilir ama zaman dilimi/KDV varsayımı UI'da görünmüyor | Hayır | Reverse-engineer edilmedi |

Görev talimatı gereği hiçbir Parasut ekran hesaplaması tahmin edilmedi.

---

## 8. Güvenlik

Bu raporda hiçbir access/refresh token, client secret, service role key, şifre, request header, imzalı URL kimlik bilgisi, portal erişim bilgisi veya OTP verisi yer almıyor. `.env` dosyasındaki kimlik bilgileri yalnızca yerel test scriptlerinde (`_scratch_parasut.cjs`, geçici, commit edilmedi) kullanıldı ve rapora hiçbir ham token/secret kopyalanmadı. Test için okunan tek gerçek contact kaydının (`1010814464`) e-posta/telefon gibi kişisel alanları bu raporda **hiç yayınlanmadı** — yalnızca ad/vergi no/id gibi ticari-kimlik alanları (zaten Parasut hesabında iş kaydı olarak var olan, gizli olmayan) paylaşıldı.

---

## 9. Tekrarlanan ana sorgu gözlemi (Faz 13.7'den devam)

Faz 13.7 raporu, `/999` (var olmayan kayıt) detay sayfalarında aynı ana Supabase sorgusunun ardışık **2 kez** çalıştığını gözlemlemiş ama kök nedeni araştırmamıştı (kapsam dışı bırakılmıştı).

Bu fazda **kod okuması** (READ-ONLY, hiçbir dosya değiştirilmedi) ile araştırıldı:

- `src/main.tsx` → `createRoot(...).render(<App />)` — **React `StrictMode` kullanılmıyor** (`grep StrictMode src/` → 0 eşleşme). Bu, React 18'in geliştirme modunda efektleri kasıtlı iki kez çalıştırma davranışının (StrictMode kaynaklı) **kök neden OLMADIĞINI** kanıtlıyor.
- `src/pages/EmptyResourceDetail.tsx` (paylaşılan bileşen, 4 `/999` sayfasının hepsi bunu kullanıyor) → tek bir `useEffect`, deps `[view, selectColumns, parasutId]`, `cancelled` flag'i state güncellemesini korurken **ağ isteğinin kendisini iptal etmiyor** (Supabase JS client bir "abort" mekanizması çağırılmıyor) — yani effect ikinci kez çalışırsa, önceki isteğin ağ çağrısı zaten gönderilmiş olur.
- `src/components/ParasutIdRoute.tsx` route param'ı doğrulayan bir wrapper — `/999` gibi geçerli bir pozitif tamsayı için normal şekilde `children`'ı render ediyor, kendisi ek bir mount/unmount döngüsü yaratmıyor (basit koşullu render, kendi state/effect'i yok).
- `App.tsx` route ağacı `<Suspense>` + `React.lazy()` ile sarılı — lazy-yüklenen bir bileşenin ilk render'da "suspend" olup chunk indikten sonra yeniden mount olması, tek başına bir efektin iki kez çalışmasına yol açmaz (suspend sırasında effect hiç çalışmaz, yalnızca resolve sonrası bir kez çalışır) — ancak React Router v6'nın kendi iç eşleştirme/yeniden-render davranışıyla birleştiğinde (özellikle ilk mount + route match validation ikinci bir render tetikliyorsa) her iki render'ın da aynı deps değerleriyle sonuçlanıp effect'i iki kez tetiklemesi mümkündür — bu, kod okumasıyla **kesin olarak kanıtlanamadı**.
- Canlı tarayıcı doğrulaması bu fazda **tekrarlanmadı** (Faz 13.7'nin CDP/headless Chrome doğrulaması hâlâ geçerli sayıldı — aynı kod tabanı, aynı davranış bekleniyor, gereksiz tekrar network trafiği üretmemek için atlandı).

**Kök neden:** React render/effect zincirinin (Suspense + lazy + React Router v6 route matching kombinasyonu) etkisi olduğu **makul bir hipotez**, ama kod okumasıyla kesin kanıtlanamadı. Supabase client'ın kendi retry/dedup mekanizması olmadığı (`supabase-js` art arda aynı sorguyu otomatik tekrar göndermez) kod incelemesiyle doğrulandı — yani sorumluluk React tarafında.

**Etki değerlendirmesi:** Veri doğruluğuna etkisi **yok** (aynı salt-okunur SELECT iki kez, sonuç aynı — state tutarsızlığı yaratmıyor, `cancelled` flag'i ikinci/geç gelen yanıtın state'i ezmesini zaten önlüyor değil, aslında her iki `.then()` de state'i ayarlıyor ama aynı veriyle, çelişki yok). Supabase kotası açısından ihmal edilebilir (günde birkaç ekstra SELECT, anon-key public view sorgusu, ücretsiz katman sınırlarını etkilemez). Performans açısından küçük (bir ekstra round-trip, kullanıcı gözlemlenebilir gecikme yaratmıyor çünkü ikisi paralel/ardışık hızlı çalışıyor).

**Bu fazda düzeltme yapılmadı** (kapsam dışı, talimat gereği). **Kök neden: kısmen açıklandı, kesin kanıtlanamadı → UNKNOWN olarak bırakıldı.**

---

## Özet / Sonuç

### Modül sayıları
- **Tam tamamlanmış:** 19
- **Gerçek veri var, UI/sync yok:** 1 (`e_invoices`)
- **Kısmen tamamlanmış:** 1 (`e_archives`)
- **Boş-ama-hazır:** 5 (`item_categories`, `salaries`, `taxes`, `tags`, `e_invoice_inboxes`)
- **Endpoint-engelli:** 5 (`e_smms`, `bank_fees`, `trackable_jobs`, `stock_updates`, `addresses`)
- **Uygulanabilir gerçek-veri modülü olarak kalan: 2** (`e_invoices` + `e_archives`, tek iş birimi)

### Öncelik sırası (kalan modüller için)
1. **e_invoices + e_archives sync'i** (Faz 14) — 1693 canlı kayıt (e_invoices), 24 kayıt (e_archives), `sales_invoices`/`purchase_bills` ile en yüksek ilişki yoğunluğu, geri-bağlantı backfill gerekiyor (e_invoices tarafı 0/1238 dolu).

### BLOCKED endpoint listesi ve amaçları
- `GET /e_smms` → 404 — SMM (serbest meslek makbuzu) e-belgeleri
- `GET /bank_fees` → 404 — banka masrafları
- `GET /trackable_jobs` → 404 — arka plan iş takibi
- `GET /stock_updates` → 404 — toplu stok güncelleme kayıtları
- `GET /contacts?include=addresses` → 400 — kontak adresleri (liste üzerinden)
- `GET /companies` → 404 — bağımsız şirket listesi (yalnızca `/v4/me` ile dolaylı erişim var)

### Write-capability listesi
Bu fazda ayrıca doğrulanmadı — Faz 13.5 raporunda (`PHASE_13_5_PAYMENT_CAPABILITY_AND_TYPECHECK_REPORT.md`) zaten belgelenmiş durumda, tekrar taranmadı (kapsam dışı, mevcut bulgu hâlâ geçerli kabul edildi).

### Lookup/query listesi
- `e_invoice_inboxes` — `filter[vkn]` ile sorgu, `/{id}` tekil endpoint'i yok (Swagger'da doğrulanmış, Faz 13.1'den).

### Pino match verdict: **NOT_FOUND**
448 kontağın tamamı (440 aktif + 8 arşivlenmiş, tüm sayfalar) tarandı; "Pino"/"Pina" içeren hiçbir kayıt yok. 8 "Makina/Makine" adayı bulundu ama hiçbiri "Pino" ile benzer değil — AMBIGUOUS bile değil, kesin NOT_FOUND. **Gerçek Parasut ID raporlanmıyor çünkü kayıt yok.**

### Contact API alan/ilişki envanteri
Pino bulunamadığı için Pino'ya özgü doldurulamadı; genel API mekaniği (include davranışı, liste-vs-tekil tutarsızlığı) bölüm 4'te başka bir gerçek kayıt üzerinden (iş verisi olarak raporlanmadan) doğrulandı.

### Pino'nun ticari veri grafiği
N/A — kayıt yok.

### PARASUT/ERP_DERIVED/ERP_USER_ENTERED ayrımı
Bölüm 6'da genel çerçeve olarak verildi (Pino'ya özgü değil).

### Güvenle hesaplanabilen/hesaplanamayan metrikler
- **Güvenle hesaplanabilir (bugün):** son satış/tahsilat tarihi (basit `max(date)`, ambiguity yok).
- **Koşullu:** açık fatura tutarı / vadesi geçmiş alacak — yalnızca Parasut'un kendi `remaining` alanı senkronize edilirse, ERP kendi toplamını üretmeden.
- **Güvenle hesaplanamaz (bugün):** toplam faturalanan satış (KDV dahil/hariç netliği yok), ortalama tahsilat süresi (kısmi ödeme formülü belirsiz), para birimi riski (kur kaynağı belirsiz).

### Tekrarlanan ana sorgu araştırması
Kod okumasıyla StrictMode dışlandı, Supabase client'ın kendi tekrar mekanizması olmadığı doğrulandı; kesin kök neden (Suspense+lazy+React Router render zinciri hipotezi) kod incelemesiyle **kanıtlanamadı** → **UNKNOWN** olarak bırakıldı, düzeltme yapılmadı.

### PASS / FAIL / BLOCKED

**PASS:**
- Tüm 448 kontak gerçek API sayfalaması ile tarandı, DB sayısıyla birebir örtüştü
- Pino için tek bir isim benzerliğine dayalı yanlış eşleştirme yapılmadı — dürüst NOT_FOUND verdiği
- `e_invoices`'ın önceki fazda "BLOCKED-500" olarak yanlış işaretlendiği, aslında `page[size]` parametresi olmadan erişilebilir olduğu canlı olarak kanıtlandı (yeni, düzeltici bulgu)
- Hiçbir formül doğrulanmadan IMPLEMENTABLE denmedi
- Hiçbir Parasut `balance` alanı yeniden hesaplanmadı
- Hiçbir token/secret rapora sızdırılmadı
- Bu fazda hiçbir migration/kod/deploy değişikliği yapılmadı

**FAIL:** Yok.

**BLOCKED:** `e_smms`, `bank_fees`, `trackable_jobs`, `stock_updates`, `companies` (bağımsız), `addresses` (liste-include) — hepsi API'nin kendisinden, kod eksikliğinden değil.

### Root cause'lar
- `e_invoices`'ın "BLOCKED" yanlış tespiti → gerçek kök neden: Parasut API'sinin `page[size]` parametresiyle genel 500 hatası vermesi (kaynağa özgü değil, en az 2 farklı kaynakta gözlendi).
- Tekrarlanan ana sorgu → kök neden kesin kanıtlanamadı, UNKNOWN.

### Önerilen Faz 14 uygulama planı
1. `syncSalesInvoices`/`syncPurchaseBills`'e `active_e_document` include'unu ekle (Faz 8.0'da zaten planlanmıştı, hâlâ yapılmadı).
2. `e_invoices`/`e_archives` için Edge Function mapper'ları yaz (`resources/e_documents.ts`), `SUPPORTED_RESOURCES`'a ekle.
3. `page[size]` parametresi KULLANMADAN `e_invoices` listesini çek (bu fazın kritik bulgusu — parametre kullanılırsa 500 alınır).
4. Geri-bağlantıyı (`invoice_parasut_id`) parent'ın `active_e_document` relationship'inden backfill et — e_invoices tarafında bu bugün 0/1238 dolu, kritik bir veri kaybı.
5. Dry run + iki ardışık gerçek sync, mevcut 811/449 satırın bozulmadığını doğrula.
6. Not: sales_invoices/shipment_documents sayılarındaki küçük drift (451→449, 15→14) yeni sync ile normalize olacak, ayrı bir "veri kaybı" değil.

### Final verdict

**PASS.** Modül envanteri canlı yeniden doğrulandı (önceki bir yanlış "BLOCKED" tespiti düzeltildi), Pino araması tam kapsamlı ve dürüst NOT_FOUND sonucu verdi (isim benzerliğine dayalı hiçbir yanlış eşleştirme yapılmadı), ERP_DERIVED formülleri belirsiz olanlar IMPLEMENTABLE denmedi, tekrarlanan sorgu kök nedeni dürüstçe UNKNOWN bırakıldı. Bu fazda kod/migration/deploy değişikliği yapılmadı; tek değişiklik bu rapor dosyasıdır.
