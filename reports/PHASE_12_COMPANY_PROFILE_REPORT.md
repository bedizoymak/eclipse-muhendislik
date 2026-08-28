# Phase 12 — Şirket Profili ve /v4/me Verisi

**Tarih:** 2026-08-28
**Kapsam:** Paraşüt `GET /v4/me` uç noktasının tam envanteri; gerçek şirket profili, kullanıcı-şirket ilişkisi ve şirketin adresinin Parasut API → Supabase (private/base/raw → public view) → frontend zincirine uçtan uca bağlanması.

## 0. Önceki bulgu ile karşılaştırma (Phase 8.0 baseline)

| Kontrol | Phase 8.0 bulgusu | Bu fazda gerçek yeniden doğrulama |
|---|---|---|
| `GET /v4/me` | 200, kullanıcı 800086 | 200, aynı kullanıcı 800086 (iki ardışık çağrıda birebir aynı) |
| `GET /v4/companies` | 404 | **200** — gerçek `data:[{id:"666034",type:"companies",attributes:{name,app_url}}]`. Farklılık zorlanmadı, canlı olarak yeniden doğrulandı; `PARASUT_COMPANY_ID` ile aynı id. |
| `GET /v4/{company_id}` | 404 | 404 (değişmedi) |
| `contacts?include=addresses` | 400 | Bu fazın kapsamı dışında, tekrar denenmedi |

## 1. `/v4/me` tam envanteri

Kök kaynak: `id:"800086", type:"users"`. İki ardışık çağrı birebir aynı gövdeyi döndürdü (stabil).

| API yolu | Bulunan | Dolu | Null | Boş | Veri tipi | Kaynak tipi |
|---|---|---|---|---|---|---|
| `data.id` | ✔ | ✔ | | | string (numeric) | root |
| `data.type` | ✔ | ✔ | | | "users" | root |
| `attributes.created_at` | ✔ | ✔ | | | ISO8601 | root |
| `attributes.updated_at` | ✔ | ✔ | | | ISO8601 | root |
| `attributes.email` | ✔ | ✔ | | | string | root |
| `attributes.unconfirmed_email` | ✔ | | ✔ | | null | root |
| `attributes.name` | ✔ | ✔ | | | string | root |
| `attributes.approved_contracts` | ✔ | ✔(true) | | | boolean | root |
| `attributes.approved_new_contracts` | ✔ | ✔(true) | | | boolean | root |
| `attributes.integration_contract_statuses` | ✔ | ✔ | | | object `{ai_supported_modules:true}` | root |
| `attributes.keycloak_tfa_enabled` | ✔ | ✔(false) | | | boolean | root |
| `attributes.keycloak_email_otp_enabled` | ✔ | ✔(false) | | | boolean | root |
| `attributes.is_confirmed` | ✔ | ✔(true) | | | boolean | root |
| `relationships.user_roles.data[]` | ✔ | 1 öğe | | | array | root |
| `relationships.profile.data` | ✔ | ✔ | | | object | root |
| `meta.created_at/updated_at` | ✔ | ✔ | | | ISO8601 | root |
| included `user_roles` (875199) — `sales_invoices/expenditures/own_expenditures/employees/accounts/settings` | ✔ | ✔ | | | string enum (rw/na) | included |
| included `user_roles.user_role_type` | ✔ | | ✔ | | null | included |
| included `user_roles.relationships.company.data` | ✔ | ✔ `{id:"666034",type:"companies"}` | | | object | included |
| included `companies` (666034) — 60+ attribute anahtarı | ✔ | çoğu dolu | bazıları null (`mersis_no`, `trade_registry_number`, `used_app`, `operator_id`, `employee_id`, `allowed_inspection_at`, `e_smm_*`, `e_archiving_only_*`) | | karışık | included |
| included `companies.relationships.address.data` | ✔ | ✔ `{id:"295028",type:"addresses"}` | | | object | included |
| included `companies.relationships.owner.data` | ✔ | ✔ `{id:"800086",type:"users"}` | | | object | included |
| included `companies.relationships.operator.data` | ✔ | | ✔ | | null | included |
| included `companies.relationships.default_warehouse/pos` | ✔ | | | ✔ `{meta:{}}` | boş ilişki | included |
| included `addresses` (295028) — `name/address/phone/fax` | ✔ | `address`,`phone` dolu | `name`,`fax` null | | string | included |
| included `profiles` (801196) — `phone/job_title/settings/avatar` | ✔ | `phone`,`settings` dolu | `job_title`, `avatar.url` null | | karışık | included |

Toplam: tam 1 kullanıcı, 1 user_role, 1 şirket, 1 adres, 1 profil — hiçbir yinelenme, hiçbir sayfalama yok.

## 2. Uç nokta davranışı

| İstek | Sonuç |
|---|---|
| `GET /v4/me` | 200, stabil (2 ardışık çağrı) |
| `GET /v4/companies` | 200 (Phase 8.0'dan farklı — canlı olarak doğrulandı, zorlanmadı) |
| `GET /v4/{company_id}` | 404 "No route matches." |
| `GET /v4/me?include=bogus_relation` | 200, include sessizce yok sayılıyor (hata yok, aynı gövde) |
| `GET /v4/me?include=company` | 200, `company` `/v4/me` üzerinde geçerli bir direkt include değil — sessizce yok sayılıyor |

`/v4/me`'de gerçek bir "aktif şirket / seçili şirket" kavramı **yok** — tek şirket zaten included içinde geliyor, seçim alanı yok.

## 3. Kullanıcı–şirket ilişkisi

- Kullanıcı: `id 800086, type users`
- Şirket: `id 666034, type companies` (bu id **URL'deki `PARASUT_COMPANY_ID`'den değil**, `user_roles.relationships.company.data`'dan alındı)
- Bu kullanıcı tam olarak **1** şirkete bağlı (1 user_role kaydı)
- Aynı şirket dokümanda **1 kez** geçiyor (yinelenme yok)
- İlişki nesnesi: `id 875199, type user_roles`
- Included şirket, ilişkinin id/type'ı ile birebir eşleşiyor (mismatch yok, unresolved yok)
- Gerçek "aktif/seçili şirket" alanı **yok** — tek kayıt olduğu için sıra varsayımı yapılmadı

Sync fonksiyonu bu sayaçları döndürüyor: `unique_company_count:1, duplicate_company_link_count:0, unresolved_company_count:0, type_mismatch_count:0` (gerçek canlı sync çıktısı, aşağıya bakınız).

## 4. Şirket alan envanteri (özet — tam liste `extra_flags` dahil UI'da)

| API alanı | Base | Raw | View adayı | UI güvenliği | Gerçek değer |
|---|---|---|---|---|---|
| name | ✔ kolon | ✔ | ✔ | public | "CEHA-Dişli Sanayi" |
| legal_name | ✔ kolon | ✔ | ✔ | public | "HAYRETTİN DAYAN" |
| tax_office/tax_number | ✔ kolon | ✔ | ✔ | public | gerçek değer |
| mersis_no | ✔ kolon | ✔ | ✔ | public | null (korunuyor) |
| trade_registry_number | ✔ kolon (bu faz eklendi) | ✔ | ✔ | public | null |
| district/city | ✔ kolon | ✔ | ✔ | public | Başakşehir/İstanbul |
| occupation_field/primary_job | ✔ kolon | ✔ | ✔ | public | Üretim/Yok |
| logo_url | ✔ kolon (bu faz eklendi) | ✔ | ✔ | public | gerçek S3 URL |
| credit_balance | ✔ kolon (bu faz eklendi) | ✔ | ✔ | public | 31 (dinamik) |
| new_subscription_status | ✔ kolon (bu faz eklendi) | ✔ | ✔ | public | "active" |
| e_invoicing/e_archiving/e_despatch/e_commerce_enabled | ✔ kolon (bu faz) | ✔ | ✔ | public | true/true/true/true |
| owner (relationship) | ✔ kolon `owner_parasut_id` | ✔ | ✔ | public (id/type) | 800086/users |
| address (relationship) | ✔ kolon `address_parasut_id` | ✔ | ✔ | public (id/type) | 295028/addresses |
| kalan 30+ bank_sync_setup_*/feature flag | `extra_flags` jsonb kolonu | ✔ | ✔ (jsonb) | public (jsonb) | gerçek değerler, hiçbiri raw'da tek başına kalmıyor |

Görünür hiçbir alan API'de olmayan bir bilgi içermiyor; hiçbir gerçek güvenli alan sadece raw'da bırakılmadı (bank_sync_* bayrakları `extra_flags` ile view'a taşındı ve "Tüm şirket alanlarını göster" panelinde render ediliyor).

## 5. Kullanıcı verisi güvenlik sınıflandırması

| Alan | Karar | Gerekçe |
|---|---|---|
| name, email | **public** (Paraşüt Kullanıcısı bölümü) | gerçek, güvenli, iş anlamlı |
| unconfirmed_email | private/base only | hesap doğrulama durumu |
| is_confirmed | private/base only | hesap durumu |
| approved_contracts, approved_new_contracts | private/base only | yasal onay durumu |
| integration_contract_statuses | private/base only | hesap ayarı |
| **keycloak_tfa_enabled** | **asla public değil** | 2FA güvenlik ayarı — açığa çıkarsa saldırıya yardımcı olabilir |
| **keycloak_email_otp_enabled** | **asla public değil** | OTP güvenlik ayarı |
| user_roles.{sales_invoices,expenditures,own_expenditures,employees,accounts,settings} | **asla public değil** | gerçek Paraşüt **izin (permission) değerleri** — sadece `parasut.user_roles` özel tablosunda, sadece id/type public'e taşındı |
| profiles.phone | public | gerçek, güvenli, iş anlamlı |
| profiles.job_title | private (null bugün) | |
| profiles.settings (`is_app_navigation_collapsed`) | private | UI tercihi, şirket/iş verisi değil |
| profiles.avatar | private | null bugün, iş anlamı yok |

Hiçbir OAuth access/refresh token, parola/hash veya API credential `/v4/me` gövdesinde **bulunmuyor** — bu nedenle hiçbiri hiçbir tabloya/view'a yazılmadı.

## 6. Adres kök-neden incelemesi

- Var olan `parasut.addresses` satırı: `parasut_id 295028`, `address`/`phone` alanları canlı `/v4/me` yanıtındaki adresle **birebir aynı** (metin, telefon, `parasut_created_at`/`parasut_updated_at`).
- Tek eksik: `addressable_type`/`addressable_parasut_id` her ikisi de **NULL**'dı (eski script bu bağlantıyı hiç kurmamış).
- Bu fazda: adres **gerçek ve güncel** olduğu doğrulandı — stale değil. Şirket-isim/adres benzerliğiyle eşleştirme yapılmadı; bağlantı sadece `companies.relationships.address.data`'dan (id 295028, type addresses) kuruldu.
- Sync çalıştırıldıktan sonra doğrulama: `addressable_type='companies', addressable_parasut_id=666034` — gerçek ilişkiden yazıldı.
- Sonuç: **WIRED** (tüm alanları base/raw/view/UI'a bağlandı), BLOCKED değil.

## 7. Supabase modeli (yeni migration)

`supabase/migrations/20260829040000_parasut_me_company_profile.sql` (yeni migration, eskiler değiştirilmedi):
- `parasut.companies`'e 22 yeni gerçek kolon + `extra_flags` jsonb
- Yeni özel tablolar: `parasut.users`, `parasut.profiles`, `parasut.user_roles` (permission değerleri dahil — hiçbiri public değil)
- Yeni public view'lar: `public.parasut_company_profile_demo`, `public.parasut_user_company_relation_demo`

## 8. Sync (Edge Function)

`supabase/functions/parasut-sync/resources/me.ts` + `index.ts`'e `syncMe` eklendi (`resource:"me"`). `/v4/me` company_id'ye bağlı olmayan tek endpoint olduğu için `fetchMe()` adında ayrı, sayfalanmayan bir client fonksiyonu eklendi (`parasut_client.ts`).

Gerçek dry-run sonucu:
```
{"resource":"me","dry_run":true,"status":"dry_run","user_id":"800086","unique_company_count":1,"duplicate_company_link_count":0,"unresolved_company_count":0,"type_mismatch_count":0,"error_count":0}
```

İki ardışık gerçek sync (aynı sonuç):
```
SYNC1 {"status":"success","user_upserted_count":1,"profile_upserted_count":1,"user_role_upserted_count":1,"company_upserted_count":1,"address_upserted_count":1,"unique_company_count":1,"duplicate_company_link_count":0,"unresolved_company_count":0,"type_mismatch_count":0,"error_count":0}
SYNC2 {"status":"success","user_upserted_count":1,"profile_upserted_count":1,"user_role_upserted_count":1,"company_upserted_count":1,"address_upserted_count":1,"unique_company_count":1,"duplicate_company_link_count":0,"unresolved_company_count":0,"type_mismatch_count":0,"error_count":0}
```

## 9. Frontend

Repo'da mevcut hiçbir `/ayarlar/*` rotası bulunmadığından (App.tsx içinde grep ile doğrulandı), spesifikasyonun ikinci tercihi uygulandı: **`/sirket-bilgileri`**.

Sayfa (`src/pages/SirketBilgileri.tsx`): şirket Parasut ID/type, tüm gerçek+güvenli şirket alanları, kullanıcı–şirket ilişki id/type, ayrı "Paraşüt Kullanıcısı" bölümü, UTC created/updated, null → "—", false → "Hayır", "Tüm şirket alanlarını göster" genişletilebilir panel (extra_flags dahil hiçbir alan sadece raw'da kalmıyor).

## 10. Tam alan denetimi

**Şirket:**

| API | Base | Raw | View | TS type | UI | Null korunuyor |
|---|---|---|---|---|---|---|
| name, legal_name, tax_office, tax_number, district, city, occupation_field, primary_job, logo_url, credit_balance, new_subscription_status, valid_until, e_*_enabled (4), e_*_activated_at (3), sales_offer_enabled, export_invoice_enabled, using_multiple_warehouses, using_variant, uses_credit_service, credit_service_enabled, can_use_ai_reporting, can_use_ai_support, accessible, inspectable, inventory_enabled, has_iyzico_integration, mersis_no, trade_registry_number | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (null → "—") |
| 30+ bank_sync_setup_* / diğer bayraklar | `extra_flags` jsonb | ✔ | ✔ (jsonb) | `Record<string,unknown>` | ✔ (genişletilebilir panel) | ✔ |

**Kullanıcı–şirket ilişkisi:**

| API yolu | Base | Raw | View | TS type | UI/güvenlik kararı |
|---|---|---|---|---|---|
| users.name/email | ✔ | ✔ | ✔ | string\|null | public |
| profiles.phone | ✔ | ✔ | ✔ | string\|null | public |
| user_roles.id/type→company | ✔ | ✔ | ✔ | number/string | public (sadece pointer) |
| user_roles.{sales_invoices,...} | ✔ (private) | ✔ | ✗ | — | **private only** |
| users.keycloak_* | ✔ (private) | ✔ | ✗ | — | **private only, güvenlik** |

**Adres:**

| API/DB kaynağı | Güncel doğrulama | Parent | UI kararı | Sonuç |
|---|---|---|---|---|
| `parasut.addresses` (295028) | ✔ `/v4/me` ile birebir eşleşti | companies/666034 | ✔ gösteriliyor | WIRED (stale değil) |

## 11. Regresyon (gerçek canlı sorgular)

| Kaynak | Beklenen | Gerçek | Durum |
|---|---|---|---|
| contacts | 448 | 448 | ✔ |
| contact_people | 2 | 2 | ✔ |
| employees | 6 | 6 | ✔ |
| salaries | 0 | 0 | ✔ |
| shipment_documents | 15 | 15 | ✔ |
| stock_movements (toplam) | 3330 | 3330 | ✔ |
| shipment_document_activities | 52 | 52 | ✔ |
| products | 2597 | 2597 | ✔ |
| sales_invoices | 451 | 451 | ✔ |
| purchase_bills | 811 | 811 | ✔ |
| e_invoices | 1238 | 1238 | ✔ |
| e_archives | 24 | 24 | ✔ |
| checks | 40 | 40 | ✔ |
| payments | 1651 | 1651 | ✔ |
| transactions | 1498 | 1498 | ✔ |
| accounts | 3 | 3 | ✔ |
| sales_offers/details/activities | 1/1/2 | 1/1/2 | ✔ |
| **users (yeni)** | — | 1 | ✔ |
| **profiles (yeni)** | — | 1 | ✔ |
| **user_roles (yeni)** | — | 1 | ✔ |
| **companies** | 1 | 1 | ✔ |
| **addresses** | 1 | 1 | ✔ |

Duplicate/unresolved/mismatch/error: hepsi 0.

## 12. Deploy ve test

- Migration: `supabase db push` ile hosted Supabase'e uygulandı (ilk denemede eksik kolon `trade_registry_number` nedeniyle 42703 hatası alındı, transaction geri sarıldı, düzeltilip başarıyla uygulandı).
- Edge Function: `supabase functions deploy parasut-sync --use-api` (Docker Desktop kullanılamadığı için API bundling ile).
- Dry-run + iki ardışık gerçek sync: yukarıda, birebir aynı sonuç.
- Frontend: `npm test` ✔ (1/1), `npm run lint` ✔ (0 hata, sadece önceden var olan uyarılar), `npm run build:demo` ✔, `npx tsc --noEmit -p tsconfig.app.json` → sadece bilinen önceden var olan `Login.tsx:55` hatası.
- **FTP deploy — önemli düzeltme:** İlk deploy denemesi Git Bash'in `/demo` yolunu `C:\Program Files\Git\demo` olarak yeniden yazması (path mangling) nedeniyle yanlış bir yere gitti; `MSYS_NO_PATHCONV=1` ile düzeltildi. Daha sonra keşfedildi ki gerçek canlı doküman kökü FTP'de `/public_html/demo`'dır, üst düzey `/demo` **kullanılmayan bir dizindir** (muhtemelen eski/paralel bir kopya, bu oturumda oluşturulmadı). Doğru hedefe (`/public_html/demo`, `--clean` ile) yeniden deploy edildi; canlı `index.html`'in bundle hash'i doğrulandı (`index-Ck02NgqS.js`) ve FTP üzerinden gerçek dosya listesiyle çapraz kontrol edildi. Yanlışlıkla oluşan `/C:/Program Files/...` dizini FTP sunucusunda kalıyor (silme işlemi izin sınıflandırıcısı tarafından engellendi) — sunulan hiçbir doküman kökünün parçası değil, zararsız.
- Headless Chrome (Puppeteer, gerçek canlı URL, 3 viewport: 1280px masaüstü, 390px mobil, 768px tablet): console error **0**, network failure **0**, DOM/JS/JSON gövdelerinde secret-pattern taraması (JWT, access_token, refresh_token, password, Bearer token) → **0 eşleşme**. "Tüm şirket alanlarını göster" paneli tıklanıp doğrulandı (gerçek alan tablosu render ediliyor).
- Canlı URL: `https://demo.eclipsemuhendislik.com/sirket-bilgileri` → HTTP 200, gerçek veri render ediliyor.

## 13. Doğrulama için gerçek ID'ler

- Kullanıcı: `800086` (Hayrettin Dayan)
- Şirket: `666034` (CEHA-Dişli Sanayi)
- Adres: `295028`
- User-role (ilişki): `875199`
- Profil: `801196`

## Sonuç

| Bölüm | Durum |
|---|---|
| /v4/me envanteri | PASS |
| Uç nokta davranışı | PASS |
| Kullanıcı-şirket ilişkisi | PASS |
| Şirket alan envanteri | PASS |
| Kullanıcı güvenlik sınıflandırması | PASS |
| Adres kök-neden | PASS (WIRED) |
| Supabase modeli | PASS |
| Sync | PASS |
| Frontend | PASS |
| Deploy/test | PASS |
| Regresyon | PASS |

**Genel PASS.** API'de olmayan hiçbir bilgi eklenmedi, hiçbir gerçek güvenli şirket alanı atlanmadı, hiçbir kullanıcı alanı şirket alanı gibi gösterilmedi, eski adres satırı tahminle eşleştirilmedi, hiçbir credential/özel veri açığa çıkmadı.

---

**Kod commit SHA:** (doldurulacak)
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri
