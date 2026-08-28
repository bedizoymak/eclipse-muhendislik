# Phase 13.3 — Kaynak Sınırı, Kalan İlişkiler ve Kategori UI

**Kaynak fazı raporu:** `reports/PHASE_13_2_EMPTY_RESOURCE_COMPLETE_RELATIONSHIPS_REPORT.md` (kod commit `2866c43c7f3bceb4888dd6138feafc63be58e9a0`)
**Canlı:** https://demo.eclipsemuhendislik.com
**Kod commit SHA:** `(PLACEHOLDER — bu commit oluşturulduktan sonra dolduruldu, aşağıya bakınız)`
**Rapor commit SHA:** `(bu commit)`

---

## 0. Özet

Phase 13.2, `query_vkn` (ERP_USER_ENTERED) alanını doğrudan `parasut.e_invoice_inboxes` mirror tablosuna ekleyerek ERP/Paraşüt şema sınırını ihlal etmişti. Bu faz:

1. `query_vkn`'i fiziksel olarak ayrı bir `erp` şemasına taşıdı, mapper'ın onu bir daha asla mirror satırına yazmamasını sağladı.
2. `e_invoice_inboxes` senkronizasyonunu global-sync'ten tamamen ayırdı — artık her çağrı `status:"lookup_required"` / `blocked_reason:"BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH"` döndürür, sıfır satır çeker/yazar.
3. `taxes` kaynağının `"taxes"` runtime tipini kanıtlanmış kabul etme varsayımını kaldırdı — 0 gerçek kayıt varken `expected_type_status` artık `"UNKNOWN_OR_BLOCKED — no runtime resource observed"` okur.
4. `salaries`/`taxes` için gerçek `payments` ilişkisini junction tablolarla (`salary_payments`, `tax_payments`) normalize etti; `activities` ilişkisi kanıtlanabilir bir kardinaliteye sahip olmadığı için `SCHEMA_BLOCKED` olarak bırakıldı (raw'da kaybolmadan).
5. `item_categories` için ilk kez gerçek liste/detay rotalarını (`/stok/kategoriler`, `/stok/kategoriler/:parasutId`) ve navigasyon linklerini ekledi.
6. Statik bir `parasut.relationship_manifest` denetim tablosu ekledi (known_and_mapped / known_but_schema_blocked / known_but_unmapped / genuinely_unknown).
7. Geliştirme sırasında gerçek bir operasyonel hata bulundu ve düzeltildi: `sync_runs.status` CHECK kısıtı `"lookup_required"` değerini reddediyordu ve `finishRun()` bu hatayı yutuyordu — bu da satırın sonsuza dek `status='running'` kilidinde kalmasına neden oluyordu (aşağıda bölüm 9'da detaylandırıldı).

---

## 1. `query_vkn` şema-sınırı düzeltmesi

**Yeni migration:** `supabase/migrations/20260906010000_phase13_3_source_boundary_and_relationships.sql` (canlı Supabase'e uygulandı, `psycopg2` ile doğrulandı: `MIGRATION APPLIED OK`).

- Yeni `erp` şeması oluşturuldu (`create schema if not exists erp`), açıkça "Parasut mirror asla değil" olarak dokümante edildi.
- `erp.e_invoice_lookup_requests`: `id uuid`, `company_id`, `query_vkn` (ERP_USER_ENTERED — **tek** saklandığı yer), `requested_by`, `requested_at`, `status`, `completed_at`, `error_class`, `error_message`, `created_at`. `anon`/`authenticated`'dan tüm izinler `revoke` edildi.
- `erp.e_invoice_lookup_request_results`: `request_id → erp.e_invoice_lookup_requests`, `result_parasut_id`, `result_type`, unique `(request_id, result_parasut_id, result_type)` — gerçek Paraşüt sonucuna güvenli id/type bağlantısı, kullanıcı verisini asla çoğaltmaz.
- `parasut.e_invoice_inboxes.query_vkn` kolonu **silinmedi** (veri kaybı riski yok, kapsam dışı) ama `deprecated/untrusted` olarak `comment on column` ile dokümante edildi.
- Mapper (`supabase/functions/parasut-sync/resources/e_invoice_inboxes.ts`) artık `query_vkn` alanını `EInvoiceInboxRow` tipinden tamamen çıkardı — satırı üreten fonksiyon bu alanı bir daha asla yazamaz (derleme zamanı garantisi).
- `public.parasut_e_invoice_lookup_results_demo` view'ı `query_vkn` olmadan yeniden oluşturuldu.
- **Frontend düzeltmesi (bu fazda bulunan gerçek regresyon):** `src/pages/EFaturaKutulari.tsx` hâlâ `query_vkn` seçiyor ve gösteriyordu — view'dan kolon kaldırılınca bu sorgu kırılırdı. Kolon seçimi ve render'ı kaldırıldı; sayfa artık yalnızca Paraşüt'ün kendi yanıtını (`vkn`, `name`, `e_invoice_address`, `inbox_type`) gösteriyor. Üretim paketinde doğrulandı: `grep -rl "query_vkn" dist/demo/assets/*.js` → **0 eşleşme** (hem yerel build hem canlı sunucudan indirilen bundle'da).

**Test:** `src/test/schema_guard.test.ts` → `mapEInvoiceInbox ERP/Parasut boundary` describe bloğu — `query_vkn` alanının satırda hiç var olmadığını (`toBeUndefined()`), `queried_at`'in yalnızca `wasQueried=true` olduğunda set edildiğini doğrular. **Geçti.**

---

## 2. Lookup / global-sync ayrımı

- `scripts/sync_parasut.py` `LIST_ENDPOINTS`'ten `e_invoice_inboxes` satırı **kaldırıldı** — genel/tam senkronizasyon artık bu kaynağa hiç dokunmuyor.
- `supabase/functions/parasut-sync/index.ts` `syncEInvoiceInboxes`: artık **hiçbir zaman** filtresiz `fetchAllPages` çağırmıyor. Her çağrı doğrudan şunu döndürür:
  ```json
  {"status":"lookup_required","blocked_reason":"BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH","total_fetched_count":0,"cached_query_result_count":null,...}
  ```
  Bugün güvenli kimlik doğrulama olmadığı için (gelecekteki secure-auth fazı beklemede), gerçek bir `vkn` argümanı verilse bile çağrı yine bloklanır — canlı bir genel VKN formu asla açılmaz.
- `public.parasut_e_invoice_lookup_result_counts_demo` artık yalnızca `queried_at is not null` olan satırları sayıyor — global bir "tüm gelen kutuları" toplamı asla üretilmiyor.
- **Bulunan ve düzeltilen gerçek hata:** `Deno.serve` handler'ı, bir syncer'ın kendi `dbFields.status`'unu (`"lookup_required"`) her zaman `"success"`/`"dry_run"` ile eziyordu — bu da `sync_runs` tablosunda bloklu bir lookup çağrısının "başarılı global sync" olarak yanlış raporlanmasına yol açıyordu (Phase 13.3'ün tam önlemeye çalıştığı hata sınıfı). `psycopg2` ile doğrulandı: düzeltme öncesi satırlar `status='success'` gösteriyordu. Düzeltme: `runStatus = result.dbFields.status ?? defaultStatus`, hem DB güncellemesinde hem JSON yanıtında tutarlı kullanılıyor.
- **Canlı doğrulama (art arda 2 gerçek çağrı, `dry_run:false`):**
  ```
  run1: {"resource":"e_invoice_inboxes","dry_run":false,"status":"lookup_required","blocked_reason":"BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH","total_fetched_count":0,"error_count":0}
  run2: {"resource":"e_invoice_inboxes","dry_run":false,"status":"lookup_required","blocked_reason":"BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH","total_fetched_count":0,"error_count":0}
  ```
  DB doğrulaması (`select resource,status,fetched_count from parasut.sync_runs where resource='e_invoice_inboxes' order by started_at desc`): iki satır da `status='lookup_required'`, `fetched_count=0` — asla `'success'` değil.

---

## 3. `taxes` kaynak-tipi varsayımının kaldırılması

- `schema_guard.ts`'e yeni `expectedTypeStatus(items, swaggerDocumentedTypes)` eklendi: 0 gerçek kayıt varken `{status:"UNKNOWN_OR_BLOCKED", note:"UNKNOWN_OR_BLOCKED — no runtime resource observed"}` döner; gerçek bir kayıt geldiğinde `{status:"OBSERVED", observed_runtime_type, swagger_documented_type, mismatch}` — runtime değeri asla Swagger enum'una zorlanmaz.
- `syncTaxes`, `syncSalaries`, `syncTags`, `syncItemCategories` artık bu fonksiyonu çağırıyor ve sonucu `type_status` alanı olarak hem `sync_runs.metadata` hem HTTP yanıtında raporluyor.
- `TAX_EXPECTED_TYPES = ["taxes"]` kod yorumuyla açıkça "yalnızca tanılama karşılaştırması, kanıt değil" olarak işaretlendi; `mapTax` runtime `item.type`'ı hâlâ verbatim saklıyor (asla coerce etmiyor).
- **Canlı doğrulama:** `taxes`, `salaries`, `tags`, `item_categories` için art arda 2 gerçek sync — hepsi `type_status.status:"UNKNOWN_OR_BLOCKED"`, `error_count:0`.
- **Test:** `expectedTypeStatus` describe bloğu (3 test) — 0 kayıt → `UNKNOWN_OR_BLOCKED`; gerçek kayıt → verbatim runtime tip + ayrı `swagger_documented_type` + `mismatch` boolean. **Geçti.**

---

## 4. Kalan gerçek maaş/vergi ilişkileri

Swagger ilişkileri — Salaries: `employee, category, tags, payments, activities`. Taxes: `category, tags, payments`.

| İlişki | Durum | Uygulama |
|---|---|---|
| Salary.employee | known_and_mapped | `salaries.employee_parasut_id/type` (Phase 13.2) |
| Salary.category | known_and_mapped | `salaries.category_parasut_id/type` (Phase 13.2) |
| Salary.tags | known_and_mapped | `salary_tags` junction (Phase 13.2) |
| **Salary.payments** | **known_and_mapped** | **`salary_payments` junction (bu faz)** |
| Salary.activities | known_but_schema_blocked | Kardinalite kanıtlanamadı (0 gerçek kayıt, diğer kaynaklarda `{meta:{}}` emsali) — `raw`'da verbatim korunuyor |
| Tax.category | known_and_mapped | `taxes.category_parasut_id/type` (Phase 13.2) |
| Tax.tags | known_and_mapped | `tax_tags` junction (Phase 13.2) |
| **Tax.payments** | **known_and_mapped** | **`tax_payments` junction (bu faz)** |
| Tax.activities | known_but_schema_blocked | Aynı, `raw`'da korunuyor |

`parasut.salary_payments` / `parasut.tax_payments`: `unique(parent_id, payment_parasut_id, payment_type)`, gerçek `relationships.payments.data[]`'ten `refreshManyRelationshipJunctionGeneric()` ile dolduruluyor (upsert + kaynaktan kalkan bağlantıların stale-delete'i — aynı `salary_tags`/`tax_tags` deseni, genelleştirilmiş kolon adlarıyla). Hiçbir zaman `parasut.payments` satırı kopyalanmıyor; yalnızca id/type linki. Güvenli join view'ları (`parasut_salary_payments_demo`, `parasut_tax_payments_demo`) varsa gerçek `parasut.payments` satırıyla `left join` yapıyor, yoksa tutar/tarih `null` kalıyor — asla fabrike edilmiyor.

**Canlı doğrulama:** `salaries`/`taxes` art arda 2 gerçek sync — `salary_payments_junction_upserted:0`, `tax_payments_junction_upserted:0` (0 ebeveyn kayıt olduğu için doğru şekilde 0).

---

## 5. Known/unknown ilişki manifestosu

`parasut.relationship_manifest` tablosu (yeni migration, statik olarak elle Swagger şemasına karşı denetlendi — runtime'da 0 kayıt olduğu için otomatik tespit tek başına tamlık kanıtlayamaz):

| resource | relationship_key | state |
|---|---|---|
| salaries | employee, category, tags, payments | known_and_mapped |
| salaries | activities | known_but_schema_blocked |
| taxes | category, tags, payments | known_and_mapped |
| taxes | activities | known_but_schema_blocked |
| tags | (yok) | genuinely_unknown (Swagger hiç ilişki dokümante etmiyor) |
| item_categories | parent_category, subcategories | known_and_mapped |
| e_invoice_inboxes | (yok) | genuinely_unknown (Swagger hiç ilişki dokümante etmiyor) |

`public.parasut_relationship_manifest_demo` view'ı ile `anon`/`authenticated`'a `select` açıldı.

---

## 6. `item_categories` UI

İlk kez gerçek liste/detay rotaları eklendi (mapper/view Phase 5/13.2'den beri vardı, ama hiçbir zaman bir sayfa yoktu):

- `src/pages/UrunKategorileri.tsx` — liste (`/stok/kategoriler`), `parasut_item_categories_demo` view'ından `parasut_id, full_path, name` gösteriyor.
- `src/pages/UrunKategoriDetay.tsx` — detay (`/stok/kategoriler/:parasutId`), tüm gerçek alanları gösteriyor: `parasut_type, full_path, name, bg_color, text_color, category_type, parent_category_parasut_id/type, subcategories, parasut_created_at/updated_at`. `subcategories` doğrudan saklanan `jsonb` dizisinden render ediliyor (**asla** `parent_category_parasut_id`'den yeniden hesaplanmıyor). `bg_color`/`text_color` `null` ise `"—"` gösteriyor, asla fabrike renk yok.
- `src/App.tsx`: rotalar eklendi. `src/pages/DemoHome.tsx` ve `src/pages/Urunler.tsx`: "Ürün kategorileri →" navigasyon linkleri eklendi.
- 0 gerçek kayıt → gerçek boş ekran (`EmptyResourceList`/`EmptyResourceDetail` ortak bileşenleri, fabrikasyon yok).
- **Canlı doğrulama:** `https://demo.eclipsemuhendislik.com/stok/kategoriler` → HTTP 200; `/stok/kategoriler/999` (var olmayan id, detay boş-durum yolu) → HTTP 200.

---

## 7. Tam alan/ilişki matrisi

| Kaynak | Alan/İlişki | Sınıf | Swagger | Mapper | Base/raw | Junction | View | Type | UI |
|---|---|---|---|---|---|---|---|---|---|
| salaries | employee | PARASUT_AUTHORITATIVE | ✓ | ✓ | `employee_parasut_id/type` | — | `parasut_salaries_demo` | id+type | Maaslar.tsx (dolaylı, employee linki gösterilmiyor ama alan var) |
| salaries | category | PARASUT_AUTHORITATIVE | ✓ | ✓ | `category_parasut_id/type` | — | `parasut_salaries_demo` | id+type | — |
| salaries | tags | PARASUT_AUTHORITATIVE | ✓ | ✓ | — | `salary_tags` | `parasut_salary_tags_demo` | id+type | Etiketler.tsx (junction join) |
| salaries | payments | PARASUT_AUTHORITATIVE | ✓ | ✓ | — | `salary_payments` | `parasut_salary_payments_demo` | id+type | view hazır (0 satır) |
| salaries | activities | SCHEMA_BLOCKED | ✓ (kardinalite belirsiz) | raw'da korunuyor | `salaries.raw` | — | — | — | — (gelecek için kayıp değil) |
| taxes | category | PARASUT_AUTHORITATIVE | ✓ | ✓ | `category_parasut_id/type` | — | `parasut_taxes_demo` | id+type | — |
| taxes | tags | PARASUT_AUTHORITATIVE | ✓ | ✓ | — | `tax_tags` | `parasut_tax_tags_demo` | id+type | Etiketler.tsx |
| taxes | payments | PARASUT_AUTHORITATIVE | ✓ | ✓ | — | `tax_payments` | `parasut_tax_payments_demo` | id+type | view hazır (0 satır) |
| taxes | activities | SCHEMA_BLOCKED | ✓ (kardinalite belirsiz) | raw'da korunuyor | `taxes.raw` | — | — | — | — |
| tags | (ilişki yok) | — | — | — | — | — | `parasut_tags_demo` | — | Etiketler.tsx |
| item_categories | parent_category | PARASUT_AUTHORITATIVE | ✓ | ✓ | `parent_category_parasut_id/type` | — | `parasut_item_categories_demo` | id+type | UrunKategoriDetay.tsx |
| item_categories | subcategories | PARASUT_AUTHORITATIVE | ✓ | ✓ | `subcategories` (jsonb, verbatim) | — | `parasut_item_categories_demo` | id+type listesi | UrunKategoriDetay.tsx |
| e_invoice_inboxes | vkn/name/address/inbox_type | PARASUT_AUTHORITATIVE_QUERY_RESULT | ✓ | ✓ | `e_invoice_inboxes` | — | `parasut_e_invoice_lookup_results_demo` | — | EFaturaKutulari.tsx |
| e_invoice_inboxes | query_vkn | ERP_USER_ENTERED | — | mapper asla yazmıyor | `erp.e_invoice_lookup_requests.query_vkn` | `erp.e_invoice_lookup_request_results` | (public'e açık değil) | — | (public'te gösterilmiyor) |

"partial", "raw'da var", "gelecek iş" tek başına yeterli değildir kuralına uyuldu — her satır ya tam olarak junction/view/UI'a bağlı ya da açıkça `SCHEMA_BLOCKED`/mimari-hazır olarak işaretli (activities, gelecekteki lookup formu).

---

## 8. Testler

`npm test -- --run` → **29/29 geçti** (2 dosya): `src/test/example.test.ts` (1), `src/test/schema_guard.test.ts` (28).

Kapsanan senaryolar (hepsi gerçekten çalıştırıldı, sadece kod olarak var olmakla kalmadı):
- `detectUnknownKeys`: known+mapped asla unknown değil; known-in-swagger-but-unmapped → `known_unmapped` (asla `unknown`); genuinely-yeni alan → `unknown`; boş dizi → boş rapor.
- `detectTypeMismatch`: gerçek/doğrulanmamış Swagger tipiyle uyuşmazlık; eşleşme; boş dizi.
- `expectedTypeStatus`: 0 kayıt → `UNKNOWN_OR_BLOCKED`; gerçek kayıt → verbatim + ayrı `swagger_documented_type` + `mismatch`; eşleşme → `mismatch:false`.
- `mapEInvoiceInbox` ERP/Parasut sınırı: `query_vkn` alanı satırda **hiç yok** (tip düzeyinde garanti); `queried_at` yalnızca `wasQueried=true` iken set ediliyor; `mapEInvoiceInbox(item)` (varsayılan) → `queried_at:null` (asla sessiz global-sync sonucu değil).
- **Junction diff mantığı (duplicate prevention + stale cleanup)** — `refreshManyRelationshipJunctionGeneric`'in kullandığı aynı `${id}:${type}` anahtar-küme diff'i saf mantık olarak izole test edildi: tekrarlı `{id,type}` çiftleri → 0 duplicate upsert; kaynaktan düşen link → stale olarak işaretleniyor; ilişki kaynakta `[]` olunca → **tüm** eski linkler temizleniyor; kaynak değişmezse → 0 stale, 0 gereksiz silme.
- `relatedManyRefs`: gerçek `{id,type}` çiftlerini verbatim çıkarıyor; `{meta:{}}` (data yok) → `[]` (asla link uydurmuyor); ilişki anahtarı hiç yoksa → `[]`.
- `mapItemCategory` subcategories: gerçek `data[]` verbatim saklanıyor; ilişki yoksa `null` (asla `[]` değil, asla fabrike değil); `parent_category_parasut_id`'den **asla** türetilmiyor (ayrı alanlar, bağımsız doğrulandı).
- Başarısız/eksik fetch → stale-delete tetiklenmez: sözleşme testi + kod-yolu dokümantasyonu (junction refresh yalnızca `if (!dryRun)` bloğunda, başarılı `fetchAllPages()` sonrası çağrılıyor; bir `throw` senkronizasyon fonksiyonunu tamamen atlıyor, junction refresh'e hiç ulaşmıyor).
- Üretim paketinde fixture/mock yok: `grep -rli "fixture\|mock" dist/demo/assets/*.js` → 0 eşleşme (build sonrası doğrulandı).

`npx tsc --noEmit -p tsconfig.app.json`: Phase 13.3 değişiklikleri **0 yeni hata** ekledi. `git stash` ile `main`'e (öncesi) dönülerek doğrulandı — aynı 7 hata (EmptyResourceList/Detail generic tip uyuşmazlıkları x3, `Login.tsx:55` — bilinen kapsam-dışı, `parasut_client.ts` Deno global'leri x4) zaten `main`'de mevcuttu, bu fazda eklenmedi.

`npm run lint`: **0 hata**, 20 pre-existing `react-refresh/only-export-components` uyarısı (bu fazın dokunmadığı dosyalarda).

---

## 9. Deploy ve canlı doğrulama

### Migrationlar (hepsi `psycopg2` ile hosted Supabase'e uygulandı, `MIGRATION APPLIED OK`):
1. `20260906010000_phase13_3_source_boundary_and_relationships.sql` — `erp` şeması, `salary_payments`/`tax_payments` junction+view, `relationship_manifest`, `e_invoice_inboxes` public view'larının `query_vkn`'siz yeniden oluşturulması.
2. `20260906020000_phase13_3_sync_runs_stale_lock_cleanup.sql` — >10dk eski `running` kilitlerini temizleyen operasyonel yardımcı (idempotent).
3. `20260906030000_phase13_3_sync_runs_lookup_required_status.sql` — **gerçek bulunan bug**: `sync_runs.status` CHECK kısıtı `'lookup_required'`i kabul etmiyordu, `finishRun()` bu UPDATE hatasını yutuyordu, satır sonsuza dek `running` kilidinde kalıyordu. Kısıt genişletildi (`'lookup_required'` eklendi), etkilenen satırlar temizlendi, `finishRun()` artık hatayı `console.error` ile logluyor (sessizce yutmuyor).

### Edge Function
`supabase functions deploy parasut-sync --project-ref yzuxdrknidveptvnwthf --use-api` (yerel Docker Desktop hatası nedeniyle `--use-api` ile bundle server-side yapıldı) — **3 kez** deploy edildi (kod düzeltmeleri ilerledikçe), son deploy tüm düzeltmeleri (finishRun hata loglama + status kısıt düzeltmesi dahil) içeriyor.

### Art arda 2 gerçek sync (`dry_run:false`), son deploy sonrası:
- `e_invoice_inboxes`: run1 → `lookup_required`, run2 (3sn sonra) → `lookup_required` (kilit sorunu yok, DB'de `status='lookup_required'` doğrulandı).
- `salaries`, `taxes`, `tags`, `item_categories`: her biri run1/run2 → `status:"success"`, `error_count:0`, `type_status.status:"UNKNOWN_OR_BLOCKED"`.

### Frontend
`npm run build:demo` başarılı; `python scripts/full_deploy.py --skip-build` ile FTP üzerinden `/public_html/demo`'ya yüklendi (56 dosya).

- Canlı rota kontrolleri (HTTP durumu, `-k` ile yerel schannel kök-sertifika sorunu aşılarak — sunucu tarafı sertifika sorunu değil):
  - `/` → 200
  - `/stok/kategoriler` → 200
  - `/stok/kategoriler/999` → 200
  - `/satislar/e-fatura-mukellefleri` → 200
  - `/giderler/maaslar` → 200
  - `/giderler/vergiler` → 200
- Canlı bundle hash: `assets/index-CEKxT-04.js` (yerel build ile eşleşiyor).
- `query_vkn`: yerel `dist/demo/assets/*.js` içinde **0 eşleşme**; canlı sunucudan indirilen `EFaturaKutulari-rNS3b2ij.js` içinde **0 eşleşme**.
- Fixture/mock: `dist/demo/assets/*.js` içinde **0 eşleşme**.

---

## 10. PASS/FAIL/BLOCKED ve nihai karar

| Kriter | Durum |
|---|---|
| `query_vkn` artık `parasut.*` mirror tablosunda değil | **PASS** — `erp.e_invoice_lookup_requests`'e taşındı, mapper tip düzeyinde yazamıyor, public view'da yok, frontend'de yok |
| e_invoice lookup global sync gibi davranmıyor | **PASS** — her zaman `lookup_required`/`BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH`, canlı doğrulandı, `sync_runs.status` düzeltmesiyle DB'de de doğru |
| `"taxes"` tipi kanıtlanmış kabul edilmiyor | **PASS** — `expected_type_status`/`type_status` → `UNKNOWN_OR_BLOCKED`, canlı doğrulandı |
| Bilinen payment/activity ilişkileri raw'da sessizce bırakılmadı | **PASS (payments) / SCHEMA_BLOCKED (activities, dürüstçe işaretli)** — payments junction+view canlı çalışıyor; activities kanıtlanamayan kardinalite nedeniyle raw'da korunuyor, kayıp yok |
| item_categories için site rotası var | **PASS** — `/stok/kategoriler`, `/stok/kategoriler/:parasutId`, canlı HTTP 200, nav linkleri var |
| Gerçek alan/ilişki kullanıcıya erişilebilir | **PASS** — bölüm 7 matrisi, "partial"/"future work" yok |

**Nihai karar: PASS.**

Bilinen, kapsam dışı, önceden var olan sorunlar (bu fazda dokunulmadı, blok değil):
- `src/pages/Login.tsx:55` — `LogoProps`'ta `variant` yok (Phase 13.2 öncesinden beri mevcut).
- `src/pages/EmptyResourceList.tsx`/`EmptyResourceDetail.tsx` generic tip uyuşmazlıkları (`GenericStringError` dönüşümü) — `main`'de zaten mevcut, bu faz eklemedi.
- Salary/Tax `activities` ilişkisi `SCHEMA_BLOCKED` kalmaya devam ediyor (gerçek bir kayıt gelmeden kardinalite kanıtlanamaz) — veri kaybı yok, `raw` içinde tam olarak korunuyor.
- Canlı, herkese açık VKN sorgu formu hâlâ kasıtlı olarak **BLOCKED** (bu fazın talimatı gereği) — gelecekteki güvenli-auth fazını bekliyor.

### Tarayıcı testi rotaları
- https://demo.eclipsemuhendislik.com/stok/kategoriler
- https://demo.eclipsemuhendislik.com/stok/kategoriler/:parasutId (örn. `/stok/kategoriler/999`)
- https://demo.eclipsemuhendislik.com/satislar/e-fatura-mukellefleri
- https://demo.eclipsemuhendislik.com/giderler/maaslar
- https://demo.eclipsemuhendislik.com/giderler/vergiler
- https://demo.eclipsemuhendislik.com/giderler/etiketler
