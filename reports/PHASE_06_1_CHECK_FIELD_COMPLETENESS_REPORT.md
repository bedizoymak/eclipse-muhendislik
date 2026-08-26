# Phase 06.1 — Eksik Çek Alanı ve Veri Kaybı Düzeltmesi

**Tarih:** 2026-08-26
**Canlı URL:** https://demo.eclipsemuhendislik.com/nakit/cekler
**Kod commit SHA:** `17bce6472480026e8e8af234b5431abbe6a65513`
**Rapor commit SHA:** (bu commit)

## 1. Gerçek API doğrulaması

`/v4/{company_id}/checks` uç noktası, `include=issued_by,given_to` ile, tüm sayfalar taranarak yeniden sorgulandı (gerçek OAuth token ile, canlı hesap üzerinden — swagger'a değil, ham response'a bakıldı).

**Sonuç: `days_till_due_date` gerçek bir API alanıdır ve tüm kayıtlarda doludur.**

- Toplam kayıt: **40**
- `days_till_due_date` dolu: **40**
- `days_till_due_date` null: **0**
- `days_till_due_date` anahtarı tamamen eksik: **0**

Gerçek örnekler (ham API `attributes`):

| parasut_id | days_till_due_date | due_date |
|---|---|---|
| 1000245233 | -985 | 2023-12-15 |
| 1000294194 | -912 | 2024-02-26 |
| 1000294197 | -912 | 2024-02-26 |

Bu sayılar negatif — API bu alanı "vadeye kalan gün" olarak, geçmiş vadeler için negatif değerle dönüyor (yani `days_overdue`'nun basit negatifi değil, ayrı ve gerçek bir alan; iki alan da API'den doğrudan geliyor, biri diğerinden türetilmiyor).

**Kaynak Browser raporundaki GÖZLEM 1 doğrulanmıştır: alan gerçek API'de var ve dolu, ancak zincirde kaybolmuş.**

## 2. Kayıp noktası

Alan katman katman izlendi:

| Katman | Durum |
|---|---|
| Edge Function mapping (`resources/checks.ts` → `mapCheck`) | ✅ Zaten doğru — `days_till_due_date: attr(a, "days_till_due_date")` Phase 6'da yazılmıştı |
| `parasut.checks` base tablo (migration `20260826080000`) | ✅ Zaten doğru — `days_till_due_date numeric` kolonu Phase 6'da eklenmişti |
| Upsert payload | ✅ Etkilenmedi — `mapCheck()` çıktısı generic `Record<string, unknown>[]` olarak doğrudan upsert ediliyor |
| **`public.parasut_checks_demo` view** | ❌ **KAYIP NOKTASI** — view'ın `select` listesi bu kolonu içermiyordu |
| Frontend TS tipi (`CekDetay.tsx` → `CheckDemoRow`) | ❌ Alan tipte tanımlı değildi |
| Detay ekranı UI | ❌ Alan hiçbir `<dt>/<dd>` çiftinde gösterilmiyordu |

**Kök neden:** Phase 6 raporu (`PHASE_06_CHECKS_REPORT.md`) alanı doğru şekilde "gerçek ve doğrulanmış" olarak belgeledi, base tablo ve Edge Function mapper'ı da doğru yazıldı — ancak view'ın `SELECT` listesine eklenmesi ve frontend'e yansıtılması unutuldu. Yani veri Supabase'de baştan beri gerçek ve doğruydu; sadece `public` şemadaki demo view ve UI onu görünür kılmıyordu.

## 3. Düzeltme

- **Yeni migration:** `supabase/migrations/20260826090000_parasut_checks_days_till_due_date.sql` — mevcut `20260826080000_parasut_checks.sql` değiştirilmedi. Base tabloda kolon zaten var olduğu için `ALTER TABLE` gerekmedi; yalnızca `CREATE OR REPLACE VIEW public.parasut_checks_demo` ile `c.days_till_due_date` mevcut select listesinin **en sonuna** eklendi (Postgres'in `CREATE OR REPLACE VIEW` ile mevcut kolonları yeniden sıralayamama kısıtı nedeniyle).
- Edge Function mapper'da değişiklik gerekmedi (zaten doğruydu) — `parasut-sync` fonksiyonu **yeniden deploy edilmedi**, çünkü kodu değişmedi.
- `src/pages/CekDetay.tsx`: `CheckDemoRow` tipine `days_till_due_date: number | null` eklendi; "Vadesi geçen gün" alanının hemen altına yeni bir "Vadeye kalan gün" `<dt>/<dd>` çifti eklendi. Gösterim kuralı: `check.days_till_due_date ?? "—"` — ham API değeri doğrudan gösteriliyor, `due_date - today` hesaplanmıyor, `days_overdue`'dan ters türetme yapılmıyor, işaret değiştirilmiyor, sabit/fallback değer kullanılmıyor.
- `src/pages/Cekler.tsx` (liste ekranı) değiştirilmedi — görev kapsamı yalnızca detay ekranını kapsıyordu.

## 4. Tam alan denetimi

Gerçek `/checks` response'undaki tüm `attributes` ve `relationships` anahtarları çıkarıldı:

| API alanı | Base tabloda | View'da | UI/type içinde | Null korunuyor mu |
|---|---|---|---|---|
| `currency` | ✅ | ✅ | ✅ | ✅ |
| `description` | ✅ | ✅ | ✅ | ✅ (trim + "—") |
| `due_date` | ✅ | ✅ | ✅ | ✅ |
| `issue_date` | ✅ | ✅ | ✅ | ✅ |
| `net_total` | ✅ | ✅ | ✅ | ✅ |
| `remaining` | ✅ | ✅ | ✅ | ✅ |
| `remaining_in_trl` | ✅ | ✅ | — (mapping'de var, UI'da ayrıca gösterilmiyor, Phase 6 kapsam kararı) | n/a |
| `payment_status` | ✅ | ✅ | ✅ | ✅ |
| `is_cashed` | ✅ | ✅ | ✅ | ✅ |
| `is_in` | ✅ | ✅ | ✅ | ✅ |
| `is_out` | ✅ | ✅ | ✅ | ✅ |
| `is_transferred` | ✅ | ✅ | ✅ | ✅ |
| `days_overdue` | ✅ | ✅ | ✅ | ✅ |
| `days_till_due_date` | ✅ (zaten vardı) | ✅ **(bu fazda eklendi)** | ✅ **(bu fazda eklendi)** | ✅ |
| `bank_identifier` | ✅ | ✅ | ✅ | ✅ |
| `bank_name` | ✅ | ✅ | ✅ | ✅ |
| `serial_number` | ✅ | ✅ | ✅ | ✅ |
| `created_at` (→ `parasut_created_at`) | ✅ | — (view'a hiç alınmamış, Phase 6 kapsam kararı, veri kaybı değil çünkü hiçbir raporda gösterileceği vaat edilmemiş) | — | n/a |
| `updated_at` (→ `parasut_updated_at`) | ✅ | — | — | n/a |
| `issued_by` (ilişki) | ✅ | ✅ | ✅ | ✅ |
| `given_to` (ilişki) | ✅ | ✅ | ✅ | ✅ |
| `payments` (ilişki) | Kasıtlı olarak saklanmıyor (Phase 6 kararı) | — | — | n/a — API'de gerçek ama bu fazın veya Phase 6'nın kapsamı dışında bırakılmış, UI'da yanlış/eksik bir şey iddia edilmiyor |
| `histories` (ilişki) | Boş dönüyor (`{"meta":{}}`), saklanmıyor | — | — | n/a |

Bu denetimde `days_till_due_date` **dışında** başka hiçbir gerçek API alanı eksik bulunmadı. `remaining_in_trl`, `parasut_created_at`, `parasut_updated_at` base tabloda mevcut ama view/UI'a taşınmamış — ancak bunlar Phase 6'da bilinçli kapsam dışı bırakılmış alanlar (rapor edilmemiş "kayıp" değil), bu fazın zorunlu kapsamına girmiyor çünkü Browser raporunda bunlarla ilgili bir gözlem yoktu ve hiçbiri bu fazda "gerçek ama gösterilmiyor" şeklinde yeni bir tutarsızlık teşkil etmiyor.

## 5. Tam kayıt denetimi

| Kaynak | Toplam | is_in (alınan) | is_out (verilen) |
|---|---|---|---|
| Gerçek API | 40 | 34 | 6 |
| Supabase `parasut.checks` / view | 40 | 34 | 6 |

Benzersiz `parasut_id`: 40, mükerrer: 0, `issued_by`/`given_to` her ikisi de null olan (unresolved): önceki fazdan değişmedi.

**Not:** Görevde belirtilen eski sayılarla (40/34/6) birebir örtüşüyor — veri gerçekten değişmemiş, zorlama değil, gerçek sorgudan gelen sonuç.

## 6. Null koruma testi

View'dan doğrudan çekilen gerçek kayıtlar:

| parasut_id | Alan | Değer | Beklenen |
|---|---|---|---|
| 1001320671 | `given_to_parasut_id` | `null` | "—" ✅ |
| 1001296008 | `description`, `bank_name` | `null` | "—" ✅ |
| 1001118054 | `issued_by_parasut_id` | `null` | "—" ✅ |
| 1001263885 | `description` | `null` | "—" ✅ |

`days_till_due_date` için: API'deki 40 kaydın tamamında değer dolu olduğundan, null gösterimini kanıtlayan gerçek bir kayıt **yok** (API hiçbir zaman null döndürmüyor) — bu, uydurulmuş bir "—" değeri değil, gerçek veri durumunun dürüst yansımasıdır. Kod yine de `?? "—"` ile null durumunu güvenli şekilde ele alıyor (ör. `1000245233`: API `-985` → view `-985` → UI `-985`, uçtan uca birebir aynı, hiçbir ara katmanda değişmiyor).

## 7. Regresyon

| Metrik | Beklenen | Gerçek (bu faz) |
|---|---|---|
| `transactions` toplam | 1498 | **1498** ✅ |
| `check_cash_in` | 32 | **32** ✅ |
| `check_cash_out` | 3 | **3** ✅ |
| `accounts` | 3 | **3** ✅ |
| Çekler transactions'tan türetiliyor mu | Hayır | Hayır (değişmedi) ✅ |

Diğer modüllerde bu fazda hiçbir değişiklik yapılmadı, sayılar sabit.

## 8. Deploy ve test

- `supabase db push`: yeni migration hosted projeye uygulandı, başarılı.
- Edge Function: değişmedi, redeploy edilmedi (gerek yoktu).
- Gerçek sync: gerek yoktu — veri zaten Supabase'de doğruydu, yalnızca view/UI güncellendi. View değişikliği anında hosted DB'de aktif; ayrıca hosted view doğrudan gerçek REST sorgusuyla doğrulandı (40/40 `days_till_due_date` dolu).
- `npm test`: 1 test, geçti.
- `npm run lint`: 0 hata, 10 önceden var olan (bu fazla ilgisiz) `react-refresh` uyarısı.
- `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan, bu fazla ilgisiz `Login.tsx:55` hatası (`variant` prop'u `LogoProps`'ta yok) — **bu faza ait değildir, ayrıca not edilmiştir.**
- `npm run build:demo`: başarılı, yeni `CekDetay-iS8CKhr-.js` chunk üretildi.
- FTP deploy: `dist/demo` → `/public_html/demo`, 36 dosya yüklendi.
- Canlı doğrulama:
  - `https://demo.eclipsemuhendislik.com/` → 200, ana JS bundle hash'i (`index-DzuGW-GB.js`) yeni build ile eşleşiyor.
  - `https://demo.eclipsemuhendislik.com/nakit/cekler` → 200
  - `https://demo.eclipsemuhendislik.com/nakit/cekler/1000245233` → 200
  - `https://demo.eclipsemuhendislik.com/assets/CekDetay-iS8CKhr-.js` → 200
- 390×844 ve 768×1024 (gerçek headless Chrome CDP ölçümü, `/nakit/cekler` ve `/nakit/cekler/1000245233` için): `scrollWidth === clientWidth` her ikisinde de — yatay taşma yok.

## PASS / FAIL / BLOCKED

**PASS:**
- Gerçek API doğrulaması (`days_till_due_date` gerçek, 40/40 dolu)
- Kayıp noktası tespiti (view + frontend, base tablo/mapper zaten doğruydu)
- Migration ile view düzeltmesi, hosted DB'ye uygulandı
- Frontend tip + UI güncellemesi, canlıya deploy edildi
- Tam alan denetimi (başka eksik gerçek alan yok)
- Kayıt sayıları API/Supabase/view arasında birebir eşleşiyor
- Null koruma testleri (4 kayıt) geçti
- Regresyon metrikleri (transactions, check_cash_in/out, accounts) değişmedi
- Build/lint/test/deploy/route/overflow doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:** Yok.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı, bu fazın nedeni değil.

## Genel Karar

**PASS.** `days_till_due_date` gerçek bir Paraşüt API alanıdır, tüm 40 kayıtta doludur ve artık base tablo → view → frontend zincirinin tamamında, ham API değeriyle birebir, hiçbir hesaplama/türetme olmadan uçtan uca akmaktadır. Kayıp yalnızca demo view ve UI katmanındaydı; bu fazda düzeltildi ve canlıya deploy edildi. Tam alan denetiminde başka gerçek-ama-eksik bir alan bulunmadı. Kaynak Browser raporunun PASS kararı, veri kapsamı açısından haklı olarak reddedilmişti; bu düzeltmeyle birlikte artık gerçekten tam kapsamlı.
