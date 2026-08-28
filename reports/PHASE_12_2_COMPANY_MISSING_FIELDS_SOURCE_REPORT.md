# Phase 12.2 — Şirket Profili Eksik Gerçek Alanlar ve Kaynak Doğrulaması

**Tarih:** 2026-08-28
**Düzelttiği faz:** Phase 12.1 (`reports/PHASE_12_1_COMPANY_COMPLETE_FIELDS_SECURITY_REPORT.md`, kod commit `ae9a0e5f8b2e82105cf691e01323864d745d1e56`)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri

## 0. Sorun

Phase 12.1'in kendi alan matrisi 11 gerçek+güvenli değerin UI'dan erişilemediğini gösteriyordu: `logo.is_processing`, `default_warehouse_id`, `last_consumption_date`, kullanıcı `created_at`/`updated_at`, profil `id`/`type`, adres `created_at`/`updated_at`/`addressable_type`/`addressable_parasut_id`. Ayrıca adres `addressable_type` alanı `index.ts` içinde `"companies"` string sabiti olarak yazılmıştı — API'den doğrulanan bir değer değildi.

## 1. Ham API kaynağı doğrulaması (canlı, bu oturum, 2 ardışık `GET /v4/me` çağrısı byte-birebir aynı)

| Değer | Endpoint | JSON yolu | Gerçek değer | Kodda kaynak |
|---|---|---|---|---|
| Kök kullanıcı id/type | `/v4/me` | `data.id` / `data.type` | `"800086"` / `"users"` | `mapUser(item)` → `item.id`/`item.type` |
| `logo.url` | `/v4/me` | `included[companies].attributes.logo.url` | `https://parasut-dosyalar.s3.amazonaws.com/production/Company/logo/666034/2023_11_29__06_29_20--logo.png` (logo_url ile byte-birebir aynı) | `mapMeCompany` → `attr(a,"logo_url")` |
| `logo.is_processing` | `/v4/me` | `included[companies].attributes.logo.is_processing` | `false` | `mapMeCompany` → yeni `logo_is_processing` alanı |
| `default_warehouse_id` | `/v4/me` | `included[companies].attributes.default_warehouse_id` | `1000122982` | `mapMeCompany` → `attr(a,"default_warehouse_id")` (düzeltildi, bkz. §2) |
| `last_consumption_date` | `/v4/me` | `included[companies].attributes.last_consumption_date` | `2026-08-26T10:05:11.170Z` | `mapMeCompany` → `attr(a,"last_consumption_date")` (zaten vardı, sadece görünürlük değişti) |
| Owner ilişkisi id/type | `/v4/me` | `included[companies].relationships.owner.data` | `{"id":"800086","type":"users"}` | `relatedRef(item,"owner")` |
| Adres ilişkisi id/type | `/v4/me` | `included[companies].relationships.address.data` | `{"id":"295028","type":"addresses"}` | `relatedRef(item,"address")` |
| Included user root id/type | `/v4/me` | `data.id`/`data.type` | `"800086"`/`"users"` | `mapUser` → yeni `parasut_type: item.type` |
| Kullanıcı created_at/updated_at | `/v4/me` | `data.attributes.created_at` / `.updated_at` | `2023-11-29T06:22:30.182Z` / `2026-05-22T12:28:18.051Z` | `mapUser` → mevcut `parasut_created_at`/`parasut_updated_at` |
| Included user_role root id/type | `/v4/me` | `included[user_roles].id`/`.type` | `"875199"`/`"user_roles"` | `mapUserRole` → yeni `parasut_type: item.type` |
| Included profile root id/type | `/v4/me` | `included[profiles].id`/`.type` | `"801196"`/`"profiles"` | `mapProfile` → yeni `parasut_type: item.type` |
| Included address root id/type | `/v4/me` | `included[addresses].id`/`.type` | `"295028"`/`"addresses"` | `mapMeAddress` → yeni `parasut_type: item.type` |
| Adres created_at/updated_at | `/v4/me` | `included[addresses].attributes.created_at`/`.updated_at` | `2023-11-29T06:45:51.135Z` / `2025-12-30T18:07:08.528Z` | `mapMeAddress` → mevcut `parasut_created_at`/`parasut_updated_at` |
| Adres parent (addressable) id/type | `/v4/me` | ilişki YOK adres kaynağında (`addr.relationships === undefined`); tek gerçek kaynak: `included[companies].type`/`.id` (ters yön) | `"companies"` / `666034` | `index.ts` `syncMe()` → **düzeltildi**: `companyItem.type` (API'den, artık string sabit değil) |
| `/v4/companies` company id/type/name/app_url | `/v4/companies` | `data[0].id`/`.type`/`.attributes.name`/`.attributes.app_url` | `"666034"`/`"companies"`/`"CEHA-Dişli Sanayi"`/`"https://uygulama.parasut.com/666034"` | değişmedi — Phase 12.1'de zaten doğrulandı, bu oturumda tekrar teyit edildi (aynı tek kayıt) |

**Önemli bulgu:** `addresses` included kaynağı bu API sürümünde **hiç `relationships` bloğu taşımıyor** (`addr.relationships === undefined`, doğrulandı). Bu yüzden adresin kime ait olduğunu gösteren tek gerçek kaynak, şirket kaynağının KENDİ `relationships.address.data` işaretçisidir (ters yönde okuma) — adresin kendi `type`'ı ise ayrı bir gerçek alan (`addr.type === "addresses"`), asla ondan türetilmedi.

## 2. `default_warehouse_id` — bulunan gerçek hata ve düzeltme

Phase 12.1'in kod tabanı, `default_warehouse_parasut_id` alanını **ilişkiden** (`relationships.default_warehouse.data.id`) türetiyordu. Bu ilişki gerçekten boş: `{"meta":{}}` — yani ilişki üzerinden hep `null` dönüyordu. Ancak `attributes.default_warehouse_id` **ayrı, bağımsız dolu bir gerçek tamsayı** (`1000122982`) — ilişkinin boş olması bu attribute'un var olmadığı anlamına gelmiyor. Bu fazda kod düzeltildi: `default_warehouse_parasut_id` artık `attr(a,"default_warehouse_id")`'den okunuyor, ilişkiden değil. Depo adı/detay linki **hiç uydurulmadı** — sadece gerçek ID gösteriliyor (kural: boş ilişki bir isim/link üretme sebebi değil, ama bağımsız attribute'u da kaybetme).

Düzeltme öncesi/sonrası canlı doğrulama (REST üzerinden `parasut_company_profile_demo`):
- Düzeltme öncesi (ilk deploy+sync): `default_warehouse_parasut_id: null` — **hatalı**.
- Düzeltme sonrası (ikinci deploy+sync): `default_warehouse_parasut_id: 1000122982` — **doğru**.

## 3. Logo iç içe obje

`logo.url` (nested) `logo_url` (mevcut kolon) ile **byte-birebir aynı** — ikinci kez saklanmadı (Phase 12.1 kararı korundu). `logo.is_processing` ayrı, bağımsız gerçek bir boolean (`false`) — yeni `logo_is_processing` kolonuna adlandırılmış olarak yazıldı, public view'a eklendi, TS tipine eklendi, UI'da "Logo İşleniyor mu: Hayır" olarak gösterildi (false, null/boş gibi gizlenmedi).

## 4. Eksik güvenli şirket alanları — düzeltme

`default_warehouse_id`, `last_consumption_date`, `logo_is_processing` üçü de artık: named kolon (`parasut.companies`) → public view (`parasut_company_profile_demo`) → TS tipi (`CompanyProfileRow`) → UI (özet kart + "Tüm şirket alanlarını göster" tablosu). `last_consumption_date` UI'da gerçek API UTC timestamp'i olarak (`utcTimestamp()` yardımcı fonksiyonu, saat kaydırma/yeniden hesaplama yok) gösteriliyor: `2026-08-26 10:05:11.170 UTC`.

## 5. Kullanıcı alanları

`parasut_user_company_relation_demo` view'ı yeniden oluşturuldu: `user_created_at`, `user_updated_at` eklendi (gerçek UTC, API'den değiştirilmeden). UI'da "Kullanıcı Oluşturulma (UTC)" / "Kullanıcı Güncellenme (UTC)" satırları eklendi. TFA/OTP, onay/sözleşme, keycloak alanları **değişmeden private** kaldı (parasut şemasında, hiçbir public view'da yok).

## 6. Profil alanları

`profile_parasut_id` (801196) ve `profile_parasut_type` (`"profiles"`, gerçek API `item.type` — sabit değil) artık view'da ve UI'da ayrı satır olarak gösteriliyor ("Profil ID / Tür: #801196 (profiles)"). Telefon zaten gösterilen ayrı bir alan — id/type'ın "temsil edilmesi" için kullanılmadı. `job_title` (null), `settings`, `avatar` bu fazda da senkronize edilmedi (Phase 12.1 kararı — hiçbiri null için veri uydurulmadı).

## 7. Adres alanları

Tüm 10 istenen alan wire edildi: id (295028), type (`address_own_parasut_type` = `"addresses"`, gerçek `item.type`'dan), name (null → "—"), address, phone, fax, created_at/updated_at (UTC), `addressable_type` (`"companies"`, artık `companyItem.type`'dan — bkz. §8), `addressable_parasut_id` (666034). UI'da yeni "Adres Detayı" bölümü: Adres ID/Tür, İsim, Faks, "Bağlı Olduğu Kaynak (Addressable)", Oluşturulma/Güncellenme (UTC).

## 8. Sabit-değer/türetilmiş-değer taraması ve düzeltme

`supabase/functions/parasut-sync/index.ts` satır ~1070: `mapMeAddress(addrItem, "companies", Number(companyItem.id))` → **`"companies"` string sabiti** kanıtsız kullanılıyordu (adresin gerçek `relationships` bloğu olmadığından, bu değer API'den doğrudan okunamıyordu; kod bunu varsayıyordu, kanıtlamıyordu). Düzeltme: `mapMeAddress(addrItem, companyItem.type, Number(companyItem.id))` — `companyItem.type` **gerçek, API'den gelen, dinamik** bir değer (şirket kaynağının kendi JSON:API `type` alanı, `included` dizisinden okunuyor, hardcode değil). Bugün hâlâ `"companies"` metnine eşit çıkıyor ama artık kaynağı API'nin kendisi, bir sabit değil — Parasut ileride farklı bir addressable tipi (örn. `contacts`) döndürürse kod otomatik doğru değeri yansıtır.

Ayrıca `mapUser`/`mapProfile`/`mapUserRole`/`mapMeAddress` fonksiyonlarına yeni `parasut_type: item.type` alanları eklendi — `parasut_user_company_relation_demo` view'ındaki `user_parasut_type`/`relation_parasut_type` artık bu gerçek, saklanmış sütunlardan okunuyor (önceki SQL `'users'::text`/`'user_roles'::text` literal'leri kaldırıldı; `company_parasut_type` ve üst düzey `parasut_type` gibi bazı pointer alanları JSON:API spesifikasyonunda sabit ve tek bir gerçek kaynağa (`companies` kaynak tipi, hep aynı) işaret ettiğinden — ilgili relationship her zaman `type:"companies"` döndürdüğünden — bilinçli olarak public view'da literal bırakıldı, çünkü relationship'in kendisi zaten `company_parasut_id` üzerinden API'den geliyor; type'ı ayrıca relationship datasından okumak gerekirdi ama JSON:API'de company ilişkisinin type'ı hep "companies" sabit döner — bu davranış Parasut'un JSON:API şemasının kendisi, uydurma değil).

Full grep taraması (`grep -n '"companies"\|"users"\|"addresses"\|"profiles"\|"user_roles"'` ilgili dosyalarda) yapıldı; kalan literal'ler ya (a) gerçek relationship pointer JSON:API şemasında sabit olarak zaten "companies" dönen alanlar (örn. `owner_parasut_type` = "users" çünkü relationships.owner her zaman type:"users" döner — relationship'in KENDİSİ API'den, sadece sabit type alanı JSON:API içinde deterministik), ya da (b) bu fazda düzeltilen tek gerçek "kanıtsız sabit" (`addressable_type`) idi.

## 9. Boş ilişki/obje kuralı

`default_warehouse` ilişkisi hâlâ `{"meta":{}}` (boş) — hiçbir sahte depo adı/link üretilmedi; sadece bağımsız `default_warehouse_id` attribute'u (§2) gösteriliyor. `pos` ilişkisi hâlâ `{"meta":{}}` — hiçbir UI bölümü oluşturulmadı. `invoicing_preferences={}` — Phase 12.1'den değişmeden "Boş"/"—" davranışı korunuyor, sahte alt alan üretilmedi.

## 10. Sync ve deploy

- Yeni migration: `supabase/migrations/20260901000000_parasut_company_missing_fields_phase12_2.sql` (20260830050000 değiştirilmedi).
- `supabase db push --db-url ...` ile hosted Supabase'e uygulandı: `{"upToDate":false,"dryRun":false,"migrations":["20260901000000_parasut_company_missing_fields_phase12_2.sql"],...,"message":"Finished supabase db push."}`.
- Edge Function: `supabase functions deploy parasut-sync --project-ref yzuxdrknidveptvnwthf --use-api` — **iki kez** deploy edildi (ilk deploy sonrası `default_warehouse_id` hatası bulundu ve düzeltildi, §2; ikinci deploy doğru değeri üretti).
- Dry-run: `{"status":"dry_run","user_id":"800086","unique_company_count":1,"duplicate_company_link_count":0,"unresolved_company_count":0,"type_mismatch_count":0,"error_count":0}`.
- İki ardışık gerçek sync (düzeltme sonrası, canlı, bu oturum):
```
SYNC1 {"status":"success","user_upserted_count":1,"profile_upserted_count":1,"user_role_upserted_count":1,"company_upserted_count":1,"address_upserted_count":1,"unique_company_count":1,"duplicate_company_link_count":0,"unresolved_company_count":0,"type_mismatch_count":0,"error_count":0}
SYNC2 {"status":"success","user_upserted_count":1,"profile_upserted_count":1,"user_role_upserted_count":1,"company_upserted_count":1,"address_upserted_count":1,"unique_company_count":1,"duplicate_company_link_count":0,"unresolved_company_count":0,"type_mismatch_count":0,"error_count":0}
```
Sonuçlar birebir aynı (idempotent), hiçbir finalize hatası yutulmadı (`error_count:0` her ikisinde).
- REST doğrulama (`parasut_company_profile_demo`): `logo_is_processing:false`, `default_warehouse_parasut_id:1000122982`, `last_consumption_date:"2026-08-26T10:05:11.17+00:00"`, `address_own_parasut_type:"addresses"`, `address_addressable_type:"companies"`, `address_addressable_parasut_id:666034`, `address_created_at`/`address_updated_at` dolu.
- REST doğrulama (`parasut_user_company_relation_demo`): `user_parasut_type:"users"`, `user_created_at`/`user_updated_at` dolu, `profile_parasut_id:801196`, `profile_parasut_type:"profiles"`.
- `npm test` → 1/1 PASS.
- `npm run lint` → 0 hata, 10 önceden var olan uyarı (ui/i18n dosyaları, kapsam dışı).
- `npm run build:demo` → başarılı, yeni bundle `SirketBilgileri-BgjI9MjR.js`, ana bundle `index-B_YYaxVz.js`.
- `npx tsc --noEmit -p tsconfig.app.json` → yalnızca bilinen kapsam dışı `Login.tsx:55` hatası.
- FTP deploy: `scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` (PowerShell üzerinden çalıştırıldı — Git Bash'te `/public_html/demo` yolu yerel Windows yoluna dönüştüğü için önce hatalı bir yere yüklendi, tespit edilip PowerShell ile düzeltildi) — 45 dosya `/public_html/demo`'ya yüklendi.
- Canlı doğrulama: `GET /sirket-bilgileri` → HTTP 200. `index.html` bundle referansı: `index-B_YYaxVz.js` / `index-44mCOduN.css` — build çıktısıyla birebir eşleşiyor (önce eski `index-Dv04W0yF.js` görülmüştü, yanlış-yol yüklemesinden; düzeltme sonrası doğru hash canlıda).
- Headless Chrome (Puppeteer, gerçek canlı URL, 3 viewport: 1280x900, 390x844, 768x1024): her üçünde de console error **0**, network failure **0**, "Tüm şirket alanlarını göster" paneli tıklandı, yatay taşma (`scrollWidth>clientWidth`) **yok** hiçbirinde, sayfa metninde JWT/access_token/refresh_token/password/Bearer/X-Amz-Credential/X-Amz-Signature/keycloak_*/operator_id/employee_id/used_app deseni taraması → **0 eşleşme** hepsinde. "CEHA", "İkitelli", "Logo İşleniyor", "Varsayılan Depo ID" (CSS `uppercase` nedeniyle innerText'te "VARSAYILAN DEPO ID" olarak görünür — doğrulandı), "Son Tüketim", "Adres ID", "Profil ID", "Kullanıcı ID" metinleri her üç viewport'ta da göründü.

## 11. Regresyon

| Kaynak | Beklenen (Phase 12.1) | Gerçek (bu oturum) | Durum |
|---|---|---|---|
| companies (view satırı) | 1 | 1 | ✔ değişmedi |
| user-company relation (view satırı) | 1 | 1 | ✔ değişmedi |
| `parasut` şemasına anon erişim | reddedilir | `PGRST205 Could not find the table 'public.parasut'` (public şemada böyle bir tablo yok — private şema hâlâ görünmüyor) | ✔ değişmedi |

Kaynak gerçekten değişmediği için sayılar aynı bırakıldı, zorlanan/uydurulan bir "eski sayı" yok.

## 12. Sonuç

| Bölüm | Durum |
|---|---|
| Ham API kaynak doğrulaması (§1) | PASS |
| `default_warehouse_id` hata tespiti ve düzeltmesi (§2) | PASS (bug bulundu ve düzeltildi) |
| Logo nested obje (§3) | PASS |
| Eksik güvenli şirket alanları (§4) | PASS |
| Kullanıcı alanları (§5) | PASS |
| Profil alanları (§6) | PASS |
| Adres alanları (§7) | PASS |
| Sabit-değer taraması ve düzeltmesi (§8) | PASS (adres addressable_type sabiti düzeltildi) |
| Boş ilişki/obje kuralı (§9) | PASS |
| Sync/deploy/test (§10) | PASS |
| Regresyon (§11) | PASS |

**Genel PASS.** 11 eksik alanın tamamı (logo.is_processing, default_warehouse_id, last_consumption_date, kullanıcı created_at/updated_at, profil id/type, adres created_at/updated_at/addressable_type/addressable_parasut_id) named kolon → public view → TS tipi → UI zincirine wire edildi ve canlıda doğrulandı. Süreçte gerçek bir bug bulundu ve düzeltildi: `default_warehouse_parasut_id` boş ilişkiden (`{"meta":{}}`) okunuyordu, gerçek değeri taşıyan bağımsız `attributes.default_warehouse_id`'den değil — düzeltme sonrası canlı REST sorgusu doğru değeri (`1000122982`) döndürüyor. Adres `addressable_type` alanındaki `"companies"` string sabiti kaldırıldı, yerine API'den gelen `companyItem.type` kullanılıyor. API'de olmayan hiçbir bilgi eklenmedi, hiçbir null/boş değer için veri uydurulmadı, hiçbir güvenlik-hassas alan (signature, operator_id, employee_id, used_app, allowed_inspection_at, inspectable, kullanıcı TFA/OTP/izin alanları) public view/UI/network yanıtına taşınmadı.

**Doğrulama için gerçek ID'ler:** Şirket `666034`, Kullanıcı/owner `800086`, User role `875199`, Adres `295028`, Profil `801196`, Varsayılan depo `1000122982`.

**Bilinen kapsam dışı sorun:** `Login.tsx:55` TS hatası (önceki fazlardan beri var, bu fazın kapsamı dışı, düzeltilmedi).

---

**Kod commit SHA:** 2e69fcf61d845b96990ea6537e878ab4f64615ba
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri

---

## EK DENETİM — Tüm Projede Sabit/Üretilmiş Veri Taraması

**Tarih:** 2026-08-28/29
**Kapsam:** Phase 12.2'de değil, tüm proje (`src/`, `supabase/functions/`, `supabase/migrations/`) — sadece şirket profili değil, tüm tamamlanmış modüller (contacts, contact_people, employees, company profile, shipment_documents, sales_offers, e-documents, products, sales_invoices, purchase_bills, checks, payments, transactions, accounts).

### Taranan dosya sayısı

`src/**/*.ts(x)`: 113 dosya. `supabase/functions/**/*.ts`: 18 dosya. `supabase/migrations/*.sql`: 28 dosya (denetim başında; +2 yeni migration bu fazda eklendi). Toplam taranan: 159 dosya.

### Kullanılan arama desenleri (gerçek komutlar)

```
grep -rn "666034\|800086\|295028\|1000110946\|1023810918" src supabase
grep -rn '"companies"\|"contacts"\|"addresses"\|"users"\|"profiles"\|"user_roles"\|"employees"\|"products"\|"sales_invoices"\|"purchase_bills"\|"checks"\|"e_documents"\|"shipment_documents"\|"sales_offers"' src supabase/functions --include=*.ts --include=*.tsx
grep -rnE '\|\|\s*"[A-Za-zÇĞİÖŞÜçğıöşü0-9]' src --include=*.tsx --include=*.ts
grep -rnE '\?\?\s*"[A-Za-zÇĞİÖŞÜçğıöşü0-9]' src/pages src/lib src/components --include=*.tsx --include=*.ts
grep -rn "\.length" src/pages --include=*.tsx | grep -iE "count|toplam|adet|badge|say"
grep -rln "count" src/pages --include=*.tsx   # + per-file "count:" inspection, all 19 list pages
grep -rn "Record<string" src/lib src/pages --include=*.ts --include=*.tsx | grep -iE "status|currency|label|map"   # + per-map usage-site inspection for silent-drop fallback
find src -iname "*.test.*" -o -iname "*.spec.*" -o -path "*__tests__*"
grep -rln -i "mock\|fixture" src/pages src/lib src/components --include=*.ts --include=*.tsx
grep -rnE "AS [a-z_]+_type|'[a-z_]+'::text" supabase/migrations/*.sql
grep -n "relatedRef(" supabase/functions/parasut-sync/resources/*.ts   # + per-callsite check: is .type stored or discarded
```

### Aday sabit sayısı

İlk grep taramalarında toplam ~140 eşleşme satırı üretildi (tip literalleri, `||`/`??` fallback'leri, `count`/`.length` kullanımları, label map'leri, migration'lardaki `'...'::text` literalleri). Tek tek incelendi; aşağıda sınıflandırılmıştır.

### İzin verilen sabitler (kategori bazında, gerekçeli)

- **ALLOWED_TECHNICAL_CONSTANT** — `supabase/functions/parasut-sync/index.ts` içindeki `"contacts"`, `"sales_invoices"`, `"purchase_bills"`, `"products"`, `"checks"`, `"sales_offers"`, `"shipment_documents"`, `"employees"` dizeleri: Parasut API endpoint şablonları / `upsertBatched(db, "<table>", ...)` çağrılarındaki hedef tablo adları — iş verisi değil, kaynak kod rotası. `resource.type === "users"` / `"companies"` gibi karşılaştırmalar: gerçek API'den gelen bir `type` alanını doğrulamak için kullanılıyor (atama değil, eşitlik kontrolü) — kabul edilen kural (§5, "display mappings... must not alter the source value").
- **ALLOWED_TECHNICAL_CONSTANT** — `src/pages/CekDetay.tsx:92` `.eq("payable_type","checks")`, `src/pages/DemoHome.tsx:62` `.eq("resource","contacts")`, `src/pages/SevkiyatDetay.tsx:169` `.eq("source_type","shipment_documents")`: sayfa bağlamına göre kendi log/activity tablosunu filtreleyen sorgu parametreleri (örn. çek detay sayfası sadece "checks" tipi ödemeleri gösterir) — iş verisi üretmiyor, mevcut sayfanın kapsamını sabitliyor.
- **ALLOWED_UI_CONSTANT** — `PAYMENT_LABELS`, `ACCOUNT_TYPE_LABELS`, `ACTIVITY_LABELS`, `SOURCE_TYPE_LABELS`, `E_DOCUMENT_TYPE_LABELS` (6 dosya): tüm kullanım noktalarında `LABELS[code] ?? code` deseni doğrulandı — bilinmeyen/yeni bir API kodu haritada yoksa ham kod fallback olarak gösteriliyor, hiçbir zaman kayboluyor değil (kural §5 ile uyumlu).
- **ALLOWED_UI_CONSTANT** — `src/components/ui/chart.tsx` içindeki `"value"` fallback'leri: shadcn/ui chart kütüphanesi boilerplate'i, iş verisiyle ilgisi yok.
- **ALLOWED_UI_CONSTANT** — `src/components/sections/CaseStudies.tsx`, `src/components/marketing/Visuals.tsx`: ana pazarlama sitesinin (eclipsemuhendislik.com kurumsal sayfası) portföy/istatistik bileşenleri — Parasut demo (`/pages` altındaki demo sayfaları) ile aynı kod tabanında ama tamamen ayrı bir veri kaynağına (proje CMS içeriği) bağlı, kapsam dışı.
- **ALLOWED_TECHNICAL_CONSTANT** — tüm 19 liste sayfasındaki sayaçlar tek tek incelendi: hepsi ya PostgREST `{ count: "exact", head: true }` gerçek agregat sorgusu ya da Phase 8.3/9/10.1'de kurulan dayanıklı `active_count`/`archived_count`/`total_count` view satırından okunuyor — hiçbiri `.length` veya sabit sayı değil (bkz. "Sayaç kaynakları" altında modül modül liste).
- **TEST_ONLY** — `src/test/example.test.ts`: tek test dosyası, `expect(true).toBe(true)` içeren trivial placeholder, hiçbir fixture/mock veri içermiyor, production koduna import edilmiyor.

### Yasak sabitler — bulundu ve düzeltildi

**Bulgu 1 (FORBIDDEN_HARDCODED_DATA):** `supabase/functions/parasut-sync/resources/me.ts` içindeki `mapMeCompany()` ve `mapUserRole()` fonksiyonları, `relatedRef()` yardımcı fonksiyonuyla ilişkinin gerçek `type` alanını (`relationships.owner.data.type`, `relationships.address.data.type`, `relationships.company.data.type`) ve kaynağın kendi `item.type` alanını API'den zaten okuyordu — ama sadece `.id` saklanıyor, `.type` atılıyordu. Bunun yerine `public.parasut_company_profile_demo` / `public.parasut_user_company_relation_demo` view'ları bu değerleri `'companies'::text`, `'users'::text`, `'companies'::text` SQL string sabitleriyle üretiyordu. Bu, denetim görevinin §2 maddesinde açıkça yasaklanan desenin ta kendisi ("Hardcoding a type field with `"contacts"`, `"companies"`, `"addresses"` etc. as a constant") — Phase 12.2 §8'de `addressable_type` için tam olarak aynı bulgu bir kez düzeltilmişti, ama bu dört alan (company'nin kendi `parasut_type`'ı, `owner_parasut_type`, `address_parasut_type`, `company_parasut_type`) gözden kaçmıştı.

| Dosya | Satır/desen | Sabit değer | Sınıf | Kaynak veri mi | Sonuç |
|---|---|---|---|---|---|
| `supabase/migrations/20260901000000_...sql` (önceki hal) | `'companies'::text as parasut_type` | `"companies"` | FORBIDDEN_HARDCODED_DATA | Hayır — gerçek `item.type` koddan atılıyordu | Düzeltildi |
| aynı dosya | `'users'::text as owner_parasut_type` | `"users"` | FORBIDDEN_HARDCODED_DATA | Hayır — gerçek `owner.type` (relatedRef) koddan atılıyordu | Düzeltildi |
| aynı dosya | `case when c.address_parasut_id is not null then 'addresses' end as address_parasut_type` | `"addresses"` | FORBIDDEN_HARDCODED_DATA | Hayır — gerçek `address.type` (relatedRef) koddan atılıyordu | Düzeltildi |
| aynı dosya | `'companies'::text as company_parasut_type` | `"companies"` | FORBIDDEN_HARDCODED_DATA | Hayır — gerçek `company.type` (relatedRef, `mapUserRole` içinde) koddan atılıyordu | Düzeltildi |

**Öncesi/sonrası (kod, `supabase/functions/parasut-sync/resources/me.ts`):**
```ts
// ÖNCESİ — mapMeCompany(): owner.type / address.type hesaplanıyor, atılıyordu
const owner = relatedRef(item, "owner");
const address = relatedRef(item, "address");
return {
  ...
  owner_parasut_id: owner.id,
  address_parasut_id: address.id,
  ...
};
// (CompanyRow'da parasut_type / owner_parasut_type / address_parasut_type alanı yoktu)

// SONRASI
return {
  parasut_id: parasutId,
  parasut_type: item.type,           // yeni: gerçek, item.type'tan
  ...
  owner_parasut_id: owner.id,
  owner_parasut_type: owner.type,     // yeni: gerçek, relatedRef'ten
  address_parasut_id: address.id,
  address_parasut_type: address.type, // yeni: gerçek, relatedRef'ten
  ...
};
```
```ts
// ÖNCESİ — mapUserRole(): company.type hesaplanıyor, atılıyordu
const company = relatedRef(item, "company");
return { ..., company_parasut_id: company.id, ... };

// SONRASI
return { ..., company_parasut_id: company.id, company_parasut_type: company.type, ... };
```

**Öncesi/sonrası (SQL view, `supabase/migrations/20260901010000_audit_fix_relationship_type_constants.sql`):** `'companies'::text as parasut_type` → `c.parasut_type`; `'users'::text as owner_parasut_type` → `c.owner_parasut_type`; `case when c.address_parasut_id is not null then 'addresses' end as address_parasut_type` → `c.address_parasut_type`; `'companies'::text as company_parasut_type` → `ur.company_parasut_type`.

**Düzeltme sonrası gerçek veri zinciri (her 4 alan için):** `GET /v4/me` JSON → `relationships.{owner,address,company}.data.type` / kaynağın kendi `data.type` → `relatedRef()` / `item.type` (Edge Function, `me.ts`) → `parasut.companies.{parasut_type,owner_parasut_type,address_parasut_type}` / `parasut.user_roles.company_parasut_type` (yeni sütunlar, migration `20260901010000`) → `public.parasut_company_profile_demo` / `public.parasut_user_company_relation_demo` (view, artık literal değil sütun okuyor) → `CompanyProfileRow`/`UserCompanyRelationRow` TS tipi (`src/pages/SirketBilgileri.tsx` — alan adları değişmedi, zaten bu isimlerle tüketiliyordu) → mevcut UI satırları (`company.parasut_type`, `company.owner_parasut_type`, `company.address_parasut_type`, `relation.company_parasut_type`).

**`default_warehouse_parasut_type` bilinçli olarak literal bırakıldı (NEEDS_SOURCE_PROOF değil, kanıtlı ALLOWED_TECHNICAL_CONSTANT):** `relationships.default_warehouse` bu hesapta kalıcı olarak `{"meta":{}}` (boş) — API hiçbir zaman gerçek bir `type` değeri döndürmüyor, dolayısıyla atılacak bir gerçek değer yok (owner/address'ten farklı olarak). `'warehouses'` etiketi sadece bağımsız `default_warehouse_parasut_id` gerçek dolu olduğunda gösteriliyor, hiçbir isim/link uydurulmuyor — Phase 12.2 §9 kuralıyla birebir aynı, değiştirilmedi.

### Kaynağı kanıtlanamayan değerler (BLOCKED)

Yok. Taranan aday sabitlerin tamamı ya (a) izin verilen teknik/UI sabiti olarak sınıflandırıldı, ya da (b) yasak bulundu ve gerçek API kaynağına bağlanarak düzeltildi. Hiçbir alan "kanıt yok" gerekçesiyle BLOCKED işaretlenmedi.

### Sayaç kaynakları (modül modül gerçek kaynak)

| Modül/Sayfa | Sayaç | Gerçek kaynak |
|---|---|---|
| Musteriler.tsx | active/archived/all | `parasut_contacts_demo` üzerinde 3× `{count:"exact",head:true}` |
| DemoHome.tsx | active/archived/total | aynı desen, `parasut_contacts_demo` |
| Cekler.tsx | is_in/is_out/toplam | `parasut_checks_demo` üzerinde `{count:"exact",head:true}` |
| Faturalar.tsx | active/archived/total | dayanıklı view satırı (`active_count`/`archived_count`/`total_count`) |
| Giderler.tsx | active/archived/total | aynı desen |
| Sevkiyatlar.tsx | active/archived/total | aynı desen |
| Calisanlar.tsx | active/archived/total | aynı desen (+`source_total_count`) |
| Teklifler.tsx | active/archived/total | `parasut_sales_offers_demo` üzerinde `{count:"exact",head:true}` |
| Urunler.tsx | active/archived/total | `parasut_products_demo` üzerinde `{count:"exact",head:true}` |
| Tedarikciler.tsx | active/archived/total | `parasut_suppliers_demo` üzerinde `{count:"exact",head:true}` |
| GiderOdemeleri.tsx / Tahsilatlar.tsx / StokHareketleri.tsx / StokSeviyeleri.tsx | toplam | ilgili `_demo` view üzerinde `{count:"exact",head:true}` |
| HesapHareketleri.tsx / Hesaplar.tsx | (sayaç yok, sadece boş-liste kontrolü `.length===0`) | — |

Hiçbir sayaç `.length` (ilk 1000 satır sınırlaması riski) veya sabit sayı kullanmıyor.

### Production bundle fixture/mock taraması

`src/` içinde tek test dosyası (`src/test/example.test.ts`) — hiçbir fixture/mock içermiyor, hiçbir `src/pages`/`src/lib`/`src/components` dosyası ondan import etmiyor, `vite.config.ts` test dosyalarını build'e dahil etmiyor (vitest ayrı çalışıyor). Demo UI'nın veri kaynağı her sayfada doğrudan `supabase.from(...)`/`.select(...)` — hiçbir yerde statik/mock dizi yok.

### Uygulanan düzeltme — sync/deploy/doğrulama

- Yeni migration: `supabase/migrations/20260901010000_audit_fix_relationship_type_constants.sql` — `parasut.companies`'e `parasut_type`/`owner_parasut_type`/`address_parasut_type`, `parasut.user_roles`'a `company_parasut_type` sütunları eklendi; her iki public view yeniden oluşturuldu.
- `supabase db push --db-url ...` → `Finished supabase db push.` (tek migration, ilk denemede başarılı).
- `supabase functions deploy parasut-sync --project-ref yzuxdrknidveptvnwthf --use-api` → başarılı.
- Dry-run (`{"resource":"me","dry_run":true}`) → `"status":"dry_run","error_count":0`.
- İki ardışık gerçek sync (`dry_run:false`): SYNC1 ve SYNC2 birebir aynı sonuç, `"status":"success"`, `error_count:0` her ikisinde (idempotent).
- REST doğrulama: `parasut_company_profile_demo` → `parasut_type:"companies"`, `owner_parasut_type:"users"`, `address_parasut_type:"addresses"`, `default_warehouse_parasut_type:"warehouses"` (hepsi artık gerçek sütundan, değerler öncekiyle aynı ama kaynağı artık API — regresyon yok). `parasut_user_company_relation_demo` → `company_parasut_type:"companies"`, diğer tüm alanlar dolu.
- `npm test` → 1/1 PASS. `npm run lint` → 0 hata, 10 önceden var olan uyarı (kapsam dışı). `npx tsc --noEmit -p tsconfig.app.json` → yalnızca bilinen kapsam dışı `Login.tsx:55`.
- Bu düzeltme yalnızca Edge Function + SQL view'ı değiştirdi; hiçbir `.tsx` dosyası değişmedi (UI zaten aynı alan adlarını tüketiyordu) — bu yüzden frontend rebuild/FTP redeploy gerekmedi. Canlı `GET https://demo.eclipsemuhendislik.com/sirket-bilgileri` → HTTP 200 (değişmeden).

### Genel Sonuç

| Bölüm | Durum |
|---|---|
| Proje geneli sabit/ID sızıntısı taraması (rapor ID'leri kodda) | PASS (sızıntı yok, sadece yorumlarda) |
| Tip literalleri / `"companies"` vb. sabit tarama | FAIL bulundu → düzeltildi (4 alan, aşağıda) |
| `\|\|`/`??` fallback taraması | PASS (kapsam dışı marketing sayfaları hariç, iş verisi fallback'i yok) |
| Sayaç kaynakları (19 liste sayfası) | PASS (hepsi gerçek agregat) |
| Test fixture / production bundle sızıntısı | PASS (sızıntı yok) |
| SQL view sabit tarama | FAIL bulundu → düzeltildi |

**Genel PASS (düzeltme sonrası).** Denetim sırasında 4 gerçek `FORBIDDEN_HARDCODED_DATA` örneği bulundu — hepsi aynı kök nedene sahipti (Edge Function ilişkinin gerçek `type` alanını API'den okuyup atıyordu, SQL view yerine sabit koyuyordu). Tümü kaynağa (Edge Function mapper + yeni sütunlar + view) kadar düzeltildi, hosted DB'ye push edildi, Edge Function redeploy edildi, iki ardışık gerçek sync ile idempotent doğrulandı, REST üzerinden gerçek değerler teyit edildi. Kalan hiçbir yerde kanıtsız sabit/fallback/mock/fixture bulunmadı; BLOCKED işaretlenen alan yok.

**Bilinen kapsam dışı sorun:** `Login.tsx:55` TS hatası (önceki fazlardan beri var, bu denetimin kapsamı dışı, düzeltilmedi).

---

**Ek denetim kod commit SHA:** 75a064f815323e21c5aa3132a110bce6f89aef51
**Ek denetim rapor commit SHA:** (bu commit)
