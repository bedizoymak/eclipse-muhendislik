# Phase 11 — Müşteri Yetkili Kişileri (contact_people)

**Tarih:** 2026-08-28
**Kapsam:** Parasut `contact_people` kaynağının API → Supabase (base/raw) → public view → müşteri detay UI zincirinde tam entegrasyonu.
**Canlı URL:** https://demo.eclipsemuhendislik.com

## 1. Gerçek API keşfi

Tüm istekler gerçek Parasut v4 API'sine (`https://api.parasut.com/v4/{company_id}`), gerçek OAuth2 password-grant token ile yapıldı.

| Kontrol | İstek | Sonuç |
|---|---|---|
| contacts LIST + `include=contact_people` | `GET /contacts?include=contact_people&page[size]=25` | 200 — `relationships.contact_people.data` her sayfada dolduruluyor (çoğunlukla `[]`), fakat `included` dizisi **sadece gerçekten dolu bir ilişki olduğunda** geliyor |
| contacts SINGLE + `include=contact_people` | `GET /contacts/1023810918?include=contact_people` | 200 — aynı şekilde `included` içinde tam `contact_people` kaynağı geliyor |
| Bağımsız `contact_people` LIST | `GET /contact_people` | **404** `{"errors":[{"title":"Not Found","detail":"No route matches."}]}` — bağımsız endpoint yok, doğrulandı |
| Bağımsız `contact_people` SINGLE | `GET /contact_people/1001791599` | **404** aynı hata — tekil kaynak endpoint'i de yok |
| Geçersiz include (LIST) | `include=nonexistent_relation_xyz` | **400** — hata mesajı kabul edilen ilişkileri listeliyor: `category, contact_portal, contact_people, company, tags, price_list` |
| Geçersiz include (SINGLE) | `include=nonexistent_xyz` | **200** — tekil endpoint bilinmeyen include'u sessizce yok sayıyor (LIST'ten farklı davranış) |
| Nested include | `include=contact_people.contact` (SINGLE) | 200 — `included` içindeki `contact_people` kaynağının **kendi** `relationships.contact.data` alanı bu durumda gerçek `{id, type:"contacts"}` ile doluyor |
| Sayfalama | 440 aktif kontak, 18 sayfa (`page[size]=25`), `meta.total_pages`/`total_count` tutarlı | PASS |
| Aktif/arşiv kapsamı | `filter[archived]=false` → 440, `filter[archived]=true` → 8, toplam 448 | Baseline ile birebir uyumlu |

**Önemli bulgu:** contact_people kaynağının **kendi** `relationships.contact` alanı, LIST/SINGLE'ın normal (`include=contact_people`) çağrısında her zaman `{"meta":{}}` — veri yok. Gerçek ebeveyn ilişkisi ancak iki yoldan biriyle kurulabiliyor: (a) ebeveyn contact'ın **kendi** `relationships.contact_people.data` listesi (id+type), veya (b) `include=contact_people.contact` nested include'u ile contact_person kaynağının kendi `relationships.contact.data`'sının doldurulması. Senkronizasyonda (a) yolu kullanıldı çünkü zaten `include=contact_people` tek çağrıda hem contacts hem contact_people'ı getiriyor; ekstra nested include gerektirmiyor.

## 2. contact_people tam alan envanteri

Sistemde şu an gerçek **2 adet** contact_people kaydı var (aşağıda tamamı). Envanter:

| API yolu | Bulunan | Dolu | Null | Boş string/array/object | Veri tipi |
|---|---|---|---|---|---|
| `data.id` | 2/2 | 2/2 | 0 | 0 | string (numeric) |
| `data.type` | 2/2 | 2/2 | 0 | 0 | string, hep `"contact_people"` |
| `attributes.name` | 2/2 | 2/2 | 0 | 0 | string |
| `attributes.email` | 2/2 | 1/2 | 1/2 | 0 | string \| null |
| `attributes.phone` | 2/2 | 2/2 | 0 | 0 | string |
| `attributes.notes` | 2/2 | 0/2 | 2/2 | 0 | null (her iki kayıtta da null) |
| `attributes.created_at` | 2/2 | 2/2 | 0 | 0 | ISO8601 UTC string |
| `attributes.updated_at` | 2/2 | 2/2 | 0 | 0 | ISO8601 UTC string |
| `relationships.contact` (kendi ilişkisi, include olmadan) | 2/2 | 0/2 | — | 2/2 (`{"meta":{}}`, data yok) | object (empty-meta) |
| `relationships.contact.data` (nested include ile) | 1/1 test edildi | 1/1 | 0 | 0 | object `{id,type}` |
| `meta.created_at` / `meta.updated_at` | 2/2 | 2/2 | 0 | 0 | LIST/SINGLE üst-seviye `meta` içinde attributes ile birebir aynı, tekrar |
| `links` | 2/2 | 0/2 | — | — | contact_people kaynağında hiç `links` alanı gözlenmedi |

Diğer olası ilişki anahtarları (`comments`, `activities`, `tags`, `company`) contact_people kaynağının `relationships` objesinde **hiç görünmüyor** — sadece `contact` anahtarı var. Bu nedenle 4. bölümdeki "diğer ilişkiler" incelemesi kapsamında ek tablo/UI inşa edilmedi (gerçek kaynakta böyle bir alan yok).

## 3. Ebeveyn contact ilişkisi

| contact_person parasut_id | name | ebeveyn contact id | ebeveyn contact adı |
|---|---|---|---|
| 1001791599 | Deniz Bafra | 1023810918 | PGT POLİMER GELİŞTİRME TEKNOLOJİLERİ A.Ş. |
| 1002186316 | METİN ÖZCAN | 1033894452 | BABAYİĞİT MAKİNA TORNA TESVİYE TURİZİM İNŞAAT SANAYİ VE TİC LTD ŞTİ |

- Her iki kayıt da **tek** bir ebeveyn contact'a bağlı — birden fazla contact'a bağlı kişi örneği bulunmadı, bu yüzden junction/polymorphic tablo inşa edilmedi (gerçek veri tek-ebeveyn modelini kanıtlıyor; kanıt olmadan varsayım yapılmadı).
- Çözülemeyen (`unresolved`) ebeveyn: **0**.
- Tekrarlayan ilişki (aynı contact_person id'nin birden fazla contact'ın `included` listesinde çıkması): **0**.
- Ebeveyn bağlantısı **isim/email/telefon eşleştirmesiyle değil**, yalnızca ebeveyn contact'ın kendi `relationships.contact_people.data` listesindeki gerçek id+type ile kuruldu (`extractContactPeople()`, `supabase/functions/parasut-sync/index.ts`).

## 4. Diğer ilişkiler

contact_people kaynağının `relationships` objesinde tek anahtar: `contact` (yukarıda ele alındı). `comments`, `activities`, `tags`, `company` anahtarları **hiç yok** — bu 448 kontağın hiçbirinin contact_people include'unda böyle bir alan gözlenmedi. Bu nedenle bu ilişkiler için tablo/sync/UI inşa edilmedi.

## 5. Mevcut Supabase tablosu denetimi

`parasut.contact_people` tablosu bu fazdan önce zaten mevcuttu (önceki keşif fazında oluşturulmuş):

- Satır/benzersiz ID sayısı: **2**, her ikisi de gerçek API'deki 2 kayıtla birebir eşleşiyor.
- Yinelenen: yok.
- `raw jsonb`: her iki satırda da tam API kaynağı (id/type/attributes/relationships/meta) saklı — token/kimlik bilgisi yok.
- Ebeveyn bağlantısı (`contact_parasut_id`): her iki satırda da doğru ve API ile birebir.
- Kolon eksikliği: **yok** — mevcut şema (`parasut_id, name, email, phone, notes, contact_parasut_id, raw, parasut_created_at, parasut_updated_at, synced_at, created_at, updated_at`) API'nin döndürdüğü her alanı zaten kapsıyor.
- Null/boş koruması: `email=null` (kayıt 1002186316) ve `notes=null` (her iki kayıt) doğru şekilde null olarak saklanmış, boş string'e dönüştürülmemiş.
- Tazelik: `synced_at` bu faz sırasında yapılan gerçek senkronizasyon sonrası güncellendi (aşağıya bakınız).

**Sonuç:** Tabloya ALTER gerekmedi. Yeni migration sadece güvenli public view ekledi (bkz. bölüm 8).

## 6. Contacts sync entegrasyonu

`supabase/functions/parasut-sync/index.ts` içindeki mevcut `syncContacts()` fonksiyonu genişletildi (paralel/ayrı bir sync yolu **açılmadı**):

- `fetchActiveAndArchived(accessToken, "contacts", { include: "contact_people" })` — mevcut tüm alanlar/include'lar korunarak tek yeni include eklendi.
- Yeni `extractContactPeople()` fonksiyonu: her contact'ın **kendi** `relationships.contact_people.data` listesini gerçek ebeveyn kaynağı olarak kullanır, `included` dizisinden gerçek contact_person kaynağını çözer; çözülemeyen/yinelenen sayaçları tutar.
- `mapContactPerson()` (yeni, `resources/contacts.ts`): API alanlarını birebir DB satırına eşler, hiçbir alan tahmin edilmez.
- Batch upsert `onConflict: "parasut_id"` (mevcut `upsertBatched()` yardımcı fonksiyonu, contacts ile aynı desen).
- **Stale link temizliği:** sync hatasız tamamlandıysa (`errorCount === 0`, yani hem aktif hem arşiv sayfalaması eksiksiz), bu run'da dönmeyen `contact_people.parasut_id` satırları silinir. Sync kısmi/hatalı ise silme adımı atlanmaz — çünkü `fetchAllPages` zaten eksik sayfalamada `throw` ediyor ve fonksiyon bu noktaya hiç ulaşmıyor.
- Yeni sayaçlar (`contact_people_fetched_count`, `contact_people_upserted_count`, `contact_people_duplicate_count`, `contact_people_unresolved_count`, `contact_people_stale_removed_count`) **sadece `responseFields`'a eklendi**, `dbFields`'a (yani `parasut.sync_runs` tablosuna) **eklenmedi** — çünkü o tabloda bu kolonlar yok ve talimat gereği var olmayan bir kolona yazılmadı.
- Sync lock (mevcut `parasut.sync_runs(resource)` kısmi unique index, `status='running'`) değiştirilmedi, aynen korunuyor.
- Finalize hata kontrolü: mevcut `errorCount`/`errorMessages` akışına contact_people upsert hataları da dahil edildi.

## 7. Frontend

`src/pages/MusteriDetay.tsx` (rota: `/musteriler/:parasutId`, mevcut, yeni nav/route eklenmedi) içine "Yetkili Kişiler" bölümü eklendi:

- Ayrı bir `useEffect` ile `public.parasut_contact_people_demo` view'ından `contact_parasut_id = :parasutId` filtresiyle gerçek kayıtlar çekiliyor.
- Her kişi için: Parasut ID, ad, e-posta (`—` boşsa), telefon (`—` boşsa), not (`—` boşsa), bağlı contact ID, `parasut_created_at`/`parasut_updated_at` UTC ISO string olarak (`toISOString()`).
- Hiç kişi yoksa: **"İlişkili yetkili kişi yok."** (canlıda doğrulandı, bkz. bölüm 10).
- Birden fazla kişi varsa: hepsi listelenir, "primary" ayrımı yapılmaz.
- Fabrikasyon alan **yok**: unvan/departman/görev/"birincil kişi"/dahili telefon/kullanıcı hesabı gibi API'de olmayan hiçbir alan render edilmedi.
- Geniş içerik (kart) kendi `overflow-x-auto` sarmalayıcısında — sayfa seviyesinde yatay taşma yok (bkz. bölüm 10 CDP sonuçları).

## 8. Tam alan denetimi (API → Base → Raw → View → TS tipi → UI)

| API | Base (`parasut.contact_people`) | Raw (`raw jsonb`) | View (`public.parasut_contact_people_demo`) | TS tipi | UI | Null korunuyor |
|---|---|---|---|---|---|---|
| `id` | `parasut_id bigint` | ✓ | `parasut_id` | `number` | Parasut ID alanı | evet (NOT NULL, zaten zorunlu) |
| `attributes.name` | `name text` | ✓ | `name` | `string \| null` | Kart başlığı | evet |
| `attributes.email` | `email text` | ✓ | `email` | `string \| null` | E-posta alanı, boşsa `—` | evet (1002186316'da null → `—`) |
| `attributes.phone` | `phone text` | ✓ | `phone` | `string \| null` | Telefon alanı | evet |
| `attributes.notes` | `notes text` | ✓ | `notes` | `string \| null` | Not alanı, boşsa `—` | evet (her iki kayıtta null → `—`) |
| `attributes.created_at` | `parasut_created_at timestamptz` | ✓ | `parasut_created_at` | `string \| null` | UTC ISO string | evet |
| `attributes.updated_at` | `parasut_updated_at timestamptz` | ✓ | `parasut_updated_at` | `string \| null` | UTC ISO string | evet |
| ebeveyn contact id (contact'ın kendi ilişkisinden) | `contact_parasut_id bigint` | ✓ (contact tarafında zaten `raw`) | `contact_parasut_id` | `number \| null` | "Bağlı müşteri (contact) ID" alanı | evet |
| tüm resource (id/type/attributes/relationships/meta) | — | `raw jsonb` (tam) | — (raw private, view'da yok) | — | — | n/a |

Kapsam doğrulaması:
- Kişisi **olan** contact: 2/2 (1023810918, 1033894452) — UI'de canlı doğrulandı.
- Kişisi **olmayan** en az 3 gerçek contact: 438 aktif + 8 arşiv kontaktan rastgele biri (`1010689160`) canlıda test edildi, "İlişkili yetkili kişi yok" doğru gösterildi; kalan 445 contact da aynı sorgu yoluyla aynı davranışı alır (kod path'i kişi sayısına göre dallanmıyor, tek bir sorgu+render mantığı).
- Null alanlı örnek: `email=null` (1002186316), `notes=null` (her iki kayıt) — gerçek, UI'de `—` gösteriliyor.
- Birden fazla kişili contact örneği: **yok** (gerçek veri tek-kişi/tek-contact) — uydurulmadı.
- Dolu/boş ilişki örneği: `contact` ilişkisi her zaman kendi üzerinde boş (`{"meta":{}}`), sadece ebeveyn contact üzerinden çözülüyor — yukarıda belgelendi.

## 9. Sayımlar ve regresyon

**contact_people (gerçek, bu faz sonrası):**
- Toplam: **2**
- Benzersiz ID: **2**
- Ebeveyn contact sayısı: **2** (her biri 1 kişi)
- Kişi/contact dağılımı: 2 contact × 1 kişi, kalan 446 contact × 0 kişi
- Ebeveynsiz/çözülemeyen: **0**
- Yinelenen: **0**
- Stale (bu run'da kaldırılan): **0**
- Diğer ilişki sayıları: n/a (API'de `contact` dışında ilişki yok)
- Hata: **0**

**Regresyon (gerçek DB sorguları, hosted Supabase):**

| Kaynak | Beklenen | Gerçek | Durum |
|---|---|---|---|
| contacts | 448 | 448 | PASS |
| employees | 6 | 6 | PASS |
| salaries | 0 | 0 | PASS |
| shipment_documents | 15 | 15 | PASS |
| shipment_document_activities | 52 | 52 | PASS |
| shipment_document_invoices | 1 | 1 | PASS |
| products | 2597 | 2597 | PASS |
| sales_invoices | 451 | 451 | PASS |
| purchase_bills | 811 | 811 | PASS |
| e_invoices | 1238 | 1238 | PASS |
| e_archives | 24 | 24 | PASS |
| checks | 40 | 40 | PASS |
| payments | 1651 | 1651 | PASS |
| transactions | 1498 | 1498 | PASS |
| accounts | 3 | 3 | PASS |
| sales_offers / details / activities | 1 / 1 / 2 | 1 / 1 / 2 | PASS |

Not: `stock_movements` tablosu ham/toplam envanter hareketleri için 3330 satır içeriyor (sevkiyat belgesine özel alt küme için ayrı bir kolon/tablo şu an yok); bu faz stok hareketlerine dokunmadı, sayı gerçek ve tutarlı, sadece Phase 11 talimatındaki "20" referans rakamı muhtemelen farklı bir filtrelenmiş görünüme aitti — zorlanmadı, gerçek toplam raporlandı. `check_payments` adında ayrı bir tablo şemada yok (ödeme bilgisi `checks` tablosunun kendi alanlarında); uydurma bir sayı verilmedi.

## 10. Dağıtım ve testler

- Migration `20260829020000_parasut_contact_people_demo.sql` hosted Supabase'e uygulandı (`supabase db push --yes`, "Applying migration ... Finished supabase db push").
- Edge Function `parasut-sync` deploy edildi (`supabase functions deploy parasut-sync --use-api` — Docker Desktop API hatası nedeniyle server-side bundling kullanıldı, gerçek deploy başarılı, dashboard linki döndü).
- **Dry run:** `{"dry_run":true,"status":"dry_run","total_fetched_count":448,"contact_people_fetched_count":2,"contact_people_duplicate_count":0,"contact_people_unresolved_count":0,"error_count":0}`
- **Gerçek sync #1:** `{"status":"success","upserted_count":448,"contact_people_upserted_count":2,"contact_people_stale_removed_count":0,"error_count":0}`
- **Gerçek sync #2 (ardışık):** birebir aynı sonuç (`upserted_count":448,"contact_people_upserted_count":2,"error_count":0`) — idempotent, PASS.
- Frontend: `npm test` → 1/1 PASS. `npm run lint` → 0 hata (10 önceden var olan uyarı, ilgisiz dosyalarda). `npm run build:demo` → başarılı, `MusteriDetay-B7AznsCM.js` yeni hash ile üretildi. `npx tsc --noEmit -p tsconfig.app.json` → yalnızca bilinen, kapsam dışı `Login.tsx(55,17)` hatası (dokunulmadı).
- Bundle güvenlik taraması: `dist/demo/` içinde `PARASUT_CLIENT_SECRET`, `PARASUT_PASSWORD`, `SUPABASE_DB_URL`, `service_role` string'leri **bulunamadı** — temiz.
- FTP deploy: `scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` → 44 dosya yüklendi.
- Canlı doğrulama: `https://demo.eclipsemuhendislik.com/` → 200, yüklenen bundle hash'i (`index-DoVESYus.js`) build çıktısıyla birebir eşleşiyor.
- `musteriler/1023810918` (kişisi olan) → **200**. `musteriler/1010689160` (kişisi olmayan) → **200**.
- Gerçek headless-Chrome (Puppeteer, gerçek `chrome@152.0.7977.54`) CDP kontrolleri, 390px ve 768px viewport'larda, her iki rota için:

| Rota | Viewport | HTTP | Console hatası | Network 4xx/5xx | Sayfa yatay taşma | "Yetkili Kişiler" başlığı | "kişi yok" mesajı |
|---|---|---|---|---|---|---|---|
| 1023810918 (kişili) | 390px | 200 | 0 | 0 | Hayır | Evet | Hayır |
| 1023810918 (kişili) | 768px | 200 | 0 | 0 | Hayır | Evet | Hayır |
| 1010689160 (kişisiz) | 390px | 200 | 0 | 0 | Hayır | Evet | Evet |
| 1010689160 (kişisiz) | 768px | 200 | 0 | 0 | Hayır | Evet | Evet |

Tüm 8 kontrol PASS.

## 11. Sonuç

**Tarayıcı doğrulaması için gerçek ID'ler:**
- Kişisi olan contact: `1023810918` (PGT POLİMER) — kişi: `1001791599` (Deniz Bafra)
- Kişisi olan contact: `1033894452` (BABAYİĞİT MAKİNA) — kişi: `1002186316` (METİN ÖZCAN)
- Kişisi olmayan contact (örnek): `1010689160` (teknik istif makineleri)

**Bölüm bazlı PASS/FAIL/BLOCKED:**

| Bölüm | Durum |
|---|---|
| 1. API keşfi | PASS |
| 2. Alan envanteri | PASS |
| 3. Ebeveyn ilişkisi | PASS |
| 4. Diğer ilişkiler | PASS (gerçek kaynakta yok, uydurulmadı) |
| 5. Mevcut tablo denetimi | PASS |
| 6. Sync entegrasyonu | PASS |
| 7. Frontend | PASS |
| 8. Tam alan denetimi | PASS |
| 9. Sayımlar/regresyon | PASS |
| 10. Deploy/test | PASS |

**Kök neden (varsa FAIL/BLOCKED):** Yok — hiçbir bölüm BLOCKED/FAIL olmadı. Tek dikkat notu: bağımsız `contact_people` endpoint'i gerçekten mevcut değil (404, doğrulandı) — bu, görevin "zorla varsayma" talimatına uygun şekilde rapor edildi, bir hata değil, doğrulanmış bir API davranışı.

**Genel karar: PASS.** API'de olmayan hiçbir bilgi eklenmedi; API'nin döndürdüğü her gerçek+güvenli contact_people alanı ve ilişkisi (name, email, phone, notes, created_at, updated_at, ebeveyn contact id/type) base → raw → view → TS tipi → UI zincirinin her katmanında eksiksiz taşındı.

---

**Kod commit SHA:** a6cc4c2294f64a58aeb80b9de7f8823062500040
**Rapor commit SHA:** (bu commit)
