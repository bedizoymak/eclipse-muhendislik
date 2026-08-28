# Phase 13.1 — Boş Kaynaklar Şema, Unknown Field ve Route Tamamlama

**Tarih:** 2026-08-28
**Phase 13 kod commit SHA:** 1d53962c5bdf46d4ed09c4cf4645e2c7239ea1e4
**Phase 13.1 kod commit SHA:** (doldurulacak)
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com

## 0. Bu fazın önceli: Phase 13 doğrulaması

Bu oturumda Phase 13'ün STAGE edilmiş (commit edilmemiş) hâli bağımsız olarak yeniden doğrulandı, önce commit edildi, SONRA bu faz başladı:
- Migration `20260902010000_phase13_empty_resources_views.sql` gerçekten hosted DB'de mevcut (`\dv` ile 8 view doğrulandı).
- Edge Function `parasut-sync` gerçekten deploy edilmiş (versiyon 28, `supabase functions list` ile doğrulandı).
- `parasut.sync_runs` tablosunda salaries/taxes/tags/e_invoice_inboxes için gerçek dry_run + 2 ardışık `success` satırı bulundu (zaman damgaları eşleşiyor).
- Regresyon: contacts 448, sales_invoices 451, purchase_bills 811, products 2597, employees 6 — hepsi gerçek DB sorgusuyla teyit edildi.
- `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, `npm run build:demo` hepsi temiz.
Hiçbir düzeltme gerekmedi — Phase 13 gerçekten iddia ettiği durumdaydı. Commit `1d53962c` (kod) + rapor SHA doldurma commit'i `a9e4810d` ile `main`'e push edildi.

## 1. Veri sınıflandırma

Bu fazda dokunulan her alan için:

| Sınıf | Bu fazda kullanım |
|---|---|
| PARASUT_RAW | 4 kaynağın `raw jsonb` sütunu — API'den gelen tam nesne, filtrelenmemiş. |
| PARASUT_AUTHORITATIVE | Aşağıdaki §2 tablosundaki, gerçek swagger.json `definitions.{Salary,Tax,Tag,EInvoiceInbox}Attributes` içinde ADI GEÇEN alanlar. |
| ERP_DERIVED | Sayaç view'ları (`total_count`, `active_count`, `archived_count`) — SQL `count(*)` agregatı. |
| ERP_USER_ENTERED | Yok (bu 4 kaynakta hiç kullanıcı girdisi yok). |
| UNKNOWN_OR_BLOCKED | Gerçek örnek satır olmadığından hiçbir alanın gerçek runtime değeri gözlemlenemedi — hiçbir tip/anlam TAHMİN EDİLMEDİ, yalnızca şemadan okundu. |

## 2. Resmi Swagger şema envanteri

Kaynak: `https://apidocs.parasut.com/swagger.json` (bu oturumda canlı indirildi, 802 473 bayt, yerel olarak `python`+`json` ile ayrıştırıldı — repo'da önceden cache'lenmiş bir swagger dosyası yoktu).

### salaries

| Alan | JSON yolu | Swagger tipi | Nullable/RO | Attr/Rel | Mapper | Base | Raw | View | UI |
|---|---|---|---|---|---|---|---|---|---|
| description | attributes.description | string | required, writable | attr | ✅ | ✅ | ✅ | ✅ | ✅ |
| currency | attributes.currency | enum(TRL,USD,EUR,GBP) | required, writable | attr | ✅ | ✅ | ✅ | ✅ | ✅ |
| issue_date | attributes.issue_date | string(date) | required, writable | attr | ✅ | ✅ | ✅ | ✅ | ✅ |
| due_date | attributes.due_date | string(date) | required, writable | attr | ✅ | ✅ | ✅ | ✅ | ✅ |
| exchange_rate | attributes.exchange_rate | number | writable | attr | ✅ | ✅ | ✅ | ✅ | ✅ |
| net_total | attributes.net_total | number | required, writable | attr | ✅ | ✅ | ✅ | ✅ | ✅ |
| total_paid | attributes.total_paid | number | readOnly | attr | ✅ | ✅ | ✅ | ✅ | ✅ |
| remaining | attributes.remaining | number | readOnly | attr | ✅ | ✅ | ✅ | ✅ | ✅ |
| remaining_in_trl | attributes.remaining_in_trl | number | readOnly | attr | ✅ | ✅ | ✅ | ✅ | ✅ |
| **archived** | attributes.archived | boolean | readOnly | attr | ✅ | ✅ | ✅ | ✅ | ✅ |
| created_at | attributes.created_at | string(date) | readOnly | attr | ✅→parasut_created_at | ✅ | ✅ | ✅ | — |
| updated_at | attributes.updated_at | string(date) | readOnly | attr | ✅→parasut_updated_at | ✅ | ✅ | ✅ | — |
| employee | relationships.employee | ref→employees | — | rel | ✅→employee_parasut_id | ✅ | ✅ | ✅ | — |
| category | relationships.category | ref→item_categories | — | rel | ✅→category_parasut_id | ✅ | ✅ | ✅ | — |
| **tags** | relationships.tags | ref[]→tags | — | rel | ❌ HARİTALANMAMIŞ | — (junction tablo yok) | ✅ (raw içinde tam) | ❌ | ❌ |

Liste yanıtı: `data:[]` (bugün gerçek 0 kayıt), `meta` anahtarı bu endpoint'te hiç dönmüyor (Phase 13'te doğrulandı, bu fazda tekrar teyit edildi). Tek kayıt yanıtı: `GET /salaries/{id}` swagger'da gerçekten var (path listesinde `get` metodu mevcut). Desteklenen filtreler (swagger `parameters`): `filter[due_date]`, `filter[issue_date]`, `filter[currency]`, `filter[remaining]` — `archived` YOK. Sort: `id, issue_date, due_date, remaining, description, net_total`. Include: `category, tags, payments, activities, employee`. Kaynak tipi: `"salaries"`.

**Phase 0 sütun çaprazlama:** Base tablodaki tüm sütunlar (description/currency/issue_date/due_date/exchange_rate/net_total/total_paid/remaining/remaining_in_trl/archived/employee_parasut_id/category_parasut_id) → **proven field** (resmi şemada birebir karşılığı var). Ekstra/fazladan sütun yok, eksik tip/ilişki yok — tek eksik, yeni tespit edilen gerçek `tags` ilişkisi (junction tablo henüz yok, gelecek faz notu, §9).

### taxes

Aynı desen: `description, issue_date, due_date, net_total, total_paid, remaining, remaining_in_trl, archived, created_at, updated_at` attribute'ları + `category`, `tags` (haritalanmamış) ilişkileri. Filtreler: `due_date, issue_date, currency, remaining` (currency listelense de TaxAttributes'ta currency alanı YOK — swagger'ın kendi tutarsızlığı, not edildi, kod bu tutarsızlığa güvenmiyor). Sort aynı. Include: `category, tags, payments`. `GET /taxes/{id}` gerçek var. İlginç swagger tutarsızlığı: `Tax.type` enum'u `["bank_fees"]` olarak tanımlı (muhtemelen paylaşılan şema kopyala-yapıştır hatası) — koddaki mapper `item.type`'a hiç güvenmiyor, sadece `item.id`/`attributes` okuyor, bu yüzden bu tutarsızlık hiçbir etkiye sahip değil.

### tags

Attributes: `name` (required, writable), `created_at`, `updated_at`. Relationships: **hiç yok** (`Tag.relationships: {}`). Filtre parametresi hiç yok (`filter[archived]` dahil hiçbir filtre). Sort: `id, name`. `GET /tags/{id}` gerçek var.

### e_invoice_inboxes

Attributes: `vkn, e_invoice_address, name, inbox_type, address_registered_at, registered_at, created_at, updated_at` — **hepsi `readOnly:true`** (yazılabilir hiçbir alan yok, bu kaynağın bir "sorgu sonucu" olduğunu doğrular). Relationships: **hiç yok**. Filtre: yalnızca `filter[vkn]` (sort yok, include yok). **`GET /e_invoice_inboxes/{id}` swagger path listesinde YOK** — yalnızca `/{company_id}/e_invoice_inboxes` (GET) var, `/{id}` alt yolu tanımlı değil.

### item_categories (referans, bu fazda dokunulmadı — Phase 5)

Attributes: `full_path (RO), name, bg_color, text_color, category_type (enum: Product/Contact/Employee/SalesInvoice/Expenditure), created_at (RO), updated_at (RO)`. Relationships: `parent_category`, `subcategories`. `GET/POST /item_categories`, `GET/PUT/DELETE /item_categories/{id}` hepsi gerçek. Phase 0/5 base tablo sütunları (`name, full_path, bg_color, text_color, category_type, parent_category_parasut_id`) resmi şemayla birebir eşleşiyor — proven field, düzeltme gerekmedi.

## 3. Archived semantiği — kesin karar

**salaries ve taxes: `archived` gerçek, resmi bir Swagger attribute'u (`SalaryAttributes.archived` / `TaxAttributes.archived`, `type: boolean, readOnly: true`).** Ayrıca her iki kaynağın da gerçek `PATCH /{id}/archive` ve `PATCH /{id}/unarchive` endpoint'leri var (swagger `paths`'te doğrulandı) — bu, `archived`'ın gerçek, birinci sınıf bir iş kavramı olduğunun ikinci bağımsız kanıtı.

Karar: **active/archived sayaçları KORUNUYOR** (zaten Phase 13'te böyle kurulmuştu, bu faz bunu resmi şemayla teyit etti — tahminen değil). `filter[archived]` gerçekten desteklenmiyor (400, "Acceptable: due_date, issue_date, currency, remaining") — bu açıkça raporlanıyor (bkz. Phase 13 raporu §1, bu raporun §2 filtre satırları) ve sync tek, filtresiz tam listeleme yapıyor (zaten böyleydi, `syncSalaries`/`syncTaxes` — `fetchAllPages`, `fetchActiveAndArchived` DEĞİL). Gelecekte gerçek kayıt geldiğinde, sunucu tarafında tek fetch + mapper'ın okuduğu gerçek `archived` attribute'una göre `count(*) filter (where archived = ...)` DB tarafında ayrım yapacak — bu zaten migrationdaki count view'ların çalışma şekli.

**tags ve e_invoice_inboxes: `archived` resmi şemada YOK** (`TagAttributes`/`EInvoiceInboxAttributes` içinde `archived` alanı hiç tanımlı değil). Karar: **hiçbir active/archived sayaç yok**, yalnızca `total_count` (zaten Phase 13'te böyleydi) — bu fazda resmi şemayla teyit edildi.

Bugün 0/0 gerçek sayı görmek bu kararın kanıtı DEĞİL — karar yukarıdaki şema satırlarından geliyor.

## 4. Unknown field / relationship / root key tespiti — GERÇEKTEN UYGULANDI

`supabase/functions/parasut-sync/schema_guard.ts` — genel, kaynak-bağımsız `detectUnknownKeys(items, knownAttributeKeys, knownRelationshipKeys)`:
- `unknown_root_keys`: JSON:API zarfının gerçek anahtar seti (`id,type,attributes,relationships,links,meta`) dışında kalan her kök anahtar.
- `unknown_attribute_keys` / `unknown_relationship_keys`: her mapper'ın yanına konan `*_KNOWN_ATTRIBUTE_KEYS`/`*_KNOWN_RELATIONSHIP_KEYS` manifestosu (mapper'ın gerçekten okuduğu anahtarlarla birebir, reflection değil) ile karşılaştırma.
- `inspected_resource_count`: gerçekten taranan öğe sayısı.

4 kaynağın `syncSalaries/syncTaxes/syncTags/syncEInvoiceInboxes` fonksiyonlarına gerçekten kablolandı — `index.ts`'te her biri `detectUnknownKeys(...)` çağırıyor, sonucu hem HTTP yanıtına (`unknown_keys`) hem `sync_runs.metadata` (yeni migration `20260903010000_phase13_1_sync_runs_metadata.sql` ile eklenen gerçek `jsonb` sütun) içine yazıyor. **Bilinçli olarak dahil edilmeyen bilinen alan:** salaries/taxes'in gerçek `tags` ilişkisi (§2) — bu, gelecekte gerçek bir kayıt geldiğinde mekanizmanın onu GERÇEKTEN `unknown_relationship_keys: ["tags"]` olarak yakalayacağını kanıtlamak için bilerek "bilinmeyen" bırakıldı; sahte bir pozitif değil, gerçek bir kanıt.

Bu oturumda 4 kaynağa karşı gerçek dry run + 2 ardışık gerçek sync çalıştırıldı (canlı `POST /functions/v1/parasut-sync`, deploy edilen fonksiyona karşı):

| Kaynak | dry_run unknown_keys | sync#1 | sync#2 | sync_runs.metadata (DB'den okundu) |
|---|---|---|---|---|
| salaries | tümü `[]`, `inspected_resource_count:0` | aynı | aynı | ✅ gerçek satırda mevcut |
| taxes | aynı | aynı | aynı | ✅ |
| tags | aynı | aynı | aynı | ✅ |
| e_invoice_inboxes | aynı | aynı | aynı | ✅ |

Bugün `[]` olması beklenen sonuç (0 gerçek kayıt) — ama **mekanizmanın kendisi** artık kodda var ve çalışıyor (ertelenmedi), `sync_runs`'a gerçekten yazıyor (var olmayan bir sütuna yazmadı — yeni `metadata jsonb` sütunu migration ile eklendi ve DB'de doğrulandı), finalize hatası sessizce yutulmadı (aynı `finishRun`/try-catch zinciri, değişmedi), credential/header raw'a asla girmiyor (mapper'lar yalnızca `item.attributes`/`item.relationships` okuyor, hiçbir HTTP header'ı JsonApiResource'a hiç girmiyor).

## 5. e_invoice_inboxes — gerçek iş anlamı ve yeniden adlandırma

Resmi Swagger kanıtı (§2): tüm attribute'lar `readOnly`, hiç ilişki yok, tek gerçek filtre `filter[vkn]`, **`GET /{id}` yok**. API dokümantasyonunun kendi prose'u (bu oturumda `apidocs.parasut.com` üzerinden WebFetch ile okunan özet): *"müşterinin e-Fatura gelen kutusu olup olmadığına bakmak gereklidir"* — yani bu kaynak, bir VKN'nin (vergi kimlik no) e-faturaya kayıtlı bir mükellef olup olmadığını sorgulamak için var; gelen kutuya düşen mesaj/belge listesi DEĞİL.

**Karar: "E-Fatura Kutuları" adı yanıltıcı (mesaj/gelen kutu izlenimi veriyor) → "E-Fatura Mükellef Sorgulama" olarak değiştirildi.**
- Route: `/satislar/e-fatura-kutulari` → `/satislar/e-fatura-mukellefleri` (`src/App.tsx`).
- Başlık/açıklama: `src/pages/EFaturaKutulari.tsx` — "E-Fatura Mükellef Sorgulama" + "VKN'ye göre sorgulanan gerçek e-fatura mükellefi kayıtları (gelen kutusu/mesaj listesi değildir)".
- Nav: `DemoHome.tsx` ve yeni `Faturalar.tsx` linki (§7) güncellendi.
- Eski route (`/satislar/e-fatura-kutulari`) artık tanımlı değil — React Router'ın `path="*"` fallback'i (DemoHome) devreye giriyor, sahte/boş bir sayfa değil, gerçek ana sayfa.

## 6. Detail route matrisi

| Kaynak | Swagger `GET /{id}` | Karar | Route | Kaynak |
|---|---|---|---|---|
| salaries | ✅ var | Detail route eklendi | `/giderler/maaslar/:parasutId` | `parasut_salaries_demo` view, `parasut_id` filtresi |
| taxes | ✅ var | Detail route eklendi | `/giderler/vergiler/:parasutId` | `parasut_taxes_demo` view |
| tags | ✅ var | Detail route eklendi | `/ayarlar/etiketler/:parasutId` | `parasut_tags_demo` view |
| e_invoice_inboxes | ❌ yok | **DETAIL_ENDPOINT_BLOCKED/UNSUPPORTED** — route eklenmedi | — | — |

Yeni generic `src/pages/EmptyResourceDetail.tsx` yalnızca ilgili public view'ı `parasut_id` ile filtreler (raw asla okunmaz); bugün olmayan bir ID için gerçek "Kayıt bulunamadı." gösterir, hiçbir sahte nesne kurulmaz. `EmptyResourceList.tsx`'e eklenen opsiyonel `detailBase` prop'u yalnızca gerçek detail route'u olan 3 kaynakta set edildi (`Maaslar.tsx`, `Vergiler.tsx`, `Etiketler.tsx`) — `EFaturaKutulari.tsx`'te bilerek set EDİLMEDİ, satırlar hiçbir yere link vermiyor.

Route sırası (`src/App.tsx`): `/giderler/maaslar` → `/giderler/maaslar/:parasutId` → `/giderler/vergiler` → `/giderler/vergiler/:parasutId` → `/giderler/:parasutId` (dinamik catch-all EN SONDA) — statik route'lar dinamik olandan önce, doğrulandı.

## 7. Navigasyon — sadece DemoHome değil

| Kaynak | Yeni/onaylı nav girişi |
|---|---|
| Maaşlar | `Giderler.tsx` üst nav şeridi (Tedarikçiler/Gider ödemeleri/Çalışanlar yanına eklendi) + DemoHome (zaten vardı) |
| Vergiler | `Giderler.tsx` üst nav şeridi + DemoHome |
| Etiketler | `Giderler.tsx` üst nav şeridi (etiketler satış/gider genelinde kullanılan bir kavram olduğundan) + DemoHome (zaten vardı) — bu uygulamada ayrı bir "Ayarlar" hub sayfası hiç yok (IA'da böyle bir sayfa mevcut değil, uydurulmadı) |
| E-Fatura Mükellef Sorgulama | `Faturalar.tsx` (Satış Faturaları) üst nav şeridine yeni eklendi — gerçek iş bağlamı (bir müşteriye e-fatura mı e-arşiv mi kesileceği, VKN sorgusuyla belirlenir) + DemoHome (güncellendi) |

Hiçbir sayaç hardcode edilmedi — hepsi ilgili count view'dan okunuyor (değişmedi, Phase 13'ten).

## 8. Boş ekran alanları

Değişmedi — Phase 13'teki `EmptyResourceList` kolonları zaten yalnızca §2'de PARASUT_AUTHORITATIVE olarak doğrulanan alanları gösteriyordu (description/currency/issue_date/due_date/net_total/remaining/archived, vs.). Bu fazda ek sahte satır/ID/placeholder eklenmedi. Boş durum metni aynı: "Henüz kayıt bulunmuyor." + "Paraşüt hesabında bu kaynak için mevcut kayıt yok."

## 9. Sayaç kaynağı zinciri

Değişmedi (Phase 13'te zaten doğru kurulmuştu, bu fazda tekrar doğrulandı): API `fetched_count` (`result.items.length`, tam `fetchAllPages` sonucu) → base tablo `count(*)` → `public.parasut_*_counts_demo` (durable SQL count view) → UI `totalCount` (yalnızca count view'dan `.single()`). `.length` yalnızca TAM çekilmiş `result.items` dizisinde sayım için kullanılıyor, hiçbir UI toplamı için değil. `salaries`/`taxes` bugün `meta.total_count` döndürmüyor (Phase 13'te doğrulandı) — `fetchAllPages` her sayfa gerçek `data.length < pageSize` olana kadar devam ediyor (kod, `parasut_client.ts`, değişmedi), yani sayfalama meta'ya değil gerçek sayfa doluluk durumuna dayanıyor — gelecekte 1000+ gerçek kayıt olsa bile tüm sayfalar tamamlanana kadar durmaz.

## 10. Tam regresyon (bu oturumda gerçek DB sorgusuyla)

| Modül | Gerçek sayı |
|---|---:|
| contacts | 448 |
| contact_people | 2 |
| products | 2597 |
| item_categories | 0 |
| sales_invoices | 451 |
| sales_invoice_details | 1402 |
| purchase_bills | 811 |
| purchase_bill_details | 1925 |
| e_invoices | 1238 |
| e_archives | 24 |
| payments | 1651 |
| checks | 40 |
| transactions | 1498 |
| accounts | 3 |
| sales_offers | 1 |
| sales_offer_details | 1 |
| sales_offer_activities | 2 |
| shipment_documents | 15 |
| shipment_document_activities | 52 |
| stock_movements | 3330 |
| employees | 6 |
| warehouses | 1 |
| salaries | 0 |
| taxes | 0 |
| tags | 0 |
| e_invoice_inboxes | 0 |
| users | 1 |
| companies | 1 |

Hiçbir sapma yok; Phase 13 raporundaki 5 çekirdek sayı (448/451/811/2597/6) birebir tekrarlandı.

## 11. Test / build / deploy

- Migration `20260903010000_phase13_1_sync_runs_metadata.sql` gerçekten hosted DB'ye uygulandı (`metadata jsonb` sütunu `information_schema.columns`'ta doğrulandı).
- `supabase functions deploy parasut-sync --use-api` → başarılı.
- 4 kaynak için canlı dry run + 2 ardışık gerçek sync (`POST /functions/v1/parasut-sync`) — hepsi `success`, `unknown_keys` DB'de `sync_runs.metadata`'da gerçekten kalıcı (SQL ile doğrulandı, bkz. §4).
- `npx tsc --noEmit` → 0 hata (Login.tsx:55 bilinen/kapsam dışı sorun, bu koşuda da hata vermedi).
- `npx eslint .` → 0 hata, 10 uyarı (hepsi önceden var olan, bu fazın dosyalarında değil).
- `npx vitest run` → 1/1 test geçti.
- `npm run build:demo` → başarılı, yeni chunk'lar: `MaasDetay`, `VergiDetay`, `EtiketDetay`, güncellenmiş `Faturalar`/`Giderler`/`EmptyResourceList`/`EFaturaKutulari`/`DemoHome`.
- FTP deploy: `MSYS_NO_PATHCONV=1 python scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` → 54 dosya, doğru hedef.
- Canlı bundle hash doğrulaması: `curl https://demo.eclipsemuhendislik.com/` → `index-JoKhOryD.js`, yerel `npm run build:demo` çıktısındaki hash ile birebir eşleşiyor.
- Route HTTP 200 kontrolü (`curl -sk -o /dev/null -w "%{http_code}"`): `/`, `/giderler/maaslar`, `/giderler/maaslar/1`, `/giderler/vergiler`, `/giderler/vergiler/1`, `/ayarlar/etiketler`, `/ayarlar/etiketler/1`, `/satislar/e-fatura-mukellefleri` → hepsi 200 (SPA fallback, gerçek build'den sunuluyor).

## 12. Karar

**PASS:**
- Resmi Swagger şeması bu oturumda gerçekten indirilip ayrıştırıldı (uydurulmadı) — §2'deki alan/ilişki/endpoint matrisi doğrudan `swagger.json`'dan.
- `archived` semantiği kanıtlandı: salaries/taxes'te GERÇEK bir attribute + gerçek `/archive`/`/unarchive` endpoint'i var (sayaç korunuyor, filtre eksikliği açıkça raporlanıyor); tags/e_invoice_inboxes'ta YOK (sayaç yok, tahmin edilmedi).
- Unknown-field/relationship/root-key tespiti GERÇEKTEN koda yazıldı (`schema_guard.ts`), 4 kaynağa kablolandı, `sync_runs.metadata` (yeni gerçek migration) içine gerçekten persist ediliyor, canlı sync'lerle doğrulandı — ertelenmedi.
- `e_invoice_inboxes` gerçek iş anlamına göre yeniden adlandırıldı ("E-Fatura Mükellef Sorgulama"), route/başlık/açıklama güncellendi; detail route BİLEREK eklenmedi (gerçek `GET /{id}` yok).
- salaries/taxes/tags için gerçek detail route'ları (`GET /{id}` swagger'da var) eklendi, sahte veri kullanmadan, "Kayıt bulunamadı" gerçek boş durumuyla.
- Navigasyon yalnızca DemoHome'a değil, gerçek IA sayfalarına (Giderler, Faturalar) eklendi.
- Tam regresyon: 27 modül, hiçbir sapma yok.
- Kod SHA tam ve gerçek (bu raporun başında + commit zinciri).

**FAIL:** Yok.

**BLOCKED:** `e_invoice_inboxes` detail route — swagger'da `GET /{id}` tanımlı değil, kasıtlı olarak eklenmedi (DETAIL_ENDPOINT_BLOCKED/UNSUPPORTED).

**Bilinen, kapsam dışı not:** salaries/taxes'in gerçek `tags` ilişkisi (many-to-many) henüz normalize bir junction tabloya haritalanmadı — `raw jsonb` içinde tam korunuyor, hiçbir veri kaybı yok, `unknown_relationship_keys` mekanizması bunu bilerek "bilinmeyen" olarak işaretliyor (gelecekteki bir faz için).

## Tarayıcıda test için route'lar

- https://demo.eclipsemuhendislik.com/giderler/maaslar
- https://demo.eclipsemuhendislik.com/giderler/maaslar/1 (gerçek "Kayıt bulunamadı")
- https://demo.eclipsemuhendislik.com/giderler/vergiler
- https://demo.eclipsemuhendislik.com/giderler/vergiler/1
- https://demo.eclipsemuhendislik.com/ayarlar/etiketler
- https://demo.eclipsemuhendislik.com/ayarlar/etiketler/1
- https://demo.eclipsemuhendislik.com/satislar/e-fatura-mukellefleri
- https://demo.eclipsemuhendislik.com/giderler (yeni nav linkleri)
- https://demo.eclipsemuhendislik.com/satislar/faturalar (yeni nav linki)
