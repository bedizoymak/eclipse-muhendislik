# Phase 06.2 — Çeklerde Tüm API Verilerinin Eksiksiz Korunması

**Tarih:** 2026-08-26
**Canlı URL:** https://demo.eclipsemuhendislik.com/nakit/cekler
**Kod commit SHA:** (aşağıda, ikinci commit'te doldurulacak)
**Rapor commit SHA:** (push sonrası doldurulacak)

## 1. Ham API envanteri

Gerçek `/v4/{company_id}/checks` uç noktası, tüm sayfalar (`page[size]=25`, 2 sayfa) taranarak, `include=issued_by,given_to,payments` ile yeniden sorgulandı. 40 kaydın tamamı üzerinde anahtar seviyesinde analiz yapıldı.

**Root seviyesi:** her kayıtta yalnızca `id`, `type`, `attributes`, `relationships`, `meta` var. Resource-level `links` **hiçbir kayıtta yok** (0/40); resource-level `meta` **tüm kayıtlarda var** (40/40) ama içeriği `attributes.created_at`/`attributes.updated_at` ile birebir aynı — ek/yeni veri değil, JSON:API'nin kendi meta yansıması.

**Attributes (40 kayıt üzerinden):**

| Alan | found | populated | null | boş string | boş obj | tip |
|---|---|---|---|---|---|---|
| `bank_identifier` | 40 | 40 | 0 | 0 | 0 | string |
| `bank_name` | 40 | 0 | 3 | 37 | 0 | string/null |
| `created_at` | 40 | 40 | 0 | 0 | 0 | string |
| `currency` | 40 | 40 | 0 | 0 | 0 | string |
| `days_overdue` | 40 | 40 | 0 | 0 | 0 | number |
| `days_till_due_date` | 40 | 40 | 0 | 0 | 0 | number |
| `description` | 40 | 3 | 36 | 1 | 0 | string/null |
| `due_date` | 40 | 40 | 0 | 0 | 0 | string |
| `is_cashed` | 40 | 40 | 0 | 0 | 0 | boolean |
| `is_in` | 40 | 40 | 0 | 0 | 0 | boolean |
| `is_out` | 40 | 40 | 0 | 0 | 0 | boolean |
| `is_transferred` | 40 | 40 | 0 | 0 | 0 | boolean |
| `issue_date` | 40 | 40 | 0 | 0 | 0 | string |
| `net_total` | 40 | 40 | 0 | 0 | 0 | string (sayısal) |
| `payment_status` | 40 | 40 | 0 | 0 | 0 | string |
| `remaining` | 40 | 40 | 0 | 0 | 0 | string (sayısal) |
| `remaining_in_trl` | 40 | 40 | 0 | 0 | 0 | string (sayısal) |
| `serial_number` | 40 | 40 | 0 | 0 | 0 | string |
| `updated_at` | 40 | 40 | 0 | 0 | 0 | string |

`net_total`/`remaining`/`remaining_in_trl` API'de **string** olarak dönüyor (ör. `"551107.89"`); base tabloda `numeric` olarak saklanıyor — değer kaybı yok, yalnızca tip dönüşümü.

**Relationships (include olmadan varsayılan hâl):**

```json
{ "issued_by": {"meta":{}}, "given_to": {"meta":{}}, "payments": {"meta":{}}, "histories": {"meta":{}} }
```

Bunlar dört gerçek relationship anahtarıdır — başka hiçbiri (include edilmemiş hâlde de) görünmüyor.

| Relationship | found | hasData (include ile) | boş/null | 
|---|---|---|---|
| `issued_by` | 40 | 40 | 34 null (is_out=6 kayıtta dolu) |
| `given_to` | 40 | 40 | 6 null (is_in=34 kayıtta dolu) |
| `payments` | 40 | 40 (dizi) | 35 kayıtta 1 eleman, 5 kayıtta boş dizi `[]` |
| `histories` | 40 | — | 40/40 yalnızca boş `{"meta":{}}` |

## 2. Attribute eksiksizliği

| API alanı | 40 kayıtta durum | Base tablo | View | Frontend type | Detay UI |
|---|---|---|---|---|---|
| `remaining_in_trl` | 40/40 dolu | ✅ (zaten vardı) | ✅ **(bu fazda eklendi)** | ✅ **(eklendi)** | ✅ **(eklendi: "Kalan (TL)")** |
| `created_at` → `parasut_created_at` | 40/40 dolu | ✅ (zaten vardı) | ✅ **(bu fazda eklendi)** | ✅ **(eklendi)** | ✅ **(eklendi: "Paraşüt'te oluşturulma")** |
| `updated_at` → `parasut_updated_at` | 40/40 dolu | ✅ (zaten vardı) | ✅ **(bu fazda eklendi)** | ✅ **(eklendi)** | ✅ **(eklendi: "Paraşüt'te güncellenme")** |
| `days_till_due_date` | 40/40 dolu | ✅ | ✅ (Faz 6.1) | ✅ | ✅ |
| Diğer tüm attribute'lar (bank_identifier, bank_name, currency, description, due_date, issue_date, net_total, payment_status, is_cashed, is_in, is_out, is_transferred, days_overdue, serial_number) | değişmedi | ✅ | ✅ | ✅ | ✅ |

Tarih/saat alanları (`parasut_created_at`, `parasut_updated_at`) UI'da API'nin döndürdüğü UTC zaman damgası **değiştirilmeden**, yalnızca `Intl` ile `timeZone: "UTC"` sabitlenerek biçimlendiriliyor (`formatApiTimestamp`) — tarayıcının yerel saat dilimine kaydırma yapılmıyor. `remaining_in_trl` ham API string değeri doğrudan `numeric` olarak gösteriliyor; `remaining` veya kur üzerinden **hesaplanmıyor**. Null durumunda tüm alanlar "—" gösteriyor (kod: `?? "—"`), üretilen/varsayılan bir değer yok.

Bu turda `days_till_due_date` dışında, yukarıdaki üç alan haricinde başka eksik gerçek attribute bulunmadı.

## 3. Payments relationship

**Gerçek yapı (kanıtlanmış, varsayılmadı):**

- `relationships.payments.data` her zaman bir **dizi** (JSON:API to-many) — tekil obje değil.
- 40 kaydın **35**'inde dizi 1 eleman içeriyor (`{id, type:"payments"}`), **5**'inde dizi tamamen boş (`[]`) — bu 5 çek henüz ödenmemiş/tahsil edilmemiş, gerçek ve dürüst bir durum, uydurulmuş boşluk değil.
- Toplam payment referansı: 35, tamamı benzersiz (35 farklı ID), mükerrer yok.
- `links`/anlamlı `meta` yok (`hasLinks=0`, `hasMeta=0` — hem check hem payment relationship seviyesinde).
- `/checks` listesinde `include=issued_by,given_to,payments` verildiğinde, response'un **`included`** dizisi bu 35 payment nesnesinin **tam attribute'larını** içeriyor (doğrulandı: 35/35 referans `included` içinde bulundu, eksik yok). Tekil kayıt `GET /checks/{id}?include=payments` de aynı şekilde çalışıyor.
- `/payments/{id}` bağımsız endpoint'i **404** dönüyor ("No route matches") — önceki fazlardan bilinen "payments'ın bağımsız list/get endpoint'i yok" bulgusuyla tutarlı.
- `include=payments.transaction` (checks üzerinden) **400** ile reddediliyor: `"payments.transaction is not a valid relation"`.
- Gerçek payment attribute'ları (hem checks hem diğer payable'lar için): `created_at, updated_at, date, due_date, amount, matched_amount, amount_in_trl, currency, paid_in_currency, notes`. Mevcut `parasut.payments` tablosu ve mapper'ı `due_date`, `matched_amount`, `amount_in_trl`, `paid_in_currency`'yi **hiçbir payable_type için** saklamıyordu — bu da bu fazın kapsamındaki "gerçek veri atlanamaz" kuralı gereği düzeltildi (sadece checks için değil, tüm payment kayıtları için — aynı kaynak defect, aynı fazda giderildi).
- **35 payment ID'si de mevcut `parasut.payments` tablosundaki (sales_invoices/purchase_bills'ten gelen) 1616 kayıtla çakışmıyor** — tamamen ayrı, yeni bir payment kümesi (doğrulandı: sorgu öncesi 0/35 eşleşme).

**Seçilen veri modeli:** Yeni bir junction tablo **kurulmadı**. `parasut.payments` tablosu zaten `payable_type`/`payable_parasut_id` ile "bu ödeme hangi kayda ait" ilişkisini tutuyor (sales_invoices ve purchase_bills için aynen bu şekilde kullanılıyordu). Checks-payments de aynı gerçek örüntüye uyuyor: her payment tam olarak bir payable'a (bu durumda bir check'e) ait, `payable_type='checks'`, `payable_parasut_id=<check parasut_id>`. Bu tasarım zaten çoklu payment'ı da destekliyor (birden fazla payment aynı `payable_parasut_id`'yi paylaşabilir) — API şu an her check için en fazla 1 payment döndürse de, mimari buna zaten hazır. Junction tablo gereksiz karmaşıklık olurdu; mimariye bakılmadan varsayılmadı, gerçek response incelendikten sonra karar verildi.

**Sync:** `syncChecks`, `include=issued_by,given_to,payments` ile listeyi çekiyor, `included` içindeki payment nesnelerini `payments:{id}` anahtarıyla haritalıyor, her check'in kendi `relationships.payments.data` listesindeki ID'leri bu haritadan çözüyor (bulunamayan referans olursa hata olarak raporlanır — sales_invoices/purchase_bills payments sync'iyle birebir aynı desen) ve `parasut.payments` tablosuna `payable_type="checks"` ile upsert ediyor. Var olan payment kayıtları kopyalanmadı; ID çakışması olmadığı için hiçbir satır üzerine yazılmadı, yalnızca 35 yeni satır eklendi.

**UI:** Detay ekranında yeni "İlişkili ödeme" bölümü — check'in `payable_type='checks' & payable_parasut_id=<id>` ile `parasut_payments_demo` view'ından gerçek ödeme(ler)i çekiyor; ödeme yoksa "İlişkili ödeme yok" gösteriyor; varsa tarih/vade/tutar/eşleşen tutar/TL karşılığını ham değerleriyle gösteriyor. Ödeme adı/açıklama gibi API'de/Supabase'de bulunmayan hiçbir alan üretilmedi.

## 4. Histories ve diğer relationship verileri

- `histories`: **40/40 kayıtta yalnızca `{"meta":{}}`** — data yok, link yok, başka anahtar yok. Sayıyla kanıtlandı (kod: her kayıt `Object.keys(h)` tek eleman `["meta"]` ve `h.meta` boş obje). Sahte history tablosu/ekranı oluşturulmadı.
- `issued_by`/`given_to`: ID/type/name üçlüsünün tamamı korunduğu yeniden doğrulandı — `issued_by` 6/40'ta, `given_to` 34/40'ta dolu, tam olarak `is_out`/`is_in` dağılımıyla örtüşüyor.
- API'nin kendi 400 hata mesajının "Acceptable" olarak listelediği `category, details, tags, refund_of, sharings, recurrence_plan` include'ları tek tek denendi: **hepsi gerçek API'de HTTP 500 (Internal Server Error) döndürüyor** — swagger/hata mesajı yanlış/güncel değil, bu API'nin kendi sunucu tarafı hatası. Include edilmeden hiçbir check kaydında bu anahtarlar relationships içinde belirmiyor de (yalnızca issued_by/given_to/payments/histories görünüyor). Bu, kodda çalışılmayan/atlanmış bir veri değil — API'nin kendisinin sunamadığı bir özellik; kanıtla (500 response body) belgelendi, workaround yapılmadı, uydurulmadı.

## 5. Raw payload koruması kararı

Mevcut mimaride her tabloda zaten `raw jsonb not null default '{}'::jsonb` kolonu var (parasut.checks.raw, parasut.payments.raw dahil) ve mapper'lar `raw: item` ile API resource object'inin **tamamını** (attributes + relationships + meta, include edilenler hariç included nesneler) olduğu gibi saklıyor. Bu, görevin istediği "ham JSON denetim amaçlı saklama" ihtiyacını **zaten karşılıyor** — ayrı bir `raw_payload` kolonu eklemek mevcut `raw` kolonuyla birebir aynı işi tekrar edecek, gereksiz veri çoğaltması olurdu. Bu yüzden yeni bir `raw_payload` kolonu **eklenmedi**; mevcut `raw` kolonunun rolü bu görevin gereksinimini zaten dolduruyor. UI zaten bu kolonu okumuyor (yalnızca normalize edilmiş kolonlar kullanılıyor), token/credential/header hiçbir raw kolonunda saklanmıyor (yalnızca API resource body'si saklanıyor).

## 6. Sync semantiği

- `fetchAllPages` tüm sayfaları geziyor (2 sayfa, 40 kayıt) — kontrol edildi.
- `upsertBatched`, `parasut_id` üzerinden upsert yapıyor; API'de artık var olmayan bir check/payment satırı otomatik silinmiyor (mevcut mimarinin genel davranışı, bu faz değiştirmedi) — bu fazda API'de checks/payments tarafında herhangi bir silinen ilişki tespit edilmedi.
- **Bulunan ve düzeltilen gerçek bir bug:** `syncChecks`'in ilk sürümü, `dbFields` içine `payments_upserted_count` alanını eklemişti; ancak `parasut.sync_runs` tablosunda böyle bir kolon yok. Bu, sync'i bitiren `finishRun()` UPDATE sorgusunun PostgREST tarafında reddedilmesine ve satırın sonsuza dek `status='running'` kalmasına yol açtı (hata sessizce yutuluyordu çünkü `finishRun` sonucu kontrol edilmiyor) — bir sonraki sync denemesi 409 "already running" ile bloke oldu. Kök neden bulundu, `payments_upserted_count` yalnızca HTTP `responseFields`'da bırakıldı (DB'ye yazılan `dbFields`'dan çıkarıldı), takılı kalan satır elle `status='error'` olarak kapatıldı, Edge Function yeniden deploy edildi.
- **İki ardışık gerçek sync** (düzeltme sonrası) çalıştırıldı: her ikisi de `total_fetched_count=40, upserted_count=40, payments_upserted_count=35, unresolved_count=0, error_count=0` döndürdü — sonuçlar birebir aynı, duplicate oluşmadı (DB'de doğrulandı: `parasut.checks` 40 satır/40 benzersiz `parasut_id`; `parasut.payments where payable_type='checks'` 35 satır/35 benzersiz `parasut_id`).
- Null değerler eski dolu değerle "merge" edilmiyor — `upsertBatched`, mapper'ın döndürdüğü tam satırı yazıyor (kısmi patch değil), yani kaynaktaki null her zaman Supabase'e null olarak yansıyor.
- Eski/stale relationship kaydı tespit edilmedi.

## 7. Sayı ve regresyon

| Metrik | Değer (bu faz, gerçek sorgu) |
|---|---|
| Checks — API / base+view / UI | 40 / 40 / 40 |
| is_in / is_out | 34 / 6 |
| Benzersiz check ID | 40, duplicate yok |
| Check-payment bağlantı sayısı | 35 (view'da `payable_type='checks'`) |
| Unresolved (issued_by ve given_to ikisi de null) | 0 |
| `parasut.payments` toplam (tüm payable_type) | 1651 (742 sales_invoices + 874 purchase_bills + **35 checks — yeni**) |
| `transactions` toplam | 1498 (değişmedi) |
| `check_cash_in` | 32 (değişmedi) |
| `check_cash_out` | 3 (değişmedi) |
| `accounts` | 3 (değişmedi) |
| `contacts` | 448 |
| `sales_invoices` | 451 |
| `purchase_bills` | 811 |
| `products` | 2597 |

Checks/transactions/accounts sayıları Faz 6.1'deki değerlerle birebir aynı — zorlanmadı, gerçek sorgudan geldi. `parasut.payments` toplamı 1616'dan 1651'e çıktı; bu **beklenen ve doğru** bir artış (checks'e ait 35 gerçek payment kaydı ilk kez eklendi), regresyon değil.

## 8. Deploy ve test

- Yeni migration: `supabase/migrations/20260826100000_parasut_checks_payments_full_data.sql` (eski migration'lar değiştirilmedi). Hosted Supabase'e `supabase db push` ile uygulandı.
- Edge Function (`parasut-sync`) değişti (`index.ts`, `resources/payments.ts`) → `supabase functions deploy parasut-sync` ile iki kez deploy edildi (ilk deploy'da bulunan `sync_runs` kolon bug'ı sonrası ikinci düzeltme deploy'u).
- Gerçek (non-dry) `checks` sync'i **iki kez** çalıştırıldı, sonuçlar birebir aynı (bkz. bölüm 6).
- `npm test`: 1 test, geçti.
- `npm run lint`: 0 hata, 10 önceden var olan uyarı.
- `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan, bu faza ait olmayan `Login.tsx:55` hatası.
- `npm run build:demo`: başarılı, yeni `CekDetay-BCHlC8Nt.js` chunk.
- FTP deploy: 36 dosya, `/public_html/demo`.
- Canlı doğrulama: `/` → 200 (`index-CSX0L7_t.js`, yeni build ile eşleşiyor), `/nakit/cekler` → 200, `/nakit/cekler/1000245233` (ödemesi olan) → 200, `/nakit/cekler/1001320671` (ödemesiz) → 200, yeni JS chunk → 200.
- 390×844 ve 768×1024 (gerçek headless Chrome CDP, hem liste hem yeni ödeme kartını içeren detay sayfası): `scrollWidth === clientWidth` her ikisinde — yatay taşma yok.

## Alan/kayıt bazlı uçtan uca doğrulama örneği

`parasut_id 1000245233`: API `remaining_in_trl="0.0"` → view `0` → UI "Kalan (TL): 0,00 TL". API `created_at="2024-01-05T15:51:22.858Z"` → view `parasut_created_at` aynı an → UI "05.01.2024 15:51:22 UTC" (yalnızca biçim, an değişmedi). API `payments.data=[{id:"1025160851"}]` → included payment `amount="55440.0"` → `parasut.payments` `payable_type='checks', payable_parasut_id=1000245233, amount=55440` → view → UI "Tutar: 55.440,00 TRL" — hiçbir ara katmanda değer değişmedi.

`parasut_id 1001320671`: `payments.data=[]` (gerçek, boş) → view'da hiçbir satır yok → UI "İlişkili ödeme yok" — uydurulmuş "—" değil, gerçek boş ilişkinin dürüst yansıması.

## PASS / FAIL / BLOCKED

**PASS:**
- Ham API envanteri tam çıkarıldı (root/attributes/relationships/data/links/meta, 40 kaydın tamamı)
- `remaining_in_trl`, `parasut_created_at`, `parasut_updated_at` artık base→view→type→UI zincirinin tamamında
- Payments relationship'in gerçek yapısı (to-many, 35/40 dolu, 5/40 boş) kanıtlandı ve `payable_type='checks'` ile mevcut `parasut.payments` tablosuna doğru şekilde bağlandı, junction tablo gerekmediği gerekçesiyle açıklandı
- Payment resource'un kendi eksik attribute'ları (`due_date`, `matched_amount`, `amount_in_trl`, `paid_in_currency`) tüm payable_type'lar için düzeltildi
- `histories` 40/40 kayıtta gerçekten boş olduğu sayıyla kanıtlandı
- Raw payload: mevcut `raw jsonb` kolonunun zaten bu ihtiyacı karşıladığı gerekçelendirildi, gereksiz tekrar eklenmedi
- İki ardışık gerçek sync birebir aynı sonucu verdi, duplicate yok
- Sync sırasında bulunan gerçek bir bug (sync_runs kolon uyumsuzluğu → takılı kalan lock) kök nedeniyle düzeltildi
- Regresyon metrikleri (transactions, check_cash_in/out, accounts) değişmedi; payments toplamındaki artış beklenen ve doğru
- Build/lint/test/deploy/route/overflow doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:**
- `category`, `details`, `tags`, `refund_of`, `sharings`, `recurrence_plan` relationship'leri gerçek API'nin kendi sunucu hatası (HTTP 500) nedeniyle hiçbir şekilde alınamıyor — bu, kodun değil, Parasut'un canlı API'sinin bir kısıtı. Veri asla var olmadığı için (include edilmeden relationships'te de görünmüyorlar) atlanan bir şey yok; ancak API bu konuda düzelirse yeniden denenmesi gerektiği not edilir.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Genel Karar

**PASS.** Gerçek `/checks` API'sinin döndürdüğü her attribute ve her gerçek relationship (issued_by, given_to, payments, histories) artık base tablo → view → frontend type → UI zincirinin tamamında, null'lar korunarak, hiçbir hesaplama/türetme/uydurma olmadan mevcut. `remaining_in_trl`/`created_at`/`updated_at` eksikliği giderildi; `payments` ilişkisi gerçek yapısına (to-many, mevcut `payable_type` mimarisiyle) uygun şekilde eklendi ve UI'da gösterildi; `histories`'in gerçekten boş olduğu kanıtlandı; API'nin kendi sunucu hatası nedeniyle erişilemeyen 6 relationship (category/details/tags/refund_of/sharings/recurrence_plan) ham kanıtla (HTTP 500) belgelendi ve BLOCKED olarak işaretlendi — kod tarafında bir eksiklik değildir. Sync sırasında rastlanan gerçek bir lock bug'ı da kök nedeniyle giderildi. Kaynak Faz 6.1 raporunun "kapsam dışı" gerekçesi bu fazda tamamen ortadan kaldırıldı.
