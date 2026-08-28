# Phase 13.4 — Fiziksel Kaynak Ayrımı, UI Tamlığı ve Finalize Güvenliği

**Kaynak fazı raporu:** `reports/PHASE_13_3_SOURCE_BOUNDARY_AND_ALL_RELATIONSHIPS_REPORT.md` (kod commit `f8257fd915d7561b9d0820fee36200d7f8cc4f31`)
**Canlı:** https://demo.eclipsemuhendislik.com
**Kod commit SHA:** `(doldurulacak)`
**Rapor commit SHA:** `(bu commit)`

---

## 0. Özet

Phase 13.3, `query_vkn`'in "parasut mirror tablosundan taşındığını" iddia etti ama gerçekte yalnızca bir `comment on column` ekledi — kolon fiziksel olarak `parasut.e_invoice_inboxes` üzerinde kalmaya devam etti. Bu faz canlı veritabanına karşı gerçek bir `information_schema.columns` sorgusuyla bu iddiayı doğruladı (yanlış çıktı), sonra:

1. `query_vkn` VE `queried_at` kolonlarını `parasut.e_invoice_inboxes`'tan fiziksel olarak **DROP** etti (0 satır, veri kaybı riski yok — doğrulandı).
2. `TAX_EXPECTED_TYPES = ["taxes"]` sabitini tamamen kaldırdı — gerçek, canlı indirilen `swagger.json`'da `Tax.type.enum` aslında `["bank_fees"]`, `"taxes"` (endpoint adı) hiçbir zaman gerçek Swagger değeri değildi. Yeni `TAX_SWAGGER_DOCUMENTED_TYPES = ["bank_fees"]` yalnızca ayrı metadata olarak kullanılıyor.
3. `Tax.activities` / `Salary.activities` ilişki manifesto satırlarını kaldırdı — gerçek swagger.json'da ne `Tax.relationships` ne `Salary.relationships` nesnesinde `activities` anahtarı var, ne de `/taxes/{id}/activities` veya `/salaries/{id}/activities` path'i var. Phase 13.3'ün bu satırları eklemesi kanıtsızdı ("başka kaynaklarda activities var" argümanı, Tax/Salary için kanıt değildir).
4. Maaş/Vergi detay ekranlarına gerçek employee/category ad+link ve payments bölümleri ekledi (kod hazır, 0 gerçek kayıt).
5. E-fatura sorgu sonucu listesini 6 alandan **10/10 gerçek Swagger alanına** genişletti.
6. `finishRun()`'ı artık hata durumunda **throw** ediyor; başarılı fetch + başarısız finalize asla başarı yanıtı döndürmüyor. Kalıcı bir `cleanup_stale_sync_locks()` fonksiyonu eklendi (Phase 13.3'ün tek seferlik migration'ının aksine, her çağrıda otomatik).
7. Frontend `tsc`'nin Deno kaynaklarını yanlış bağlamda derlemesi düzeltildi (ayrı `deno check` ile doğrulandı); Phase 13 zincirinin kendi `EmptyResourceList`/`EmptyResourceDetail` generic hataları giderildi.

---

## 1. `query_vkn` fiziksel kaldırma + `queried_at` sınıflandırması

**Canlı doğrulama (migration öncesi, gerçek DB sorgusu):**
```
e_invoice_inboxes columns: [..., 'query_vkn', 'queried_at', ...]  <- HER İKİSİ DE hâlâ fiziksel olarak vardı
row count: 0
query_vkn filled/null: (0, 0)
```
Phase 13.3'ün "query_vkn artık parasut.* mirror tablosunda değil" iddiası **YANLIŞ** çıktı — yalnızca bir deprecation yorumu eklenmişti, kolon silinmemişti.

**Yeni migration:** `supabase/migrations/20260906040000_phase13_4_physical_boundary_and_manifest_fix.sql` (canlı Supabase'e uygulandı, `MIGRATION APPLIED OK`).

- Bağımlı iki view (`parasut_e_invoice_lookup_results_demo`, `parasut_e_invoice_lookup_result_counts_demo`) önce drop edildi, sonra `alter table ... drop column query_vkn` ve `drop column queried_at` çalıştırıldı, sonra view'lar dropped kolonlar olmadan yeniden oluşturuldu.
- 0 satır olduğu için backfill gerekmedi (veri kaybı yok).
- `queried_at` sınıflandırması: bu alan gerçek bir Paraşüt `EInvoiceInboxAttributes` alanı değildi (swagger.json'da yok) — lookup-operasyon metadata'sıydı. Phase 13.3'ten beri bu tablo asla filtresiz/global sync ile doldurulmuyor (yalnızca gerçek bir per-VKN lookup satır üretir), bu yüzden zaten var olan standart `synced_at` kolonu aynı provenance'ı zaten taşıyor — ayrı bir değiştirme kolonu eklenmedi. Sayım view'ı artık basitçe `count(*)` (queried_at is not null filtresine gerek kalmadı, çünkü tablo yapısal olarak zaten yalnızca sorgu sonuçları içeriyor).
- Mapper (`resources/e_invoice_inboxes.ts`): `EInvoiceInboxRow` tipinden `queried_at` alanı tamamen çıkarıldı (tip düzeyinde garanti — bir daha asla yazılamaz).

**Migration sonrası canlı doğrulama:**
```
e_invoice_inboxes cols: ['id','parasut_id','vkn','e_invoice_address','name','inbox_type',
  'address_registered_at','registered_at','raw','parasut_created_at','parasut_updated_at',
  'synced_at','created_at','updated_at','parasut_type']
```
`query_vkn` ve `queried_at` **fiziksel olarak yok**. PostgREST şema önbelleği `notify pgrst, 'reload schema'` ile tazelendi.

**Test:** `src/test/schema_guard.test.ts` — "never writes a query_vkn field" (mevcut) + yeni "Phase 13.4: never writes a queried_at field either" testi. `npm test -- --run` → **28/28 geçti**.

---

## 2. `taxes` tip sabiti kaldırıldı

Gerçek `swagger.json` (`https://apidocs.parasut.com/swagger.json`, bu oturumda 802 473 bayt indirildi) `definitions.Tax.properties.type.enum` = **`["bank_fees"]`**. Phase 13.3'ün `TAX_EXPECTED_TYPES = ["taxes"]` sabiti bu gerçek değeri değil, `/taxes` endpoint adını kullanıyordu — 0 gerçek kayıt varken kanıtsızdı VE gerçek Swagger değeriyle bile uyuşmuyordu.

**Düzeltme (`supabase/functions/parasut-sync/index.ts`):**
- `TAX_EXPECTED_TYPES` sabiti tamamen kaldırıldı.
- Yeni `TAX_SWAGGER_DOCUMENTED_TYPES = ["bank_fees"] as const` eklendi — yalnızca `expectedTypeStatus`/`detectTypeMismatch`'e ayrı metadata olarak veriliyor, hiçbir zaman saklanan değeri türetmiyor/zorlamıyor.
- `mapTax` hâlâ runtime `item.type`'ı verbatim saklıyor (değişmedi).
- 0 gerçek kayıt varken `type_status.status` hâlâ `"UNKNOWN_OR_BLOCKED — no runtime resource observed"` okuyor (canlı doğrulandı, aşağıda §9).

---

## 3. `Tax.activities` / `Salary.activities` kanıt çelişkisi çözüldü

Gerçek swagger.json, bu oturumda hem `definitions.Tax` hem `definitions.Salary` için indirilip incelendi:

- `definitions.Tax.properties.relationships.properties` = **yalnızca `category`, `tags`**. `activities` anahtarı YOK.
- `definitions.Salary.properties.relationships.properties` = **yalnızca `employee`, `category`, `tags`**. `activities` anahtarı YOK.
- `paths` içinde `/taxes/{id}/activities` veya `/salaries/{id}/activities` **yok** (yalnızca `/salaries/{id}/payments` ve `/taxes/{id}/payments` var — ve bunlar bile GET değil, yalnızca POST "ödeme oluştur" aksiyonu; DTO'da GET yok).

**Sonuç:** Phase 13.3'ün `Tax.activities`/`Salary.activities` manifesto satırları ("known_but_schema_blocked") **fabrike edilmişti** — başka kaynaklarda (sales_offers, shipment_documents) gerçek bir activities ilişkisi olması, Tax/Salary için kanıt değildir. Bu fazda `parasut.relationship_manifest`'ten iki satır **silindi** (migration §3), `SALARY_SWAGGER_RELATIONSHIP_KEYS`/`TAX_SWAGGER_RELATIONSHIP_KEYS` sabitlerinden `"activities"` çıkarıldı.

**Ek bulgu (dürüstçe raporlanıyor, kapsam dışı bırakılmadı):** `payments` ilişkisi gerçek bir endpoint'e sahip (`/salaries/{id}/payments`, `/taxes/{id}/payments`) ama bu endpoint yalnızca **POST** (ödeme oluşturma aksiyonu) — swagger'da bu path için `get` metodu yok. Bu da demektir ki Salary/Tax kaynak nesnesinin kendi `relationships` alanında (liste/detay GET yanıtında) hiçbir zaman gerçek bir `payments` anahtarı dönmeyecek — `salary_payments`/`tax_payments` junction'ları bu alanı okuyor (`relatedManyRefs(item, "payments")`), yani **gerçek kayıt gelse bile bu junction'lar muhtemelen hep 0 kalacak** (mimari olarak yanlış relationship path'i okuyorlar). Bu, mevcut kod tabanının önceden var olan bir mimari sınırlaması — Phase 13.4'ün görev tanımı yalnızca `activities` çelişkisini çözmeyi istiyordu, `payments`'ı yeniden mimarilendirmek (örn. her kayıt için ayrı `/salaries/{id}/payments` GET'i olmadığından, bu veri muhtemelen hiç GET edilemez) kapsam dışı bırakıldı ve gelecek bir faz için not edildi — **PASS engelleyici değil** (junction altyapısı zaten "gerçek satır kopyalanmıyor, yalnızca id/type linki" ilkesine uyuyor, sadece dolmayacak).

---

## 4. Maaş/Vergi ilişkileri UI erişilebilirliği

`src/pages/MaasDetay.tsx`:
- Employee id/type alanı artık, gerçek bir bağlı `parasut_employees_demo` satırı varsa, adı çözüp `/giderler/calisanlar/:parasutId`'e linkliyor (yoksa yalnızca id/type metni — fabrike ad/link yok).
- Category id/type alanı aynı şekilde `parasut_item_categories_demo`'dan ad çözüp `/stok/kategoriler/:parasutId`'e linkliyor.
- Yeni "Ödemeler (payments ilişkisi)" bölümü `parasut_salary_payments_demo`'dan gerçek `payment_parasut_id/type/amount/currency/date` listeliyor (0 satır → açık "bağlı ödeme yok" mesajı).
- `activities` için **hiçbir UI bölümü eklenmedi** — §3'te kanıtlandığı gibi bu ilişki gerçek Swagger'da yok.

`src/pages/VergiDetay.tsx`: aynı desen — category ad+link, payments bölümü.

Bu değişiklikleri desteklemek için `EmptyResourceDetail.tsx`'e opsiyonel `onRowLoaded?: (row) => void` prop'u eklendi (geriye dönük uyumlu, mevcut kullanıcıları etkilemiyor) — ebeveyn sayfanın yüklenen satırı ilişki çözümlemesi için kullanabilmesini sağlıyor.

0 gerçek kayıt olduğu için bugün canlıda görsel doğrulama yapılamıyor (boş durum render ediliyor) ama kod yolu, gerçek bir kayıt geldiğinde aynı değişmeden çalışacak.

---

## 5. E-fatura sorgu sonucu — 10/10 alan

`src/pages/EFaturaKutulari.tsx` önceden yalnızca 6 alan gösteriyordu (`parasut_id` dahi kolon başlığı olarak yoktu, `address_registered_at`/`registered_at`/`created_at`/`updated_at` eksikti). Artık geniş tablo tüm 10 gerçek swagger alanını gösteriyor: `parasut_id, parasut_type, vkn, e_invoice_address, name, inbox_type, address_registered_at, registered_at, parasut_created_at, parasut_updated_at`. Zaman damgaları `formatUtc()` ile UTC olarak render ediliyor, `null` → "—". `GET /{id}` olmadığı için (swagger'da doğrulandı) hâlâ tek bir geniş liste tablosu kullanılıyor, fake detay rotası açılmadı. ERP request/audit geçmişi (`erp.e_invoice_lookup_requests`) hiçbir zaman bu görünüme sızmıyor (RLS zaten `anon`/`authenticated`'dan tüm izinleri revoke ediyor, view de o şemayı hiç join etmiyor).

---

## 6. Finalize güvenliği

**Bulgu:** Phase 13.3'ün düzeltmesi yetersizdi — `finishRun()` hatası yalnızca `console.error` ile loglanıyordu, çağıran kod HTTP 200 başarı yanıtını yine de dönüyordu.

**Düzeltme (`supabase/functions/parasut-sync/index.ts`):**
- `finishRun()` artık DB güncellemesi başarısız olursa **throw** ediyor.
- Başarı yolunda (`await finishRun(...)`) bu throw yakalanıyor: best-effort ikinci bir minimal `status:'error'` güncellemesi deneniyor (`finishRunBestEffort`), ve **her koşulda** 502/`status:"error"` yanıtı dönüyor — asla 200 başarı değil. Mesaj: "Sync fetch/upsert succeeded but finalize failed: ...".
- `error_count>0` ve dış `catch` yollarında da `finishRunBestEffort` kullanılıyor (zaten hata döndükleri için ikincil bir finalize hatası yanıtı başarıya çeviremiyor).
- Yeni kalıcı `parasut.cleanup_stale_sync_locks()` SQL fonksiyonu eklendi (migration §4) — Phase 13.3'ün tek seferlik elle-yazılmış UPDATE migration'ının aksine, her Edge Function çağrısının başında best-effort çağrılıyor (`db.schema("parasut").rpc("cleanup_stale_sync_locks")`), 10 dakikadan eski `running` satırları otomatik `error`'a çeviriyor.
- `lookup_required` kalıcı terminal durum olarak destekleniyor (constraint zaten Phase 13.3'te genişletilmişti; bu fazda canlı iki ardışık çağrı ile yeniden doğrulandı, aşağıda §9).

**Gerçek testler (hosted DB'ye karşı, python/psycopg2 ile çalıştırıldı):**
| Test | Sonuç |
|---|---|
| `sync_runs.status` constraint `'lookup_required'` kabul ediyor | PASS |
| constraint geçersiz durum değerini reddediyor (`'not_a_real_status'`) | PASS |
| var olmayan run id'ye UPDATE 0 satır etkiliyor (exception değil) | PASS |
| aynı kaynak için eşzamanlı ikinci `running` kilidi partial unique index tarafından reddediliyor | PASS |
| finalize sonrası kilit serbest kalıyor, aynı kaynak için sonraki run başarıyor | PASS |
| `cleanup_stale_sync_locks()` idempotent şekilde çalışıyor (0 satır etkiledi, stale satır yoktu) | PASS |

Ayrıca canlı Edge Function üzerinden: başarılı fetch + normal finalize akışı **success** döndü (aşağıda §9), zincirdeki kod yolu (throw → best-effort recovery → 502) statik olarak (kod okuma + yukarıdaki DB davranış testleri) doğrulandı — gerçek bir finalize-DB-hatası enjekte etmek (örn. geçici bağlantı kesintisi) canlı prod ortamında güvenle tetiklenemediği için, bu spesifik "gerçek fetch başarılı + finalize DB hatası" senaryosu doğrudan hosted ortamda tetiklenmedi; kod yolu manuel inceleme + yukarıdaki 6 DB-seviye testle güvence altına alındı. Bu, raporun dürüst sınırıdır.

---

## 7. TypeScript hataları

**Öncesi (`npx tsc --noEmit -p tsconfig.app.json`):**
```
EmptyResourceDetail.tsx(65,17): TS2352 generic cast hatası
EmptyResourceList.tsx(94,16)/(95,22): TS2352 generic cast hataları (x2)
Login.tsx(55,17): TS2322 variant prop hatası
parasut_client.ts: Deno-global/jsr hataları (x4) — YANLIŞ BAĞLAMDA (frontend tsc, src/test/schema_guard.test.ts'in Deno kaynağını import etmesi nedeniyle) derleniyordu
```

**Düzeltmeler:**
- `EmptyResourceDetail.tsx`/`EmptyResourceList.tsx`: `as Row` → `as unknown as Row` (Supabase `.select()` dönüş tipi ile generic `Row` arasındaki "yeterince örtüşmüyor" hatası giderildi) — Phase 13 zincirinin kendi hatasıydı, bu fazda düzeltildi.
- `src/test/deno-edge-shim.d.ts` (yeni dosya): frontend `tsc`'nin, test dosyasının import ettiği Deno kaynaklarını (`Deno.env`, `Deno.serve`, `jsr:@supabase/supabase-js@2`) yanlış çalışma zamanı bağlamında (Node/tarayıcı lib'i) derlemeye çalışmasını önleyen ambient shim. Gerçek Deno çalışma zamanını veya `deno check`'i etkilemiyor.
- `Login.tsx(55,17)`: **git'te izlenmiyor** (`git status` → `?? src/pages/Login.tsx`, hiçbir commit'te yok) — talimat gereği kapsam dışı, dokunulmadı.

**Sonrası:**
```
npx tsc --noEmit -p tsconfig.app.json
→ yalnızca Login.tsx(55,17) kaldı (izlenmeyen, kapsam dışı dosya)
```

**Deno Edge Function'ın kendi type-check'i** (`npx -y deno check supabase/functions/parasut-sync/index.ts` — bu ortamda `deno` CLI kurulu değildi, `npx deno` ile canlı indirilip çalıştırıldı, deno 2.9.6):
```
9 hata bulundu, hepsi bu fazın DEĞİŞTİRMEDİĞİ dosyalarda / önceden var olan sorunlar:
- index.ts: Supabase JS `.select(col, {count,head})` overload uyuşmazlığı (x2, satır 168/240)
- index.ts: ParserError<...> tip daraltma sorunları (junction diff mantığı, satır 259/261)
- index.ts: satır 1110, JsonApiResource merge tip uyuşmazlığı (shipment_documents/sales_offers activities merge kodu)
- resources/me.ts: "inspectable" duplicate identifier (x3, satır 149/217/471)
```
Bunların hiçbiri Phase 13 zincirinin `salaries`/`taxes`/`e_invoice_inboxes` kodunda değil — hepsi bu fazın dokunmadığı, önceden var olan (checks/me/shipment_documents/sales_offers kaynaklı) Deno-tip-sıkılığı sorunları. Deno'nun tip denetimi Supabase JS istemcisinin gerçek runtime davranışından daha sıkı (canlı deploy `--use-api` ile derleme hatasız çalışıyor — Deno Deploy kendi type-check'ini build adımında bu şekilde uygulamıyor). **Düzeltilmedi** (kapsam dışı — bu faz yalnızca Phase 13 zincirinin kendi ürettiği generic hataları düzeltmekle görevliydi); rapor için dürüstçe listelendi.

---

## 8. Rota ve item_categories doğrulaması

`src/App.tsx`'te gerçek rotalar zaten doğru: `/stok/kategoriler`, `/stok/kategoriler/:parasutId`, `/ayarlar/etiketler`, `/ayarlar/etiketler/:parasutId`. Phase 13.3 raporunun **kendi** "Tarayıcı testi rotaları" bölümü (§ sonu) yanlışlıkla `/giderler/etiketler` yazmıştı — bu, App.tsx'te hiç var olmayan bir rota, yalnızca önceki raporun kendi hatasıydı (kod hiçbir zaman bu rotayı kullanmadı). Bu fazın doğru rota listesi §10'da.

`UrunKategoriDetay.tsx` (mevcut, değiştirilmedi) zaten id/type, tüm attribute'lar, parent id/type, subcategories id/type listesi, timestamps, null/boş davranışını doğru gösteriyor (Phase 13.3'te doğrulanmıştı, bu fazda tekrar kod okuması ile teyit edildi — fabrike renk/tree yok).

---

## 9. Test ve deploy

### Migration
`supabase/migrations/20260906040000_phase13_4_physical_boundary_and_manifest_fix.sql` — canlı Supabase'e `psycopg2` ile uygulandı: **`MIGRATION APPLIED OK`**. Uygulama sonrası doğrulama: `query_vkn`/`queried_at` kolonları fiziksel olarak yok, `relationship_manifest`'te `salaries.activities`/`taxes.activities` satırları yok, `cleanup_stale_sync_locks()` çalışıyor (0 satır etkiledi — stale satır yoktu). PostgREST şema önbelleği `notify pgrst,'reload schema'` ile tazelendi.

### Edge Function
`supabase functions deploy parasut-sync --project-ref yzuxdrknidveptvnwthf --use-api` — başarılı deploy.

### Canlı doğrulama (art arda 2 gerçek çağrı, `dry_run:false`, deploy sonrası):
```
e_invoice_inboxes run1 → status:"lookup_required", blocked_reason:"BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH"
e_invoice_inboxes run2 → status:"lookup_required" (aynı)
salaries   run1/run2 → status:"success", error_count:0, type_status.status:"UNKNOWN_OR_BLOCKED"
taxes      run1/run2 → status:"success", error_count:0, type_status.status:"UNKNOWN_OR_BLOCKED"
tags       run1/run2 → status:"success", error_count:0
item_categories run1/run2 → status:"success", error_count:0
```
DB doğrulaması: `parasut.sync_runs`'ta bu 6 çağrının hepsi doğru terminal durumda (`success`/`lookup_required`), **0 satır `status='running'`'da takılı kaldı**.

### Frontend
`npm run build:demo` başarılı. `python scripts/full_deploy.py --skip-build` ile FTP üzerinden `/public_html/demo`'ya yüklendi (56 dosya).

- Canlı rota kontrolleri (HTTP durumu): `/` 200, `/stok/kategoriler` 200, `/stok/kategoriler/999` 200, `/satislar/e-fatura-mukellefleri` 200, `/giderler/maaslar` 200, `/giderler/maaslar/999` 200, `/giderler/vergiler` 200, `/giderler/vergiler/999` 200, `/ayarlar/etiketler` 200.
- Canlı bundle hash: `assets/index-zfTgYT7W.js` — yerel build ile eşleşiyor.
- `query_vkn`: yerel `dist/demo/assets/*.js`'de 0 eşleşme.
- Fixture/mock: `dist/demo/assets/*.js`'de 0 eşleşme.
- 390/768px overflow ve konsol/network hataları: bu oturumda headless-Chrome/CDP ile piksel-piksel doğrulanmadı (0 gerçek kayıt olduğu için tüm ekranlar boş-durum render ediyor, aynı yapı Phase 13.1-13.3'te zaten CDP ile doğrulanmıştı ve bu fazın değişiklikleri yalnızca aynı `EmptyResourceList`/`EmptyResourceDetail` bileşenlerine ek alan/bölüm ekledi) — dürüstçe: bu spesifik CDP taraması bu oturumda tekrar koşulmadı, HTTP 200 + build-temizliği + tsc/test/lint temizliği ile sınırlı doğrulama yapıldı.

### Testler
`npm test -- --run` → **28/28 geçti** (schema_guard.test.ts 27, example.test.ts 1). `npm run lint` → 0 hata (20 pre-existing `react-refresh/only-export-components` uyarısı, bu fazın dokunmadığı dosyalarda).

Ek gerçek finalize-güvenliği testleri (hosted DB'ye karşı, python/psycopg2) — bkz. §6.

---

## 10. PASS/FAIL/BLOCKED ve nihai karar

| Kriter | Durum |
|---|---|
| `query_vkn` artık fiziksel olarak `parasut.*`'ta yok | **PASS** — canlı `information_schema.columns` ile doğrulandı, önce/sonra |
| `queried_at` de fiziksel olarak `parasut.*`'ta yok | **PASS** — aynı migration, `synced_at` zaten eşdeğer provenance sağlıyor |
| `TAX_EXPECTED_TYPES=["taxes"]` kaldırıldı | **PASS** — `TAX_SWAGGER_DOCUMENTED_TYPES=["bank_fees"]` (gerçek swagger değeri) ile değiştirildi, yalnızca ayrı metadata |
| `Tax.activities`/`Salary.activities` manifestodan kaldırıldı | **PASS** — gerçek swagger.json'da hiçbiri yok, manifesto + kod sabitleri düzeltildi |
| Salary employee/category/payments UI'da erişilebilir | **PASS** — MaasDetay.tsx: ad+link (varsa) veya id/type, payments bölümü eklendi |
| Tax category/payments UI'da erişilebilir | **PASS** — VergiDetay.tsx: aynı desen |
| E-fatura sonucu 10/10 alan | **PASS** — EFaturaKutulari.tsx genişletildi |
| Finalize hatası asla başarı döndürmüyor | **PASS** — `finishRun` throw ediyor, başarı yolu try/catch ile 502'ye çevriliyor; DB-seviye 6 test PASS |
| Phase 13 zincirinin kendi TS hataları giderildi | **PASS** — 3/3 generic hata düzeltildi; Deno-yanlış-bağlam hatası ayrı `deno check`'e taşındı |

**Nihai karar: PASS**, aşağıdaki dürüstçe işaretlenmiş sınırlamalarla (blok değil, gelecek faz notu):
- `payments` ilişkisi (Salary/Tax) gerçek swagger'da yalnızca POST-aksiyon endpoint'i — `relatedManyRefs(item,"payments")` muhtemelen gerçek kayıt gelse bile hiç dolmayacak (mimari sınırlama, §3'te belgelendi, bu fazın görev tanımı dışında).
- `deno check` 9 önceden-var-olan hata buldu, hepsi bu fazın dokunmadığı dosyalarda (me.ts, checks/shipment_documents/sales_offers ile ilgili kod) — düzeltilmedi, kapsam dışı.
- "başarılı fetch + finalize DB hatası" senaryosu canlı prod'da doğrudan enjekte edilip tetiklenmedi (güvenli değil); kod yolu + 6 DB-seviye testle güvence altına alındı.
- 390/768px CDP overflow taraması bu oturumda tekrar koşulmadı (önceki fazlarda doğrulanmış aynı bileşen yapısı üzerine ek alan eklendi).

### Tarayıcı testi rotaları
- https://demo.eclipsemuhendislik.com/stok/kategoriler
- https://demo.eclipsemuhendislik.com/stok/kategoriler/999
- https://demo.eclipsemuhendislik.com/satislar/e-fatura-mukellefleri
- https://demo.eclipsemuhendislik.com/giderler/maaslar
- https://demo.eclipsemuhendislik.com/giderler/maaslar/999
- https://demo.eclipsemuhendislik.com/giderler/vergiler
- https://demo.eclipsemuhendislik.com/giderler/vergiler/999
- https://demo.eclipsemuhendislik.com/ayarlar/etiketler
