# Phase 4.1 — Giderler mobile overflow fix + supplier verifiability report

- **Branch:** `main`
- **Base commit (before this phase):** `f7006f6d8a34285b2669c1f99dbd5d65cf4c42ab`
- **This phase's commit SHA:** `83ab3260b65514ed319ce49f55ebc367deddd392` (`83ab326`)
- **Push result:** `f7006f6..83ab326 main -> main` — success
- **Hosted Supabase project:** `yzuxdrknidveptvnwthf`
- **Live URL:** https://demo.eclipsemuhendislik.com/giderler

Note: `reports/PHASE_04_BROWSER_REPORT.md` was referenced in the task but does not exist in this repository (same recurring situation as every prior phase's referenced browser report). This phase proceeded using the reports that do exist plus, for the first time, a **real headless-browser measurement** (see below) rather than relying only on HTTP/REST checks.

No secret values appear anywhere in this report.

## What actually changed

### 1. `/giderler` mobile/tablet overflow (`src/pages/Giderler.tsx`)

Root cause: the payment-status and supplier `<select>` elements were direct children of a `flex flex-wrap` filter row with no width constraint. Browsers size a closed `<select>`'s minimum box to fit its widest `<option>` text unless an explicit width/max-width is set, and flex items default to `min-width: auto`, which lets that intrinsic content width push the row (and the document) wider than the viewport — the supplier list includes very long real company names.

Fix:
- Each select is now wrapped in its own container (`w-full min-w-0 sm:w-auto sm:max-w-[220px]`) instead of being a bare flex child.
- The select itself: `w-full max-w-full truncate`.
- The outer filter row and the archived-filter button group both got `min-w-0`.
- The date-range inputs also got `min-w-0` on their wrapper and themselves, for the same reason (defensive — they were not the reported bug but share the same flex-item risk).
- **First attempt had a real regression, caught before deploy finalization:** using `flex-1` on the select wrappers made both selects shrink to ~24–26px wide on a 390px viewport (crammed into a shared flex-wrap row with the archived-filter buttons) — unreadable, even though it did eliminate the overflow. Fixed by switching to `w-full` (full-width, own row on mobile) with `sm:w-auto sm:max-w-[220px]` only from the `sm:` breakpoint up, so mobile gets a readable full-width control and desktop keeps its original compact size.
- Desktop layout: unchanged in structure; the only difference is a `220px` cap on the two selects, which is at or above their previous typical rendered width (they were already effectively ~190–250px wide from content), so the visual desktop layout is not altered.
- The `overflow-x-auto` wrapper around the expenses `<table>` was not touched.

### 2. `parasut_suppliers_demo.account_type` (new migration)

New migration `20260826060000_parasut_suppliers_demo_account_type.sql`: `CREATE OR REPLACE VIEW public.parasut_suppliers_demo` appending `account_type` (from `parasut.contacts.account_type`, the real API field, already synced since Phase 1) as the last output column — required since `CREATE OR REPLACE VIEW` cannot reorder or rename existing columns, only append. The `WHERE account_type = 'supplier'` filter is unchanged. No existing migration was modified; no table or `sync_runs` column changes were needed.

## Real headless-browser verification (new for this phase)

Previous phases could not visually verify `demo.eclipsemuhendislik.com` because it serves a self-signed certificate and no automated fetch tool in this session trusts it. This phase found a working path: the machine already has Google Chrome installed, so a real headless Chrome instance was driven directly via the Chrome DevTools Protocol (a Node script using the CDP HTTP/WebSocket API, with `--ignore-certificate-errors` — a deliberate, explicit choice made by this session for its own testing, not a bypass presented to an end user) to load the actual live page, execute real JavaScript, and read real computed DOM values. This is the first phase where the mobile-overflow claim is backed by an actual rendered measurement rather than inferred from source code.

**Before the fix** (first deploy of this phase, `flex-1` version) at 390×844:
```
innerWidth: 390 (viewport correctly emulated)
selects: width 24-26px each (unreadable -- a new bug introduced by the first attempt)
docScrollWidth vs docClientWidth: 392 vs 390 (2px overflow)
```
This was caught and fixed before being reported as done — see "First attempt had a real regression" above.

**After the fix** (current live deploy):

| Viewport | `window.innerWidth` | `document.documentElement.scrollWidth` | `document.documentElement.clientWidth` | Overflow? |
|---|---:|---:|---:|---|
| 390×844 | 390 | **390** | **390** | **No** (390 ≤ 390) |
| 768×1024 | 768 | **753** | **753** | **No** (753 ≤ 753) |
| 1440×900 (desktop, for comparison) | 1440 | **1425** | **1425** | **No** (1425 ≤ 1425) |

(`innerWidth` includes the scrollbar gutter; `documentElement.clientWidth` excludes it, which is why 768/1440 show a slightly smaller client width than the emulated viewport — this is normal and not overflow, since scrollWidth and clientWidth are equal at every size, which is the actual pass condition.)

**Select widths** (`getBoundingClientRect().width`), same live page:

| Viewport | Payment-status select | Supplier select |
|---|---:|---:|
| 390px (mobile, full-width) | 342px | 342px |
| 768px | 192px | 220px (capped) |
| 1440px | 192px | 220px (capped) |

**Table scroll behavior preserved:** at every measured width, the expenses table's wrapper `<div>` computed `overflow-x: auto`, with `table.scrollWidth = 1312` consistently exceeding the wrapper's own `clientWidth` (340 / 703 / 1150 at the three widths respectively) — the table still scrolls internally exactly as before, unaffected by this fix.

**Supplier select is functional with real data:** the live page's supplier `<select>` has **280 options** (279 real suppliers + the "Tüm tedarikçiler" default), first real option text `"3DCİM 3 BOYUTLU ENDÜSTRİYEL BASKI ÇÖZÜMLERİ LİMİTED ŞİRKETİ"` — a genuine synced supplier name, not a placeholder.

## Data counts — unchanged, verified live

| Check | Value |
|---|---:|
| Purchase bills active | 810 |
| Purchase bills archived | 1 |
| Purchase bills total | 811 |
| Suppliers total (`parasut_suppliers_demo`) | 279 |
| Suppliers with `account_type = 'supplier'` | 279 |
| Suppliers with `account_type <> 'supplier'` | **0** |

All identical to Phase 4's figures — this phase changed only view columns and frontend layout, never any data or sync logic, so no count could have changed, and none did.

## Deploy results

- `supabase db push` → migration applied on the first attempt (9/9 migrations now match local/remote).
- `npm run build:demo` → success (two builds: the `flex-1` regression build was built and measured but never left as the final deploy; the corrected `w-full`/`sm:w-auto` build is what's live now).
- FTP deploy (`scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo`, `MSYS_NO_PATHCONV=1`, dry-run confirmed the correct remote path first): **29/29 files uploaded**, twice (once for the regression build during investigation, once for the final corrected build) — the live site now serves the corrected build, confirmed by its bundle hash matching the latest local build.
- Live routes: `/` → 200, `/giderler` → 200.

## Test / lint / build / tsc

- `npm test` → 1/1 passed.
- `npm run lint` → 0 errors, 10 pre-existing warnings (unchanged from every prior phase).
- `npm run build:demo` → success.
- `tsc --noEmit -p tsconfig.app.json` → same single pre-existing, unrelated error: `src/pages/Login.tsx:55` — not touched, **not reported as PASS**.

## Changed files (this phase)

Modified: `src/pages/Giderler.tsx`
Added: `supabase/migrations/20260826060000_parasut_suppliers_demo_account_type.sql`, `reports/PHASE_04_1_MOBILE_SUPPLIER_FIX_REPORT.md`
Not touched (user's own, pre-existing, and out of this bugfix's scope per the task's own instruction): `vite.config.ts`, `src/pages/Login.tsx`, `AUDIT_REPORT.md`, every other page/route from Phases 1–4
Deployed (not committed, build output): `dist/demo/**` → uploaded via FTP

Local Docker was not attempted this phase (a small, view-only + CSS fix; no new sync logic to test against a database, so a Docker-dependent local Supabase run would not have added verification value beyond what the hosted REST checks and the real headless-browser render already provided).

---

## Sonuç Özeti

| Kontrol | Beklenen | Gerçekleşen | Sonuç | Sorun/Kök Neden |
|---|---:|---:|---|---|
| /giderler HTTP durumu | 200 | 200 | PASS | — |
| 390px document scrollWidth vs clientWidth | scrollWidth ≤ clientWidth | 390 ≤ 390 | PASS | İlk deneme (flex-1) 392 vs 390 vererek FAIL idi; select genişliği düzeltmesiyle çözüldü |
| 768px document scrollWidth vs clientWidth | scrollWidth ≤ clientWidth | 753 ≤ 753 | PASS | — |
| Select genişliği (mobil) | okunabilir, tam genişlik | 342px (tam genişlik) | PASS | İlk denemede 24-26px'e küçülmüştü, düzeltildi |
| Select genişliği (masaüstü) | önceki görünümle tutarlı, taşma yok | 192px / 220px (220px tavan) | PASS | — |
| Tablo kendi overflow-x:auto davranışı | korunmalı | Korundu: wrapper `overflow-x:auto`, table scrollWidth 1312 > wrapper clientWidth her genişlikte | PASS | — |
| Aktif/arşivli/toplam gider sayısı | 810/1/811 (değişmemeli) | 810/1/811 | PASS | — |
| Tedarikçi filtresi çalışıyor mu | gerçek verilerle dolu, seçilebilir | 280 seçenek (279 gerçek + varsayılan), gerçek isimlerle | PASS | — |
| `parasut_suppliers_demo.account_type` | yeni migration ile eklenmiş, döndürülüyor | Doğrulandı, her satırda `"supplier"` | PASS | — |
| `account_type='supplier'` sayısı | tedarikçi toplamıyla aynı | 279 | PASS | — |
| `account_type!='supplier'` sayısı | 0 | 0 | PASS | — |
| Migration deploy | hosted uygulanmış | 9/9 migration local=remote | PASS | — |
| Frontend deploy | canlı bundle güncel, doğru sürüm | Düzeltilmiş build canlıda (regresyon build'i hiç "tamamlandı" olarak raporlanmadı) | PASS | İlk build'te gerçek bir regresyon vardı, deploy edilip ölçülüp düzeltildikten sonra tekrar deploy edildi |
| npm test | başarılı | 1/1 | PASS | — |
| npm run lint | 0 hata | 0 hata, 10 önceden var olan uyarı | PASS | — |
| npm run build:demo | başarılı | Başarılı | PASS | — |
| TypeScript kontrolü | 0 hata | 1 hata (`Login.tsx:55`) | **FAIL — pre-existing unrelated error** | Faz 1.1'den beri aynı, Login'e dokunulmadı |
| Git commit/push | remote main güncel | `83ab326`, `f7006f6..83ab326 main -> main` başarılı | PASS | — |

## FAIL ve BLOCKED Maddeler

### TypeScript kontrolü (`tsc --noEmit`)
- Durum: FAIL
- Hata mesajı: `src/pages/Login.tsx(55,17): error TS2322: Type '{ variant: string; }' is not assignable to type 'IntrinsicAttributes & LogoProps'.`
- Kesin kök neden: `Login.tsx`'in önceden var olan, kullanıcının kendi tip hatası.
- Bu fazdan mı kaynaklandı, önceden mi vardı: Önceden vardı (Faz 1.1'den beri her raporda aynı şekilde işaretlendi); bu faz `Login.tsx`'e hiç dokunmadı.
- Canlı sistemi etkiliyor mu: Hayır — `npm run build:demo` bunu durdurmadan geçiyor, canlı build başarıyla tamamlandı ve deploy edildi.
- Yapılan denemeler: Yok — "Login ile ilgilenme" ve "ilgisiz dosyalara dokunma" talimatları gereği dokunulmadı.
- Düzeltilmesi için gereken işlem: `LogoProps`'a `variant` eklenmesi (kullanıcının kendi işi, bu fazın kapsamı dışında).
- Sonraki faza bırakıldıysa nedeni: Kapsam dışı.

Not: İlk `flex-1` denemesi (390px'te scrollWidth 392 vs clientWidth 390, select genişliği 24-26px) bu oturum içinde tespit edilip, canlıya "tamamlandı" olarak raporlanmadan önce düzeltildi ve yeniden ölçüldü — ayrı bir FAIL maddesi olarak değil, yukarıdaki "İlk deneme" notlarında şeffaf şekilde belgelendi.

## Genel Karar

**PASS**

(Bu küçük, odaklı bir hata düzeltme fazı olduğu için tek bilinen "sorun", bu fazın kapsamına hiç girmeyen, önceden var olan ve dokunulmaması istenen `Login.tsx` tip hatasıdır — canlı teslimi hiçbir şekilde etkilemiyor. Bu faza özgü hiçbir açık öğe kalmadı; bu yüzden "PASS WITH KNOWN ISSUES" değil düz "PASS".)

- **Mobil taşma düzeldi mi?** Evet — gerçek headless tarayıcı ölçümüyle doğrulandı: 390px'te scrollWidth=clientWidth=390, 768px'te scrollWidth=clientWidth=753, ikisinde de sıfır yatay taşma. (İlk düzeltme denemesi taşmayı gidermiş ama select'leri okunamaz hale getirmişti — bu da düzeltilip yeniden ölçüldü.)
- **Veri sayıları değişti mi?** Hayır — gider aktif/arşivli/toplam (810/1/811) ve tedarikçi toplamı (279) bu fazdan önce ve sonra birebir aynı; bu faz hiçbir sync mantığına veya tabloya dokunmadı, sadece bir view'a kolon ekledi ve CSS düzeltti.
- **Supplier tanımı doğrudan doğrulanabiliyor mu?** Evet — `parasut_suppliers_demo` artık `account_type` kolonunu döndürüyor ve her satırda gerçek değeri `"supplier"`; `account_type != 'supplier'` sayısı 0 olarak doğrulandı. Artık sadece koddaki WHERE filtresine güvenmek yerine, view'ın kendisinden doğrudan sorgulanabiliyor.
- **Claude Browser tekrar testine hazır mı?** Evet. Bu fazda ilk kez, bu oturumun kendisi self-signed sertifikayı (`--ignore-certificate-errors` ile, sadece kendi testi için) aşıp gerçek bir tarayıcıyla canlı sayfayı ölçtü — dolayısıyla mobil taşma iddiası artık çıkarım değil, gerçek ölçüm. Sertifika sorunu Claude Browser gibi normal bir tarayıcı için hâlâ geçerli olabilir (güven uyarısı/bypass gerektirebilir), ama bu, bu fazın kapsamındaki asıl hatanın (mobil taşma) gerçekten düzeldiğinin kanıtını değiştirmiyor.
