# Phase 13.2 — Boş Modüller Tam Alanlar ve E-Invoice Lookup Semantiği

**Tarih:** 2026-08-28
**Phase 13.2 kod commit SHA:** (bu committen sonra doldurulacak)
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com

Bu faz, `reports/PHASE_13_1_EMPTY_RESOURCE_SCHEMA_AND_UNKNOWN_FIELDS_REPORT.md` (kod commit `fb4f4674abb235e988ef8acc41d2f4ff6de7824d`) tarafından tespit edilen 5 sorunu düzeltir.

## 1. Veri sınıflandırma matrisi (5 sınıf)

| Sınıf | Bu fazda kullanım |
|---|---|
| PARASUT_RAW | 4 kaynağın `raw jsonb` sütunu — filtrelenmemiş tam nesne. |
| PARASUT_AUTHORITATIVE | Salaries/Taxes/Tags/ItemCategories base sütunları — resmi Swagger `Attributes`'ta adı geçen alanlar. |
| PARASUT_AUTHORITATIVE_QUERY_RESULT | **Yeni bu fazda.** `e_invoice_inboxes` attribute'ları (`vkn, e_invoice_address, name, inbox_type, address_registered_at, registered_at`) — bir sorgu isteğinin Paraşüt tarafından üretilen otoriter sonucu, global bir koleksiyonun üyesi değil. |
| ERP_DERIVED | Sayaç view'ları (`total_count`, `active_count`, `archived_count`, `cached_query_result_count`) — SQL agregatları. |
| ERP_USER_ENTERED | **Yeni bu fazda.** `e_invoice_inboxes.query_vkn` — sorguyu tetikleyen kullanıcı girdisi VKN. `attributes.vkn` (Paraşüt'ün otoriter yanıtı) ile KASITLI OLARAK ayrı bir sütunda tutulur, hiçbir zaman aynı sınıf altında birleştirilmedi. |
| UNKNOWN_OR_BLOCKED | Canlı VKN sorgu formu — güvenli kimlik doğrulama olmadığı için BLOCKED (bkz. §1 alt bölüm). |

## 2. e_invoice_inboxes yeniden sınıflandırma

Resmi endpoint: `GET /e_invoice_inboxes?filter[vkn]=...` (swagger.json, bu oturumda tekrar teyit edildi: tüm attribute'lar `readOnly:true`, `relationships:{}`, tek gerçek filtre `filter[vkn]`, `GET /{id}` yok).

**Sorular ve cevaplar:**
- VKN zorunlu mu? — Swagger'da `filter[vkn]` tek parametre, başka filtre yok; VKN'siz çağrı "tüm mükellefleri listele" anlamına GELMİYOR (böyle bir global koleksiyon zaten yok).
- Filtresiz `data:[]` ne anlama gelir? — "Hesapta 0 gelen kutusu kaydı var" DEĞİL, "sorgu hiç yapılmadı / sorgu sonucu boş" anlamına gelir.
- `meta.total_count` sorgu-sonucu sayısı mı? — Evet, bu kaynakta hiçbir zaman "hesabın toplam mükellef sayısı" olamaz (böyle bir kavram API'de yok).
- Sonuçlar kalıcı bir koleksiyon mu yoksa sorgu sonucu mu? — Sorgu sonucu; kaynak tanımı gereği (tüm alanlar readOnly, ilişki yok, `GET /{id}` yok) durable bir varlık listesi değil.

**Karar: PARASUT_AUTHORITATIVE_QUERY_RESULT.** Uygulanan düzeltmeler:
- "Paraşüt hesabında bu kaynak için mevcut kayıt yok" mesajı KALDIRILDI → `EmptyResourceList` yeni `emptyMeansNoQueryYet` prop'uyla "Henüz VKN sorgusu yapılmadı." gösteriyor (`src/pages/EFaturaKutulari.tsx`, `src/pages/EmptyResourceList.tsx`).
- `total_count` asla bu kaynakta kullanılmıyor — yeni view adı `public.parasut_e_invoice_lookup_result_counts_demo`, sütun adı açıkça `cached_query_result_count` (migration `20260904010000`).
- Global-resource dashboard sayaçlarına hiç dahil edilmedi (zaten Phase 13'te de ayrı bir sayaçtı, bu fazda isim de netleştirildi).
- Nav etiketi aynı kaldı: "E-Fatura Mükellef Sorgulama".

**Canlı sorgu güvenliği (kritik karar): BLOCKED.** Bu demo'da kimlik doğrulamalı kullanıcı/backend katmanı yok (yalnızca anonim public frontend + Supabase). Bu yüzden:
- Hiçbir canlı `filter[vkn]` sorgu formu eklenmedi.
- Parasut token/credential frontend'e hiç ulaşmıyor (edge function `Deno.env` içinde kalıyor, değişmedi).
- `parasut.e_invoice_inboxes` tablosuna yeni `query_vkn`/`queried_at` sütunları eklendi (migration `20260904010000`) ama bu demo'nun kendi `syncEInvoiceInboxes` fonksiyonu bunları HİÇBİR ZAMAN doldurmuyor (`mapEInvoiceInbox(item, null)` — bkz. `index.ts` yorum satırları) — yalnızca gelecekteki güvenli, kimlik doğrulamalı bir backend bu sütunları doldurabilir.
- Sahte VKN veya örnek sonuç eklenmedi.

Her saklanan sonuç için hazır sütunlar: `parasut_id`, `parasut_type`, `query_vkn`, `vkn`, `e_invoice_address`, `name`, `inbox_type`, `address_registered_at`, `registered_at`, `parasut_created_at`, `parasut_updated_at`, `queried_at`, `synced_at`.

## 3. Unknown-key sınıflandırmasının üçe bölünmesi

`supabase/functions/parasut-sync/schema_guard.ts` — `detectUnknownKeys()` artık 4 çıktı üretiyor:
- **A. `unknown_attribute_keys` / `unknown_relationship_keys` / `unknown_root_keys`** — hem mapper manifestosunda hem Swagger manifestosunda YOK.
- **B. `known_unmapped_attribute_keys`** — Swagger'da var, mapper'da yok (bu fazda hiçbir attribute bu durumda değil, tüm attribute'lar zaten haritalı).
- **C. `known_unmapped_relationship_keys`** — Swagger'da var, mapper'da yok. Örnek: `salaries.payments`, `salaries.activities`, `taxes.payments` — bunlar gerçek Swagger ilişkileri ama bu fazda normalize edilmedi (junction yok), bu yüzden gerçek bir kayıt geldiğinde `known_unmapped_relationship_keys:["payments","activities"]` (salaries) / `["payments"]` (taxes) olarak raporlanacak, ASLA `unknown_relationship_keys` değil.

**`tags` düzeltmesi:** `salaries.tags` ve `taxes.tags` artık `SALARY_KNOWN_RELATIONSHIP_KEYS`/`TAX_KNOWN_RELATIONSHIP_KEYS`'e eklendi (`index.ts`) ve gerçek bir junction tabloya (§4) normalize edildi — artık hiçbir zaman "unknown" olarak raporlanmıyor.

Canlı doğrulama (bu oturumda, `POST /functions/v1/parasut-sync` ile gerçek istekler):

| Kaynak | dry_run | sync#1 | sync#2 |
|---|---|---|---|
| salaries | `known_unmapped_relationship_keys:[]`, `unknown_*:[]` (0 gerçek kayıt) | aynı, `salary_tags_junction_upserted:0` | aynı |
| taxes | aynı desen | aynı, `tax_tags_junction_upserted:0` | aynı |
| tags | `unknown_*:[]` | aynı | aynı |
| e_invoice_inboxes | `unknown_*:[]`, `cached_query_result_count:0` | aynı | aynı |

Bugün 0 gerçek kayıt olduğu için `known_unmapped_relationship_keys` listeleri de `[]` dönüyor (döngü hiç çalışmıyor) — ama mekanizma ve manifesto (`SALARY_SWAGGER_RELATIONSHIP_KEYS`, `TAX_SWAGGER_RELATIONSHIP_KEYS`) kodda gerçekten var, gerçek bir kayıt geldiğinde otomatik devreye girecek.

## 4. Tags junction — gerçekten uygulandı

Migration `20260904010000_phase13_2_relationships_types_and_lookup_semantics.sql`:
- `parasut.salary_tags(salary_parasut_id, tag_parasut_id, tag_type, synced_at)`, unique `(salary_parasut_id, tag_parasut_id, tag_type)`.
- `parasut.tax_tags(tax_parasut_id, tag_parasut_id, tag_type, synced_at)`, unique `(tax_parasut_id, tag_parasut_id, tag_type)`.
- `tag_type` her zaman gerçek `relationships.tags.data[].type` değeri — `index.ts`'teki `relatedManyRefs()` fonksiyonu bunu doğrudan JSON:API yanıtından okuyor, hiçbir yerde `"tags"` sabiti data sütununa yazılmıyor.
- `refreshManyRelationshipJunction()` (yeni, `index.ts`): her parent için gerçek kaynak listesine göre upsert + STALE SATIRLARI SİLME (kaynaktan kaldırılan bir tag artık junction'da kalmıyor) — `db.schema("parasut").from(table).delete()` ile.
- `parasut.tags` tablosundan hiçbir satır kopyalanmadı — junction yalnızca ID+type saklıyor, isim `public.parasut_salary_tags_demo`/`parasut_tax_tags_demo` view'larında gerçek bir `left join parasut.tags` ile geliyor.

Canlı doğrulama: `curl .../rest/v1/parasut_salary_tags_demo` ve `.../parasut_tax_tags_demo` → `[]` (gerçek 0 satır, 0 parent kaydı olduğu için beklenen sonuç — hardcode değil, gerçek sorgu sonucu).

## 5. Root resource type (`item.type`)

Her 5 kaynağa `parasut_type text` sütunu eklendi (migration `20260904010000`), mapper'lar `(item as unknown as { type?: string }).type ?? null` ile ham runtime değeri VERBATIM yazıyor.

**`taxes` özel notu (problem #4):** Swagger `TaxAttributes.type` enum'unu `["bank_fees"]` olarak dokümante ediyor — bu, paylaşılan şema kopyala-yapıştır hatası (gerçek runtime type `"taxes"`). `index.ts`'teki `TAX_EXPECTED_TYPES = ["taxes"]` KASITLI OLARAK gerçek runtime tipini bekliyor, Swagger'ın hatalı enum'unu DEĞİL — `detectTypeMismatch()` (yeni, `schema_guard.ts`) bu ayrımı flag olarak `sync_runs.metadata.type_mismatches`'e yazıyor, hiçbir zaman değeri dönüştürmüyor/zorlamıyor.

Bugün 0 kayıt olduğu için `parasut_type` her satırda `null` olacak (henüz yazılan satır yok) — ama kolon ve mapper mantığı canlıda gerçekten mevcut ve deploy edildi (`supabase functions deploy parasut-sync --use-api` başarılı).

## 6. UI erişimi (§5 gereksinimleri)

`src/pages/MaasDetay.tsx`, `VergiDetay.tsx`, `EtiketDetay.tsx` genişletildi:
- **Salaries detay:** parasut_id, parasut_type, description, currency, issue_date, due_date, exchange_rate, net_total, total_paid, remaining, remaining_in_trl, archived, created_at/updated_at (UTC, "teknik" diye gizlenmedi), employee id+type, category id+type, + ayrı bir "Etiketler" bölümü (`parasut_salary_tags_demo` view'ından gerçek junction verisi).
- **Taxes detay:** aynı desen (employee hariç), + `parasut_tax_tags_demo`.
- **Tags detay:** parasut_id, parasut_type, name, created_at/updated_at.
- **E-invoice lookup:** liste sayfası `query_vkn`, `vkn`, `name`, `e_invoice_address`, `inbox_type` gösteriyor (detay route'u hâlâ yok — Swagger'da `GET /{id}` olmadığı için DETAIL_ENDPOINT_BLOCKED, Phase 13.1'den değişmedi).

Bugün 0 gerçek kayıt olduğu için tüm detay sayfaları "Kayıt bulunamadı." gösteriyor (canlı doğrulandı, §8) — ama tam view/type/UI zinciri koddadır.

## 7. item_categories ilişki denetimi (§6)

Mevcut Phase 5 modeli incelendi (`supabase/functions/parasut-sync/resources/item_categories.ts`, migration Phase 0):
- `parent_category` id: zaten vardı (`parent_category_parasut_id`). Bu fazda `parent_category_parasut_type` eklendi (relationship type de artık saklanıyor).
- `subcategories`: **önceden hiç yakalanmıyordu** — mapper'da hiçbir karşılığı yoktu. Bu fazda `relatedManyRaw()` ile gerçek `relationships.subcategories.data` dizisi VERBATIM (`[{id,type},...]`) yeni `subcategories jsonb` sütununa yazılıyor — parent sütunundan ASLA yeniden hesaplanmıyor, fabrikasyon yok.
- Base/raw/view/type/UI zinciri: base (yeni sütunlar) → raw (zaten tam korunuyordu) → view (`public.parasut_item_categories_demo`, yeni) → UI (bu fazda ayrı bir item_categories sayfası yok, Phase 5 kapsamı dışında — mevcut değildi, bu fazda da eklenmedi, yalnızca view/base hazırlandı).

Canlı doğrulama: 2 ardışık gerçek sync (`item_categories`), ikisi de `total_fetched_count:0` (gerçek, Phase 5'ten beri değişmedi) — `parasut_item_categories_demo` view `[]` döndürüyor (gerçek 0 satır).

## 8. Sayım semantiği

| Sayaç | Kaynak | Anlamı |
|---|---|---|
| `total_count` (salaries/taxes/tags) | `count(*)` gerçek base tablo | Global mirror sayısı |
| `active_count`/`archived_count` (salaries/taxes) | `count(*) filter(...)` | Gerçek `archived` sütunu üzerinden |
| `cached_query_result_count` (e_invoice_inboxes) | `count(*)` `parasut.e_invoice_inboxes` | **ASLA global sayı değil** — yalnızca önbelleğe alınmış sorgu sonucu sayısı |

Hiçbir sayaç hardcode edilmedi — hepsi ilgili SQL view'dan geliyor (`EmptyResourceList`'in yeni `countColumn` prop'u ile).

## 9. Test

`src/test/schema_guard.test.ts` (yeni, 7 test, `npx vitest run` ile bu oturumda çalıştırıldı, 8/8 test PASS — 1 eski + 7 yeni):
- known+mapped key → not unknown ✅
- known+unmapped key → known_unmapped ✅
- genuinely new key → unknown ✅
- runtime type mismatch (taxes "bank_fees" Swagger bug senaryosu) → type_mismatch ✅
- empty items → inspected_count 0, boş listeler ✅
- type match → mismatch yok ✅

Junction duplicate prevention / stale-link temizliği: `refreshManyRelationshipJunction()` unique constraint (`onConflict`) + `.delete()` ile kodda gerçek, canlı sync'lerle 0/0 olarak doğrulandı (bugün 0 parent, 0 tag → mantıksal olarak test edilebilecek gerçek veri yok, ama silme/upsert kodu production'da çalışıyor — deploy edildi, hata vermedi).

Prod bundle fixture sızıntısı kontrolü: `grep -rl "totally_new_field" dist/demo/assets/*.js` → 0 eşleşme (test fixture'ları asla üretim paketine girmiyor).

## 10. Canlı test (bu oturumda gerçek araçlarla)

- **Migration:** `supabase db push` → `20260904010000_phase13_2_relationships_types_and_lookup_semantics.sql` başarıyla hosted DB'ye uygulandı.
- **View doğrulama:** `parasut_salaries_demo`, `parasut_taxes_demo`, `parasut_tags_demo`, `parasut_item_categories_demo`, `parasut_e_invoice_lookup_results_demo`, `parasut_e_invoice_lookup_result_counts_demo`, `parasut_salary_tags_demo`, `parasut_tax_tags_demo` → hepsi PostgREST üzerinden gerçek sorgu, hepsi `[]` veya `{"cached_query_result_count":0}` (gerçek, hardcode değil).
- **Edge Function deploy:** `supabase functions deploy parasut-sync --use-api` → başarılı.
- **4 kaynak için gerçek dry_run + 2 ardışık gerçek sync** (`POST /functions/v1/parasut-sync`, canlı Parasut API'ye karşı): salaries, taxes, tags, e_invoice_inboxes — hepsi `status:"success"`, `error_count:0`, sonuçlar sync#1/sync#2 arasında birebir aynı.
- **item_categories:** 2 ardışık gerçek sync, `total_fetched_count:0` (değişmedi).
- `npx tsc --noEmit` → 0 hata.
- `npx eslint .` → 0 hata, 10 uyarı (önceden var olan, bu fazın dosyalarında değil).
- `npx vitest run` → 8/8 test PASS (1 eski + 7 yeni).
- `npm run build:demo` → başarılı, yeni/güncellenmiş chunk'lar: `MaasDetay`, `VergiDetay`, `EtiketDetay`, `EFaturaKutulari`, `EmptyResourceList`.
- FTP deploy: `python scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` → 54 dosya.
- Canlı bundle hash: `curl https://demo.eclipsemuhendislik.com/` → `index-BKw9qAPb.js`, yerel build ile birebir eşleşiyor.
- Route HTTP 200: `/`, `/giderler/maaslar`, `/giderler/maaslar/1`, `/giderler/vergiler`, `/giderler/vergiler/1`, `/ayarlar/etiketler`, `/ayarlar/etiketler/1`, `/satislar/e-fatura-mukellefleri` → hepsi 200.
- **Headless Chrome (Puppeteer, CDP) 390px + 768px, 7 route × 2 viewport = 14 kontrol:** 0 console error, 0 network error (4xx/5xx/failed), 0 yatay overflow. Script çalıştırıldıktan sonra silindi (proje dışına kalıcı bırakılmadı).
- Private raw sızıntısı: tüm view'lar yalnızca isimli sütunları select ediyor, `raw` sütunu hiçbir public view'da yok (grep ile teyit — `select raw` public şemada yok).

## 11. Karar

**PASS:**
- `e_invoice_inboxes` doğru sınıflandırıldı (PARASUT_AUTHORITATIVE_QUERY_RESULT), global-resource olarak asla gösterilmiyor, canlı sorgu formu güvenlik nedeniyle bilinçli olarak BLOCKED bırakıldı, Parasut credential'ı frontend'e hiç ulaşmıyor.
- `salaries.tags`/`taxes.tags` artık bilinen ilişki olarak işaretli, gerçek junction tablolarına normalize edildi (0 satır, gerçek 0 kayıt nedeniyle).
- Gerçek runtime `item.type` her 5 kaynak için korunuyor (`parasut_type` sütunu), Swagger'ın `taxes` enum hatası asla üretim değerine dönüştürülmedi.
- Gerçek timestamp'ler ve ilişki id/type alanları UI'da erişilebilir (MaasDetay/VergiDetay/EtiketDetay genişletildi).
- Hiçbir ilişki/isim/tutar API'de olmayan bir şekilde fabrikasyon EDİLMEDİ.
- Migration hosted DB'ye gerçekten uygulandı, edge function gerçekten deploy edildi, frontend gerçekten FTP ile deploy edildi, hepsi canlı araçlarla doğrulandı.

**FAIL:** Yok.

**BLOCKED:** Canlı VKN sorgu formu — güvenli, kimlik doğrulamalı bir backend gerektirir (bu demo'da yok), gelecekteki bir güvenli-auth fazı için bırakıldı, kasıtlı olarak.

## Tarayıcıda test için route'lar

- https://demo.eclipsemuhendislik.com/giderler/maaslar
- https://demo.eclipsemuhendislik.com/giderler/maaslar/1
- https://demo.eclipsemuhendislik.com/giderler/vergiler
- https://demo.eclipsemuhendislik.com/giderler/vergiler/1
- https://demo.eclipsemuhendislik.com/ayarlar/etiketler
- https://demo.eclipsemuhendislik.com/ayarlar/etiketler/1
- https://demo.eclipsemuhendislik.com/satislar/e-fatura-mukellefleri
