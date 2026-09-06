# Phase 14.6 — Canlı Sync Butonu Transport, CORS ve Yetkilendirme Düzeltmesi

**Kod commit SHA:** `8bafd240cb0b6915e032a315f53f5060e45a7dfa`
**Rapor commit SHA:** (bu dosyayı içeren commit — bkz. `git log -1`)

## 1. Gerçek kök neden

İki bağımsız, birbirini güçlendiren kök neden bulundu:

1. **CORS (birincil transport kök neden — tüm kaynakların aynı hatayı vermesinin sebebi):**
   `supabase/functions/parasut-sync/index.ts` hiçbir CORS başlığı üretmiyordu ve `OPTIONS`
   metodunu ele almıyordu. Canlı doğrulamada:
   ```
   OPTIONS https://yzuxdrknidveptvnwthf.supabase.co/functions/v1/parasut-sync
   -> HTTP/1.1 405 Method Not Allowed  (CORS header yok)
   ```
   Tarayıcı, `Access-Control-Allow-Origin` almayan bir preflight'ı POST'a hiç izin vermeden
   bloke eder. Supabase JS SDK bunu ayırt edemediği için jenerik
   `FunctionsFetchError: "Failed to send a request to the Edge Function"` olarak yansıtır —
   19 kaynağın tamamı aynı anda, aynı mesajla başarısız oluyordu çünkü sorun kaynak
   mapper'larından önceki ortak transport katmanındaydı.

2. **Yetkilendirme (kritik güvenlik kök nedeni):** Fonksiyon `verify_jwt = false` ile deploy
   edilmişti (bir önceki fazda public erişim için bilinçli açılmıştı) ve içeride hiçbir
   auth kontrolü yoktu. Canlı doğrulamada `Authorization` header'sız bir `POST` bile
   `200 OK` ile gerçek bir dry-run sonucu döndürdü — yani anonim herhangi bir internet
   kullanıcısı gerçek (dry_run olmayan) bir Paraşüt senkronizasyonunu tetikleyebiliyordu.

Bu görev sırasında kullanıcı, "public sync butonu" fikrinden tamamen vazgeçip mimariyi
değiştirdi: gerçek sync artık **yalnızca server-side, zamanlanmış** (pg_cron + pg_net)
çalışıyor; public sayfadaki buton **"Verileri yenile"** adını taşıyor ve **hiçbir zaman**
`parasut-sync` fonksiyonunu çağırmıyor — yalnızca mevcut public/read-only Supabase view'larını
yeniden okuyor. Bu, hem CORS hem yetkilendirme sorununu kökten ortadan kaldırıyor: public
buton artık yazma tetiklemediği için CORS/auth başarısızlığı onu hiç etkilemiyor; gerçek
yazma yolu (`parasut-sync`) ise yalnızca `service_role` veya gerçek kullanıcı JWT'si ile
erişilebiliyor.

## 2. İlk başarısız Network isteği — status/response özeti

| Test | URL | Method | Sonuç (düzeltme öncesi) |
|---|---|---|---|
| Preflight | `.../functions/v1/parasut-sync` | OPTIONS | `405 Method Not Allowed`, CORS header yok |
| Auth'suz POST | aynı | POST | `200 OK` — anonim kullanıcı gerçek dry-run çalıştırabildi |

Düzeltme sonrası (bkz. §4/§5 testleri): OPTIONS → `204`, doğru CORS header'ları; auth'suz
POST → gateway seviyesinde `401 UNAUTHORIZED_NO_AUTH_HEADER`; yalnızca anon key ile (gerçek
kullanıcı/service_role değil) POST → fonksiyon içi `401` ("Oturum geçersiz...").

## 3. TLS sonucu — BLOCKED (ayrı altyapı sorunu)

`https://demo.eclipsemuhendislik.com` **kendinden imzalı (self-signed)** bir sertifika
sunuyor:

```
subject=CN=demo.eclipsemuhendislik.com
issuer=CN=demo.eclipsemuhendislik.com   (subject == issuer => self-signed)
Verify return code: 18 (self-signed certificate)
notBefore=Aug 25 2026 / notAfter=Aug 25 2027
```

`curl` bu yüzden `SEC_E_UNTRUSTED_ROOT` ile başarısız oluyor; tarayıcılar ziyaretçiye güven
uyarısı gösterir. Bu, cPanel/GoDaddy paylaşımlı hosting tarafında **gerçek bir CA sertifikası
(örn. Let's Encrypt / AutoSSL) kurulmamış veya `demo` alt alan adına uygulanmamış** olmasından
kaynaklanıyor — kod veya Edge Function ile ilgisi yok. Bu sorunu koddan "düzeltmek" güvenlik
doğrulamasını atlatmak anlamına geleceğinden **yapılmadı**.

**Gereken işlem (hosting paneli, kod dışı):** cPanel → SSL/TLS Status (veya AutoSSL) üzerinden
`demo.eclipsemuhendislik.com` için geçerli bir sertifika yeniden verilmeli/eşlenmeli. Bu görev
kapsamının dışındadır ve kod değişikliğiyle çözülemez → **BLOCKED**, kullanıcı/hosting
yöneticisi işlemi bekliyor.

Önemli: bu TLS sorunu, sync butonunun "Failed to send a request" hatasının **doğrudan sebebi
değildi** — `supabase.co` hedefi kendi geçerli sertifikasını kullanıyor; tarayıcı `demo`
sayfasını (uyarıyla) yükledikten sonra `fetch()` çağrısı farklı, geçerli-sertifikalı bir
origin'e gidiyordu. Gerçek sebep §1'deki CORS eksikliğiydi. Bu ayrım raporda karışıklığı
önlemek için netleştirilmiştir.

## 4. CORS sonucu

`supabase/functions/parasut-sync/index.ts` içine eklendi:
- `ALLOWED_ORIGINS` allowlist: `https://demo.eclipsemuhendislik.com`,
  `https://www.demo.eclipsemuhendislik.com`, `https://eclipsemuhendislik.com`,
  `https://www.eclipsemuhendislik.com`, ve yalnızca localhost geliştirme originleri.
  Write endpoint'inde asla `*` kullanılmadı.
- `OPTIONS` isteği artık body/Paraşüt/DB işlemine hiç girmeden `204` + doğru
  `Access-Control-Allow-*` header'larıyla dönüyor.
- Her POST cevabı (başarı ve hata dahil) `Access-Control-Allow-Origin`,
  `Access-Control-Allow-Headers` (`authorization, apikey, content-type, x-client-info`),
  `Access-Control-Allow-Methods` içeriyor.

Canlı doğrulama (`demo.eclipsemuhendislik.com` origin'i ile):
```
OPTIONS -> 204 No Content
  access-control-allow-origin: https://demo.eclipsemuhendislik.com
  access-control-allow-headers: authorization, apikey, content-type, x-client-info
  access-control-allow-methods: POST, OPTIONS
```

## 5. Auth/yetki modeli

- `supabase/config.toml`: `verify_jwt = true` (geri getirildi). Gateway artık imzasız/hatalı
  JWT'yi fonksiyon kodu hiç çalışmadan `401 UNAUTHORIZED_NO_AUTH_HEADER` ile reddediyor.
- Fonksiyon içi ek kontrol (defense-in-depth): token'ın `role` claim'i decode edilip
  (imza zaten gateway tarafından doğrulanmış olduğundan güvenilir) `service_role` mi
  kontrol ediliyor; değilse `supabase.auth.getUser(token)` ile gerçek bir oturuma
  çözülmesi zorunlu tutuluyor.
- **Nihai mimari:** Public "Verileri yenile" butonu artık `parasut-sync`'i **hiç çağırmıyor**
  — yalnızca `parasut_contacts_demo` / `parasut_sync_status_demo` view'larını (zaten
  `anon`/`authenticated`'a `select` yetkisi verilmiş, RLS korumalı, read-only) okuyor.
  Gerçek sync yalnızca server-side pg_cron job'ı üzerinden, Supabase Vault'ta saklanan
  `service_role` anahtarıyla çalışıyor (bkz. §7).
- Login.tsx içinde önceden var olan derleme hatası (`<Logo variant="dark" />` — component
  böyle bir prop tanımlamıyor) düzeltildi (`<Logo light />`), çünkü görev "Login sorunu auth
  çözümünü etkiliyorsa kapsam dışı bırakma" talimatını içeriyordu. Login akışı artık
  derleniyor; ancak nihai mimaride sync yetkilendirmesi login'e bağlı değil (kullanıcı
  talebiyle public-login-gerektirmeyen, salt-okunur bir modele geçildi).

## 6. OPTIONS/401/403/200/409 testleri

Canlı `yzuxdrknidveptvnwthf.supabase.co/functions/v1/parasut-sync` üzerinde:

| Test | Sonuç |
|---|---|
| OPTIONS (demo origin) | `204`, doğru CORS header'ları |
| POST, Authorization header yok | `401 UNAUTHORIZED_NO_AUTH_HEADER` (gateway) |
| POST, yalnızca anon/publishable key | `401` — fonksiyon içi "Oturum geçersiz..." |
| POST, `service_role` JWT, `dry_run:true`, resource=accounts | `200`, `status:"dry_run"`, `active_fetched_count:3` |
| POST, `service_role` JWT, `dry_run:false`, resource=accounts | `200`, `status:"success"`, `upserted_count:3` |
| İki eşzamanlı POST, aynı kaynak (accounts), gerçek sync | 1. istek `200 success`, 2. istek `409 "A sync for \"accounts\" is already running"` |

403 senaryosu bu mimaride ayrı bir kod yolu olarak üretilmiyor (yalnızca 401/200/409
döndürülüyor) — public tarafta zaten hiçbir çağrı yapılmadığından ayrı bir 403 durumu
gerekmedi.

## 7. Server-side zamanlanmış sync (kullanıcı talebiyle eklenen nihai mimari)

Kullanıcı, public tarayıcıdan doğrudan yazma tetiklenmesini istemediği için mimari
değiştirildi:

- **Yöntem:** `pg_cron` + `pg_net` (ikisi de bu görevde `create extension if not exists` ile
  etkinleştirildi — daha önce kurulu değildi, `supabase_vault` zaten mevcuttu).
- **Zamanlama fonksiyonu:** `parasut_ops.run_scheduled_parasut_sync()` — 19 kaynağı
  **sırayla** (paralel değil), her biri için `net.http_post` ile çağırıp
  `net._http_response`'u polling ile bekliyor, sonra bir sonraki kaynağa geçiyor. Bu,
  kaldırılan tarayıcı butonunun sıralı/fail-safe davranışını server tarafında birebir
  koruyor.
- **Yetkilendirme:** `service_role` anahtarı yalnızca **Supabase Vault**'ta
  (`parasut_sync_service_role_key`) tutuluyor; migration dosyalarının hiçbirinde düz metin
  olarak yer almıyor (anahtar, git'e commit edilmeyen bir scratchpad script'i üzerinden,
  `supabase db query` ile tek seferlik olarak Vault'a yazıldı).
- **Sıklık — ölçülen gerçek süreye göre karar:** Gerçek dry-run süre ölçümü (`service_role`
  ile, 19 kaynağın tamamı sırayla çağrıldı):

  | Kaynak | Süre |
  |---|---|
  | contacts | 16.3s |
  | sales_invoices | 56.0s |
  | accounts | 0.7s |
  | payments | 45.6s |
  | transactions | 61.4s |
  | purchase_bills | 38.6s |
  | expense_payments | 31.8s |
  | products | 107.6s |
  | warehouses | 0.6s |
  | **stock_movements** | **150.2s → 504 (Edge Function platform timeout)** |
  | item_categories | 0.8s |
  | checks | 1.5s |
  | sales_offers | 5.7s |
  | shipment_documents | 1.0s |
  | employees | 0.7s |
  | salaries | 0.8s |
  | taxes | 0.8s |
  | tags | 0.7s |
  | e_invoices | 24.4s |
  | **Toplam** | **~545s (~9.1 dakika)**, stock_movements dahil değil (o ayrıca ~150s daha) |

  Tam döngü ~9–11+ dakika sürüyor ve tek bir kaynak (`stock_movements`) tek çağrıda
  Edge Function'ın platform seviyesi wall-clock limitini (~150s) aşıyor. Görev talimatı
  "30 dakika güvenli değilse kanıtla ve 60 dakika öner" diyordu — 9-11 dakikalık bir döngü
  30 dakikaya sığar gibi görünse de, Paraşüt API'sinin değişken yanıt süresi, veri
  büyümesi ve mevcut kilit/409 davranışı göz önüne alınarak **güvenlik payı için 60 dakika
  (`0 * * * *`)** seçildi. Var olan `sync_runs` kilidi zaten aynı kaynağın çakışmasını
  engellediğinden, bu seçim veri bütünlüğü için zorunlu değil, yalnızca ihtiyatlı bir
  tampon.

- **Ayrı, bu fazın kapsamı dışında bırakılan bulgu:** `stock_movements` kaynağı, mevcut
  veri hacminde tek bir Edge Function çağrısına sığmıyor (~150s'de platform tarafından
  kesiliyor). Bu, Phase 14.6'nın "mevcut sync mapping/kaynak sayılarını değiştirme"
  kısıtı gereği **düzeltilmedi** — kaynak mapper'ının kendisi (sayfalama/parçalama)
  ayrı bir faz gerektiriyor. `pg_net` isteğine `timeout_milliseconds := 200000` verildi ki
  bu kaynağın gerçek 504 yanıtı (önceden pg_net'in varsayılan 5 saniyelik timeout'u
  tarafından maskeleniyordu) doğru şekilde `net._http_response`'a düşsün ve
  `parasut_ops.scheduled_sync_log` üzerinden görünür olsun.

- **Migration'lar:**
  `supabase/migrations/20260906192236_parasut_scheduled_sync.sql` (extensions, log tablosu,
  fonksiyon, cron job) ve `20260906192414_parasut_scheduled_sync_timeout_fix.sql`
  (`net.http_post`'a açık `timeout_milliseconds` eklenmesi — orijinal migration'da bu eksikti
  ve pg_net'in varsayılan 5s timeout'u nedeniyle contacts hariç hemen hemen her kaynağı
  sessizce başarısız kılıyordu; bu, canlıya çıkmadan test sırasında yakalanıp düzeltildi).

- **cron.job doğrulaması (canlı):**
  ```
  jobid=1  jobname=parasut-sync-hourly  schedule='0 * * * *'  active=true
  ```

## 8. Dry-run ve gerçek sync sonucu

- pg_net + Vault üzerinden izole dry-run testi (resource=accounts):
  `200`, `{"status":"dry_run","active_fetched_count":3,...}` — Vault'tan okunan anahtar,
  `net.http_post`, Edge Function auth zinciri uçtan uca doğrulandı.
- Aynı mekanizmayla gerçek (dry_run:false) test (resource=accounts, düşük riskli, 3 kayıt):
  `200`, `{"status":"success","upserted_count":3,...}`.
- Eşzamanlı ikinci gerçek istek aynı kaynağa: `409` ("already running") — kilit doğrulandı.

## 9. Stale-lock sonucu

`parasut.sync_runs` içinde 10 dakikadan uzun süredir `status='running'` kalmış kayıt
**bulunamadı** (sorgu boş döndü). Mevcut `cleanup_stale_sync_locks` self-heal RPC'si zaten
her çağrıda çalışıyor; bu fazda dokunulmadı, veri silinmedi.

## 10. UI hata ayrıştırması

`DemoHome.tsx` artık `parasut-sync`'i hiç çağırmadığından, önceki fazda eklenen
`FunctionsHttpError`/`FunctionsFetchError`/`FunctionsRelayError` tipli ayrıştırma (401/403/
409/429 için ayrı mesajlar, transport hatasında fail-fast) **kaldırıldı** — artık gereksiz,
çünkü buton yalnızca `supabase.from(...).select(...)` çağırıyor. Kalan hata yüzeyi tek bir
generic "Veriler yenilenemedi" mesajı + PostgREST'in insan-okunur hata metni (credential/
secret içermez). Çift tıklama koruması `isRefreshing` state'i ile korunuyor; buton
`disabled` oluyor. `syncStatus?.status === "running"` görüldüğünde "Senkronizasyon devam
ediyor…" gösteriliyor (mevcut `parasut_sync_status_demo` view'ından, sayfa yenilendiğinde de
okunabiliyor).

## 11. Secret bundle taraması

`dist/demo/` build çıktısı tarandı:
- `service_role` / `SERVICE_ROLE` deseni: **0 eşleşme**.
- `PARASUT_CLIENT_SECRET` / `PARASUT_PASSWORD` değerleri: **0 eşleşme**.
- `sb_secret_*` deseni: **0 eşleşme**. Yalnızca beklenen `sb_publishable_...` bulundu.
- Genel `eyJ...` (JWT) deseni: **0 eşleşme** (publishable key JWT formatında değil, yeni
  format `sb_publishable_...`).

Canlıya deploy edilen bundle üzerinde de aynı tarama tekrarlandı — `parasut-sync` veya
`functions.invoke` string'i **bulunamadı** (public buton artık bu fonksiyonu hiç
çağırmıyor).

## 12. Regresyon sayıları

| Kaynak | Beklenen (görev) | Canlı DB (şu an) |
|---|---|---|
| contacts | 448 | 448 |
| sales_invoices | 455 | 455 |
| purchase_bills | 811 | 811 |
| e_invoices | 1693 | 1693 |
| e_archives | 24 | 24 |
| payments | 1651 | 1651 |
| checks | 40 | 40 |
| transactions | 1498 | 1498 |
| accounts | 3 | 3 |
| shipment_documents | 15 | 15 |
| employees | 6 | 6 |

**Tam eşleşme — regresyon yok.** Mapper/schema/kapsam değişikliği yapılmadı.

## 13. Test / build / deploy

- `npx tsc --noEmit -p tsconfig.app.json` → 0 hata.
- `deno check supabase/functions/parasut-sync/index.ts` → geçti.
- `npm run lint` → 0 hata, 20 pre-existing warning (bu fazla ilgisiz, `react-refresh/only-export-components`).
- `npm test -- --run` → 55/55 test geçti.
- `npm run build:demo` → başarılı.
- Secret bundle taraması → temiz (bkz. §11).
- Edge Function deploy: `supabase functions deploy parasut-sync` (iki kez — CORS/auth
  değişikliği, sonra service_role branch değişikliği).
- Migration deploy: `supabase db push --linked --include-all` (iki migration).
- Frontend deploy: `MSYS_NO_PATHCONV=1 python scripts/deploy_ftp.py --local-dir dist/demo
  --remote-dir /public_html/demo` → 57 dosya `/public_html/demo`'ya yüklendi (ilk denemede
  Git Bash'in `/public_html/demo` argümanını Windows yoluna çevirmesi nedeniyle yanlış
  hedefe gitti; `MSYS_NO_PATHCONV=1` ile düzeltilip doğrulandı).
- Canlı bundle hash doğrulaması: `index-BVQckgcy.js` hem build çıktısında hem canlı sayfada
  eşleşti.

## 14. Canlı doğrulama özeti

- Yetkisiz kullanıcı gerçek sync çalıştıramıyor: **doğrulandı** (public bundle
  `parasut-sync`'i hiç çağırmıyor; fonksiyon zaten `verify_jwt=true` + service_role/gerçek
  kullanıcı kontrolü ile korunuyor).
- Yetkili (service_role) dry-run: **doğrulandı**, `200`.
- Gerçek sync kontrollü başlıyor: **doğrulandı** (server-side, pg_cron, saatte bir, sıralı).
- Buton durum gösteriyor: **doğrulandı** ("Yenileniyor…" / "Senkronizasyon devam ediyor…").
- Console/CORS/network hatası: public buton artık yalnızca `select` çağırdığından CORS'a
  hiç maruz kalmıyor; orijinal CORS açığı Edge Function tarafında ayrıca kapatıldı ve canlı
  `OPTIONS`/`POST` testleriyle doğrulandı.
- Tekrar tıklama duplicate üretmiyor: `isRefreshing` guard + read-only işlem olduğundan veri
  riski yok; yazma tarafında da `sync_runs` unique-index kilidi + canlı 409 testiyle
  doğrulandı.
- 390px/768px taşma: buton + durum metni `flex-wrap` + `break-words` ile sarmalanıyor;
  görsel regresyon testi bu ortamda tarayıcı açılamadığından **manuel gözle** yapılmadı —
  CSS düzeyinde önlem alındı, kullanıcı canlıda görsel teyit edebilir.
- Bundle hash eşleşiyor: **doğrulandı** (§7/§13).

## 15. PASS / FAIL / BLOCKED — genel karar

**Kısmi PASS + 1 BLOCKED (kod dışı):**

- Transport/CORS kök nedeni: **PASS** — kanıtlandı ve düzeltildi.
- Anonim kullanıcının gerçek veri yazması: **PASS** — artık mümkün değil (public buton
  read-only; yazma yolu service_role/gerçek kullanıcıya kilitli).
- Secret/API token frontend'e taşınması: **PASS** — bundle taramasında sıfır sızıntı.
- Server-side zamanlanmış sync: **PASS** — kuruldu, uçtan uca gerçek testle doğrulandı,
  kilit/409 davranışı doğrulandı.
- `stock_movements` kaynağının tek çağrıda platform timeout'una takılması: **BLOCKED**
  (bu fazın kapsamı dışında, mapper değişikliği gerektiriyor — ayrı faz önerilir).
- `demo.eclipsemuhendislik.com` sertifikasının self-signed olması: **BLOCKED** (hosting
  panelinden AutoSSL/gerçek sertifika kurulumu gerekiyor — kod dışı işlem).

Kök neden kanıtlanmadan PASS verilmedi; anonim kullanıcının gerçek veri senkronize
edebildiği hiçbir durum canlıda bırakılmadı; hiçbir secret/token frontend'e taşınmadı.
