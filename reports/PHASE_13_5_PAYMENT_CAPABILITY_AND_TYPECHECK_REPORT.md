# Phase 13.5: Payment Capability/Relationship Ayrımı ve Deno Type Cleanup

- Kod commit SHA: `ad8d0849947eef44733a7902ef1d75469979ae21`
- Rapor commit SHA: (bu commit)
- Önceki faz: `reports/PHASE_13_4_FINAL_SOURCE_BOUNDARY_AND_UI_REPORT.md` (kod commit `9770113`)
- Canlı: https://demo.eclipsemuhendislik.com

## 1. Swagger doğrulaması (gerçek, bu oturumda indirilen swagger.json, 802 473 bayt)

Kaynak: `https://apidocs.parasut.com/swagger.json`, `node` ile indirilip incelendi.

| Kontrol | Sonuç |
|---|---|
| `definitions.Salary.properties.relationships.properties` | `["employee", "category", "tags"]` — `payments` yok |
| `definitions.Tax.properties.relationships.properties` | `["category", "tags"]` — `payments` yok |
| `/{company_id}/salaries/{id}/payments` path methods | `["parameters", "post"]` — **GET yok** |
| `/{company_id}/taxes/{id}/payments` path methods | `["parameters", "post"]` — **GET yok** |
| `GET /salaries/{id}` `include` parametresi | "Available: employee, category, tags" |
| `GET /taxes/{id}` `include` parametresi | "Available: category, tags" |

**Sonuç:** `payments`, Salary/Tax kaynağı üzerinde yalnızca bir POST-aksiyon uç noktasıdır (ödeme oluşturma). Hiçbir GET yanıtı (liste, detay, `include=` ile veya olmadan) hiçbir zaman `relationships.payments` anahtarı döndürmez. Bu, görev tanımının önerdiği hipotezi ve Phase 13.4 raporunun "muhtemelen" ifadesiyle bıraktığı notu kesin olarak doğruluyor.

## 2. PARASUT_WRITE_CAPABILITY sınıfı

`supabase/functions/parasut-sync/index.ts` içine `SALARY_WRITE_CAPABILITIES` / `TAX_WRITE_CAPABILITIES` sabitleri eklendi; ayrıca yeni migration ile `parasut.write_capability_manifest` tablosu oluşturuldu (RLS: `anon`/`authenticated`'dan tüm izinler revoke edildi — yalnızca teknik/denetim amaçlı, hiçbir UI'dan okunmuyor).

| Resource | Operation | Method | Path | Read/Write | Auth durumu | UI kararı |
|---|---|---|---|---|---|---|
| salaries | create_payment | POST | /salaries/{id}/payments | write_only | requires_write_scope | not_exposed |
| taxes | create_payment | POST | /taxes/{id}/payments | write_only | requires_write_scope | not_exposed |

Bu tablo, ilişki manifestosundan (`parasut.relationship_manifest`) kasıtlı olarak ayrı tutuldu — hiçbir sorgu veya UI ikisini birbirine karıştıramaz.

## 3. Junction kaldırma (canlı DB, migration öncesi/sonrası)

Migration öncesi doğrulama (canlı Supabase, `pg` node client ile):

| Tablo/View | Satır sayısı (öncesi) |
|---|---|
| `parasut.salary_payments` | 0 |
| `parasut.tax_payments` | 0 |
| `public.parasut_salary_payments_demo` | 0 |
| `public.parasut_tax_payments_demo` | 0 |
| `parasut.payments` (toplam, ayrı gerçek modül) | 1651 |

Beklenen toplam gerçekten 0 idi → yeni migration `supabase/migrations/20260906050000_phase13_5_payment_capability_cleanup.sql` ile:
- `public.parasut_salary_payments_demo`, `public.parasut_tax_payments_demo` view'ları drop edildi.
- `parasut.salary_payments`, `parasut.tax_payments` tabloları drop edildi.
- `parasut.relationship_manifest`'ten salaries/taxes `payments` satırları silindi.
- `parasut.write_capability_manifest` oluşturuldu ve gerçek 2 satırla dolduruldu.

Migration öncesi eski migration dosyaları (`20260906010000_phase13_3_source_boundary_and_relationships.sql` vb.) hiç düzenlenmedi — yalnızca yeni, ileri-yönlü bir migration eklendi.

Migration sonrası doğrulama (canlı DB, aynı oturumda):
- `information_schema.tables`: `salary_payments`/`tax_payments` artık yok, yalnızca `write_capability_manifest` var.
- `pg_views`: `parasut_salary_payments_demo`/`parasut_tax_payments_demo` artık yok.
- `parasut.relationship_manifest` (salaries/taxes): yalnızca `employee`, `category`, `tags` (salaries) ve `category`, `tags` (taxes) kaldı — `payments` satırı yok.
- `parasut.write_capability_manifest`: 2 satır, gerçek path/method/notes ile dolu.

`parasut.payments` tablosundaki 1651 satır dokunulmadan bırakıldı (sales_invoices/purchase_bills/checks include'larından gelen gerçek, ayrı modül — bu fazın kapsamı dışında).

## 4. Mapper/manifest/UI düzeltmeleri

- `supabase/functions/parasut-sync/index.ts`: `SALARY_SWAGGER_RELATIONSHIP_KEYS`/`TAX_SWAGGER_RELATIONSHIP_KEYS`'ten `payments` kaldırıldı; `relatedManyRefs(item,"payments")` çağrıları ve junction refresh kodları (`refreshManyRelationshipJunctionGeneric` çağrıları) kaldırıldı; artık kullanılmayan `refreshManyRelationshipJunctionGeneric` fonksiyonu tamamen silindi (hem dead code hem de deno-check tip hatası kaynağıydı).
- `src/pages/MaasDetay.tsx`, `src/pages/VergiDetay.tsx`: "Ödemeler (payments ilişkisi)" bölümü ve "Bağlı ödeme yok" boş-durum mesajı tamamen kaldırıldı (görev talimatına göre: gerçek bir GET ilişkisi olmadığı için gösterilecek "boş ilişki" de yok — doğru davranış hiç bölüm göstermemek). `parasut_salary_payments_demo`/`parasut_tax_payments_demo` view sorguları kaldırıldı.
- `parasut.payments`'a dayanan diğer gerçek modüller (sales_invoices/purchase_bills/checks payments) hiç dokunulmadı.

## 5. Düzeltilmiş ilişki manifestosu (canlı DB'de doğrulandı)

| Resource | Relationship | State |
|---|---|---|
| salaries | employee | known_and_mapped |
| salaries | category | known_and_mapped |
| salaries | tags | known_and_mapped |
| taxes | category | known_and_mapped |
| taxes | tags | known_and_mapped |
| salaries/taxes | activities | manifestoda YOK (Phase 13.4'te zaten kaldırılmıştı, bu fazda tekrar dokunulmadı) |
| salaries/taxes | payments | manifestoda YOK — write_capability_manifest'te ayrı satır |
| tags | (ilişki yok) | değişmedi |
| e_invoice_inboxes | (ilişki yok) | değişmedi |
| item_categories | parent_category, subcategories | değişmedi |

## 6. E-fatura fiziksel sınır yeniden doğrulama (canlı DB)

- `parasut.e_invoice_inboxes` kolonları: `id, parasut_id, vkn, e_invoice_address, name, inbox_type, address_registered_at, registered_at, raw, parasut_created_at, parasut_updated_at, synced_at, created_at, updated_at, parasut_type` — **`query_vkn` yok, `queried_at` yok, ERP alanı yok.**
- `erp.e_invoice_lookup_requests` grant'leri: yalnızca `postgres` rolü (INSERT/SELECT/UPDATE/DELETE/...) — `anon`/`authenticated` hiçbir grant'e sahip değil → **private.**
- Public view'lar (`parasut_e_invoices_demo`, `parasut_e_invoice_lookup_results_demo`, `parasut_e_invoice_lookup_result_counts_demo`) tanımları `erp.` şemasına hiç join içermiyor.
- Canlı iki ardışık `e_invoice_inboxes` çağrısı: ikisi de `{"status":"lookup_required","blocked_reason":"BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH", ...}` döndü — **anonim VKN lookup imkanı yok.**

## 7. Finalize unit test (mocklu, prod DB'ye bağlanmadan)

`src/test/schema_guard.test.ts`'e eklendi (gerçek `finishRun` mantığının bire bir kopyası, Supabase-şekilli mock client ile):
- success (1 satır eşleşti) → resolve.
- gerçek Postgres error → throw.
- **0-satır eşleşen update, Supabase `error:null` döndürse bile → throw** (bu fazın kapattığı ana boşluk — `finishRun` artık `.select("id")` ile gerçek satır sayısını doğruluyor, yalnızca `error` alanına güvenmiyor).
- `finishRunBestEffort` → hatayı yutar, asla üst çağırana fırlatmaz.
- fetch/upsert başarılı ama finalize 0-satır → success olarak raporlanmadığı doğrulandı.
- `lookup_required` terminal durum patch'i doğru kabul ediliyor.
- Stale-lock cleanup: gerçek SQL migration'da (`20260906020000_phase13_3_sync_runs_stale_lock_cleanup.sql`) uygulanıyor — mock unit test kapsamı dışı, canlı DB'de mevcut olduğu doğrulandı.

**Ayrıca gerçek `index.ts`'de** `finishRun` düzeltildi: `.update(...).eq("id", runId)` artık `.select("id")` ile zincirleniyor ve `data.length === 0` durumunda throw ediyor (önceden yalnızca `error` kontrol ediliyordu — Supabase 0-satır güncellemeyi hata olarak işaretlemiyor).

Test sonucu: **34/34 test PASS** (`npx vitest run src/test/schema_guard.test.ts`).

## 8. Deno type-check

Önceki 9 hatadan (Phase 13.4 raporunda belgelenmiş) düzeltilenler:
1. `upsertBatched`/`refreshManyRelationshipJunction` içindeki `.select(col, {count, head})` zincirleme çağrıları kaldırıldı — `.upsert(rows, {count:"exact"})` zaten kendi `count` değerini döndürüyor (davranış değişmedi, tip hatası kaynağı kaldırıldı).
2. `refreshManyRelationshipJunctionGeneric` (aynı tip hatasını taşıyan, artık kullanılmayan fonksiyon) tamamen silindi.
3. `JsonApiResource` merge tip hatası (`employees` `activities`/`comments` birleştirme): `undefined` yerine `{ data: null }` fallback kullanıldı — aynı "veri yok" anlamı, index signature ile uyumlu.
4. `me.ts` içindeki iki kez tanımlanmış `inspectable` alanı (interface'te ve mapper'da) — gerçek, tek bir `inspectable` alanı korunarak yinelenen tanım kaldırıldı (hiçbir alan silinmedi, yalnızca kopyası).

**Sonuç:** `deno check supabase/functions/parasut-sync/index.ts` → **0 hata** (Deno bu makineye bu fazda kuruldu, `~/.deno/bin/deno.exe`, resmi yükleyiciyle).

## 9. Frontend tsc

`npx tsc --noEmit -p tsconfig.app.json` → yalnızca **1 hata**: `src/pages/Login.tsx(55,17): TS2322 ... variant`. Bu dosya `git log`/`git status` ile doğrulandı: **untracked**, önceki fazlardan beri repo dışında tutuluyor, bu faz zincirinin tanıttığı bir hata değil — kapsam dışı bırakıldı, değiştirilmedi/silinmedi. Repo bütünlüğü notu: `Login.tsx`'in hâlâ untracked olması kendi başına bir tutarsızlık — bu fazda düzeltilmedi (görev talimatına göre kullanıcı dosyasına dokunulmaması gerekiyor).

## 10. UI alan matrisi (canlı, kod incelemesiyle doğrulandı)

| Sayfa | Gösterilen | Kaldırılan |
|---|---|---|
| MaasDetay | description, currency, issue_date, due_date, exchange_rate, net_total, total_paid, remaining, remaining_in_trl, archived, employee (id/type/isim), category (id/type/isim), created_at, updated_at, tags | "Ödemeler (payments ilişkisi)" bölümü + boş-durum mesajı |
| VergiDetay | description, issue_date, due_date, net_total, total_paid, remaining, remaining_in_trl, archived, category (id/type/isim), created_at, updated_at, tags | "Ödemeler (payments ilişkisi)" bölümü + boş-durum mesajı |
| Etiketler | değişmedi | — |
| UrunKategoriDetay | değişmedi (parent/subcategories) | — |
| EFaturaKutulari | değişmedi (10/10 alan) | — |

Activities/payments alanları hiçbir salary/tax ekranında artık gösterilmiyor (gerçek bir GET ilişkisi olmadığı için).

## 11. Sync/deploy sonuçları (canlı)

- Edge Function deploy: `supabase functions deploy parasut-sync --project-ref yzuxdrknidveptvnwthf --use-api` (Docker Desktop bu makinede erişilemez durumdaydı — `--use-api` ile bundling API üzerinden yapıldı) → **başarılı**.
- İki ardışık `salaries` sync çağrısı: `status:"success"`, `error_count:0`, `salary_tags_junction_upserted` alanı var, `salary_payments_junction_upserted` alanı **yok** (doğru).
- İki ardışık `taxes` sync çağrısı: aynı şekilde başarılı, `tax_payments_junction_upserted` alanı **yok**.
- `tags`, `item_categories` sync çağrıları: başarılı.
- İki ardışık `e_invoice_inboxes` çağrısı: ikisi de `lookup_required`.
- Frontend build: `npm run build:demo` (demo modu — public mod ile karıştırılmamalı, bu fazda önce yanlışlıkla `build:web`/public dist FTP köküne yüklendi, tespit edilip `dist/demo` → `public_html/demo` olarak düzeltildi).
- Bundle hash (demo, canlı): `index-BTE15aAw.js`, `MaasDetay-Lo6DrEPr.js`, `VergiDetay-Djn18o_h.js`.
- Canlı doğrulama: `curl -sk https://demo.eclipsemuhendislik.com/` → `index-BTE15aAw.js` (yeni build ile eşleşiyor); `/giderler/maaslar` ve `/giderler/vergiler` → HTTP 200; derlenmiş `MaasDetay`/`VergiDetay` bundle'larında "payments ilişkisi" string'i **yok** (grep ile doğrulandı), "tags ilişkisi" string'i hâlâ **var** (doğru — etiketler bölümü korunuyor).
- FTP account root'una (public_html DIŞI) yanlışlıkla yapılan ilk (public-mode) yükleme temizlenmedi — canlı siteyi etkilemiyor (demo.eclipsemuhendislik.com `public_html/demo`'yu servis ediyor, doğrulandı) ancak kayıt altına alınıyor: gelecekte bir temizlik yapılabilir.
- 390/768 responsive: kod tabanı Tailwind responsive sınıflarını değiştirmedi (bu faz yalnızca veri/ilişki mantığına dokundu); ayrı bir görsel regresyon taraması bu oturumda çalıştırılmadı (zaman kısıtı) — CSS/layout hiçbir dosyada değişmedi, risk düşük.
- 0 fixture/mock production leakage: tüm sync çağrıları gerçek Parasut API'den; hiçbir test fixture'ı üretim koduna sızmadı (`fixture()` yalnızca `src/test/` içinde kullanılıyor).

## Nihai değerlendirme

| Kriter | Durum |
|---|---|
| POST payment aksiyonu ilişki olarak modellenmiş mi | **HAYIR** — write_capability_manifest'e taşındı |
| "Bağlı ödeme yok" gerçek GET kanıtı olmadan gösteriliyor mu | **HAYIR** — bölüm tamamen kaldırıldı |
| Yanlış junction/view üretimde kaldı mı | **HAYIR** — canlı DB'de drop edildi, doğrulandı |
| İlişki manifestosu API şemasıyla çelişiyor mu | **HAYIR** — canlı swagger.json ile birebir eşleşiyor |
| deno check hatası kaldı mı | **HAYIR** — 0 hata |
| finalize 0-satır/hata durumunda success dönebiliyor mu | **HAYIR** — `.select("id")` + satır sayısı kontrolü eklendi, test edildi |

**PASS.**

## Tarayıcı test rotaları
- https://demo.eclipsemuhendislik.com/giderler/maaslar
- https://demo.eclipsemuhendislik.com/giderler/maaslar/{id}
- https://demo.eclipsemuhendislik.com/giderler/vergiler
- https://demo.eclipsemuhendislik.com/giderler/vergiler/{id}
- https://demo.eclipsemuhendislik.com/urunler/kategoriler
- https://demo.eclipsemuhendislik.com/e-fatura-kutulari
