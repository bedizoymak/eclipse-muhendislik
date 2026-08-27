# Phase 10 — Çalışanlar (Employees)

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/giderler/calisanlar
**Kod commit SHA:** `c548fdfe262718bd1741d1064911179000c183a8`
**Rapor commit SHA:** (bu commit)

## 1. Resmi dokümantasyon ve gerçek API doğrulaması

- **Liste:** `GET /v4/{company_id}/employees` → **200**. `meta`: `current_page:1, total_pages:1, total_count:6, per_page:15`. `page[size]=50` → yine 6 kayıt (per_page:50 dönüyor, gerçek üst sınır bu hesapta test edilemedi çünkü kayıt sayısı zaten az; sayfalama mekanizması `fetchActiveAndArchived`/`fetchAllPages` ile mevcut ortak istemci koduyla aynı desende uygulandı).
- **Tekil:** `GET /employees/{id}` → **200** (örnek: `1000110946`, "mahmut dayan").
- **filter[archived] gerçek ve destekleniyor:** `=false` → 6 kayıt, `=true` → 0 kayıt (toplamla tutarlı, hiçbir arşivli çalışan yok).
- **Geçersiz filtre (gerçek 400 gövdesi):** `filter[nonexistent_field]=x` → `"'nonexistent_field' is not a valid filter. Acceptable: name, email, iban, tckn, employment_start_date, employment_end_date"`.
- **Liste include'ları (gerçek 400 gövdesiyle kanıtlı):** Kabul edilenler: `category, managed_by_user, managed_by_user_role, tags`. **Reddedilenler:** `activities`, `comments` → `"activities is not a valid relation. Acceptable: category, managed_by_user, managed_by_user_role, tags"`.
- **Liste↔tekil fark (kritik bulgu, Faz 9'daki `shipment_documents.activities` ile aynı örüntü):** Tekil endpoint `include=activities,comments` kabul ediyor ve **200** dönüyor; ikisi de gerçek, genuinely boş `data:[]`. Liste endpoint'i bu iki ilişkiyi hiç kabul etmiyor.
- **Tüm 6 kayıt, tekil endpoint'te `include=category,managed_by_user,managed_by_user_role,activities,comments,tags` ile tek tek doğrulandı:** `category`, `managed_by_user`, `managed_by_user_role` → gerçek `data:null`; `activities`, `comments`, `tags` → gerçek `data:[]`. `included` dizisi her durumda boş (0 öğe) — çözümlenecek hiçbir ilişkili kaynak yok.
- **GET /salaries → 200, gerçek `data:[]`.** Bu hesapta **0 gerçek maaş kaydı** — hiçbir maaş satırı/özeti üretilmedi.

## 2. Tam API alan envanteri (6 kaydın tamamı)

**Root:** `id` (6/6 dolu, sayısal string, örn. `1000110946`), `type` (6/6 = `"employees"`).

**Attributes:**

| Alan | Bulunan kayıt | Dolu | Null | Boş string/array/object | Veri tipi |
|---|---:|---:|---:|---:|---|
| created_at | 6 | 6 | 0 | 0 | string (ISO8601) |
| updated_at | 6 | 6 | 0 | 0 | string (ISO8601) |
| name | 6 | 6 | 0 | 0 | string |
| email | 6 | 0 | 6 | 0 | null |
| archived | 6 | 6 (hepsi `false`) | 0 | 0 | boolean |
| iban | 6 | 0 | 6 | 0 | null |
| tckn | 6 | 0 | 6 | 0 | null |
| balance | 6 | 6 (hepsi `"0.0"`) | 0 | 0 | string (decimal) |
| trl_balance | 6 | 6 (hepsi `"0.0"`) | 0 | 0 | string (decimal) |
| usd_balance | 6 | 6 (hepsi `"0.0"`) | 0 | 0 | string (decimal) |
| eur_balance | 6 | 6 (hepsi `"0.0"`) | 0 | 0 | string (decimal) |
| gbp_balance | 6 | 6 (hepsi `"0.0"`) | 0 | 0 | string (decimal) |
| employment_start_date | 6 | 0 | 6 | 0 | null |
| employment_end_date | 6 | 0 | 6 | 0 | null |
| phone | 6 | 0 | 6 | 0 | null |

**Relationships (her biri 6/6 kayıtta mevcut):**

| İlişki | Liste endpoint'inde | Tekil endpoint'te (include ile) |
|---|---|---|
| `category` | `{"meta":{}}` (boş, veri değil) | gerçek `data:null` (6/6) |
| `managed_by_user` | `{"meta":{}}` | gerçek `data:null` (6/6) |
| `managed_by_user_role` | `{"meta":{}}` | gerçek `data:null` (6/6) |
| `tags` | liste `include=tags` ile: gerçek `data:[]` (6/6) | gerçek `data:[]` (6/6) |
| `activities` | liste endpoint'i include'u reddediyor (400) | gerçek `data:[]` (6/6) |
| `comments` | liste endpoint'i include'u reddediyor (400) | gerçek `data:[]` (6/6) |

`links`/`meta` (kaynak seviyesinde): sadece liste yanıtının üst seviyesinde `links.self/first/prev/next/last` ve `meta.current_page/total_pages/total_count/per_page/payable_total/advance_total/export_url` — hepsi gerçek, kayıt bazlı değil, DB'ye yazılmıyor (token/kimlik bilgisi değil, ama iş verisi de değil — sync sayaçlarına response-only olarak yansıtıldı).

`included`: her koşulda **0 öğe** — hiçbir ilişki gerçek bir kaynağa çözümlenmiyor.

## 3. İlişki denetimi

| İlişki | data=null | data=[] | yalnız meta (boş) | gerçek id/type | included ile çözümlü | çözümlenmemiş |
|---|---:|---:|---:|---:|---:|---:|
| category | 6 (tekil ile) | 0 | 6 (listede) | 0 | 0 | 0 |
| managed_by_user | 6 (tekil ile) | 0 | 6 (listede) | 0 | 0 | 0 |
| managed_by_user_role | 6 (tekil ile) | 0 | 6 (listede) | 0 | 0 | 0 |
| tags | 0 | 6 | 0 | 0 | 0 | 0 |
| activities | 0 | 6 (yalnız tekil endpoint'te) | 6 (listede) | 0 | 0 | 0 |
| comments | 0 | 6 (yalnız tekil endpoint'te) | 6 (listede) | 0 | 0 | 0 |

Hiçbir tabloda/junction'da gerçek bir satır yok çünkü hiçbir ilişki gerçek id/type üretmiyor: kategori tablosu/junction, `managed_by_user` referans tablosu, activity/comment/tag alt tabloları **oluşturulmadı** (kural: boş `{"meta":{}}` veya gerçek `data:[]` "tablo gerektirir" anlamına gelmez).

## 4. Mevcut `parasut.employees` (6 satır) denetimi

- **Kaynak:** `20260825010000_parasut_schema_dedicated.sql` (Faz 0 şema kurulumu) + tek seferlik `scripts/sync_parasut.py` ile daha önce doldurulmuş.
- Benzersiz `parasut_id`: **6/6**, sıfır tekrar.
- Eksik gerçek kolonlar (API'nin döndürdüğü ama tablo şemasında olmayan): `tckn`, `employment_start_date`, `employment_end_date`, `phone` (4 alan) — hepsi bu hesapta hâlâ null ama API'nin gerçek attribute anahtarları olduğu için eklendi, hiçbir değer icat edilmedi.
- `raw jsonb` sütunu zaten mevcuttu; sync üzerinden tam kaynak nesnesiyle güncellendi (tekil endpoint'ten gelen `activities`/`comments` merge edilmiş haliyle).
- Eski satırlar **drop/recreate edilmedi** — yalnızca `parasut_id` üzerinden güvenli upsert.

**Yeni migration:** `supabase/migrations/20260828030000_parasut_employees_full_data.sql` (eski migration'lar değiştirilmedi). Eklenenler:
- `parasut.employees`: `tckn, employment_start_date, employment_end_date, phone, managed_by_user_parasut_id, managed_by_user_role_parasut_id, managed_by_user_role_type, tags_resolved, activities_resolved, comments_resolved` kolonları + `archived` indeksi.
- `public.parasut_employees_demo` view (anon/authenticated'e `select` grant'li).
- `public.parasut_employee_counts_demo` durable aggregate-count view (`count(*) filter (...)`, PostgREST 1000 satır sınırından bağımsız).

Yeni tablo/junction **oluşturulmadı** çünkü `category`/`managed_by_user`/`managed_by_user_role`/`activities`/`comments`/`tags` bu hesapta genuinely boş — bir gün gerçek veri gelirse temsil edilebilmesi için `*_parasut_id` kolonları eklendi ama hiçbir satırla doldurulmadı.

## 5. Sync (Edge Function)

`supabase/functions/parasut-sync/resources/employees.ts` + `index.ts`'e eklenen `syncEmployees`, mevcut modüler desenle (shipment_documents/sales_offers) birebir aynı yapıda:

- Tam sayfalama, `filter[archived]` ile iki bağımsız akış (`fetchActiveAndArchived`).
- Liste taramasında `include=category,managed_by_user,managed_by_user_role,tags` (list-endpoint'in kabul ettiği tam küme).
- Her gerçek çalışan için ek olarak tekil endpoint'ten `include=activities,comments` çekilip listeden gelen ilişkilerle merge ediliyor (6 kayıt için 6 ek GET — ucuz).
- Batch upsert (`upsertBatched`, `BATCH_SIZE=200`), `dry_run` desteği, mevcut eşzamanlı-sync kilidi (`parasut.sync_runs` partial unique index), `error_count`/`error_messages` toplanıyor.
- `category_resolved_count`/`managed_by_user_resolved_count` response'ta — bu hesapta ikisi de gerçek **0**.
- Null-safe upsert: `mapEmployee` her alanı API'nin döndürdüğü değerle (null dahil) yeniden yazıyor, eski değeri "atlamıyor".

**Dry run (canlı):**
```
{"resource":"employees","dry_run":true,"status":"dry_run","total_fetched_count":6,"active_fetched_count":6,"archived_fetched_count":0,"upserted_count":0,"total_count_reported":6,"category_resolved_count":0,"managed_by_user_resolved_count":0,"error_count":0}
```

**İki ardışık gerçek sync (canlı, idempotency kanıtı):**
```
sync 1: {"resource":"employees","dry_run":false,"status":"success","total_fetched_count":6,"active_fetched_count":6,"archived_fetched_count":0,"upserted_count":6,"total_count_reported":6,"category_resolved_count":0,"managed_by_user_resolved_count":0,"error_count":0}
sync 2: {"resource":"employees","dry_run":false,"status":"success","total_fetched_count":6,"active_fetched_count":6,"archived_fetched_count":0,"upserted_count":6,"total_count_reported":6,"category_resolved_count":0,"managed_by_user_resolved_count":0,"error_count":0}
```
İki sonuç birebir aynı — idempotent.

## 6. Frontend

- `src/pages/Calisanlar.tsx` — liste sayfası: Paraşüt ID, ad, e-posta, telefon, TCKN, işe başlama/çıkış tarihleri, kategori ID, arşiv durumu, durable count-view tabanlı Aktif/Arşivli/Tümü sekmeleri, detay linki.
- `src/pages/CalisanDetay.tsx` — detay sayfası: tüm gerçek alanlar (Genel, Bakiyeler, İlişkiler grupları), "Tüm çalışan alanlarını göster" açılır panel (ilişki çözümleme durumu + zaman damgaları), null→"—", `archived` → Evet/Hayır. Maaş bölümü **yok** (gerçek `salaries` = 0 kanıtlandığı için) — sadece bunun neden gösterilmediğini açıklayan tek satırlık not var (icat edilmiş bir "0 TL maaş" kartı değil).
- Route'lar `src/App.tsx`'e eklendi: `/giderler/calisanlar` (liste, statik route jenerik `/giderler/:parasutId`'den önce), `/giderler/calisanlar/:parasutId` (detay).
- Nav linkleri: `src/pages/Giderler.tsx` ve `src/pages/DemoHome.tsx`'e "Çalışanlar →" linki eklendi (mevcut Tedarikçiler/Gider ödemeleri linkleriyle aynı desen).

## 7. Sayaç modeli

`public.parasut_employee_counts_demo`: `active_count, archived_count, null_archived_count, total_count` — API'nin gerçek `archived` boolean attribute'una dayanıyor (icat edilmiş bir alan değil). Canlı: `{"active_count":6,"archived_count":0,"null_archived_count":0,"total_count":6}`.

## 8. Uçtan uca doğrulama

| API | Base (`parasut.employees`) | Raw (`raw jsonb`) | View (`parasut_employees_demo`) | TS tipi | UI | Null korunuyor |
|---|---|---|---|---|---|---|
| `name` | `name` | ✓ | ✓ | `string \| null` | Liste+Detay başlığı | evet |
| `email` | `email` | ✓ | ✓ | `string \| null` | Liste+Detay | evet (6/6 null → "—") |
| `phone` | `phone` (yeni) | ✓ | ✓ | `string \| null` | Liste+Detay | evet (6/6 null) |
| `tckn` | `tckn` (yeni) | ✓ | ✓ | `string \| null` | Liste+Detay | evet (6/6 null) |
| `iban` | `iban` | ✓ | ✓ | `string \| null` | Detay | evet (6/6 null) |
| `archived` | `archived` | ✓ | ✓ | `boolean \| null` | Liste sekmesi+Detay | evet (6/6 = false, gizlenmedi) |
| `employment_start_date`/`_end_date` | yeni kolonlar | ✓ | ✓ | `string \| null` | Liste+Detay | evet (6/6 null) |
| `balance`/`trl_/usd_/eur_/gbp_balance` | mevcut kolonlar | ✓ | ✓ | `number \| null` | Detay | evet (6/6 = 0, gerçek sıfır gösteriliyor) |
| `category` ilişkisi | `category_parasut_id` | ✓ (rels) | ✓ | `number \| null` | Liste+Detay | evet (6/6 null) |
| `managed_by_user`/`_role` | yeni kolonlar | ✓ | ✓ | `number \| string \| null` | Detay | evet (6/6 null) |
| `tags`/`activities`/`comments` | `*_resolved boolean` | ✓ (rels) | ✓ | `boolean \| null` | Detay (açılır panel) | evet — "gerçekten sorgulandı, gerçek veri yok" olarak gösteriliyor, sahte satır yok |
| `created_at`/`updated_at` | `parasut_created_at`/`parasut_updated_at` | ✓ | ✓ | `string \| null` | Detay (UTC) | evet |

Kapsanan örnekler: 6/6 gerçek kayıt, `email/iban/tckn/phone/employment_*` null olan 6/6 kayıt (hepsi), `category` popüle olan **0** örnek (hesapta böyle bir kayıt yok — icat edilmedi), `category` null olan 6/6 örnek, `archived=true` olan **0** örnek (hesapta yok).

## 9. Regresyon

**Yeni (Faz 10) gerçek sayılar:**
- Çalışan: 6, benzersiz parasut_id: 6, tekrar: 0.
- Kategori: 0 popüle, 6 null, 0 çözümlenemeyen.
- managed_by_user / managed_by_user_role: 0 popüle, 6 null.
- tags/activities/comments: 6/6 "gerçekten sorgulandı, gerçek veri yok" (`*_resolved = true`, ilişkili satır sayısı 0).
- Stale/error: 0 (iki ardışık sync'te `error_count:0`, hiçbir kayıt silinmedi).
- **Gerçek maaş toplamı: 0** — `GET /salaries` canlı olarak `data:[]` döndürdü (kanıtlandı, varsayılmadı); `parasut.salaries` tablosu dokunulmadan bırakıldı, hiçbir UI maaş bölümü oluşturulmadı.

**Mevcut modüllerin regresyon sayıları (canlı REST sorgularıyla yeniden doğrulandı, `Content-Range` başlığı üzerinden):**

| Kaynak | Beklenen | Canlı |
|---|---:|---:|
| shipment_documents | 15 | 15 |
| contacts | 448 | 448 |
| products | 2597 | 2597 |
| sales_invoices | 451 | 451 |
| purchase_bills | 811 | 811 |
| checks | 40 | 40 |

Tüm regresyon sayıları değişmedi.

## 10. Deploy ve test

- Migration `20260828030000_parasut_employees_full_data.sql` hosted Supabase'e uygulandı (`supabase db push`, "Remote database is up to date" — bu sürecin bir aşamasında zaten uygulanmıştı; `supabase migration list` ile teyit edildi).
- Edge Function `parasut-sync` `--use-api` ile deploy edildi (Docker Desktop bu ortamda bundling için kullanılamadı, API tabanlı deploy'a düşüldü — kod davranışı aynı).
- Dry run, iki ardışık gerçek sync yukarıda (bölüm 5) — idempotent, `error_count:0`.
- `npm test` → 1/1 geçti.
- `npm run lint` → 0 hata, yalnızca mevcut/ilgisiz uyarılar (shadcn bileşenlerinde fast-refresh uyarıları).
- `npm run build:demo` → başarılı, `Calisanlar-B0Ssovnd.js` (4.44 kB) ve `CalisanDetay-C9jiwhIt.js` (4.84 kB) chunk'ları üretildi.
- `npx tsc --noEmit -p tsconfig.app.json` → yalnızca bilinen, kapsam dışı `Login.tsx:55` hatası (`variant` prop'u `LogoProps`'ta yok) — dokunulmadı.
- FTP deploy: `scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` (doğru hedef `scripts/full_deploy.py`'den doğrulandı; ilk denemede yanlışlıkla `/demo`'ya deploy edilmişti, düzeltildi).
- Canlı bundle hash doğrulandı: `index-D0ljsrUa.js` (build çıktısıyla birebir).
- `GET https://demo.eclipsemuhendislik.com/giderler/calisanlar` → **200**; `GET .../giderler/calisanlar/1000110946` → **200** (Apache `.htaccess` SPA rewrite üzerinden, sert yenileme dahil).

## 11. Sonuç

**PASS.**

- API'nin döndürdüğü hiçbir alan/ilişki dışında bilgi eklenmedi (maaş, departman, pozisyon, SGK, izin bakiyesi, yönetici, kullanıcı hesabı — hiçbiri bu hesapta gerçek olmadığı için gösterilmedi).
- API'nin döndürdüğü her gerçek+güvenli alan (attributes'in tamamı, `category`/`managed_by_user`/`managed_by_user_role`/`tags`/`activities`/`comments` ilişkilerinin gerçek null/boş durumu) base→raw→view→TS tipi→UI zincirinin her katmanında erişilebilir.
- Liste/tekil endpoint tutarsızlığı (activities/comments) Faz 9 örüntüsüyle aynı şekilde ele alındı: tekil endpoint üzerinden gerçek veri çekildi, hiçbir şey tahmin edilmedi.
- 0 gerçek maaş kaydı olduğu kanıtlandı (varsayılmadı) ve buna göre hiçbir maaş UI'ı kurulmadı.
- Regresyon: tüm mevcut modül sayıları değişmeden doğrulandı.

**Doğrulama için gerçek ID'ler:** çalışan `1000110946` (mahmut dayan), `1000110947` (sahin polat), `1000110949` (fevziye dayan), `1000146550` (berat dayan), `1000146551` (bediz oymak), `1000245308` (cemal altuntaş). Tümü `archived=false`, tümünde `category/managed_by_user/managed_by_user_role=null`, `tags/activities/comments` gerçekten sorgulanmış ve boş.
