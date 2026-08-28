# Phase 12.3 — Varsayılan Depo Tür Sabitini Kaldır ve Raporu Kapat

**Tarih:** 2026-08-28
**Düzelttiği faz:** Phase 12.2 ek denetim (`reports/PHASE_12_2_COMPANY_MISSING_FIELDS_SOURCE_REPORT.md`, kod commit `2e69fcf61d845b96990ea6537e878ab4f64615ba`, ek denetim kod commit `75a064f815323e21c5aa3132a110bce6f89aef51`)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri

## 0. Sorun

Phase 12.2'nin ek denetimi (proje geneli sabit taraması) 4 gerçek `FORBIDDEN_HARDCODED_DATA` bulgusunu düzeltti (`parasut_type`, `owner_parasut_type`, `address_parasut_type`, `company_parasut_type` — hepsi artık API'den gelen gerçek `.type` alanlarından okunuyor) ama bilinçli olarak bir tanesini bırakmıştı:

```sql
case when c.default_warehouse_parasut_id is not null then 'warehouses' end as default_warehouse_parasut_type
```

Gerekçe şuydu: `relationships.default_warehouse` bu hesapta kalıcı olarak `{"meta":{}}` (boş) — API hiçbir zaman gerçek bir `type` değeri döndürmüyor, dolayısıyla "atılan" bir gerçek değer yok (owner/address'in aksine). Bu doğru bir gözlem ama yanlış sonuca varıyor: bir alanın kaynağı olmaması, o alan için makul bir *tahmin* üretmeyi haklı çıkarmaz. `"warehouses"` değeri, sanki gerçek bir API ilişki tipiymiş gibi UI'ya (dolaylı olarak, sütun adı ve tüketim biçimi üzerinden) taşınıyordu — teknik bir sabit (endpoint yolu, tablo adı, sorgu filtresi) değil, üretilmiş iş verisiydi.

## 1. Kaynak kanıtı — ID gerçek, tür gerçek değil

Bu oturumda canlı `GET /v4/me` yanıtı tekrar doğrulandı (Edge Function'ın zaten okuduğu ham veri, `supabase/functions/parasut-sync/resources/me.ts` üzerinden):

| Alan | JSON yolu | Değer | Durum |
|---|---|---|---|
| `default_warehouse_parasut_id` | `included[companies].attributes.default_warehouse_id` | `1000122982` | Gerçek, bağımsız, dolu attribute |
| `default_warehouse_parasut_type` | `included[companies].relationships.default_warehouse` | `{"meta":{}}` — `data.id`/`data.type` YOK | Kaynak yok |

`attributes.default_warehouse_id` dolu olması, `relationships.default_warehouse`'un boş olmasını telafi etmiyor — bunlar JSON:API'de iki ayrı, bağımsız alan. ID'nin var olması türün de var olduğu anlamına gelmiyor.

**Bağımsız doğrulama girişimi (bulgu, kullanılmadı):** Projede gerçek, ayrı bir `/v4/warehouses` senkronizasyonu var (`supabase/functions/parasut-sync/resources/warehouses.ts`, `parasut.warehouses` tablosu). Hosted DB'de doğrudan sorgulandı:

```
select parasut_id, name, archived from parasut.warehouses order by parasut_id;
→ {"parasut_id":1000122982,"name":"Ana Depo","archived":false}
```

Yani `1000122982` gerçekten var olan, gerçek bir depo kaydı — ama bu **farklı bir kaynaktan** (bağımsız `/v4/warehouses` listesi), `/v4/me`'nin `default_warehouse` ilişkisinden değil. Görev talimatı gereği bu tabloyla join'lenip isim/tür geri doldurulmadı — görevin kendi beklenen sonucu bu alan için açıkça `BLOCKED` istiyor, ve `relationships.default_warehouse`'un kendisi hâlâ boş olduğu için bu spesifik ilişkinin türünü temsil eden hiçbir gerçek değer yok. Bu gözlem sadece kayıt altına alınıyor, alanı doldurmak için kullanılmadı.

## 2. Kaldırılan SQL literal (öncesi/sonrası)

**Önceki migration'da** (`supabase/migrations/20260901010000_audit_fix_relationship_type_constants.sql:128`, değiştirilmedi — sadece view yeni migration'la yeniden oluşturuldu):
```sql
case when c.default_warehouse_parasut_id is not null then 'warehouses' end as default_warehouse_parasut_type,
```

**Yeni migration** (`supabase/migrations/20260901020000_phase12_3_remove_default_warehouse_type_literal.sql`):
```sql
null::text as default_warehouse_parasut_type,
```

`default_warehouse_parasut_id` satırı değişmedi (`c.default_warehouse_parasut_id` — gerçek, hâlâ okunuyor).

## 3. Edge Function / frontend fallback taraması

- `supabase/functions/parasut-sync/resources/me.ts` ve `index.ts`: `default_warehouse` için `"warehouses"` üreten hiçbir fallback/derivation bulunamadı — tek satır `default_warehouse_parasut_id: attr(a, "default_warehouse_id")`, tür hiç yazılmıyor.
- `src/pages/SirketBilgileri.tsx`: `default_warehouse_parasut_type` alanı TS tipinde tanımlı (satır 94) ama **UI'nın hiçbir yerinde render edilmiyor** — ne özet kartta (satır 376-381, sadece `#{id}` gösteriliyor, tür yok), ne "Tüm şirket alanlarını göster" panelinde (`FIELD_LABELS` sözlüğünde bu anahtar hiç yok, satır 151 civarı, grep ile doğrulandı). Yani UI zaten "Tür: —" göstermek yerine türü hiç göstermiyor — görev metninin izin verdiği iki seçenekten biri ("UI must show 'Tür: —' or simply not show the type row at all") zaten sağlanmış durumdaydı, ek kod değişikliği gerekmedi.
- Depo adı/link: `src/pages` içinde depo detay route'u yok, hiçbir yerde depo adı uydurulmuyor — grep ile doğrulandı (`warehouse` geçen tek yerler `using_multiple_warehouses` ve gerçek `default_warehouse_parasut_id` idi).

## 4. Proje geneli sabit tip taraması (bu faz)

```
grep -rnE "AS [a-z_]+_type|as [a-z_]+_type" supabase/migrations/*.sql
grep -rn "'warehouses'" supabase/migrations/*.sql src supabase/functions
grep -rnE '\?\?\s*"[A-Za-z]|\|\|\s*"[A-Za-z]' src/pages/SirketBilgileri.tsx
```

Sonuç: `'companies'`/`'users'`/`'warehouses'` literal'leri **yalnızca eski, artık kullanılmayan migration dosyalarında** kaldı (`20260829040000`, `20260830050000`, `20260901000000`, `20260901010000`) — bunlar hosted DB'de `drop view if exists` ile üzerine yazılıp yeniden oluşturuluyor, canlı view artık en son migration'ı (`20260901020000`) yansıtıyor. Eski migration dosyaları hiç düzenlenmedi (kural gereği). `src/pages/SirketBilgileri.tsx` içinde `??`/`||` string fallback deseni yok.

| Alan | Sınıf | Gerekçe |
|---|---|---|
| `parasut_type` (company) | API_RESOURCE_TYPE | `item.type`, gerçek, saklanan sütun |
| `owner_parasut_type` | API_RELATIONSHIP_TYPE | `relationships.owner.data.type`, gerçek, saklanan sütun |
| `address_parasut_type` (company'nin address ilişkisi) | API_RELATIONSHIP_TYPE | `relationships.address.data.type`, gerçek, saklanan sütun |
| `address_own_parasut_type` | API_RESOURCE_TYPE | adresin kendi `item.type`, gerçek |
| `address_addressable_type` | API_RESOURCE_TYPE (ters yön) | `companyItem.type`, gerçek (Phase 12.2 §8 düzeltmesi) |
| `company_parasut_type` (user_role ilişkisi) | API_RELATIONSHIP_TYPE | `relationships.company.data.type`, gerçek, saklanan sütun |
| `user_parasut_type` | API_RESOURCE_TYPE | `data.type`, gerçek |
| `relation_parasut_type` | API_RESOURCE_TYPE | user_role kaynağının kendi `.type`'ı, gerçek |
| `profile_parasut_type` | API_RESOURCE_TYPE | profile kaynağının kendi `.type`'ı, gerçek |
| **`default_warehouse_parasut_type`** | **NULL_SOURCE_NOT_RETURNED** | `relationships.default_warehouse = {"meta":{}}`, hiçbir zaman `data.type` içermiyor — **artık NULL, hiç UI'da gösterilmiyor** |
| `"warehouses"` (index.ts `upsertBatched(db,"warehouses",...)`, `syncWarehouses`, endpoint stringi) | ALLOWED_TECHNICAL_IDENTIFIER | Tablo adı / endpoint yolu — bir data sütununa veya UI değerine hiç atanmıyor |
| `.eq("payable_type","checks")` vb. (CekDetay/DemoHome/SevkiyatDetay) | ALLOWED_QUERY_FILTER | Phase 12.2 ek denetiminde zaten sınıflandırıldı, değişmedi |

Yeni `FORBIDDEN_HARDCODED_DATA` bulgusu yok. Kalan tek düzeltme buydu.

## 5. Canlı doğrulama (bu oturum, sync sonrası REST)

`public.parasut_company_profile_demo`:
```json
{"parasut_id":666034,"parasut_type":"companies","owner_parasut_id":800086,"owner_parasut_type":"users","default_warehouse_parasut_id":1000122982,"default_warehouse_parasut_type":null,"address_parasut_id":295028,"address_own_parasut_type":"addresses","address_addressable_type":"companies"}
```
`public.parasut_user_company_relation_demo`:
```json
{"user_parasut_type":"users","relation_parasut_type":"user_roles","company_parasut_type":"companies"}
```

| Kontrol | Beklenen | Gerçek | Durum |
|---|---|---|---|
| Varsayılan depo ID | `1000122982` | `1000122982` | PASS |
| Varsayılan depo türü | null / "—" | `null` (UI'da hiç satır yok) | PASS |
| Depo adı | uydurulmamış | UI'da hiç yok | PASS |
| Depo linki | uydurulmamış | UI'da hiç yok | PASS |
| Şirket türü | `companies`, API'den | `"companies"` | PASS |
| Owner türü | `users`, ilişkiden | `"users"` | PASS |
| Adres türü | `addresses`, kaynaktan | `"addresses"` | PASS |
| Addressable türü | `companies`, şirket kaynağından | `"companies"` | PASS |
| User-role şirket türü | `companies`, ilişkiden | `"companies"` | PASS |

Tüm 9 kontrol PASS.

## 6. Sync/test/deploy

- Yeni migration: `supabase/migrations/20260901020000_phase12_3_remove_default_warehouse_type_literal.sql` (öncekiler değiştirilmedi).
- `npx supabase db push --db-url ...` → `{"upToDate":false,"dryRun":false,"migrations":["20260901020000_phase12_3_remove_default_warehouse_type_literal.sql"],...,"message":"Finished supabase db push."}`.
- Edge Function: değişmedi (yalnızca SQL view), redeploy edilmedi.
- Dry-run: `{"status":"dry_run","user_id":"800086","error_count":0}`.
- İki ardışık gerçek sync: SYNC1 ve SYNC2 birebir aynı (`"status":"success"`, `error_count:0`, `company_upserted_count:1`) — idempotent.
- REST doğrulama sync sonrası: `default_warehouse_parasut_id:1000122982`, `default_warehouse_parasut_type:null` — değişmedi, sabit.
- `npm test` → 1/1 PASS.
- `npm run lint` → 0 hata, 10 önceden var olan uyarı (kapsam dışı UI/i18n dosyaları).
- `npx tsc --noEmit -p tsconfig.app.json` → yalnızca bilinen kapsam dışı `Login.tsx:55` hatası.
- `.tsx` dosyası değişmediği için (`default_warehouse_parasut_type` zaten hiç render edilmiyordu) `npm run build:demo`/FTP redeploy gerekmedi — bundle hash'i bu fazda değişmedi.
- Canlı doğrulama (Puppeteer, gerçek `https://demo.eclipsemuhendislik.com/sirket-bilgileri`, 3 viewport: 1280x900, 390x844, 768x1024): her üçünde HTTP 200, console error **0**, network failure **0**, yatay taşma **yok**, gizli alan (JWT/token/password/Bearer/keycloak/operator_id/employee_id vb.) sızıntısı **0**, "warehouses" tür literal'i sayfa metninde **yok**, "Varsayılan Depo ID" ve gerçek ID `1000122982` her üçünde de göründü.

## 7. API → base → view → type → UI zinciri (default_warehouse alanı)

```
GET /v4/me
  → included[companies].attributes.default_warehouse_id = 1000122982   (gerçek, dolu)
  → included[companies].relationships.default_warehouse = {"meta":{}}  (gerçek, boş — type yok)
    ↓
supabase/functions/parasut-sync/resources/me.ts → mapMeCompany()
  → default_warehouse_parasut_id: attr(a,"default_warehouse_id")       (1000122982)
  → (default_warehouse_parasut_type hiç yazılmıyor — hiç field yok)
    ↓
parasut.companies.default_warehouse_parasut_id (gerçek sütun, dolu)
    ↓
public.parasut_company_profile_demo (migration 20260901020000)
  → c.default_warehouse_parasut_id                     (1000122982)
  → null::text as default_warehouse_parasut_type        (NULL, literal değil — kaynak yokluğunun açık ifadesi)
    ↓
src/pages/SirketBilgileri.tsx → CompanyProfileRow.default_warehouse_parasut_type: string | null
    ↓
UI: yalnızca "Varsayılan Depo ID: #1000122982" satırı render ediliyor — tür satırı hiç yok
```

## 8. Genel Sonuç

| Bölüm | Durum |
|---|---|
| Ham kaynak doğrulaması (§1) | PASS |
| SQL literal kaldırma (§2) | PASS |
| Edge Function/frontend fallback taraması (§3) | PASS (bulunmadı) |
| Proje geneli sabit tip taraması (§4) | PASS (yeni FORBIDDEN_HARDCODED_DATA yok) |
| Canlı doğrulama — 9 kontrol (§5) | PASS (9/9) |
| Sync/test/deploy (§6) | PASS |

| Alan | Sonuç |
|---|---|
| Şirket profili (genel) | **PASS** |
| `default_warehouse_id` | **PASS** |
| `default_warehouse_parasut_type` | **BLOCKED — gerçek API type döndürmüyor** |
| Uydurulmuş/sabit production verisi | **0** |

**Genel PASS (BLOCKED alanla birlikte).** `default_warehouse_parasut_type` alanı için API hiçbir zaman gerçek bir tip değeri döndürmüyor (`relationships.default_warehouse = {"meta":{}}`, kalıcı olarak boş) — bu yüzden alan görev talimatına uygun şekilde `BLOCKED` olarak işaretlendi, SQL'de `'warehouses'` literal'i kaldırılıp `NULL` ile değiştirildi, UI zaten bu alanı hiç göstermiyordu (ek değişiklik gerekmedi). `default_warehouse_parasut_id` gerçek, bağımsız `attributes.default_warehouse_id`'den gelmeye devam ediyor ve canlıda doğrulandı (`1000122982`). Hiçbir depo adı/linki uydurulmadı; ID'nin bağımsız `parasut.warehouses` tablosunda gerçekten var olduğu (`"Ana Depo"`) tespit edildi ama görev talimatı gereği bu farklı kaynak, ilişkinin kendi eksik türünü doldurmak için kullanılmadı — sadece kayıt altına alındı.

**Phase 12.2 raporundaki "(bu commit)" ifadeleri hakkında:** `reports/PHASE_12_2_COMPANY_MISSING_FIELDS_SOURCE_REPORT.md` içindeki iki "Rapor commit SHA: (bu commit)" ifadesi (satır 130 ve 282) belirsiz/eksik bırakılmış placeholder değil — bu projenin standart git iş akışının kendisi (bu fazın kendi talimatında da: "Rapor commit SHA" = "(bu commit)"): bir raporun kendi commit SHA'sı, o rapor commit edilmeden bilinemez, bu yüzden kendine referans ifadesi olarak kullanılıyor. Her iki "Kod commit SHA" (`2e69fcf61d845b96990ea6537e878ab4f64615ba`, `75a064f815323e21c5aa3132a110bce6f89aef51`) zaten gerçek, tam, doğrulanmış SHA'lar. Bu fazda ek bir patch gerekmedi; commit zinciri burada açıkça belgelendi: Phase 12.1 kod `ae9a0e5f8b2e82105cf691e01323864d745d1e56` → Phase 12.2 kod `2e69fcf61d845b96990ea6537e878ab4f64615ba` → ek denetim kod `75a064f815323e21c5aa3132a110bce6f89aef51` → Phase 12.3 kod (aşağıda).

**Bilinen kapsam dışı sorun:** `Login.tsx:55` TS hatası (önceki fazlardan beri var, bu fazın kapsamı dışı, düzeltilmedi).

---

**Kod commit SHA:** d5ba80cce4723130bb5a6ed5353d9bf23a7b46cf
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri
**Doğrulama için gerçek ID'ler:** Şirket `666034`, Kullanıcı/owner `800086`, Adres `295028`, Varsayılan depo `1000122982` (bağımsız `parasut.warehouses` kaydı: "Ana Depo", arşivlenmemiş).
