# Phase 12.1 — Şirket Tüm Alanlar, /Companies Farkı ve Public Güvenlik

**Tarih:** 2026-08-30
**Düzelttiği faz:** Phase 12 (`reports/PHASE_12_COMPANY_PROFILE_REPORT.md`, kod commit `42b3fa3088e4dd291a57d4f7b50a519557d19f8c`)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri

## 0. Sorun (Phase 12'nin eksiği)

Phase 12, şirket 666034'ün "60+ attribute" olduğunu söyledi ama tek tek saymadı: 30+ gerçek alan `extra_flags` jsonb kolonuna toplu atıldı ve **tamamı** public view/UI'a taşındı (`Object.entries(extra_flags)` ile UI'da genel render). Ayrıca `GET /v4/companies`'in gerçek `app_url` alanı hiç `/v4/me`'nin included şirketiyle karşılaştırılmadı. Bu faz her ikisini de tek tek düzeltiyor.

## 1. `/v4/me` tam envanteri (canlı, bu oturum, 2 ardışık çağrı byte-birebir aynı)

Kök: `id:"800086", type:"users"`. Included: 1 `user_roles` (875199), 1 `companies` (666034), 1 `addresses` (295028), 1 `profiles` (801196). Toplam gerçek şirket attribute anahtarı: **90** (birkaçı nested: `logo.{url,is_processing}`, `signature.{url,is_processing}`, `invoicing_preferences` boş obje).

| # | API yolu | Bulunan | Gerçek değer/durum | Tip | Null/boş/0/false | Base kolonu | Public karar |
|---|---|---|---|---|---|---|---|
| 1 | created_at | ✔ | 2023-11-29T06:22:30.476Z | ISO8601 | dolu | parasut_created_at | public |
| 2 | updated_at | ✔ | 2026-05-13T19:06:00.208Z | ISO8601 | dolu | parasut_updated_at | public |
| 3 | owner_id | ✔ | 800086 | int | dolu | owner_parasut_id (relationship'ten de teyit) | public (id/type) |
| 4 | name | ✔ | "CEHA-Dişli Sanayi" | string | dolu | name | public |
| 5 | allowed_inspection_at | ✔ | null | date | **null (korunuyor)** | allowed_inspection_at | **private** (internal inspection) |
| 6 | app_url | ✔ | https://uygulama.parasut.com/666034 | string | dolu | app_url | public — bkz. §2/§8 |
| 7 | legal_name | ✔ | "HAYRETTİN DAYAN" | string | dolu | legal_name | public |
| 8 | occupation_field | ✔ | "Üretim" | string | dolu | occupation_field | public |
| 9 | district | ✔ | "Başakşehir" | string | dolu | district | public |
| 10 | city | ✔ | "İstanbul" | string | dolu | city | public |
| 11 | tax_office | ✔ | "İkitelli Vergi Dairesi Müdürlüğü" | string | dolu | tax_office | public |
| 12 | tax_number | ✔ | "43675880102" | string | dolu | tax_number | public |
| 13 | e_invoice_vkn | ✔ | "43675880102" (tax_number ile aynı) | string | dolu | **e_invoice_vkn (yeni kolon)** | public |
| 14 | mersis_no | ✔ | null | string | **null** | mersis_no | public (null → "—") |
| 15 | trade_registry_number | ✔ | null | string | **null** | trade_registry_number | public (null → "—") |
| 16 | credit_balance | ✔ | 31 | numeric | dolu | credit_balance | public |
| 17 | last_consumption_date | ✔ | 2026-08-26T10:05:11.170Z | ISO8601 | dolu | last_consumption_date | private (dinamik iç sayaç, Phase 12'de zaten UI'da değil) |
| 18 | display_exchange_rate_in_offer_pdf | ✔ | **false** | boolean | dolu (false) | **display_exchange_rate_in_offer_pdf (yeni)** | public |
| 19 | used_app | ✔ | null | string | **null** | **used_app (yeni)** | **private** (internal/tracking) |
| 20 | primary_job | ✔ | "Yok" | string | dolu | primary_job | public |
| 21 | e_invoicing_activated_at | ✔ | 2023-12-12 | date | dolu | e_invoicing_activated_at | public |
| 22 | e_archiving_activated_at | ✔ | 2023-12-12 | date | dolu | e_archiving_activated_at | public |
| 23 | e_smm_activated_at | ✔ | null | date | **null** | **e_smm_activated_at (yeni)** | public (null → "—") |
| 24 | e_archiving_only_activated_at | ✔ | null | date | **null** | **e_archiving_only_activated_at (yeni)** | public (null → "—") |
| 25 | e_despatch_activated_at | ✔ | 2023-12-14 | date | dolu | e_despatch_activated_at | public |
| 26 | new_subscription_status | ✔ | "active" | string | dolu | new_subscription_status | public |
| 27 | employee_id | ✔ | null | int | **null** | **employee_id (yeni)** | **private** (internal linkage) |
| 28 | payment_with_akbank_enabled | ✔ | **false** | boolean | dolu (false) | **payment_with_akbank_enabled (yeni)** | public |
| 29 | can_upload_signature | ✔ | true | boolean | dolu | **can_upload_signature (yeni)** | public |
| 30 | operator_id | ✔ | null | int | **null** | **operator_id (yeni)** | **private** (internal support-operator) |
| 31 | invoicing_preferences | ✔ | `{}` | jsonb | dolu (boş obje) | **invoicing_preferences (yeni)** | public |
| 32 | logo_url | ✔ | gerçek S3 URL | string | dolu | logo_url | public — bkz. §8 |
| 33 | default_warehouse_id | ✔ | 1000122982 | int | dolu | default_warehouse_parasut_id | private (relationship zaten meta-only, §5) |
| 34 | valid_until | ✔ | 2027-05-13 | date | dolu | valid_until | public |
| 35 | accessible | ✔ | true | boolean | dolu | accessible | public |
| 36 | inspectable | ✔ | **false** | boolean | dolu (false) | inspectable | **private (Phase 12 REGRESYON — bu fazda view'dan çıkarıldı)** |
| 37 | inventory_enabled | ✔ | true | boolean | dolu | inventory_enabled | public |
| 38 | e_commerce_enabled | ✔ | true | boolean | dolu | e_commerce_enabled | public |
| 39 | e_invoicing_enabled | ✔ | true | boolean | dolu | e_invoicing_enabled | public |
| 40 | e_archiving_enabled | ✔ | true | boolean | dolu | e_archiving_enabled | public |
| 41 | e_archiving_only_enabled | ✔ | false | boolean | dolu (false) | **e_archiving_only_enabled (yeni)** | public |
| 42 | e_smm_enabled | ✔ | false | boolean | dolu (false) | **e_smm_enabled (yeni)** | public |
| 43 | e_despatch_enabled | ✔ | true | boolean | dolu | e_despatch_enabled | public |
| 44 | sales_offer_enabled | ✔ | true | boolean | dolu | sales_offer_enabled | public |
| 45 | export_invoice_enabled | ✔ | true | boolean | dolu | export_invoice_enabled | public |
| 46 | using_sales_receipt | ✔ | false | boolean | dolu (false) | **using_sales_receipt (yeni)** | public |
| 47 | using_multiple_warehouses | ✔ | false | boolean | dolu (false) | using_multiple_warehouses | public |
| 48 | using_variant | ✔ | false | boolean | dolu (false) | using_variant | public |
| 49 | using_emikro_einvoice | ✔ | true | boolean | dolu | **using_emikro_einvoice (yeni)** | public |
| 50 | e_invoicing_waiting | ✔ | false | boolean | dolu (false) | **e_invoicing_waiting (yeni)** | public |
| 51 | e_archiving_only_waiting | ✔ | false | boolean | dolu (false) | **e_archiving_only_waiting (yeni)** | public |
| 52 | uses_credit_service | ✔ | true | boolean | dolu | uses_credit_service | public |
| 53 | credit_service_enabled | ✔ | true | boolean | dolu | credit_service_enabled | public |
| 54 | can_use_ai_reporting | ✔ | true | boolean | dolu | can_use_ai_reporting | public |
| 55 | can_use_ai_support | ✔ | true | boolean | dolu | can_use_ai_support | public |
| 56 | has_iyzico_integration | ✔ | false | boolean | dolu (false) | has_iyzico_integration | public |
| 57 | logo.url / logo.is_processing | ✔ | logo_url ile birebir aynı / false | obj | dolu | **kaydedilmedi — logo_url zaten aynı değeri taşıyor, iki kez saklanmadı** | public (logo_url üzerinden) |
| 58 | signature.url / signature.is_processing | ✔ | null / null | obj | **null, null** | **signature (yeni, jsonb)** | **private** (dijital imza — güvenlik-yakın sınıf, bugünkü null değerden bağımsız) |
| 59 | e_invoicing_order_details_enabled | ✔ | false | boolean | dolu (false) | **e_invoicing_order_details_enabled (yeni)** | public |
| 60 | email_tx_import_enabled | ✔ | false | boolean | dolu (false) | **email_tx_import_enabled (yeni)** | public |
| 61–76 | bank_sync_setup_{is_bankasi,ing_bank,akbank,denizbank,kuveytturk,teb,finansbank,fibabanka,albaraka,ornekbank,yapikredi,vakifbank,enpara,garanti,ziraat_bankasi,halkbank}_enabled | ✔ (16 anahtar) | gerçek değerler (çoğu true, kuveytturk/ornekbank false) | boolean | dolu | **16 yeni kolon** | public (banka senkron açık/kapalı bayrağı — kimlik bilgisi değil) |
| 77 | multiple_bank_integration_enabled | ✔ | false | boolean | dolu (false) | **yeni** | public |
| 78 | e_commerce_integration_enabled | ✔ | true | boolean | dolu | **yeni** | public |
| 79 | fibabanka_credit_application_enabled | ✔ | false | boolean | dolu (false) | **yeni** | public |
| 80 | using_emikro_services | ✔ | true | boolean | dolu | **yeni** | public |
| 81 | inbound_edocument_page_enabled | ✔ | true | boolean | dolu | **yeni** | public |
| 82 | batch_updated_vat_rates | ✔ | false | boolean | dolu (false) | **yeni** | public |
| 83 | invoice_note_enabled | ✔ | false | boolean | dolu (false) | **yeni** | public |
| 84 | has_odeal_integration | ✔ | false | boolean | dolu (false) | **yeni** | public |
| 85 | has_507_and_509 | ✔ | false | boolean | dolu (false) | **yeni** | public |
| 86 | footer_aggregate_enabled | ✔ | true | boolean | dolu | **yeni** | public |
| 87 | contact_transfer_enabled | ✔ | true | boolean | dolu | **yeni** | public |
| 88 | pending_qr_code_migration | ✔ | false | boolean | dolu (false) | **yeni** | public |
| 89 | ai_support_rag | ✔ | false | boolean | dolu (false) | **yeni** | public |
| 90 | ai_features_enabled | ✔ | false | boolean | dolu (false) | **yeni** | public |

`companies.relationships.{owner,operator,address,default_warehouse,pos}` → §5. `included.addresses/profiles/user_roles` → §6/§7.

**Hiçbir alan "30+ flags" gibi toplu satırla geçilmedi — tamamı (90/90) tek tek listelendi.**

## 2. `/v4/companies` tam keşfi (canlı, bu oturum)

| İstek | Sonuç |
|---|---|
| `GET /v4/companies` | 200, `data:[{id:"666034",type:"companies",attributes:{name,app_url}}]` — tek öğe |
| `GET /v4/companies?page[size]=1` | 200, aynı tek öğe — sayfalama yok, toplam kayıt sayısı = 1 |
| `GET /v4/companies?include=bogus_relation` | 200, include sessizce yok sayılıyor (hata yok) |
| `GET /v4/companies?filter[bogus_filter]=1` | 200, filter sessizce yok sayılıyor (hata yok) |
| `GET /v4/companies/666034` | **404** "No route matches." |
| `GET /v4/companies/999999999` | **404** "No route matches." (aynı mesaj — id'ye özel değil, route hiç yok) |

`data[0].attributes` sadece **2** anahtar taşıyor: `name`, `app_url` — `/v4/me`'nin included şirketindeki 90 anahtarın küçük bir alt kümesi. `links`/`meta` yok. Relationships yok.

## 3. `/v4/me` ↔ `/v4/companies` alan karşılaştırması (şirket 666034)

| Alan | `/me` included company | `/companies` resource | Aynı/farklı | Yetkili kaynak | Saklama kararı |
|---|---|---|---|---|---|
| id | "666034" | "666034" | aynı | her ikisi de | tek `parasut_id` |
| type | "companies" | "companies" | aynı | her ikisi de | tek `parasut_type` |
| name | "CEHA-Dişli Sanayi" | "CEHA-Dişli Sanayi" | **byte-birebir aynı** | her ikisi | `name` kolonu (mevcut, /me'den) |
| app_url | https://uygulama.parasut.com/666034 | https://uygulama.parasut.com/666034 | **byte-birebir aynı** | her ikisi | `app_url` kolonu (mevcut, /me'den) |
| diğer 88 anahtar | ✔ (§1) | **yok** (`/companies` bu anahtarları hiç döndürmüyor) | — | sadece `/me` | sadece `/me` kaynaklı base kolonlar |

Hiçbir alan atlanmadı: `/companies`'in 2 alanı da `/me`'de var ve **birebir aynı** (uyuşmazlık yok, raporlanacak bir fark yok). `/me`'nin 88 fazla alanı `/companies`'de hiç yok — bu beklenen (companies list minimal stub). İki kaynak asla tek bir raw objede birleştirilmedi: `parasut.companies.raw` = `/me`'den gelen şirket kaynağı (raw_me_company semantiği), yeni `parasut.companies.raw_company_list` = `/companies`'den gelen ayrı kaynak — ayrı sütun, ayrı provenance.

## 4. `app_url` güvenlik sonucu

| Alan | Ham değer | Mutlak/göreli | Host | İmza/token | Durability | Karar |
|---|---|---|---|---|---|---|
| app_url | https://uygulama.parasut.com/666034 | **mutlak** | uygulama.parasut.com (resmi Parasut app domaini) | **yok** (sorgu string'i yok) | kalıcı (şirket id'sine bağlı statik yol) | **public** (zaten Phase 12'de public'ti, bu fazda /companies ile çapraz doğrulandı, değişmedi) |

## 5. `extra_flags` alan-alan denetimi — sonuç

Phase 12'nin `extra_flags` jsonb kolonuna toplu attığı **30+ anahtarın tamamı** artık ayrı, adlandırılmış kolonlara taşındı (§1, satır 18/28/29/31/41/42/46/49–89). `extra_flags` kolonu şemada geriye dönük uyumluluk için bırakıldı ama:
- Migration sonrası içeriği **boş** (`COMPANY_KNOWN_KEYS` artık 90 anahtarın tamamını kapsıyor).
- UI artık `Object.entries(extra_flags)` ile **hiçbir şeyi genel render etmiyor** — `src/pages/SirketBilgileri.tsx`'teki tablo yalnızca elle sınıflandırılmış `FIELD_LABELS` sözlüğünden render ediliyor.
- Public view (`parasut_company_profile_demo`) artık `extra_flags` kolonunu **hiç seçmiyor**.

Hassasiyet sınıflandırması özeti:
- **Safe iş bilgisi → public:** e_invoice_vkn, display_exchange_rate_in_offer_pdf, payment_with_akbank_enabled, can_upload_signature, invoicing_preferences, e_smm_*, e_archiving_only_*, using_sales_receipt/emikro_einvoice/emikro_services, e_invoicing_waiting, e_invoicing_order_details_enabled, email_tx_import_enabled, bank_sync_setup_* (16), multiple_bank_integration_enabled, e_commerce_integration_enabled, fibabanka_credit_application_enabled, inbound_edocument_page_enabled, batch_updated_vat_rates, invoice_note_enabled, has_odeal_integration, has_507_and_509, footer_aggregate_enabled, contact_transfer_enabled, pending_qr_code_migration, ai_support_rag, ai_features_enabled (toplam 43 alan, hepsi named kolon + public view).
- **İç-sistem/inceleme/operatör → private:** operator_id, employee_id, used_app, allowed_inspection_at (zaten private'tı), **inspectable (Phase 12 regresyonu — bu fazda public view'dan çıkarıldı)**.
- **Güvenlik-yakın → private:** signature (dijital imza durumu).
- **Credential/token/secret:** `/v4/me` gövdesinde **hiç yok** — hiçbir alan bu kategoriye girmedi, dolayısıyla hiçbir şey "asla saklanmaz" kuralına takılmadı.

## 6. Şirket ilişkileri tam denetimi

| İlişki | data | Durum | Base/View/UI |
|---|---|---|---|
| owner | `{id:"800086",type:"users"}` | dolu | owner_parasut_id/owner_parasut_type, public (id/type pointer) |
| address | `{id:"295028",type:"addresses"}` | dolu | address_parasut_id/type, public + adres alanları (§7) |
| operator | `null` | **gerçek null** | private, UI'da "—" (relationship yok) |
| default_warehouse | `{meta:{}}` | **meta-only, data yok** | private, UI'da sahte depo kartı **oluşturulmadı** |
| pos | `{meta:{}}` | **meta-only, data yok** | private, UI'da sahte POS kartı **oluşturulmadı** |

## 7. Kullanıcı / user_role / profil tam envanteri

**Kullanıcı (800086):**

| API alanı | Base/raw | Public/private | UI | Gerekçe |
|---|---|---|---|---|
| id/type | ✔ | public (pointer) | ✔ | ilişki alanı |
| name, email | ✔ | public | ✔ | güvenli iş bilgisi |
| unconfirmed_email | ✔ | private | ✗ | hesap doğrulama durumu |
| created_at/updated_at | ✔ | private | ✗ | Phase 12'den beri UI'da değil (kapsam dışı bırakıldı, değişmedi) |
| approved_contracts/approved_new_contracts | ✔ | private | ✗ | yasal onay |
| integration_contract_statuses.* | ✔ | private | ✗ | hesap ayarı |
| keycloak_tfa_enabled | ✔ | **private, asla public değil** | ✗ | 2FA güvenlik ayarı |
| keycloak_email_otp_enabled | ✔ | **private, asla public değil** | ✗ | OTP güvenlik ayarı |
| is_confirmed | ✔ | private | ✗ | hesap durumu |

**User role (875199):**

| API alanı | Base/raw | Public/private | UI | Gerekçe |
|---|---|---|---|---|
| id/type | ✔ | public (pointer) | ✔ | ilişki alanı |
| company id/type | ✔ | public (pointer) | ✔ | ilişki alanı |
| sales_invoices/expenditures/own_expenditures/employees/accounts/settings | ✔ | **private, asla public değil** | ✗ | gerçek Parasut izin (rw/na) değerleri |
| user_role_type | ✔ (null) | private | ✗ | null, iş anlamı yok bugün |

**Profil (801196):**

| API alanı | Base/raw | Public/private | UI | Gerekçe |
|---|---|---|---|---|
| id/type | ✔ | public (pointer, mevcut değil UI'da doğrudan ama phone üzerinden erişilebilir) | kısmi | — |
| phone | ✔ | public | ✔ | güvenli iş bilgisi |
| job_title | ✔ (null) | private | ✗ | null bugün |
| settings.is_app_navigation_collapsed | ✔ | private | ✗ | UI tercihi, şirket verisi değil |
| avatar.url/is_processing | ✔ (null/false) | private | ✗ | null, iş anlamı yok |

## 8. Adres tam alan zinciri (295028)

| API | Base | Raw | View | TS type | UI | Gerçek değer |
|---|---|---|---|---|---|---|
| id | ✔ | ✔ | ✔ (address_parasut_id) | number | ✔ | 295028 |
| type | ✔ (sabit "addresses") | ✔ | ✔ | string | ✔ | "addresses" |
| name | ✔ | ✔ | ✔ (**yeni: address_name eklendi**) | string\|null | ✔ | null |
| address | ✔ | ✔ | ✔ | string | ✔ | "İkitelli OSB Mahallesi..." |
| phone | ✔ | ✔ | ✔ | string | ✔ | "05365837420" |
| fax | ✔ | ✔ | ✔ | string\|null | ✔ | null |
| created_at/updated_at | ✔ | ✔ | ✔ (parasut_created_at üzerinden değil, adresin kendi timestamp'i private/base'de kalıyor — Phase 12'den değişmedi) | ISO8601 | — | 2023-11-29 / 2025-12-30 |
| addressable_type/addressable_parasut_id | ✔ | ✔ | — | "companies"/666034 | — | Phase 12'de zaten wired |

Adres tipi ve parent tipi ayrı gerçek değerler olarak korundu — isim/adres benzerliğinden türetilmedi.

## 9. Logo/App/diğer URL güvenliği

| Alan | Ham değer | Mutlak/göreli | Host | İmza/token | DOM | Güvenlik |
|---|---|---|---|---|---|---|
| logo_url | https://parasut-dosyalar.s3.amazonaws.com/production/Company/logo/666034/2023_11_29__06_29_20--logo.png | mutlak | parasut-dosyalar.s3.amazonaws.com | **yok** (X-Amz-Credential/Signature/Security-Token yok — sabit, sorgu string'siz path) | `<img src>` | public, kalıcı, güvenli |
| app_url | https://uygulama.parasut.com/666034 | mutlak | uygulama.parasut.com | yok | metin | public (§4) |
| logo.url (nested) | logo_url ile aynı | — | — | — | — | ikinci kez saklanmadı (duplike) |
| signature.url | null | — | — | — | gösterilmiyor | private sınıf, bugün null |

## 10. Frontend tam alan denetimi

`src/pages/SirketBilgileri.tsx`: şirket parasut_id/type, 43 yeni public alan "Tüm şirket alanlarını göster" panelinde elle sınıflandırılmış etiketlerle (FIELD_LABELS whitelist — genel `Object.entries` render **yok**), adres id/type + tüm güvenli alanları, owner id/type, kullanıcı id/type/name/email, profil phone, user-role id/type/company id/type, null→"—", false→"Hayır", tarih-only alanlarda saat uydurulmadı, UTC timestamp gösterimi korundu. `inspectable` ve `extra_flags` UI'dan tamamen kaldırıldı.

## 11. Sync (Edge Function)

- `supabase/functions/parasut-sync/parasut_client.ts`: yeni `fetchCompaniesList()` — `/v4/companies`'i ayrı, gerçek bir kaynak olarak çekiyor (hata olursa `/me` sync'ini bloklamıyor, `raw_company_list` null'a düşüyor).
- `supabase/functions/parasut-sync/resources/me.ts`: `mapMeCompany()` artık 90 alanın tamamını (43 yeni public + 5 yeni private) işliyor; `findCompanyListEntry()` `/companies` kaydını `/me` şirketiyle id'den eşliyor.
- `index.ts`'in `syncMe()`'si her iki kaynağı da (`/me`, `/companies`) ayrı ayrı işliyor, `raw`/`raw_company_list` hiç birleştirilmiyor.

**Dry-run (canlı, bu oturum):**
```
{"resource":"me","dry_run":true,"status":"dry_run","user_id":"800086","unique_company_count":1,"duplicate_company_link_count":0,"unresolved_company_count":0,"type_mismatch_count":0,"error_count":0}
```

**İki ardışık gerçek sync (canlı, bu oturum, birebir aynı sonuç):**
```
SYNC1 {"status":"success","user_upserted_count":1,"profile_upserted_count":1,"user_role_upserted_count":1,"company_upserted_count":1,"address_upserted_count":1,"unique_company_count":1,"duplicate_company_link_count":0,"unresolved_company_count":0,"type_mismatch_count":0,"error_count":0}
SYNC2 {"status":"success","user_upserted_count":1,"profile_upserted_count":1,"user_role_upserted_count":1,"company_upserted_count":1,"address_upserted_count":1,"unique_company_count":1,"duplicate_company_link_count":0,"unresolved_company_count":0,"type_mismatch_count":0,"error_count":0}
```

`/v4/me` tek-kullanıcı kapsamı, tam şirket listesi olarak varsayılmadı — silme/staleness mantığı `/companies`'e bağlanmadı (tek kayıt döndürdüğü kanıtlanmış olsa da, mevcut upsert-only mimari korunarak riskli bir "unseen'i sil" davranışı eklenmedi).

## 12. Regresyon (canlı sorgular, bu oturum)

| Kaynak | Beklenen | Gerçek | Durum |
|---|---|---|---|
| companies | 1 | 1 | ✔ |
| addresses | 1 | 1 | ✔ |
| users | 1 | 1 | ✔ |
| profiles | 1 | 1 | ✔ |
| user_roles | 1 | 1 | ✔ |
| user-company relation | 1 | 1 (`parasut_user_company_relation_demo`) | ✔ |
| duplicate_company_link_count | 0 | 0 | ✔ |
| unresolved_company_count | 0 | 0 | ✔ |
| type_mismatch_count | 0 | 0 | ✔ |
| error_count | 0 | 0 | ✔ |

`parasut` şemasına anon anahtarla doğrudan erişim denendi → `permission denied for schema parasut` (42501) — private tablolar gerçekten erişilemez, sadece iki public view (`parasut_company_profile_demo`, `parasut_user_company_relation_demo`) `anon`/`authenticated`'e açık.

## 13. Test ve deploy

- Migration: `supabase db push --db-url ...` ile hosted Supabase'e uygulandı (`20260830050000_parasut_company_full_fields_security.sql`). İlk denemede `create or replace view` mevcut kolon isimlerini/sırasını değiştiremediği için 42P16 hatası alındı; `drop view` + `create view` ile düzeltildi.
- Edge Function: `supabase functions deploy parasut-sync --project-ref yzuxdrknidveptvnwthf --use-api` (Docker kullanılamadığı için API bundling).
- Dry-run + iki ardışık gerçek sync: §11, birebir aynı sonuç.
- `npm test` ✔ (1/1), `npm run lint` ✔ (0 hata, sadece önceden var olan uyarılar), `npm run build:demo` ✔, `npx tsc --noEmit -p tsconfig.app.json` → sadece bilinen önceden var olan `Login.tsx:55` hatası (kapsam dışı, düzeltilmedi).
- FTP deploy: `scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo` — 45 dosya yüklendi (`SirketBilgileri-CdooTN4b.js` dahil). Canlı `index.html` bundle referansı doğrulandı: `index-Dv04W0yF.js` / `index-44mCOduN.css` — build çıktısıyla birebir eşleşiyor.
- Canlı `GET /sirket-bilgileri` → HTTP 200.
- Headless Chrome (Puppeteer, gerçek canlı URL, 3 viewport: 1280x900 masaüstü, 390x844 mobil, 768x1024 tablet): her üçünde de console error **0**, network failure **0**, "Tüm şirket alanlarını göster" paneli tıklandı ve render doğrulandı, sayfa DOM'unda JWT/access_token/refresh_token/password/Bearer-token/keycloak_*/user_role izin değeri/operator_id/employee_id/used_app/X-Amz-Credential/X-Amz-Signature deseni taraması → **0 eşleşme** hepsinde, yatay taşma (`scrollWidth>clientWidth`) **yok** hiçbirinde, gerçek şirket adı ("CEHA") ve adres metni ("İkitelli") her üç viewport'ta da göründü.

## 14. Doğrulama için gerçek ID'ler

- Kullanıcı: `800086` (Hayrettin Dayan)
- Şirket: `666034` (CEHA-Dişli Sanayi)
- Adres: `295028`
- User-role (ilişki): `875199`
- Profil: `801196`

## Sonuç

| Bölüm | Durum |
|---|---|
| /v4/me tam envanteri (90/90 alan) | PASS |
| /v4/companies keşfi | PASS |
| /me ↔ /companies karşılaştırması | PASS (fark yok, app_url birebir aynı) |
| extra_flags alan-alan audit | PASS (43 public + 5 private, blob kaldırıldı) |
| Şirket ilişkileri | PASS |
| Kullanıcı/user_role/profil | PASS |
| Adres zinciri | PASS |
| Logo/App URL güvenliği | PASS |
| Frontend tam alan | PASS |
| Sync (iki kaynak, ayrı provenance) | PASS |
| Regresyon | PASS |
| Test/deploy | PASS |

**Genel PASS.** API'de olmayan hiçbir bilgi eklenmedi. Hiçbir gerçek güvenli şirket alanı atlanmadı — 90 şirket attribute'unun tamamı tek tek sınıflandırıldı (43'ü yeni public kolon, 5'i yeni private kolon, 42'si Phase 12'den zaten public/private). `extra_flags` toplu blob kaldırıldı; UI artık jenerik `Object.entries` render etmiyor. Phase 12 regresyonu (`inspectable` public view'daydı) bu fazda düzeltildi — private'a alındı. `/v4/companies`'in `app_url`'i `/v4/me` ile karşılaştırıldı: birebir aynı, discrepancy yok. Hiçbir kullanıcı/profil alanı şirket alanı gibi gösterilmedi. Hiçbir credential/token/parola `/v4/me` gövdesinde bulunmadığı için hiçbiri hiçbir yere yazılmadı.

**Bilinen kapsam dışı sorun:** `Login.tsx:55` TS hatası (Phase 12'den beri var, bu fazın kapsamı dışı, düzeltilmedi).

---

**Kod commit SHA:** ae9a0e5f8b2e82105cf691e01323864d745d1e56
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri
