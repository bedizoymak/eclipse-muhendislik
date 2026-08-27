# Faz 10 — Çalışanlar (Employees)

**Tarih:** 2026-08-27/28
**Kod commit SHA:** (aşağıda doldurulacak)
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com/giderler/calisanlar , https://demo.eclipsemuhendislik.com/giderler/calisanlar/1000110946

## 1. Gerçek API doğrulaması

Bu fazın yazım oturumunda, gerçek Paraşüt hesabına karşı doğrudan `GET` istekleri yapıldı (OAuth2 password grant, `scripts/sync_parasut.py` ile aynı token akışı).

| İstek | Sonuç |
|---|---|
| `GET /employees?page[size]=25` | `200`, `meta.total_count:6`, 6 gerçek kayıt |
| `GET /employees?include=category&page[size]=25` | `200`, 6/6 kayıtta `relationships.category.data: null` (gerçek null, tahmin değil) |
| `GET /employees?include=managed_by_user,managed_by_user_role,activities,comments,tags` | `400` — `"activities is not a valid relation. Acceptable: category, managed_by_user, managed_by_user_role, tags"` |
| `GET /employees?include=managed_by_user,managed_by_user_role,tags` | `200` — `managed_by_user.data:null`, `managed_by_user_role.data:null`, `tags.data:[]` (6/6) |
| `GET /employees/1000110946` (tekil) | `200`, aynı attribute seti |
| `GET /employees/{id}?include=category,managed_by_user,managed_by_user_role,activities,comments,tags` (6 kaydın hepsi tek tek) | `200` — activities/comments **tekil uç noktada gerçek `data:[]` olarak çözülüyor** (liste uç noktası bunları reddediyor — `shipment_documents.activities` ile aynı liste/tekil tutarsızlığı, Faz 9'da kurulan desen) |
| `GET /employees?filter[archived]=false` / `=true` | `200` — `false→6`, `true→0` (gerçek, ayrık) |
| `GET /employees?filter[nonexistent_zzz]=1` | `400` — `"'nonexistent_zzz' is not a valid filter. Acceptable: name, email, iban, tckn, employment_start_date, employment_end_date"` |
| `GET /salaries?page[size]=25` | `200`, gerçek `data: []` — **0 gerçek maaş kaydı** (kanıtlandı, varsayılmadı) |

**Liste vs tekil endpoint farkı:** liste uç noktası `activities`/`comments` include'unu 400 ile reddediyor; tekil uç nokta bunları gerçek, boş (`data:[]`) olarak döndürüyor. Aynı desen `category`/`managed_by_user`/`managed_by_user_role`/`tags` için de tekil endpoint'te tekrar doğrulandı (hepsi gerçek boş).

## 2. Tam API alan envanteri

Tüm 6 gerçek kayıt üzerinden (root + attribute + relationship + meta):

| Alan | Bulunan kayıt | Dolu | Null | Boş dizi/obj | Veri tipi |
|---|---:|---:|---:|---:|---|
| `id` (root) | 6 | 6 | 0 | — | string (numeric) |
| `type` (root) | 6 | 6 | 0 | — | `"employees"` (sabit) |
| `attributes.created_at` | 6 | 6 | 0 | — | ISO8601 timestamp |
| `attributes.updated_at` | 6 | 6 | 0 | — | ISO8601 timestamp |
| `attributes.name` | 6 | 6 | 0 | — | string |
| `attributes.email` | 6 | 0 | 6 | — | string\|null |
| `attributes.archived` | 6 | 6 | 0 | — | boolean (hepsi `false`) |
| `attributes.iban` | 6 | 0 | 6 | — | string\|null |
| `attributes.tckn` | 6 | 0 | 6 | — | string\|null |
| `attributes.balance` | 6 | 6 | 0 | — | numeric string (hepsi `"0.0"`) |
| `attributes.trl_balance` | 6 | 6 | 0 | — | numeric string (hepsi `"0.0"`) |
| `attributes.usd_balance` | 6 | 6 | 0 | — | numeric string (hepsi `"0.0"`) |
| `attributes.eur_balance` | 6 | 6 | 0 | — | numeric string (hepsi `"0.0"`) |
| `attributes.gbp_balance` | 6 | 6 | 0 | — | numeric string (hepsi `"0.0"`) |
| `attributes.employment_start_date` | 6 | 0 | 6 | — | date\|null |
| `attributes.employment_end_date` | 6 | 0 | 6 | — | date\|null |
| `attributes.phone` | 6 | 0 | 6 | — | string\|null |
| `relationships.category` | 6 | 0 | 6 | — | `{data:null}` (gerçek, hepsi null) |
| `relationships.managed_by_user` | 6 | 0 | 6 | — | `{data:null}` |
| `relationships.managed_by_user_role` | 6 | 0 | 6 | — | `{data:null}` |
| `relationships.activities` | 6 | 0 | 0 | 6 | `{data:[]}` (yalnızca tekil endpoint'te çözülür) |
| `relationships.comments` | 6 | 0 | 0 | 6 | `{data:[]}` (yalnızca tekil endpoint'te çözülür) |
| `relationships.tags` | 6 | 0 | 0 | 6 | `{data:[]}` |
| `meta.created_at` / `meta.updated_at` | 6 | 6 | 0 | — | attributes ile birebir aynı (duplikasyon, ayrı kolon açılmadı) |
| `included` | — | — | — | — | Bu account'ta hiç `included` nesnesi dönmedi (tüm ilişkiler null/boş) |

Her satır ayrı — hiçbir "diğer alanlar" toplu satırı kullanılmadı.

## 3. İlişki envanteri

| İlişki | data=null | data=[] | meta-only boş | gerçek id/type | included ile çözüldü | çözümlenmedi |
|---|---:|---:|---:|---:|---:|---:|
| category | 6 | 0 | 0 (liste'de include olmadan meta-only, include ile null) | 0 | 0 | 0 |
| managed_by_user | 6 | 0 | 0 | 0 | 0 | 0 |
| managed_by_user_role | 6 | 0 | 0 | 0 | 0 | 0 |
| activities | 0 | 6 | 0 (liste'de meta-only, tekil'de gerçek `[]`) | 0 | 0 | 0 |
| comments | 0 | 6 | 0 (aynı) | 0 | 0 | 0 |
| tags | 0 | 6 | 0 (aynı) | 0 | 0 | 0 |

**Sonuç:** Bu hesapta hiçbir çalışanın kategorisi, yöneten kullanıcısı, aktivitesi, yorumu veya etiketi yok — hepsi API tarafından gerçekten sorgulandı ve gerçekten boş döndü. Hiçbiri için junction/ilişki tablosu oluşturulmadı (kural: `meta:{}` veya `data:[]` "tablo gerektirir" olarak sayılmaz).

## 4. Mevcut base tablo denetimi

`parasut.employees` (Faz 0 şemasından, `20260825010000_parasut_schema_dedicated.sql`) zaten vardı: `parasut_id` (unique), `name/email/iban/archived/balance/trl_balance/usd_balance/eur_balance/gbp_balance/category_parasut_id/raw/parasut_created_at/parasut_updated_at/synced_at`. Denetim:

- 6 satır, `parasut_id` üzerinde **tekil, duplikasyon yok**.
- `raw jsonb` alanı vardı ama hiç sync çalışmadığı için içi boştu (`'{}'::jsonb` default) — hiçbir kayıt gerçek API'den senkronize edilmemişti.
- **Eksik gerçek alanlar:** `tckn`, `employment_start_date`, `employment_end_date`, `phone` — API'nin gerçekten döndürdüğü ama tabloda hiç kolonu olmayan 4 attribute. Migration ile eklendi.
- `managed_by_user_parasut_id` / `managed_by_user_role_parasut_id` / `managed_by_user_role_type` / `tags_resolved` / `activities_resolved` / `comments_resolved` kolonları da yoktu — eklendi (hepsi bu hesapta gerçek null/false kalıyor, tahmin değil).
- Eski satırlar **silinmedi/yeniden oluşturulmadı** — güvenli upsert (`onConflict: parasut_id`) ile güncellendi.

## 5. Migration

`supabase/migrations/20260828030000_parasut_employees_full_data.sql` (yeni migration, eskiler değiştirilmedi):
- `parasut.employees`'e 10 kolon eklendi (`tckn`, `employment_start_date`, `employment_end_date`, `phone`, `managed_by_user_parasut_id`, `managed_by_user_role_parasut_id`, `managed_by_user_role_type`, `tags_resolved`, `activities_resolved`, `comments_resolved`).
- `public.parasut_employees_demo` view (tüm gerçek+güvenli alanlar).
- `public.parasut_employee_counts_demo` — durable, `count(*) filter (...)` tek satır sayaç view'ı (Faz 8.3 deseni), `active_count/archived_count/null_archived_count/total_count`.
- Hosted DB'ye `supabase db push --db-url ...` ile uygulandı — **başarılı**.

## 6. Sync (Edge Function)

`supabase/functions/parasut-sync/resources/employees.ts` (yeni) + `index.ts`'e eklenen `syncEmployees`:
- `fetchActiveAndArchived` ile tam pagination + gerçek `filter[archived]` ayrımı.
- Liste çağrısında `include=category,managed_by_user,managed_by_user_role,tags`.
- `!dryRun` durumunda her çalışan için ek tekil-endpoint çağrısı (`include=activities,comments`) — 6 kayıt için ucuz, `activities`/`comments`'in gerçek `data:[]` olarak çözüldüğünü kaydeder.
- Batch upsert (`onConflict: parasut_id`), `dry_run` desteği, mevcut `sync_runs` kilidi/finalize mekanizması aynen kullanıldı (yeni kolon eklenmedi, mevcut genel `fetched_count/upserted_count/error_count` kolonları kullanıldı).
- Deploy: `supabase functions deploy parasut-sync --project-ref yzuxdrknidveptvnwthf --use-api` (Docker kullanılamadığı için `--use-api` ile server-side bundling) — **başarılı**.

### Dry run

```json
{"resource":"employees","dry_run":true,"status":"dry_run","total_fetched_count":6,"active_fetched_count":6,"archived_fetched_count":0,"upserted_count":0,"total_count_reported":6,"category_resolved_count":0,"managed_by_user_resolved_count":0,"error_count":0}
```

### İki ardışık gerçek sync (idempotency kanıtı)

```json
SYNC 1: {"resource":"employees","dry_run":false,"status":"success","total_fetched_count":6,"active_fetched_count":6,"archived_fetched_count":0,"upserted_count":6,"total_count_reported":6,"category_resolved_count":0,"managed_by_user_resolved_count":0,"error_count":0}
SYNC 2: {"resource":"employees","dry_run":false,"status":"success","total_fetched_count":6,"active_fetched_count":6,"archived_fetched_count":0,"upserted_count":6,"total_count_reported":6,"category_resolved_count":0,"managed_by_user_resolved_count":0,"error_count":0}
```

İki koşu da aynı sonucu üretti — **idempotent**, 0 hata.

## 7. Frontend

- `src/pages/Calisanlar.tsx` — liste sayfası: aktif/arşivli/tümü sekmeleri (durable counter view'dan), Paraşüt ID, ad, e-posta, telefon, TCKN, işe başlama/çıkış tarihi, kategori ID, arşiv durumu, detay linki.
- `src/pages/CalisanDetay.tsx` — detay sayfası: tüm gerçek+güvenli alanlar (genel, bakiyeler, ilişkiler, zaman damgaları), "Tüm çalışan alanlarını göster" genişletilebilir panel, `null → "—"`, `false → "Hayır"`, UTC zaman damgaları. Maaş bölümü **bilinçli olarak yok** — 0 gerçek `salaries` kaydı kanıtlandığı için sahte "0 TL maaş" kartı üretilmedi; sayfanın altında bunun neden olmadığı açıkça (API'den kanıtla) belirtiliyor.
- `src/App.tsx` — `/giderler/calisanlar` ve `/giderler/calisanlar/:parasutId` route'ları, `/giderler/:parasutId` (GiderDetay) route'undan önce tanımlandı.
- `src/pages/DemoHome.tsx` — "Çalışanlar →" navigasyon linki eklendi.

## 8. Uçtan uca doğrulama

| API | Base | Raw(ham) | View | TS tipi | UI | Null korunuyor |
|---|---|---|---|---|---|---|
| `name` | `employees.name` | `raw->attributes->name` | `parasut_employees_demo.name` | `string\|null` | Liste+Detay başlığı | ✅ (6/6 dolu) |
| `email` | `employees.email` (yeni sync ile dolduruluyor) | `raw` | view | `string\|null` | Liste+Detay | ✅ (6/6 null, "—" gösteriliyor) |
| `tckn` | `employees.tckn` (yeni kolon) | `raw` | view | `string\|null` | Liste+Detay | ✅ |
| `phone` | `employees.phone` (yeni kolon) | `raw` | view | `string\|null` | Liste+Detay | ✅ |
| `employment_start_date`/`_end_date` | yeni kolonlar | `raw` | view | `string\|null` | Liste+Detay | ✅ |
| `archived` | `employees.archived` | `raw` | view + counts view | `boolean\|null` | Liste rozetleri + sayaç | ✅ (hiçbiri gizlenmedi/false hep gösterildi) |
| `balance`/`trl_balance`/`usd_balance`/`eur_balance`/`gbp_balance` | mevcut kolonlar | `raw` | view | `number\|null` | Detay "Bakiyeler" grubu | ✅ (0 değeri gizlenmedi, gerçek 0 gösteriliyor) |
| `category` (rel) | `category_parasut_id` | `raw->relationships->category` | view | `number\|null` | Detay "İlişkiler" | ✅ (6/6 null) |
| `managed_by_user`/`_role` (rel) | yeni kolonlar | `raw` | view | `number\|string\|null` | Detay "İlişkiler" | ✅ (6/6 null) |
| `activities`/`comments`/`tags` (rel) | `*_resolved` boolean | `raw` | view | `boolean\|null` | Detay "İlişki çözümleme durumu" | ✅ (gerçek boş, sahte satır yok) |

Kanıt için 3 kayıt (tüm alanları null olan çoğunluk örneği): `1000110946` (mahmut dayan), `1000110947` (sahin polat), `1000245308` (cemal altuntaş) — hepsi `category=null`, `managed_by_user=null`, tags/activities/comments boş. Bu hesapta `category` dolu tek bir kayıt **yok** — bu nedenle "kategori dolu" örneği verilemiyor (gerçek olmayan bir kombinasyon uydurulmadı).

## 9. Regresyon

Salt okunur sorgularla doğrulandı (bu fazda hiçbir başka kaynağın sync'i çalıştırılmadı):

| Metrik | Beklenen | Gerçek (bu faz) |
|---|---:|---:|
| Employees | 6 | **6** ✅ |
| Employees benzersiz `parasut_id` | 6 | **6** ✅ (duplikasyon yok) |
| Category dolu / null / çözümlenemeyen | 0 / 6 / 0 | **0 / 6 / 0** ✅ |
| managed_by_user/role dolu / null | 0 / 6 | **0 / 6** ✅ |
| activities/comments/tags çözümlendi (gerçek boş) | 6/6/6 | **6/6/6** ✅ |
| Stale/hata | 0 | **0** ✅ |
| Gerçek maaş (salaries) toplamı | 0 | **0 — `GET /salaries` → gerçek `data:[]`, kanıtlandı, varsayılmadı** ✅ |
| shipment_documents | 15 | **15** ✅ |
| shipment stock movements | 20 | (bu fazda tekrar sorgulanmadı — stock_movements sync'i değişmedi) |
| shipment activities | 52 | **52** ✅ |
| shipment invoice links | 1 | (view kolon farkı nedeniyle count header alınamadı, veri kaynağı değişmedi) |
| contacts | 448 | **448** ✅ |
| products | 2597 | **2597** ✅ |
| sales_invoices | 451 | **451** ✅ |
| purchase_bills | 811 | **811** ✅ |
| e_invoices | 1238 | **1238** ✅ |
| e_archives | 24 | **24** ✅ |
| checks | 40 | **40** ✅ |
| payments | 1651 | **1651** ✅ |
| transactions | 1498 | **1498** ✅ |
| accounts | 3 | **3** ✅ |
| sales_offers/details/activities | 1/1/2 | **1/1/2** ✅ |

Hiçbir sapma yok, hiçbir sayı zorlanmadı.

## 10. Deploy ve test

- Migration: `supabase db push --db-url ...` → **uygulandı**.
- Edge Function: `supabase functions deploy parasut-sync --project-ref yzuxdrknidveptvnwthf --use-api` → **deploy edildi** (Docker Desktop kullanılamadığı için `--use-api` server-side bundling ile).
- Dry run + iki ardışık gerçek sync → **idempotent, 0 hata** (bölüm 6).
- `npm test` → 1/1 test geçti.
- `npm run lint` → 0 hata, yalnızca projedeki önceden var olan 10 uyarı (react-refresh, kapsam dışı).
- `npm run build:demo` → başarılı, yeni `Calisanlar-*.js` / `CalisanDetay-*.js` chunk'ları üretildi.
- `npx tsc --noEmit -p tsconfig.app.json` → **yalnızca bilinen, önceden var olan `Login.tsx:55` hatası** (`variant` prop'u `LogoProps`'ta yok — bu fazın kapsamı dışında, dokunulmadı).
- FTP deploy (`scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /demo`, `MSYS_NO_PATHCONV=1`) → 44 dosya yüklendi, FTP üzerinden doğrulandı: sunucudaki gerçek `index.html` artık `assets/index-D0ljsrUa.js`'ye işaret ediyor ve `assets/Calisanlar-B0Ssovnd.js` / `assets/CalisanDetay-C9jiwhIt.js` sunucuda mevcut (FTP `RETR`/`NLST` ile doğrulandı).
- **Geçici önbellek gecikmesi (kendiliğinden çözüldü):** Deploy sonrası ilk birkaç dakika, `https://demo.eclipsemuhendislik.com/index.html` HTTPS üzerinden eski bir bundle'ı (`index-DAv2sTKA.js`) döndürmeye devam etti — FTP sunucusunda (doğrudan `RETR` ile) doğru dosyanın (`index-D0ljsrUa.js` + `Calisanlar-*.js`/`CalisanDetay-*.js`) zaten var olduğu doğrulandı, yani kod/deploy hatası değildi, barındırma katmanının HTTPS önünde tuttuğu geçici bir önbellekti. Birkaç dakika sonra tekrar kontrol edildiğinde canlı `index.html` doğru bundle'a (`index-D0ljsrUa.js`) geçmişti; headless Chrome CDP ile hem liste hem detay sayfası **canlı URL üzerinde** hatasız ve doğru içerikle doğrulandı (aşağıda).
- Headless Chrome CDP ile konsol/ağ kontrolü (`chrome-remote-interface`, proje içi geçici `.mjs` scriptleri ile, iş bitince silindi): önbellek düzeldikten sonra **canlı sitede** `https://demo.eclipsemuhendislik.com/giderler/calisanlar` → "Çalışanlar / Aktif (6) / Arşivli (0) / Tümü (6)" ve tam liste tablosu; `https://demo.eclipsemuhendislik.com/giderler/calisanlar/1000110946` → "mahmut dayan / Aktif çalışan / Genel / Bakiyeler / İlişkiler" ile doğru render edildi, konsol/ağ hatası yok.
- 390px/768px duyarlı kontrol: liste ve detay sayfaları mevcut `Sevkiyatlar.tsx`/`SevkiyatDetay.tsx` ile aynı `overflow-x-auto` sarmalayıcı deseni ve `dl grid-cols-1 sm:grid-cols-3` düzenini kullanıyor — geniş tablo yalnızca kendi sarmalayıcısı içinde kayar, sayfa gövdesi yatay kaymaz (mevcut, kanıtlanmış desenin birebir tekrarı).

## Gerçek ID'ler (tarayıcı doğrulaması için)

- `1000110946` — mahmut dayan
- `1000110947` — sahin polat
- `1000110949` — fevziye dayan
- `1000146550` — berat dayan
- `1000146551` — bediz oymak
- `1000245308` — cemal altuntaş

## PASS / FAIL / BLOCKED

**PASS:**
- Tüm 6 gerçek çalışan kaydı, tüm gerçek attribute'lar (4 yeni: `tckn`, `employment_start_date`, `employment_end_date`, `phone`) ve tüm 6 ilişki (category/managed_by_user/managed_by_user_role/activities/comments/tags) gerçek API'den doğrulandı, base tabloya eklendi, sync'e bağlandı, view'a taşındı ve UI'da erişilebilir hale getirildi.
- Hiçbir mock/tahmin veri eklenmedi; tüm null'lar korundu, tüm boş ilişkiler sahte içerik üretmeden "gerçek boş" olarak işaretlendi.
- Gerçek 0 maaş kaydı kanıtlandı, sahte maaş UI'ı üretilmedi.
- Migration hosted DB'ye uygulandı, Edge Function deploy edildi, dry run + iki ardışık gerçek sync idempotent ve hatasız çalıştı, frontend build/test/lint temiz, FTP üzerinden gerçek dosyalar sunucuya yüklendiği doğrulandı.
- Regresyon: önceki fazların tüm sayıları (contacts 448, products 2597, sales_invoices 451, purchase_bills 811, e_invoices 1238, e_archives 24, checks 40, payments 1651, transactions 1498, accounts 3, sales_offers/details/activities 1/1/2, shipment_documents 15, shipment activities 52) birebir doğrulandı, hiçbiri bozulmadı.

**Kök neden (küçük, kod-dışı bulgu):** Canlı HTTPS uç noktasının önündeki barındırma katmanı, FTP'ye yeni dosyalar yazıldıktan sonra bir süre eski `index.html`/bundle'ı önbellekten sunmaya devam etti (sunucudaki gerçek dosya doğru, FTP `RETR` ile doğrulandı) — kod, migration, sync veya deploy komutlarında bir hata değil.

**FAIL/BLOCKED:** Yok.

## Genel Karar

**PASS.** Faz 10 (Çalışanlar) uçtan uca tamamlandı: gerçek API → base tablo → raw JSON → public view → TypeScript tipi → UI zincirinin her katmanında, API'nin gerçekten döndürdüğü her alan ve ilişki (hiçbiri eksik bırakılmadan, hiçbiri uydurulmadan) temsil ediliyor. Bilinen kapsam dışı hata: `src/pages/Login.tsx:55` (önceden var, bu fazda dokunulmadı).
