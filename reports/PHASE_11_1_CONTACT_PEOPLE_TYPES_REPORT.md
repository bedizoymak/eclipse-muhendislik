# Phase 11.1 — contact_people Root Type ve Parent Type Düzeltmesi

**Tarih:** 2026-08-28
**Kapsam:** Phase 11'in eksik bıraktığı iki gerçek API type değerinin (root `contact_people` tipi, ebeveyn `contacts` tipi) API → Supabase (base/raw) → public view → müşteri detay UI zincirine eklenmesi.
**Düzeltilen faz:** Phase 11 (`reports/PHASE_11_CONTACT_PEOPLE_REPORT.md`, kod commit `a6cc4c2294f64a58aeb80b9de7f8823062500040`)
**Canlı URL:** https://demo.eclipsemuhendislik.com

## 1. Gerçek type kaynağı

Gerçek Parasut v4 API'sine, gerçek OAuth2 password-grant token ile yapılan gerçek isteklerle doğrulandı.

| Kontrol | İstek | Sonuç |
|---|---|---|
| Ebeveyn contact SINGLE + `include=contact_people` | `GET /contacts/1023810918?include=contact_people` | 200 — `data.type="contacts"`, `relationships.contact_people.data=[{"id":"1001791599","type":"contact_people"}]`, `included[0].type="contact_people"` |
| Ebeveyn contact SINGLE + `include=contact_people` | `GET /contacts/1033894452?include=contact_people` | 200 — aynı desen: `relationships.contact_people.data=[{"id":"1002186316","type":"contact_people"}]`, `included[0].type="contact_people"` |
| Nested include SINGLE | `GET /contacts/1023810918?include=contact_people.contact` | 200 — `included[0].relationships.contact.data = {"id":"1023810918","type":"contacts"}` |
| Nested include SINGLE | `GET /contacts/1033894452?include=contact_people.contact` | 200 — `included[0].relationships.contact.data = {"id":"1033894452","type":"contacts"}` |
| Nested include LIST | `GET /contacts?include=contact_people.contact&filter[archived]=false` | **400** `{"errors":[{"title":"Bad Request","detail":"contact_people.contact is not a valid relation. Acceptable: category, contact_portal, contact_people, company, tags, price_list"}]}` — gerçek, doğrulanmış: LIST endpoint nested include zincirini kabul etmiyor |

**Her iki gerçek kayıt için, her tip değerinin geldiği gerçek API yolu ayrı ayrı:**

| contact_person parasut_id | root type kaynağı | root type değeri | parent type kaynağı | parent type değeri |
|---|---|---|---|---|
| 1001791599 | `included[].type` (contact_people kaynağının kendi `type` alanı) | `contact_people` | nested include'un (`include=contact_people.contact`, SINGLE) çocuk kaynağının kendi `relationships.contact.data.type` | `contacts` |
| 1002186316 | `included[].type` | `contact_people` | aynı nested yol | `contacts` |

**Çelişki kontrolü:** Normal include'daki `relationships.contact_people.data[].type` (ebeveynin **kendi** ilişki listesindeki ÇOCUK referansının tipi, her zaman `"contact_people"`) ile nested include'daki `included[].relationships.contact.data.type` (ÇOCUĞUN kendi EBEVEYN referansının tipi, her zaman `"contacts"`) **farklı şeyleri** temsil ediyor — biri çocuğun tipini, diğeri ebeveynin tipini taşıyor. İkisi arasında gerçek bir çelişki yok, sadece farklı anlam. Her iki kayıtta da bu iki yol iç tutarlı: id'ler eşleşiyor (nested include'un `relationships.contact.data.id` her zaman doğru ebeveyn contact id'sine eşit), tipler beklenen (`contact_people` / `contacts`). **BLOCKED durumu yok, gerçek çelişki bulunmadı.**

**Önemli gerçek bulgu (LIST endpoint kısıtı):** LIST endpoint nested include zincirini (`contact_people.contact`) 400 ile reddediyor — sadece SINGLE endpoint kabul ediyor (Phase 11'in bölüm 1'inde zaten SINGLE için doğrulanmıştı, bu fazda LIST için de test edilip reddedildiği doğrulandı). Bu nedenle sync, tüm 448 contact için toplu LIST çağrısını (`include=contact_people`, mevcut) korur ve SADECE gerçekten `contact_people` içeren contact'lar için (bu hesapta 2/448) ek bir gerçek SINGLE çağrısı (`include=contact_people.contact`) yapar — parent type'ı zorlamadan, uydurmadan.

## 2. Supabase modeli

Yeni migration: `supabase/migrations/20260829030000_parasut_contact_people_types.sql` (Phase 11'in `20260829020000_parasut_contact_people_demo.sql` migration'ı hiç düzenlenmedi).

`parasut.contact_people` tablosuna eklenen kolonlar:

| Kolon | Kaynak | Not |
|---|---|---|
| `resource_type text` | `mapContactPerson()` içinde `item.type` (dahil edilen contact_people kaynağının kendi `type` alanı) | Nullable, DEFAULT yok — eski satırlar sync'e kadar NULL kaldı |
| `contact_type text` | `mapContactPerson()`'a parametre olarak geçirilen, `extractContactPeople()`'da nested include'dan çözülen gerçek parent type | Nullable, DEFAULT yok — eski satırlar sync'e kadar NULL kaldı |

Kurallar uygulandı:
- **Blind SQL constant default yok** — `alter table ... add column` DEFAULT'suz, mevcut 2 satır migration sonrası NULL kaldı (aşağıda doğrulandı), sadece gerçek sync sonrası gerçek değerle doldu.
- Upsert anahtarı: mevcut gerçek `parasut_id` (`onConflict: "parasut_id"`), değişmedi.
- `raw jsonb` aynen korunuyor, dokunulmadı.
- `public.parasut_contact_people_demo` view'ı iki güvenli type kolonunu da içerecek şekilde yeniden oluşturuldu (kolon sırası ortaya eklendiği için `CREATE OR REPLACE VIEW` Postgres tarafından reddedildi — `DROP VIEW` + `CREATE VIEW` kullanıldı, gerçek hata mesajı: `cannot change name of view column "parasut_created_at" to "resource_type" (SQLSTATE 42P16)`, düzeltildi ve tekrar uygulandı).

Migration sonrası, sync öncesi doğrulama (gerçek REST sorgusu):
```json
{"parasut_id":1001791599,...,"resource_type":null,"contact_type":null,...}
{"parasut_id":1002186316,...,"resource_type":null,"contact_type":null,...}
```
Null korundu, uydurulmadı — kural karşılandı.

## 3. Sync

`supabase/functions/parasut-sync/resources/contacts.ts`:
- `ContactPersonRow`'a `resource_type: string | null` ve `contact_type: string | null` eklendi.
- `mapContactPerson(item, contactParasutId, contactType)` artık üçüncü parametre alıyor; `resource_type: item.type ?? null` doğrudan gerçek kaynak objesinden okunuyor.

`supabase/functions/parasut-sync/index.ts` — `extractContactPeople()`:
- Artık `async`, `accessToken` parametresi alıyor.
- Contact'ların LIST çağrısı **değişmedi** (`include=contact_people`, tüm 448 contact tek seferde).
- Sadece gerçekten `contact_people` içeren contact'lar için (`personRefs.length > 0`), `fetchResource(accessToken, "contacts", contact.id, { include: "contact_people.contact" })` ile gerçek, ek bir SINGLE çağrısı yapılıyor (mevcut `fetchResource()` yardımcı fonksiyonu — sales_offers.activities için zaten aynı "LIST reddediyor, SINGLE kabul ediyor" deseninde kullanılıyordu).
- Bu SINGLE cevabının kendi `included` dizisinden, gerçek contact_person kaynağının `relationships.contact.data.type` alanı okunuyor — parent type asla `"contacts"` sabit string'i olarak yazılmadı, asla route'tan/id'den türetilmedi.
- Yeni sayaçlar: `missingTypeCount` (root veya parent type null geldiyse), `typeMismatchCount` (nested include'un kendi ebeveyn id'si forward ilişkideki contact id ile uyuşmuyorsa, VEYA forward `ref.type` dahil edilen kaynağın kendi `type`'ı ile uyuşmuyorsa, VEYA nested SINGLE çağrısının kendi `data.type`'ı `"contacts"` değilse).
- `responseFields`'a `contact_people_missing_type_count` ve `contact_people_type_mismatch_count` eklendi (mevcut `duplicate`/`unresolved`/`stale`/`error` sayaçlarının yanına, `dbFields`'a değil — o tabloda bu kolonlar yok, talimat gereği var olmayan kolona yazılmadı).

### Dry run + iki ardışık gerçek sync

```
Dry run:
{"status":"dry_run","total_fetched_count":448,"contact_people_fetched_count":2,
 "contact_people_duplicate_count":0,"contact_people_unresolved_count":0,
 "contact_people_missing_type_count":0,"contact_people_type_mismatch_count":0,"error_count":0}

Gerçek sync #1:
{"status":"success","upserted_count":448,"contact_people_upserted_count":2,
 "contact_people_duplicate_count":0,"contact_people_unresolved_count":0,
 "contact_people_missing_type_count":0,"contact_people_type_mismatch_count":0,
 "contact_people_stale_removed_count":0,"error_count":0}

Gerçek sync #2 (ardışık):
{"status":"success","upserted_count":448,"contact_people_upserted_count":2,
 "contact_people_duplicate_count":0,"contact_people_unresolved_count":0,
 "contact_people_missing_type_count":0,"contact_people_type_mismatch_count":0,
 "contact_people_stale_removed_count":0,"error_count":0}
```
İki ardışık gerçek sync birebir aynı — idempotent, PASS.

Sync sonrası view (gerçek REST sorgusu):
```json
{"parasut_id":1001791599,"resource_type":"contact_people","contact_type":"contacts",...}
{"parasut_id":1002186316,"resource_type":"contact_people","contact_type":"contacts",...}
```

**Beklenen mevcut gerçek durum (yeniden doğrulandı):** contact_people **2**, `resource_type=contact_people`: **2**, `contact_type=contacts`: **2**, missing type: **0**, type mismatch: **0**, duplicate/unresolved/stale/error: **0/0/0/0** — kaynak değişmemiş, zorlanmadı.

## 4. Frontend

`src/pages/MusteriDetay.tsx`, "Yetkili Kişiler" kartı (sayfa yapısı değişmedi, sadece kart alanları genişletildi):
- `ContactPersonDemoRow` arayüzüne `resource_type` ve `contact_type` eklendi.
- Supabase `select()` sorgusuna iki kolon eklendi.
- Kartta ayrı, bağımsız alanlar olarak eklendi: **Resource type** (`person.resource_type ?? "—"`) ve **Parent type** (`person.contact_type ?? "—"`) — ID alanlarının hemen yanında, isim/müşteri linkiyle karıştırılmadan.

Canlı doğrulanan gerçek render (1023810918, Deniz Bafra):
```
PARAŞÜT ID: 1001791599
RESOURCE TYPE: contact_people
BAĞLI MÜŞTERİ (CONTACT) ID: 1023810918
PARENT TYPE: contacts
```
Ham API type değeri birebir gösteriliyor, isim/müşteri linki type alanının yerine geçmiyor.

## 5. Tam alan denetimi (API → Base → Raw → View → TS tipi → UI)

| API yolu | Base | Raw | View | TS tipi | UI | Gerçek değer (1001791599 / 1002186316) |
|---|---|---|---|---|---|---|
| `included[].id` | `parasut_id bigint` | ✓ | `parasut_id` | `number` | "Paraşüt ID" | 1001791599 / 1002186316 |
| `included[].type` | `resource_type text` (YENİ) | ✓ | `resource_type` | `string \| null` | "Resource type" | `contact_people` / `contact_people` |
| `attributes.name` | `name text` | ✓ | `name` | `string \| null` | Kart başlığı | Deniz Bafra / METİN ÖZCAN |
| `attributes.email` | `email text` | ✓ | `email` | `string \| null` | "E-posta" | deniz@iskogrup.com / null→"—" |
| `attributes.phone` | `phone text` | ✓ | `phone` | `string \| null` | "Telefon" | 05337065596 / 05423529483 |
| `attributes.notes` | `notes text` | ✓ | `notes` | `string \| null` | "Not" | null→"—" / null→"—" |
| `attributes.created_at` | `parasut_created_at timestamptz` | ✓ | `parasut_created_at` | `string \| null` | "Oluşturulma (UTC)" | ISO string |
| `attributes.updated_at` | `parasut_updated_at timestamptz` | ✓ | `parasut_updated_at` | `string \| null` | "Güncellenme (UTC)" | ISO string |
| ebeveyn contact id (`relationships.contact_people.data` forward yol) | `contact_parasut_id bigint` | ✓ | `contact_parasut_id` | `number \| null` | "Bağlı müşteri (contact) ID" | 1023810918 / 1033894452 |
| ebeveyn `relationships.contact.data.type` (nested include, YENİ) | `contact_type text` (YENİ) | ✓ | `contact_type` | `string \| null` | "Parent type" | `contacts` / `contacts` |

API'nin döndürdüğü hiçbir gerçek ID/type alanı UI'de "gösterilmiyor" değil — tam kapsama.

## 6. Regresyon tanım düzeltmeleri (yeniden doğrulandı, zorlanmadı)

| Metrik | Filtre/görünüm | Beklenen | Gerçek | Durum |
|---|---|---|---|---|
| Sevkiyat stok hareketleri | `parasut_stock_movements_demo?source_type=eq.shipment_documents` | 20 | 20 | PASS |
| Çek ödemeleri | `parasut_payments_demo?payable_type=eq.checks` | 35 | 35 | PASS |
| Toplam stock_movements (ayrı metrik) | `parasut_stock_movements_demo` (filtresiz) | 3330 | 3330 | PASS — sevkiyat alt kümesinin (20) yerine geçmiyor, ayrı ve gerçek |

`check_payments` adında ayrı bir tablo/view gerekmedi — mevcut `parasut_payments_demo?payable_type=eq.checks` filtresi gerçek kaynak, doğrulandı.

**Tam regresyon listesi (hosted Supabase, gerçek REST count sorguları):**

| Kaynak | Beklenen | Gerçek | Durum |
|---|---|---|---|
| contacts | 448 | 448 | PASS |
| employees | 6 | 6 | PASS |
| salaries | 0 | 0 (employee_meta `payable_total`/`advance_total`=0, ayrı salaries view yok — Phase 11'deki gibi) | PASS |
| shipment_documents | 15 | 15 | PASS |
| shipment stock movements | 20 | 20 | PASS |
| shipment activities | 52 | 52 | PASS |
| shipment invoice links | 1 | 1 | PASS |
| products | 2597 | 2597 | PASS |
| sales_invoices | 451 | 451 | PASS |
| purchase_bills | 811 | 811 | PASS |
| e_invoices | 1238 | 1238 | PASS |
| e_archives | 24 | 24 | PASS |
| checks | 40 | 40 | PASS |
| check_payments | 35 | 35 | PASS |
| payments | 1651 | 1651 | PASS |
| transactions | 1498 | 1498 | PASS |
| accounts | 3 | 3 | PASS |
| sales_offers / details / activities | 1 / 1 / 2 | 1 / 1 / 2 | PASS |

## 7. Test ve dağıtım

- Migration `20260829030000_parasut_contact_people_types.sql` hosted Supabase'e uygulandı (`supabase db push --yes`; ilk deneme `CREATE OR REPLACE VIEW` kolon-sırası hatası verdi, `DROP VIEW`+`CREATE VIEW`'a çevrilip tekrar uygulandı — "Finished supabase db push").
- Edge Function `parasut-sync` deploy edildi (`supabase functions deploy parasut-sync --use-api`, iki kez — ilk deploy sonrası kod düzeltmesi yapılıp ikinci kez deploy edildi).
- Dry run + iki ardışık gerçek sync: bölüm 3'te tam çıktı, PASS.
- `npm test` → 1/1 PASS.
- `npm run lint` → 0 hata (10 önceden var olan uyarı, ilgisiz UI dosyalarında — Phase 11 ile birebir aynı liste).
- `npm run build:demo` → başarılı, `MusteriDetay-BcaFwZRd.js` ve `index-Bw_FpN3K.js` yeni hash'lerle üretildi.
- `npx tsc --noEmit -p tsconfig.app.json` → yalnızca bilinen, kapsam dışı `Login.tsx(55,17)` hatası (dokunulmadı).
- Bundle güvenlik taraması: `dist/demo/` içinde `PARASUT_CLIENT_SECRET`, `PARASUT_PASSWORD`, `SUPABASE_DB_URL`, `service_role` string'leri bulunamadı — temiz.
- FTP deploy: `scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` → 44 dosya `/public_html/demo`'ya yüklendi (`MSYS_NO_PATHCONV=1` ile — Git Bash'in `/public_html/demo` argümanını yerel Windows yoluna çevirmesini engellemek için gerekliydi, ilk deneme yanlış yerel yola gitmişti, tespit edilip düzeltildi).
- Canlı doğrulama: `https://demo.eclipsemuhendislik.com/` → 200, yüklenen bundle hash'i (`index-Bw_FpN3K.js`) build çıktısıyla birebir eşleşiyor.
- `musteriler/1023810918` (kişili) → **200**. `musteriler/1033894452` (kişili) → **200**. `musteriler/1010689160` (kişisiz) → **200**.
- Gerçek headless-Chrome (Puppeteer, gerçek Chrome, `acceptInsecureCerts` ile bu sandbox'ın kök sertifika deposu eksikliği aşıldı — canlı sunucunun kendi sertifikası ile ilgisiz, gerçek tarayıcılarda sorun yok), 390px ve 768px viewport'larda, 3 rota:

| Rota | Viewport | HTTP | Console hatası | Network 4xx/5xx | Yatay taşma | "Yetkili Kişiler" | Resource/Parent type görünür |
|---|---|---|---|---|---|---|---|
| 1023810918 (kişili) | 390px | 200 | 0 | 0 | Hayır | Evet | Evet (`contact_people`/`contacts`) |
| 1023810918 (kişili) | 768px | 200 | 0 | 0 | Hayır | Evet | Evet |
| 1033894452 (kişili) | 390px | 200 | 0 | 0 | Hayır | Evet | Evet |
| 1033894452 (kişili) | 768px | 200 | 0 | 0 | Hayır | Evet | Evet |
| 1010689160 (kişisiz) | 390px | 200 | 0 | 0 | Hayır | Evet | "İlişkili yetkili kişi yok" |
| 1010689160 (kişisiz) | 768px | 200 | 0 | 0 | Hayır | Evet | "İlişkili yetkili kişi yok" |

Tüm 6 kontrol PASS. Geçici CDP scripti (`cdp_check_phase111.mjs`) proje kökünden silindi, commit edilmedi.

## 8. Sonuç

**Tarayıcı doğrulaması için gerçek ID'ler:**
- Kişisi olan contact: `1023810918` (PGT POLİMER) — kişi: `1001791599` (Deniz Bafra), resource_type=`contact_people`, contact_type=`contacts`
- Kişisi olan contact: `1033894452` (BABAYİĞİT MAKİNA) — kişi: `1002186316` (METİN ÖZCAN), resource_type=`contact_people`, contact_type=`contacts`
- Kişisi olmayan contact: `1010689160`

**Bölüm bazlı PASS/FAIL/BLOCKED:**

| Bölüm | Durum |
|---|---|
| 1. Gerçek type kaynağı | PASS |
| 2. Supabase modeli | PASS |
| 3. Sync | PASS |
| 4. Frontend | PASS |
| 5. Tam alan denetimi | PASS |
| 6. Regresyon tanım düzeltmeleri | PASS |
| 7. Test/deploy | PASS |

**Kök neden (varsa FAIL/BLOCKED):** Yok. Tek dikkat notu: LIST endpoint'in nested `include=contact_people.contact` zincirini reddettiği (400, doğrulandı) gerçek bir API kısıtı — bu, ekstra bir gerçek SINGLE çağrısıyla (yalnızca gerçekten kişisi olan 2/448 contact için) çözüldü, zorlanmadı, uydurulmadı.

**Genel karar: PASS.** Root resource type (`contact_people`) ve parent relationship type (`contacts`) her iki gerçek kayıt için de eksiksiz, gerçek API yollarından okunarak base → raw → view → TS tipi → UI zincirinin her katmanına taşındı. API'de olmayan hiçbir bilgi eklenmedi, hiçbir type sabit string veya id'den türetilmedi, null hiçbir zaman sahte bir değerle doldurulmadı.

---

**Kod commit SHA:** 86ac96651483649da50a97804a23c2fc05d25fd3
**Rapor commit SHA:** (bu commit)
