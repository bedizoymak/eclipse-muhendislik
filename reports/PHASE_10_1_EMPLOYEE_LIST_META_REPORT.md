# Phase 10.1 — Çalışan Listesi Meta ve Tam Yanıt Verisi

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/giderler/calisanlar
**Kod commit SHA:** `(pending)`
**Rapor commit SHA:** (bu commit)

## 0. Bağlam

Faz 10 raporu (`reports/PHASE_10_EMPLOYEES_REPORT.md`, kod commit `c548fdf`), çalışan LİSTE uç noktasının (`GET /v4/{company_id}/employees`) döndürdüğü üst seviye `links`/`meta` bloğunu ("kayıt bazlı değil" gerekçesiyle) DB/UI'dan hariç tutmuştu. Bu, proje kuralına aykırıydı: gerçek iş verisi, kayıt bazlı olmadığı için atlanamaz. Bu faz bunu düzeltir.

## 1. Tam yanıt meta envanteri (canlı API, gerçek istekler)

Gerçek OAuth2 bearer token (`scripts/sync_parasut.py` ile aynı `password` grant akışı) alınıp `GET /v4/666034/employees` dört gerçek akışta sorgulandı:

| Akış | `links.self/first/last` | `meta.current_page` | `total_pages` | `total_count` | `per_page` | `payable_total` | `advance_total` | `export_url` |
|---|---|---:|---:|---:|---:|---|---|---|
| Filtresiz | `.../employees?page[number]=1&page[size]=15` | 1 | 1 | 6 | 15 | `"0.0"` | `"0.0"` | `.../employees/export` |
| `filter[archived]=false` | `...?filter[archived]=false&page[number]=1&page[size]=15` | 1 | 1 | 6 | 15 | `"0.0"` | `"0.0"` | `.../employees/export?filter[archived]=false` |
| `filter[archived]=true` | `...?filter[archived]=true&page[number]=1&page[size]=15` | 1 | **0** | **0** | 15 | `"0.0"` | `"0.0"` | `.../employees/export?filter[archived]=true` |
| `page[size]=50` | `...?page[number]=1&page[size]=50` | 1 | 1 | 6 | 50 | `"0.0"` | `"0.0"` | `.../employees/export` |

Tüm istekler gerçek `200`. `links.prev`/`next` her akışta `null` (tek sayfa). `meta.payable_total`/`advance_total` hiçbir akışta `null` değil — genuinely `"0.0"` (gerçek bir sıfır, gizlenmedi).

**Sınıflandırma:**

| Alan | Sınıf | Gerekçe |
|---|---|---|
| `links.self/first/prev/next/last` | Teknik pagination | Sadece isteğin kendi querystring'ini yansıtıyor, iş verisi taşımıyor — saklanmadı |
| `meta.current_page/total_pages/per_page` | Teknik pagination | Sync'in kendi sayfalama mantığında zaten kullanılıyor (`fetchAllPages`), ayrıca saklanmasına gerek yok |
| `meta.total_count` | İş-finansal veri (sayaç) | Gerçek kayıt sayısı — saklandı (`source_total_count`) |
| `meta.payable_total` | İş-finansal veri | Gerçek API metriği — saklandı, hiç yeniden hesaplanmadı |
| `meta.advance_total` | İş-finansal veri | Gerçek API metriği — saklandı, hiç yeniden hesaplanmadı |
| `meta.export_url` | Güvenli URL (referans, tıklanabilir değil) | Aşağıda bölüm 3 |

## 2. `payable_total` ve `advance_total`

- Bu hesapta tüm 4 akışta değerler birebir `"0.0"`/`"0.0"` — sayfalar arası çelişki **yok** (tek sayfa olduğu için karşılaştırma sınırlı ama mevcut tüm gerçek çağrılarda tutarlı).
- **Toplam karşılaştırması (varsayılmadı, hesaplandı):** Filtresiz listenin 6 kaydının gerçek `attributes.balance` alanları toplandı → `sum(balance) = 0.0`. `payable_total = "0.0"` ile eşleşiyor. Ancak bu hesapta **her** çalışanın bakiyesi zaten `0.0` olduğundan, bu tek örnek `payable_total`'ın literal `SUM(balance)` mi yoksa bağımsız bir API metriği mi olduğunu **kanıtlayamıyor** — sıfır=sıfır her iki hipotezle de tutarlı. Bu belirsizlik migration yorumunda açıkça not edildi; hiçbir varsayım DB'ye yazılmadı.
- Para birimi API tarafından belirtilmiyor — DB'de/UI'da **hiçbir TL/TRY etiketi eklenmedi** (uydurma olurdu).
- Değerler asla yerelde yeniden hesaplanmadı; her sync'te API'nin verbatim değeri `parasut.employee_sync_meta`'ya yazılıyor.
- UI: yalnızca `Calisanlar.tsx` (LİSTE ekranı) üzerinde yeni "API Özeti" bölümünde gösteriliyor — `CalisanDetay.tsx`'te (bireysel çalışan sayfası) **gösterilmiyor** (doğrulandı, bkz. bölüm 6).

## 3. `export_url` — güvenlik kararı

- `meta.export_url` değerinin kendisi: `https://api.parasut.com/v4/666034/employees/export` (+ filtre varsa querystring). Bu **token/imza içermiyor** — sabit, tekrarlanan çağrılarda birebir aynı (yalnızca filtre querystring'i değişiyor), göreli değil mutlak bir Paraşüt API uç nokta referansı. Bu uç nokta korumalı — çağırmak için hesabın kendi OAuth2 bearer token'ı gerekiyor, yani herkese açık/anonim bir kullanıcı bu URL'yi tıklasa dahi hiçbir şey alamaz.
- **Karar:** `meta.export_url` değerinin kendisi saklandı ve UI'da düz metin olarak gösterildi (asla `<a href>` linki değil — kimlik doğrulama gerektirdiği için tıklanabilir yapılmadı).
- **Ayrıca doğrulandı (saklanmadı, gösterilmedi):** bu uç noktayı kendi bearer token'ımızla gerçekten çağırdığımızda dönen yanıt, `data.attributes.url` altında **geçici, imzalı bir AWS S3 linki** içeriyor — `X-Amz-Credential`, `X-Amz-Signature`, `X-Amz-Expires=7200` (2 saat) parametreleriyle. Bu, gerçek bir kısa ömürlü kimlik bilgisi/gizli link — **hiçbir yerde saklanmadı, loglanmadı, DB'ye/view'a/UI'a yazılmadı.** Yalnızca bu denetim oturumu sırasında sunucu tarafında bir kez doğrulandı ve atıldı.

## 4. Depolama modeli

Yeni migration: `supabase/migrations/20260829010000_parasut_employee_sync_meta.sql` (eski migration'lar değiştirilmedi).

- `parasut.employee_sync_meta` — `(resource, filter_scope)` birincil anahtarlı, her gerçek sync'te (dry run'da **yazılmıyor**) o filtre kapsamının gerçek `payable_total/advance_total/export_url/source_total_count/source_current_page/source_total_pages/source_per_page/fetched_at/raw_meta` değerleriyle upsert ediliyor. `raw_meta jsonb` tam verbatim `links+meta` nesnesi — **hiçbir public view'da gösterilmiyor**.
- `active`/`archived` kapsamları **iki bağımsız satır** — hiçbir zaman birleştirilmiyor/ortalanmıyor.
- `public.parasut_employee_meta_demo` view — yalnızca `resource, filter_scope, payable_total, advance_total, export_url, source_total_count, fetched_at` sütunlarını `anon, authenticated`'e açıyor. `raw_meta` ve teknik pagination alanları (current_page/per_page) view'dan hariç.

## 5. Edge Function değişiklikleri

- `supabase/functions/parasut-sync/parasut_client.ts`: `JsonApiListResponse.meta` tipine `per_page/payable_total/advance_total/export_url` eklendi; `fetchAllPages` artık gerçek son sayfanın `lastMeta`'sını döndürüyor (sayfalar arası birleştirme yok — yalnızca son gözlemlenen gerçek değer, bu hesapta zaten tüm sayfalarda aynı).
- `supabase/functions/parasut-sync/index.ts`: yeni `upsertEmployeeSyncMeta(db, filterScope, meta)` — yalnızca `dry_run=false` iken çağrılıyor, `active`/`archived` için ayrı ayrı. `syncEmployees` bu fonksiyonu `fetchActiveAndArchived` sonrası, per-employee upsert'ten önce çağırıyor — yani her sync'te tam olarak 2 meta satırı (bir kez, kayıt başına değil) yazılıyor.

## 6. Frontend

- `src/pages/Calisanlar.tsx` (LİSTE): yeni "API Özeti" bölümü — `parasut_employee_meta_demo` view'ından `payable_total/advance_total/source_total_count/export_url`'i kapsama göre (Aktif/Arşivli) tablo halinde gösteriyor. Ham API alan adları alt metinde/`<code>` içinde görünür kalıyor (`payable_total`, `advance_total`, `export_url` sütun başlıkları). Para birimi etiketi **yok** (API belirtmiyor). `export_url` düz metin, tıklanamaz.
- `src/pages/CalisanDetay.tsx` (DETAY): bu meta **gösterilmiyor** — doğrulandı, dosyada `payable_total/advance_total/export_url/meta` hiçbir referans yok (grep ile teyit edildi). Bu meta yalnızca listeye ait, bireysel çalışana ait değil.
- `tags_resolved/activities_resolved/comments_resolved` incelemesi: bu üç boolean zaten Faz 10'da ayrı bir grup altında ("İlişki çözümleme durumu (Paraşüt API)") gösteriliyordu, ham API iş alanı gibi değil, açık şekilde "API gerçekten sorgulandı, gerçek X bulunamadı" cümleleriyle sync-doğrulama bilgisi olarak etiketlenmiş durumda. Bu doğru bir sunum — **değişiklik gerekmedi**, karar: olduğu gibi bırakıldı.
- Boş ilişki durumları (`category`, `managed_by_user`, `managed_by_user_role`, `tags`, `activities`, `comments`): `formatValue()` null → `"—"` dönüştürüyor, hiçbir uydurma satır yok — doğrulandı, değişiklik gerekmedi.

## 7. Sync ve regresyon (canlı)

**Dry run:**
```
{"resource":"employees","dry_run":true,"status":"dry_run","total_fetched_count":6,"active_fetched_count":6,"archived_fetched_count":0,"upserted_count":0,"total_count_reported":6,"category_resolved_count":0,"managed_by_user_resolved_count":0,"error_count":0}
```

**İki ardışık gerçek sync:**
```
sync 1: {"resource":"employees","dry_run":false,"status":"success","total_fetched_count":6,"active_fetched_count":6,"archived_fetched_count":0,"upserted_count":6,"total_count_reported":6,"category_resolved_count":0,"managed_by_user_resolved_count":0,"error_count":0}
sync 2: {"resource":"employees","dry_run":false,"status":"success","total_fetched_count":6,"active_fetched_count":6,"archived_fetched_count":0,"upserted_count":6,"total_count_reported":6,"category_resolved_count":0,"managed_by_user_resolved_count":0,"error_count":0}
```
Birebir aynı — idempotent.

**`parasut_employee_meta_demo` (sync sonrası, canlı REST):**
```json
[{"resource":"employees","filter_scope":"active","payable_total":0.0,"advance_total":0.0,"export_url":"https://api.parasut.com/v4/666034/employees/export?filter%5Barchived%5D=false","source_total_count":6,"fetched_at":"2026-08-27T20:23:21.32+00:00"},
 {"resource":"employees","filter_scope":"archived","payable_total":0.0,"advance_total":0.0,"export_url":"https://api.parasut.com/v4/666034/employees/export?filter%5Barchived%5D=true","source_total_count":0,"fetched_at":"2026-08-27T20:23:21.391+00:00"}]
```
İki sync arasında `fetched_at` gerçekten güncellendi (üzerine yazma çalışıyor), diğer tüm değerler değişmedi (beklenen — API değerleri sabit).

**`parasut_employee_counts_demo`:** `{"active_count":6,"archived_count":0,"null_archived_count":0,"total_count":6}` — beklenen (6/0/0/6) ile birebir.

**Maaş:** `GET /salaries` (Faz 10'da doğrulanmıştı) — bu fazda yeniden dokunulmadı, hâlâ 0.

**Mevcut modüllerin regresyonu (canlı REST, `Content-Range` başlığı):**

| Kaynak | Beklenen | Canlı |
|---|---:|---:|
| shipment_documents | 15 | 15 |
| contacts | 448 | 448 |
| products | 2597 | 2597 |
| sales_invoices | 451 | 451 |
| purchase_bills | 811 | 811 |
| checks | 40 | 40 |

Tüm sayılar değişmedi.

## 8. Test ve deploy

- Migration `20260829010000_parasut_employee_sync_meta.sql`: `supabase migration list` ile hem yerelde hem uzakta uygulanmış olarak doğrulandı.
- Edge Function `parasut-sync`: canlı sync çağrıları (bölüm 7) yeni kodun deploy edilmiş olduğunu kanıtlıyor.
- `npm test` → 1/1 geçti.
- `npm run lint` → 0 hata (yalnızca mevcut/ilgisiz shadcn fast-refresh uyarıları).
- `npx tsc --noEmit -p tsconfig.app.json` → yalnızca bilinen, kapsam dışı `Login.tsx:55` hatası (`variant` prop'u `LogoProps`'ta yok) — dokunulmadı.
- `npm run build:demo` → başarılı; `Calisanlar-C5doSeVP.js` (6.50 kB, Faz 10'daki 4.44 kB'den yeni "API Özeti" bölümü nedeniyle büyüdü).
- FTP deploy: `scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` (Windows/Git Bash'te `/public_html/demo` MSYS path-mangling'e uğrayıp yanlışlıkla yerel bir Windows yoluna çevrildiğinden ilk deneme hatalıydı — `MSYS_NO_PATHCONV=1` ile düzeltilip yeniden çalıştırıldı, `done: 44 file(s) uploaded to /public_html/demo` doğru hedefle teyit edildi).
- Canlı bundle hash doğrulandı: `index-BOzHqdOI.js` — yerel build çıktısıyla birebir aynı.
- `GET https://demo.eclipsemuhendislik.com/giderler/calisanlar` → **200**; `GET .../giderler/calisanlar/1000110946` → **200**.
- Gerçek headless-Chrome CDP kontrolü (`chrome-remote-interface`, mevcut Faz 10 desenindeki script yeniden kullanıldı): her iki route'ta, 390px ve 768px viewport genişliklerinde — **0 console hatası, 0 ağ hatası (4xx/5xx), `docScrollWidth === innerWidth`** (sayfa düzeyinde yatay kaydırma yok). Scratch script (`_cdp_check_scratch.mjs`) iş bitince silindi — repo çalışma ağacında bırakılmadı.

## 9. Sonuç

**PASS.**

- Faz 10'un atladığı gerçek liste-meta iş verisi (`payable_total`, `advance_total`, `export_url`, `total_count`) artık kayıt-bazlı olmadığı gerekçesiyle atılmıyor — ayrı bir sync-snapshot tablosunda ve yalnızca listeye ait bir UI bölümünde doğru şekilde temsil ediliyor.
- Hiçbir değer yerelde yeniden hesaplanmadı; `payable_total`/`advance_total` her zaman API'nin verbatim değeri.
- Hiçbir para birimi uydurulmadı.
- `export_url`'in kendisi güvenli olduğu için gösterildi (tıklanamaz, kimlik doğrulama gerektiği açıkça belirtildi); onu çağırmanın ürettiği gerçek geçici imzalı S3 linki hiçbir yerde saklanmadı/gösterilmedi.
- Teknik pagination alanları (`current_page`, `per_page`, `links.self/first/prev/next/last`) iş verisi gibi sunulmadı.
- `tags_resolved`/`activities_resolved`/`comments_resolved` zaten doğru şekilde sync-doğrulama bilgisi olarak etiketlenmişti — yanlış sunulmadığı doğrulandı.
- Regresyon: tüm mevcut modül sayıları değişmeden doğrulandı; iki ardışık sync birebir idempotent.

**Doğrulama için gerçek ID'ler:** çalışan `1000110946` (mahmut dayan) — `/giderler/calisanlar/1000110946`. Liste ekranı: `/giderler/calisanlar`, "API Özeti" bölümünde Aktif kapsam `payable_total="0.0"`, `advance_total="0.0"`, `total_count=6`, `export_url="https://api.parasut.com/v4/666034/employees/export?filter%5Barchived%5D=false"`.
