# Phase 13 — Boş Kaynaklar İçin Geleceğe Hazır Modül Altyapısı

**Tarih:** 2026-08-28
**Kod commit SHA:** 1d53962c5bdf46d4ed09c4cf4645e2c7239ea1e4
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com

## 1. Canlı endpoint sınıflandırması (bu oturumda yeniden doğrulandı)

Gerçek OAuth token ile, gerçek hesaba karşı, `GET .../v4/666034/{resource}?page[size]=3` (URL-encoded) istekleri bu oturumda çalıştırıldı — Phase 8 sonuçları kopyalanmadı.

| Kaynak | HTTP | Gövde şekli | Sınıf |
|---|---:|---|---|
| `item_categories` | 200 | `data:[]`, `meta.total_count:0` | **A. EMPTY_IMPLEMENTABLE** (zaten Phase 5'ten tam kurulu — bu fazda dokunulmadı, yalnızca yeniden doğrulandı) |
| `salaries` | 200 | `data:[]` (meta yok) | **A. EMPTY_IMPLEMENTABLE** |
| `taxes` | 200 | `data:[]` (meta yok) | **A. EMPTY_IMPLEMENTABLE** |
| `tags` | 200 | `data:[]`, `meta.total_count:0` | **A. EMPTY_IMPLEMENTABLE** |
| `e_invoice_inboxes` | 200 | `data:[]`, `meta.total_count:0` | **A. EMPTY_IMPLEMENTABLE** |
| `trackable_jobs` | 404 | `{"errors":[{"title":"Not Found","detail":"No route matches."}]}` | **B. BLOCKED** |
| `bank_fees` | 404 | aynı | **B. BLOCKED** |
| `stock_updates` | 404 | aynı | **B. BLOCKED** |
| `e_smms` | 404 | aynı | **B. BLOCKED** |

Yeni gerçek kayıtlı (**C. NONEMPTY**) hiçbir kaynak bulunmadı — hepsi Phase 8'deki gibi gerçekten boş veya erişilemez durumda.

`filter[archived]` gerçek davranışı (bu oturumda test edildi):
- `salaries`/`taxes`: gerçek 400, `"Acceptable: due_date, issue_date, currency, remaining"` — filtre reddediliyor, ama `archived` sütunu tablo şemasında (Phase 0'dan) zaten var; sync tek, filtresiz tam listeleme yapıyor.
- `tags`: gerçek 400, `"Acceptable: "` (boş liste) — hiç archived kavramı yok.
- `e_invoice_inboxes`: `filter[archived]=true` sessizce 200 `data:[]` döndürdü ama tablo şemasında `archived` sütunu hiç yok — fabrikasyon split yapılmadı, yalnızca `total_count`.

## 2. Bu fazda uygulanan modüller

`item_categories` zaten tam kuruluydu (base/view/sync/UI — Phase 5/8). Bu fazda **salaries, taxes, tags, e_invoice_inboxes** uçtan uca kuruldu:

| Kaynak | Base tablo | Raw | Public view | Count view | Sync fn | Route | Nav |
|---|---|---|---|---|---|---|---|
| `salaries` | `parasut.salaries` (Phase 0'dan mevcut, değişmedi) | ✅ | `public.parasut_salaries_demo` | `public.parasut_salary_counts_demo` (active/archived/total) | `syncSalaries` | `/giderler/maaslar` | DemoHome → Giderler bölümü |
| `taxes` | `parasut.taxes` (mevcut) | ✅ | `public.parasut_taxes_demo` | `public.parasut_tax_counts_demo` (active/archived/total) | `syncTaxes` | `/giderler/vergiler` | DemoHome |
| `tags` | `parasut.tags` (mevcut) | ✅ | `public.parasut_tags_demo` | `public.parasut_tag_counts_demo` (total only — archived yok) | `syncTags` | `/ayarlar/etiketler` | DemoHome |
| `e_invoice_inboxes` | `parasut.e_invoice_inboxes` (mevcut) | ✅ | `public.parasut_e_invoice_inboxes_demo` | `public.parasut_e_invoice_inbox_counts_demo` (total only — archived yok) | `syncEInvoiceInboxes` | `/satislar/e-fatura-kutulari` | DemoHome |

Hiçbir yeni `CREATE TABLE` gerekmedi — 4 tablo da Phase 0'ın toplu şema migration'ında zaten doğru kolonlarla mevcuttu, hiç kullanılmamıştı. Bu fazda yalnızca migration `supabase/migrations/20260902010000_phase13_empty_resources_views.sql` (view'lar), Edge Function mapper'ları (`supabase/functions/parasut-sync/resources/{salaries,taxes,tags,e_invoice_inboxes}.ts`) ve `index.ts`'e 4 yeni sync fonksiyonu + dispatch kaydı eklendi.

## 3. BLOCKED kaynaklar

| Kaynak | Endpoint | HTTP | Neden | Tablo mevcut mi | Satır | UI kararı |
|---|---|---:|---|---|---:|---|
| `trackable_jobs` | `GET /trackable_jobs` | 404 | "No route matches." — bağımsız liste endpoint'i yok | ✅ (`parasut.trackable_jobs`, Phase 0'dan) | 0 | UI/sync yok — endpoint çalışmıyor |
| `bank_fees` | `GET /bank_fees` | 404 | aynı | ✅ (`parasut.bank_fees`) | 0 | UI/sync yok |
| `stock_updates` | `GET /stock_updates` | 404 | aynı | ✅ (`parasut.stock_updates`, `stock_update_details`) | 0 | UI/sync yok |
| `e_smms` | `GET /e_smms` | 404 | aynı (yalnızca `active_e_document` nested include ile erişilebilir olabilir — bu faz kapsamı dışı) | ✅ (`parasut.e_smms`) | 0 | UI/sync yok |

Bu 4 kaynak için hiçbir view/sync/route/nav girişi oluşturulmadı — çalışmayan bir endpoint'e bağlı modül üretilmedi.

## 4. Edge Function sync — gerçek sonuçlar

Deploy: `supabase functions deploy parasut-sync --use-api` (Docker inspect hatası nedeniyle `--use-api` kullanıldı, gerçek deploy başarılı, `yzuxdrknidveptvnwthf` projesine).

Her kaynak için: dry run → gerçek sync #1 → gerçek sync #2 (tümü canlı `POST /functions/v1/parasut-sync`):

| Kaynak | dry_run | sync #1 | sync #2 |
|---|---|---|---|
| `salaries` | `fetched:0, upserted:0, error:0` | `fetched:0, upserted:0, error:0, status:success` | aynı |
| `taxes` | `fetched:0, upserted:0, error:0` | `fetched:0, upserted:0, error:0, status:success` | aynı |
| `tags` | `fetched:0, upserted:0, error:0` | `fetched:0, upserted:0, error:0, status:success` | aynı |
| `e_invoice_inboxes` | `fetched:0, upserted:0, error:0` | `fetched:0, upserted:0, error:0, status:success` | aynı |

Tüm sayılar gerçek API yanıtından geliyor, hiçbiri koda hardcode edilmedi (kod, boş bir `data:[]` dizisini `.length` ile sayıyor, `0` literaltal yazılmadı).

## 5. Gerçek DB agregasyonu (view sorgusu ile doğrulandı)

```
parasut_salary_counts_demo            -> {"active_count":0,"archived_count":0,"total_count":0}
parasut_tax_counts_demo               -> {"active_count":0,"archived_count":0,"total_count":0}
parasut_tag_counts_demo               -> {"total_count":0}
parasut_e_invoice_inbox_counts_demo   -> {"total_count":0}
```

Sayılar durable count view'lardan (`count(*) filter (...)`) geliyor, `.length`/1000-satır cap'e bağlı değil, hardcode edilmiş `0` literal değil.

## 6. Bilinmeyen alan koruması

Mapper'lar yalnızca resmi/doğrulanmış attribute anahtarlarını okuyor (`attr()` helper `undefined` → `null`, mevcut olmayan gerçek `null`'u asla eski değerle değiştirmiyor). Tam kaynak nesnesi her satırda `raw jsonb` içinde saklanıyor. Bu fazda gözlemlenebilir gerçek kayıt olmadığından (`data:[]`), `unknown_attribute_keys` tespiti bu oturumda **çalıştırılamadı** (gözlemlenecek gerçek bir satır yok) — ileride gerçek bir kayıt geldiğinde raw'daki tam nesne ile mapper'ın çıkardığı anahtar seti karşılaştırılarak yapılabilir; bu, gelecekteki bir faz için not edildi, bu fazda uydurulmadı.

## 7. Sabit/mock/fallback taraması

- 4 yeni mapper dosyası: hiçbir sabit değer, hiçbir varsayılan örnek satır yok — yalnızca `attr()`/`relatedId()` gerçek JSON:API okuma.
- 4 yeni sync fonksiyonu: `fetched_count`/`upserted_count`/`error_count` tümü gerçek `result.items.length`/`upsertResult` değerlerinden.
- Frontend `EmptyResourceList.tsx`: `totalCount` yalnızca `count view`'dan okunuyor, `.length` kullanılmıyor; boş durum metni "Henüz kayıt bulunmuyor" + "Paraşüt hesabında bu kaynak için mevcut kayıt yok" — hiçbir yerde "API desteklemiyor" yazmıyor (çünkü endpoint gerçekten çalışıyor).
- Hiçbir sahte satır/örnek kart/uydurma ID yok.

## 8. Test / build / deploy

- `npx tsc --noEmit` → 0 hata (Login.tsx:55 bilinen, kapsam dışı sorun bu çalıştırmada hata vermedi — TS sürüm/konfigürasyon farkı, dokunulmadı).
- `npx eslint .` → 0 hata, 10 uyarı (tümü önceden var olan `react-refresh/only-export-components` uyarıları, bu fazın dosyalarında değil).
- `npx vitest run` → 1/1 test geçti.
- `npm run build:demo` → başarılı, yeni chunk'lar: `Maaslar`, `Vergiler`, `Etiketler`, `EFaturaKutulari`, `EmptyResourceList`.
- FTP deploy: `python scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` (doğru hedef dizin `full_deploy.py`'den teyit edildi — ilk denemede git-bash'in `/demo` argümanını Windows yoluna çevirmesi nedeniyle yanlış dizine gitmişti, `MSYS_NO_PATHCONV=1` ile düzeltildi ve doğru `/public_html/demo`'ya yeniden yüklendi).
- Canlı doğrulama: `index.html` üzerindeki script hash'i FTP'deki gerçek dosyayla eşleşti, `assets/Maaslar-*.js` gerçek 200.

## 9. Headless Chrome (Puppeteer) canlı kontrol

4 route × 3 genişlik (390/768/1280px), gerçek `https://demo.eclipsemuhendislik.com` üzerinde:

| Route | Sonuç |
|---|---|
| `/giderler/maaslar` | 0 console hatası, 0 network hatası, yatay taşma yok, "Henüz kayıt bulunmuyor" gösteriliyor |
| `/giderler/vergiler` | aynı |
| `/ayarlar/etiketler` | aynı |
| `/satislar/e-fatura-kutulari` | aynı |

İlk turda `/giderler/maaslar` ve `/giderler/vergiler` route'ları `App.tsx`'te `/giderler/:parasutId` (GiderDetay) route'undan **sonra** tanımlandığı için o dinamik route tarafından yakalanıyordu (React Router ilk eşleşeni kullanır) — bu **gerçek bir bulgu ve düzeltme**: iki yeni route, `/giderler/:parasutId`'den **önce** taşındı. Düzeltme sonrası tüm route'lar doğru bileşeni render ediyor (yukarıdaki tablo düzeltme sonrası sonuçlar).

## 10. Regresyon

Gerçek REST `Content-Range` sorgularıyla doğrulandı (bu fazda okuma-yalnızca):

| Modül | Beklenen (önceki fazlar) | Gerçek (bu faz) |
|---|---:|---:|
| Contacts | 448 | **448** ✅ |
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| Products | 2597 | **2597** ✅ |
| Employees | 6 | **6** ✅ |

Hiçbir sapma yok.

## 11. Kalan modül sayısı

- Bu faz sonunda **EMPTY_IMPLEMENTABLE ve tam kurulu**: `item_categories` (Phase 5), `salaries`, `taxes`, `tags`, `e_invoice_inboxes` (bu faz) — toplam 5.
- **BLOCKED, dokunulmadı**: `trackable_jobs`, `bank_fees`, `stock_updates`, `e_smms` — toplam 4. Bu kaynaklardan biri gelecekte gerçek bir liste endpoint'i açarsa, yeni bir fazda sıfırdan yeniden keşfedilmesi gerekir (bu fazın BLOCKED kararı kalıcı varsayılmadı).

## PASS / FAIL / BLOCKED

**PASS:**
- 4 kaynak (`salaries`, `taxes`, `tags`, `e_invoice_inboxes`) için tam, gerçek API tabanlı altyapı kuruldu: private raw + named columns → public view → durable count view → Edge Function sync (dry run + 2 ardışık gerçek sync) → frontend route + boş durum UI → nav bağlantısı.
- Gerçek toplamlar 0 ve hiçbiri hardcode edilmedi — tümü canlı API yanıtından veya DB agregat view'dan.
- Tam kaynak nesnesi her satırda private `raw jsonb`'de saklanıyor; UI hiçbir yerde raw JSON'u doğrudan okumuyor.
- Sahte satır/örnek kart/uydurma alan yok.
- BLOCKED kaynaklar (`trackable_jobs`/`bank_fees`/`stock_updates`/`e_smms`) çalışıyormuş gibi hiçbir yere (nav, route, sync) eklenmedi.
- Route sıralama hatası (dinamik `:parasutId` route'un yeni statik route'ları gölgelemesi) canlı headless Chrome testiyle tespit edildi ve düzeltildi.
- FTP deploy hedef dizin hatası (git-bash path mangling) tespit edildi ve düzeltildi; canlı site gerçek yeni build'i sunuyor.

**FAIL:** Yok.

**BLOCKED (API'nin kendisinden):** `trackable_jobs`, `bank_fees`, `stock_updates`, `e_smms` — hepsi gerçek 404 "No route matches."

## Genel Karar

**PASS.** Beş kaynağın (`item_categories` + bu fazda eklenen `salaries`/`taxes`/`tags`/`e_invoice_inboxes`) tam, uçtan uca, gerçek-API-tabanlı geleceğe hazır altyapısı kuruldu ve canlıda doğrulandı; dört kaynak (`trackable_jobs`/`bank_fees`/`stock_updates`/`e_smms`) gerçek 404 nedeniyle bilinçli olarak BLOCKED bırakıldı ve hiçbir sahte modül üretilmedi.
