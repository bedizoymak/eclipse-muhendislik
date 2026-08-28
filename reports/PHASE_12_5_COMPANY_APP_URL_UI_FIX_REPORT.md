# Phase 12.5 — Şirket `app_url` UI Eksiğini Düzelt

**Tarih:** 2026-08-28
**Düzelttiği faz:** Phase 12.4 (`reports/PHASE_12_4_COMPANY_DEFAULT_WAREHOUSE_RESOLUTION_REPORT.md`, kod commit `e800cde17abc9c65fef3fe3262baa6a561e38910`)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri

## 0. Sorun

Son tarayıcı testi, 99 şirket alanından 98'inin erişilebilir olduğunu, yalnızca `app_url` alanının UI'da hiç render edilmediğini tespit etti. İnceleme doğruladı: `CompanyProfileRow` TS arayüzünde `app_url: string | null` alanı **zaten vardı** (satır 18), ama dosyanın hiçbir yerinde (JSX, `FIELD_LABELS`) kullanılmıyordu — `grep -n "app_url"` düzeltme öncesi yalnızca tip tanımını buluyordu. Production bundle'ında `app_url` property adı bile yoktu.

## 1. Kaynak zinciri doğrulaması (düzeltme öncesi, gerçek DB sorgusu)

```
psycopg2, SUPABASE_DB_URL ile hosted DB:
select parasut_id, app_url from public.parasut_company_profile_demo
→ (666034, 'https://uygulama.parasut.com/666034')

select app_url from parasut.companies limit 1
→ ('https://uygulama.parasut.com/666034',)

view kolon sayısı: 99
```

Zincir: `GET /v4/companies` → `attributes.app_url` → Edge Function `parasut-sync` mapping → `parasut.companies.app_url` → `public.parasut_company_profile_demo.app_url` (99 kolonun biri, önceki fazlardan beri view'da mevcut) → `CompanyProfileRow.app_url` (zaten mevcut TS alanı) → **UI (eksikti, bu faz ekledi)**.

Hiçbir migration/Edge Function değişikliği gerekmedi — view zaten `app_url`'i taşıyordu, sorun yalnızca UI render eksikliğiydi.

## 2. Uygulanan düzeltme (`src/pages/SirketBilgileri.tsx`)

- Şirket başlık/bilgi bölümüne (`dl` grid, "Son Tüketim Tarihi" satırının hemen altına) yeni açık satır eklendi:
  - **Etiket:** `Paraşüt Uygulama URL`
  - **Değer:** `company.app_url` — `null` ise `—`, doluysa ham değer tam olarak gösteriliyor, tıklanabilir `<a href={company.app_url} target="_blank" rel="noopener noreferrer">` ve harici link olduğunu belirten `↗` işareti ile.
  - `break-all` class'ı ile satır taşması önlendi.
- Ayrıca `FIELD_LABELS` sözlüğüne `app_url: "Paraşüt Uygulama URL"` eklendi, böylece "Tüm şirket alanlarını göster" tablosunda da görünür (99/99 alan tam kapsama için).
- URL hiçbir yerde `company.parasut_id`'den veya başka bir alandan **inşa edilmedi**; sabit/literal URL veya fallback yok — tek kaynak `company.app_url`.

## 3. Güvenlik taraması

`https://uygulama.parasut.com/666034` değeri incelendi:
- Token yok, kimlik bilgisi yok, imzalı query parametresi yok, `Authorization`/header yok.
- URL'de tek "gizli" görünebilecek parça şirket ID'si (`666034`) — bu zaten `company.parasut_id` olarak sayfanın başında (Paraşüt ID etiketiyle) açıkça gösteriliyor, yeni bir sızıntı değil.
- `extra_flags` veya `inspectable` gibi özel alanlar view'a hiç dahil değil (Phase 12.1'den beri) — bu fazda da taşınmadı, kontrol edildi: `information_schema.columns` sorgusunda `extra_flags`/`inspectable` view'da **0 sonuç**.

## 4. Test ve build

- `npm test` → 1/1 PASS.
- `npm run lint` → 0 hata, 10 önceden var olan uyarı (kapsam dışı UI/i18n dosyaları, değişmedi).
- `npx tsc --noEmit -p tsconfig.app.json` → yalnızca bilinen kapsam dışı `Login.tsx:55` hatası (`variant` prop'u `LogoProps`'ta yok) — bu fazın kapsamı dışı, dokunulmadı.
- `npm run build:demo` → başarılı. Yeni bundle: `SirketBilgileri-DGbAr1HW.js`, ana `index-C3iphlIy.js`.
- Bundle taraması: `grep -o "app_url" dist/demo/assets/SirketBilgileri-DGbAr1HW.js` → 4 eşleşme (property adı var). `grep -o "uygulama.parasut.com"` → **0 eşleşme** (tam URL sabit olarak gömülü değil). `grep -o "666034"` → **0 eşleşme** (şirket ID bundle'da literal olarak yok — değer yalnızca runtime'da Supabase'den geliyor).

## 5. Deploy

```
set -a && source .env && set +a
MSYS_NO_PATHCONV=1 python scripts/full_deploy.py --skip-build
```
- `/public_html` (ana site) → 16 dosya yüklendi.
- `/public_html/demo` (demo alt alanı, **doğru hedef**) → 45 dosya yüklendi, `SirketBilgileri-DGbAr1HW.js` dahil.
- Canlı doğrulama: `curl -sk https://demo.eclipsemuhendislik.com/` → ana bundle `index-C3iphlIy.js`, yerel build'de üretilenle birebir eşleşiyor.
- `curl -sk -o /dev/null -w "%{http_code}"` → `/sirket-bilgileri` HTTP 200; hard refresh (aynı istek tekrar) HTTP 200.

## 6. Gerçek headless Chrome (Puppeteer, proje `node_modules`'ı üzerinden, 3 viewport)

Geçici doğrulama scripti (`scratch_verify_appurl.mjs`, proje köküne yazıldı, iş bitince silindi) ile:

| Viewport | Console error | Network failure | Yatay taşma | `app_url` etiketi | `app_url` değeri | Link (`href`/`target`/`rel`) |
|---|---|---|---|---|---|---|
| 1280×900 (desktop) | 0 | 0 | yok | var | var | `https://uygulama.parasut.com/666034` / `_blank` / `noopener noreferrer` |
| 390×844 (mobile) | 0 | 0 | yok | var | var | aynı |
| 768×1024 (tablet) | 0 | 0 | yok | var | var | aynı |

"Tüm şirket alanlarını göster" butonu her üç viewport'ta da programatik olarak tıklandı, açılan tabloda da alan doğrulandı.

## 7. Regresyon kontrolü (gerçek DB sorgusu, bu oturum)

| Kontrol | Sonuç |
|---|---|
| Şirket view satır sayısı | **1** — PASS |
| Şirket alanları erişilebilir | **99/99** — PASS (view kolon sayısı 99, hepsi TS tipinde) |
| Kullanıcı ilişki alanları | **13/13** — PASS (`parasut_user_company_relation_demo` kolon sayısı 13) |
| Varsayılan depo ID | **1000122982** — PASS |
| Depo adı | **"Ana Depo"** — PASS |
| Depo kaynak türü | **"warehouses"** — PASS |
| `/me` depo ilişki türü | **`None`/`—`** (BLOCKED, Phase 12.3/12.4'ten beri değişmedi) — PASS (doğru davranış) |
| Özel alan sızıntısı (`extra_flags`/`inspectable`) view'da | **0** — PASS |
| Production'da sabit/uydurma veri | **0** — PASS (`uygulama.parasut.com` ve `666034` bundle'da literal olarak yok) |

## 8. Genel Sonuç

| Bölüm | Durum |
|---|---|
| Kaynak zinciri (§1) | PASS |
| UI düzeltmesi (§2) | PASS |
| Güvenlik taraması (§3) | PASS |
| Test/build (§4) | PASS |
| Deploy (§5) | PASS — doğru `/public_html/demo` hedefi, `MSYS_NO_PATHCONV=1` ile argv mangling önlendi |
| Canlı tarayıcı doğrulaması (§6) | PASS — 3 viewport, 0 hata, 0 ağ hatası, 0 taşma |
| Regresyon (§7) | PASS — tüm önceki fazların sonuçları korundu |

**Genel PASS.** `app_url` alanı artık `public.parasut_company_profile_demo.app_url` (gerçek Paraşüt API kaynağı `attributes.app_url`) üzerinden UI'da hem şirket başlık bölümünde ayrı, tıklanabilir bir satır (`Paraşüt Uygulama URL`) olarak hem de "Tüm şirket alanlarını göster" tablosunda erişilebilir. URL hiçbir yerde şirket ID'sinden inşa edilmedi, sabit/fallback literal kullanılmadı; değer yalnızca gerçek view sütunundan geliyor. 99/99 şirket alanı artık UI'da erişilebilir.

**Bilinen kapsam dışı sorun:** `Login.tsx:55` TS hatası (önceki fazlardan beri var, bu fazın kapsamı dışı, düzeltilmedi).

---

**Kod commit SHA:** 7a1c3e7dfbceb6fe78567d0ebe095a2aba34b892
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri
**Doğrulama için gerçek değer:** `app_url = https://uygulama.parasut.com/666034` (şirket `666034`).
