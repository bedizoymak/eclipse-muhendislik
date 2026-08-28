# Phase 12.4 — Varsayılan Depo Gerçek Kayıt Çözümlemesi

**Tarih:** 2026-08-28
**Düzelttiği/genişlettiği faz:** Phase 12.3 (`reports/PHASE_12_3_COMPANY_WAREHOUSE_TYPE_SOURCE_FIX_REPORT.md`, kod commit `d5ba80cce4723130bb5a6ed5353d9bf23a7b46cf`)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri

## 0. Sorun

Phase 12.3, `relationships.default_warehouse = {"meta":{}}` gerçeğine dayanarak `default_warehouse_parasut_type`'ı doğru şekilde `NULL`/BLOCKED yaptı. Ama aynı raporda kayıt altına alıp *kullanmadığı* bir gözlem vardı: `default_warehouse_id = 1000122982` değeri, **bağımsız bir gerçek kaynakta** (`/v4/warehouses` senkronizasyonu, `parasut.warehouses` tablosu) gerçekten var olan bir kayıtla eşleşiyor ("Ana Depo", arşivlenmemiş). Phase 12.4'ün talimatı: bu iki ayrı gerçeği birbirine karıştırmadan, ID eşleşmesinden gelen gerçek depo bilgisini artık şirket sayfasında göster.

## 1. Kaynak ayrımı (uygulanan)

| Alan | Kaynak | Değer | Durum |
|---|---|---|---|
| `default_warehouse_parasut_id` | `/v4/me` → `included[companies].attributes.default_warehouse_id` | `1000122982` | Gerçek |
| `default_warehouse_parasut_type` | `/v4/me` → `included[companies].relationships.default_warehouse.data.type` | yok (`{"meta":{}}`) | **BLOCKED — NULL** |
| `default_warehouse_name` | bağımsız `/v4/warehouses/1000122982` → `attributes.name`, `parasut.warehouses.parasut_id = default_warehouse_id` join'i ile | `"Ana Depo"` | Gerçek, çözümlendi |
| `default_warehouse_archived` | aynı kaynak → `attributes.archived` | `false` | Gerçek, çözümlendi |
| `default_warehouse_resource_type` | aynı kaynak → kaynağın kendi kök `.type`'ı (`raw->>'type'`) | `"warehouses"` | Gerçek ama **ayrı** alan — `/me` ilişki türünün yerine asla kullanılmıyor |

## 2. Canlı API doğrulaması (bu oturum, gerçek `curl`, 2026-08-28)

`POST /oauth/token` ile gerçek erişim tokenı alındı, ardından:

- `GET /v4/me` → `included[companies].attributes.default_warehouse_id = 1000122982`; `relationships.default_warehouse = {"meta":{}}` (data yok, type yok) — Phase 12.3'teki bulgu tekrar doğrulandı.
- `GET /v4/666034/warehouses` (liste) → `total_count: 1`, tek kayıt: `{"id":"1000122982","type":"warehouses","attributes":{"created_at":"2023-11-29T06:22:30.501Z","updated_at":"2023-11-29T06:22:30.501Z","name":"Ana Depo","archived":false,"address":null,"city":null,"district":null,"is_abroad":null},"relationships":{"inventory_levels":{"meta":{}}}}`.
- `GET /v4/666034/warehouses/1000122982` (tekil) → birebir aynı kayıt.

Tüm alanlar (dolu ve boş) envanteri: `id`, `type` — dolu/gerçek. `name`, `archived` — dolu/gerçek. `address`, `city`, `district`, `is_abroad` — API'de gerçekten `null` (uydurulmadı, olduğu gibi bırakıldı). `relationships.inventory_levels` — `{"meta":{}}`, boş, kullanılmadı.

## 3. ID eşleşme kanıtı — DB satırı canlı API ile birebir

```
psycopg2 ile hosted DB sorgusu (parasut.warehouses):
(1000122982, 'Ana Depo', None, None, None, None, False, 'warehouses', 2023-11-29T06:22:30.501Z, 2023-11-29T06:22:30.501Z, synced_at=2026-08-26T18:26:28Z)
```
Bu satır, bu oturumda tekrar çekilen canlı `/v4/warehouses/1000122982` yanıtıyla `name`/`archived`/`address`/`city`/`district`/`is_abroad`/`type` alanlarının tamamında birebir eşleşiyor — DB satırı bayat değil, güncel. `parasut.warehouses.parasut_id` hem `PRIMARY KEY` hem `UNIQUE` (`warehouses_pkey`, `warehouses_parasut_id_key`) — birden fazla eşleşme yapısal olarak imkansız.

## 4. Supabase çözümleme (yeni migration)

`supabase/migrations/20260901030000_phase12_4_resolve_default_warehouse_record.sql` (önceki migration'lar değiştirilmedi):

- `public.parasut_company_profile_demo` view'ı yeniden oluşturuldu, `parasut.warehouses`'a `left join ... on w.parasut_id = c.default_warehouse_parasut_id` eklendi.
- Yeni sütunlar: `default_warehouse_name`, `default_warehouse_archived`, `default_warehouse_resource_type` (`raw->>'type'`).
- `default_warehouse_parasut_type` **değişmedi** — hâlâ `null::text`.
- Eşleşme yoksa (veya `default_warehouse_parasut_id` NULL ise) üç yeni sütun da otomatik `NULL` olur — SQL'de hiçbir literal/tahmin yok.
- `parasut.warehouses` özel tablosu frontend'e doğrudan açılmıyor; yalnızca view üzerinden, join'lenmiş güvenli alanlarla.

Hosted DB'ye uygulandı:
```
npx supabase db push --db-url ... →
{"upToDate":false,"dryRun":false,"migrations":["20260901030000_phase12_4_resolve_default_warehouse_record.sql"],...,"message":"Finished supabase db push."}
```

Doğrulama (psycopg2, view üzerinden):
```
default_warehouse_parasut_id=1000122982, default_warehouse_parasut_type=None,
default_warehouse_name='Ana Depo', default_warehouse_archived=False, default_warehouse_resource_type='warehouses'
```

REST (anon key, gerçek `public.parasut_company_profile_demo` ve `public.parasut_warehouses_demo`):
```json
{"parasut_id":666034,"default_warehouse_parasut_id":1000122982,"default_warehouse_parasut_type":null,"default_warehouse_name":"Ana Depo","default_warehouse_archived":false,"default_warehouse_resource_type":"warehouses"}
```
```json
[{"parasut_id":1000122982,"name":"Ana Depo","address":null,"city":null,"district":null,"archived":false,"synced_at":"2026-08-28T02:27:23.616+00:00"}]
```

## 5. Edge Function

`supabase/functions/parasut-sync` mapping'i değişmedi (yalnızca SQL view değişti; `me.ts` ve `warehouses.ts` zaten tüm gerçek alanları yazıyordu). Redeploy gerekmedi.

## 6. Senkronizasyon / güncellik kontrolleri

Gerçek Edge Function çağrıları (`POST .../functions/v1/parasut-sync`, anon bearer):

| Çağrı | Sonuç |
|---|---|
| `warehouses` dry-run | `{"status":"dry_run","total_fetched_count":1,"active_fetched_count":1,"archived_fetched_count":0,"upserted_count":0,"error_count":0}` |
| `warehouses` SYNC1 | `{"status":"success","total_fetched_count":1,"upserted_count":1,"error_count":0}` |
| `warehouses` SYNC2 | SYNC1 ile birebir aynı → idempotent |
| `me` SYNC1 | `{"status":"success","company_upserted_count":1,"unresolved_company_count":0,"duplicate_company_link_count":0,"type_mismatch_count":0,"error_count":0}` |
| `me` SYNC2 | SYNC1 ile birebir aynı → idempotent |

Toplam depo sayısı `1`, tekil ID, tekrar eden kayıt yok, hata `0`. `default_warehouse_id` değişseydi view otomatik olarak yeni gerçek kaydı çözümleyecek (join `on w.parasut_id = c.default_warehouse_parasut_id`, statik değil); eşleşme kaybolursa eski isim/arşiv/tür sütunları otomatik `NULL` olur — hiçbir eski değer view'da "sticky" kalmaz (view her sorguda taze join yapıyor, cache/materialization yok).

## 7. UI (`src/pages/SirketBilgileri.tsx`)

`CompanyProfileRow` arayüzüne `default_warehouse_name`, `default_warehouse_archived`, `default_warehouse_resource_type` eklendi. "Adres Detayı" ile "E-Belge ve Modül Ayarları" arasına yeni **"Varsayılan Depo"** bölümü eklendi:

- **Depo ID:** `#1000122982` + gerçek `/stok/depolar` liste route'una link ("Depolar listesinde gör") — uygulamada tekil depo detay route'u (`/stok/depolar/:id`) yok, bu yüzden uydurulmadı; var olan gerçek liste sayfasına linklendi.
- **Depo Adı:** `Ana Depo`
- **Arşivli:** `Hayır` (gerçek `false` değeri gizlenmedi/boş gösterilmedi)
- **Depo Kaynak Türü (resource type):** `warehouses` — kaynağın kendi gerçek kök `.type`'ı
- **/me İlişki Türü (relationship type):** `—` — kod içi yorum, bu satırın `default_warehouse_resource_type` ile *asla* karıştırılmaması gerektiğini açıkça belirtiyor

## 8. BLOCKED ayrımının korunması

| Alan | Sonuç |
|---|---|
| Varsayılan depo ID | **PASS** |
| Gerçek depo kaydı çözümlemesi (ID eşleşmesi) | **PASS** |
| Depo adı | **PASS** — "Ana Depo" |
| Depo arşiv durumu | **PASS** — `Hayır` (gerçek `false`) |
| Depo kaynak türü (`default_warehouse_resource_type`) | **PASS** — `warehouses`, ayrı alan |
| `/me` `default_warehouse` ilişki türü (`default_warehouse_parasut_type`) | **BLOCKED — API relationship data/type döndürmüyor** |

Bağımsız kaynağın türü (`warehouses` resource type) hiçbir yerde eksik ilişki türünün yerine yazılmadı — ikisi UI'da da, view'da da, TS arayüzünde de ayrı sütun/satır.

## 9. Test ve deploy

- `npm test` → 1/1 PASS.
- `npm run lint` → 0 hata, 10 önceden var olan uyarı (kapsam dışı UI/i18n dosyaları, değişmedi).
- `npx tsc --noEmit -p tsconfig.app.json` → yalnızca bilinen kapsam dışı `Login.tsx:55` hatası (`variant` prop'u `LogoProps`'ta yok) — bu fazın kapsamı dışı, dokunulmadı.
- `npm run build:demo` → başarılı, yeni bundle: `SirketBilgileri-BiyYs1k9.js`, `index-BXgmgVyw.js`.
- Deploy: `python scripts/full_deploy.py --skip-build` ile `dist/demo` → gerçek FTP `/public_html/demo` hedefine yüklendi (45 dosya). (Not: bu oturumda önce `deploy_ftp.py --remote-dir /demo` doğrudan çağrıldığında Git Bash'in `/demo` argümanını bir Windows yoluna dönüştürmesi nedeniyle yanlış hedefe gitti; hemen ardından `full_deploy.py` ile doğru `/public_html/demo` hedefine tam redeploy yapılarak düzeltildi — canlı doğrulama bu ikinci, doğru deploy'dan sonra yapıldı.)
- Canlı doğrulama: `https://demo.eclipsemuhendislik.com/sirket-bilgileri` HTTP 200 (curl `-k`, bu ortamda kök sertifika güven zinciri sorunu var — Chromium/Puppeteer `--ignore-certificate-errors` ile aynı sonucu doğruladı).
- Puppeteer (gerçek headless Chrome, 3 viewport — 1280x900, 390x844, 768x1024): her üçünde console error **0**, network failure **0**, yatay taşma **yok**, gizli alan sızıntısı (`bearer`, `service_role`, `jwt`, `password`, `client_secret` desenleri) **0**. Sayfa metninde "Varsayılan Depo" bölüğü, `#1000122982`, "Ana Depo", "Arşivli / Hayır", "warehouses" (kaynak türü) ve `/me İlişki Türü` satırında `—` her üç viewport'ta da doğrulandı.

## 10. API → base → view → type → UI zinciri (yeni: depo adı/arşiv/kaynak türü)

```
GET /v4/{company}/warehouses/1000122982
  → data.id = "1000122982", data.type = "warehouses"           (gerçek)
  → data.attributes.name = "Ana Depo"                           (gerçek)
  → data.attributes.archived = false                            (gerçek)
    ↓
supabase/functions/parasut-sync/resources/warehouses.ts → mapWarehouse()
  → parasut_id, name, archived, raw (tüm JSON:API kaynağı)
    ↓
parasut.warehouses (gerçek satır, PK+UNIQUE parasut_id)
    ↓
public.parasut_company_profile_demo (migration 20260901030000)
  → left join parasut.warehouses w on w.parasut_id = c.default_warehouse_parasut_id
  → default_warehouse_name, default_warehouse_archived, default_warehouse_resource_type (w.raw->>'type')
  → default_warehouse_parasut_type kalıyor: null::text (ayrı, hâlâ BLOCKED)
    ↓
src/pages/SirketBilgileri.tsx → CompanyProfileRow
    ↓
UI: "Varsayılan Depo" bölümü — Depo ID + gerçek liste linki, Depo Adı, Arşivli, Depo Kaynak Türü, ve ayrı "/me İlişki Türü: —" satırı
```

## 11. Null / bayat / duplicate / unresolved senaryoları

- Eşleşme yoksa (`default_warehouse_parasut_id` NULL veya `parasut.warehouses`'ta karşılığı yoksa): üç yeni sütun da otomatik `NULL` → UI'da "—" gösterilir, eski isim asla "yapışık" kalmaz (view her sorguda taze `left join`).
- Duplicate: yapısal olarak imkansız (`parasut_id` PK+UNIQUE); join zaten en fazla 1 satır döndürür.
- Bayatlık: DB satırı bu oturumda canlı API ile birebir doğrulandı (§3); sync idempotent (§6), `synced_at` her senkronizasyonda güncelleniyor.

## 12. Genel Sonuç

| Bölüm | Durum |
|---|---|
| Kaynak ayrımı (§1) | PASS |
| Canlı API doğrulaması (§2) | PASS |
| ID eşleşme kanıtı (§3) | PASS |
| Supabase çözümleme / migration (§4) | PASS |
| Edge Function taraması (§5) | PASS (değişiklik gerekmedi) |
| Sync/güncellik (§6) | PASS (idempotent, 0 hata) |
| UI (§7) | PASS |
| BLOCKED ayrımı (§8) | PASS — ayrım korundu |
| Test/deploy (§9) | PASS |

**Genel PASS (BLOCKED alanla birlikte).** `default_warehouse_parasut_id` gerçek ve doğrulandı (`1000122982`). Bu ID, bağımsız `/v4/warehouses` kaynağında gerçekten var olan bir kayıtla eşleşiyor ve artık bu gerçek kayıt (`Ana Depo`, arşivlenmemiş, kaynak türü `warehouses`) güvenli şekilde view'da çözümlenip UI'da gösteriliyor — hiçbir alan tahmin edilmedi veya SQL literal'i ile üretilmedi. `default_warehouse_parasut_type` (yani `/me` ilişkisinin kendi türü) API'nin bu ilişki için hiçbir zaman gerçek bir değer döndürmemesi nedeniyle **BLOCKED** olarak `NULL` kalmaya devam ediyor; bağımsız kaynağın kendi kaynak türü (`default_warehouse_resource_type = "warehouses"`) bu eksik ilişki türünün yerine hiçbir yerde kullanılmadı — ikisi kod, view ve UI'da açıkça ayrı tutuldu.

**Bilinen kapsam dışı sorun:** `Login.tsx:55` TS hatası (önceki fazlardan beri var, bu fazın kapsamı dışı, düzeltilmedi).

---

**Kod commit SHA:** (bu committen sonra doldurulacak)
**Rapor commit SHA:** (bu commit)
**Canlı URL:** https://demo.eclipsemuhendislik.com/sirket-bilgileri
**Doğrulama için gerçek ID'ler:** Şirket `666034`, Varsayılan depo `1000122982` ("Ana Depo", arşivlenmemiş, kaynak türü `warehouses`).
