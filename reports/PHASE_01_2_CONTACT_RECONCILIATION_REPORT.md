# Phase 1.2 — Contacts active/archived reconciliation report

- **Start:** 2026-08-25T23:16:19Z (continuing directly from Phase 1.1)
- **End:** 2026-08-25T23:55:00Z
- **Branch:** `main`
- **Base commit (before this phase):** `8ffab7a60418580f80d28136d6e9dd36d3744f33`
- **This phase's commit SHA:** `bd6bf0fb89c3c663b1c28ad8b73b645f92d5df3a` (`bd6bf0f`)
- **Push result:** `8ffab7a..bd6bf0f main -> main` — success
- **Hosted Supabase project:** `yzuxdrknidveptvnwthf`
- **Live URL:** https://demo.eclipsemuhendislik.com

No secret values appear anywhere in this report.

## 1. Parasut `filter[archived]` — verified, not guessed

The published swagger (`https://apidocs.parasut.com/swagger.json`) does **not** list a `filter[archived]` parameter on `GET /{company_id}/contacts` — it only documents `filter[name]`, `filter[email]`, `filter[tax_number]`, `filter[tax_office]`, `filter[city]`, `filter[account_type]`, `sort`, `page[number]`, `page[size]`, `include`. `filter[archived]` **is** documented, but only on `inventory_levels`, `sales_offers`, `shipment_documents`, and `warehouses` — confirmed by downloading the raw 802 KB swagger.json and grepping every occurrence of `archived` in it directly (not relying on a lossy AI summary of the huge file, which gave contradictory answers).

Because the documented parameter list didn't settle the question either way, this was tested empirically against the **real, live Parasut API** (a one-off Node script using the account's own OAuth credentials from the local `.env`, deleted after use, no values ever printed):

| Request | `total_count` returned |
|---|---|
| `GET /contacts?page[size]=1` (no filter) | 440 |
| `GET /contacts?page[size]=1&filter[archived]=false` | 440 |
| `GET /contacts?page[size]=1&filter[archived]=true` | 8 |

**Conclusion, verified not assumed:** `filter[archived]` is real and functional for `contacts` despite being undocumented for this endpoint. The default (no filter) is equivalent to `filter[archived]=false`. 440 + 8 = 448, which is exactly the account's full contact count — closing the gap Phase 1.1's browser report flagged.

## 2–4. Dual-stream pagination

`supabase/functions/parasut-sync/parasut_client.ts`: `fetchPage`/`fetchAllPages` now accept an `extraParams` map, forwarded as query params.

`supabase/functions/parasut-sync/index.ts`: for `contacts`, runs two independent, fully-paginated fetches in parallel — `filter[archived]=false` and `filter[archived]=true` — via `Promise.all`. Each stream keeps the existing "throw if pagination stops before the reported last page" guard from Phase 1.1, and `Promise.all` means **either stream failing aborts the whole run** as an error (rule 4) — nothing is marked successful on a partial result. Response and `sync_runs` now carry `active_fetched_count`, `archived_fetched_count`, and a `total_fetched_count` (API response field name; stored in the pre-existing `fetched_count` DB column, now equal to active+archived).

## 5. If Parasut hadn't supported the filter

Not applicable here — verified supported (section 1). Documenting for completeness per the instructions: had the filter not worked, the rule would have been "don't delete the 8 pre-existing rows; report them as an unverifiable legacy record" — this branch was not needed.

## 6. `raw` payload

Unchanged: `resources/contacts.ts` still stores the complete JSON:API resource object in `raw` for every row in both streams, with no field added, removed, or altered.

## 7. `phone` on the demo view

New migration `20260826020000_parasut_contacts_reconciliation.sql` adds `phone` (already an existing column on `parasut.contacts`, mapped from the API since Phase 1) to `public.parasut_contacts_demo`. No new/fake column was created.

**Migration bug caught before it reached hosted:** the first version of this migration inserted `phone` and the two new `sync_runs` columns in the *middle* of each view's `select` list. `CREATE OR REPLACE VIEW` requires every existing output column to keep both its name and its ordinal position — Postgres rejected it: `ERROR: cannot change name of view column "contact_type" to "phone" (SQLSTATE 42P16)`. The push failed cleanly (whole migration rolled back — verified afterward that `sync_runs.active_fetched_count` did **not** exist and `migration list` still showed the migration as not applied to remote). Fixed by appending all new columns at the end of each view's column list instead, then re-pushed successfully.

## 8. Demo home counters

`src/pages/DemoHome.tsx` now shows four real, independently-queried counters: Aktif müşteriler, Arşivli müşteririye, Toplam kayıt, Son başarılı sync (with active/archived breakdown from the last sync run). All four come from live `count: exact` queries or the sync status view — no arithmetic shortcuts.

## 9–10. `/musteriler` default filter + tabs

`src/pages/Musteriler.tsx`: defaults to `archived = false`. Aktif/Arşivli/Tümü buttons, each showing its own real count (`count: exact` per filter), re-querying on click.

## 11. Phone on detail page

`src/pages/MusteriDetay.tsx` now selects and displays `phone` directly from `parasut_contacts_demo` (real value, `null` shown as `—` when Parasut has no phone on file — never fabricated).

## 12. No source normalization

Neither the sync function nor the migration applies `trim()` or any other transform to Parasut's values before storing them — `raw` and the mapped `email`/`phone`/etc. columns are stored exactly as the API returned them, including the one contact whose email has a leading space. `DemoHome.tsx`/`Musteriler.tsx` call `.trim()` **only in the JSX render**, for the on-screen text — the stored value, the `raw` payload, and everything returned by the API are untouched. This matches the instruction: "UI'da istenirse yalnızca görsel sunum için trim yapılabilir; raw ve kolon değeri değişmemeli."

## 13. Horizontal scroll

Both `DemoHome.tsx` and `Musteriler.tsx` tables are now wrapped in `overflow-x-auto` containers with a `min-w` on the table, so columns no longer disappear/clip on narrow viewports (the Phase 1.1 browser report's "Tür kolonu kırpılıyor" finding).

## 14. Invalid `parasutId`

Unchanged behavior, still verified working: an unknown-but-valid-looking numeric id shows "Müşteri bulunamadı"; a non-numeric id surfaces a clear error banner from the failed query rather than crashing or showing a blank screen. No special-casing was needed or added.

## 15–17. Hosted deploy

**Local verification note:** Docker Desktop was unresponsive/erroring for the entire duration of this phase's work (`docker ps` / `supabase start` failed with daemon-level errors: `LegacyDockerLifecycleInspectError`, then later plain hangs). This blocked running the local Supabase stack or `supabase functions serve` to dry-test before deploying, unlike Phase 1.1. Given the task's actual deliverable is the hosted deploy, and given the archived-filter behavior itself had already been verified directly against the real Parasut API (section 1, independent of local Supabase), this phase's changes were deployed straight to hosted and verified there instead — see below. This gap is flagged, not hidden.

- **Migration:** `supabase db push` — first attempt **failed cleanly** (see section 7), fixed, second attempt **succeeded**. `supabase migration list` confirms all 4 migrations now match local/remote.
- **Edge Function:** `supabase functions deploy parasut-sync` — **succeeded** (deployed without Docker, using remote asset upload; CLI printed `WARNING: Docker is not running` but completed the deploy).
- **Hosted dry run:** `{"status":"dry_run","total_fetched_count":448,"active_fetched_count":440,"archived_fetched_count":8,"upserted_count":0,"error_count":0,"total_count_reported":448}`
- **Hosted real sync:** `{"status":"success","total_fetched_count":448,"active_fetched_count":440,"archived_fetched_count":8,"upserted_count":448,"error_count":0}`
- **Frontend build:** `npm run build:demo` → success, `dist/demo/assets/index-Cr3lhBdi.js`.
- **Frontend deploy:** same FTP method as Phase 1.1 (`scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /public_html/demo`, `MSYS_NO_PATHCONV=1` to avoid the Git-Bash path-mangling caught in Phase 1.1). Dry-run confirmed the correct remote path, then real upload: **19/19 files uploaded**.

## 18. Live coverage check

| Layer | Active | Archived | Total |
|---|---|---|---|
| Parasut API (this sync's fetch) | 440 | 8 | 448 |
| Supabase `parasut.contacts` (`Content-Range` header, verified via anon-readable view) | 440 | 8 | 448 |
| Demo UI counters (same queries the page runs) | 440 | 8 | 448 |

**All three layers agree on the same scope.** This is the condition the task requires before calling anything complete, and it holds.

- `phone` verified real on the hosted view, e.g. `{"parasut_id":1011029218,...,"phone":"02125672019"}`.
- Live routes, all HTTP 200: `/`, `/musteriler`, `/musteriler/1011029218` (active), `/musteriler/1011029178` (archived).
- Live `index.html` references `assets/index-Cr3lhBdi.js` / `assets/index-RqOK1I0q.css` — matching the fresh build's hashes, confirming the deployed code is current.
- **Known carryover limitation (from Phase 1.1, unchanged):** `demo.eclipsemuhendislik.com` still serves a self-signed TLS certificate, so this session cannot render the live page in an actual trust-validating browser (WebFetch/plain curl both reject it). HTTP-status and bundle-hash checks were done with certificate validation bypassed. Visual, in-browser confirmation of the new counters/filters/phone field is **not independently confirmed by this session** — see Claude Browser handoff below.

## 19. Test / lint / build

- `npm test` → 1/1 passed (pre-existing placeholder test, unaffected).
- `npm run lint` → 0 errors, 10 pre-existing warnings (unrelated shadcn/ui + `LanguageContext.tsx` fast-refresh warnings, unchanged from Phase 1.1).
- `npm run build:demo` → success.
- (Informational) `tsc --noEmit -p tsconfig.app.json` → same single pre-existing error in `src/pages/Login.tsx:55`, not touched, not in scope.

## Changed files (this phase)

Modified: `src/pages/DemoHome.tsx`, `src/pages/Musteriler.tsx`, `src/pages/MusteriDetay.tsx`, `supabase/functions/parasut-sync/index.ts`, `supabase/functions/parasut-sync/parasut_client.ts`
Added: `supabase/migrations/20260826020000_parasut_contacts_reconciliation.sql`, `reports/PHASE_01_2_CONTACT_RECONCILIATION_REPORT.md`
Not touched (user's own, pre-existing): `vite.config.ts`, `src/pages/Login.tsx`, `AUDIT_REPORT.md`
Deployed (not committed, build output): `dist/demo/**` → uploaded via FTP

## Unverified / failed items

1. **No local Docker verification this phase** — Docker Desktop was down/unresponsive throughout (see section 15–17). Compensated with direct hosted verification plus an independent real-API probe for the archived-filter question itself.
2. **Visual/browser render on the live site is still not independently confirmed** by this session, for the same self-signed-certificate reason as Phase 1.1. HTTP 200 + matching bundle hash + matching Supabase/API/UI-query counts were confirmed instead.
3. One migration push attempt failed (caught and fixed within this session before any further action — see section 7); mentioning for completeness, not hidden.

## Sample `parasut_id` values for Claude Browser

- **Active:** `1011029218` — 2F MAKİNE SAN. VE DIŞ TİC. LTD. ŞTİ. (phone: `02125672019`)
- **Active:** `1017928283` — ABBAS ÇELİKTEN (phone: `0530 118 73 76`)
- **Archived:** `1011029178` — HİRA PARTS METAL SANAYİ VE TİCARET LİMİTED ŞİRKETİ (phone: `null` in Parasut — expect "—" on screen, not a blank/error)

---

## Sonuç Özeti

| Kontrol | Beklenen | Gerçekleşen | Sonuç | Sorun/Kök Neden |
|---|---:|---:|---|---|
| Paraşüt aktif contacts | API sonucu | 440 (`filter[archived]=false`, tam pagination) | PASS | — |
| Paraşüt arşivli contacts | API sonucu | 8 (`filter[archived]=true`, tam pagination) | PASS | — |
| Paraşüt toplam contacts | aktif + arşivli | 440 + 8 = 448 | PASS | — |
| Supabase aktif kayıt | API aktif sayısı (440) | 440 (`Content-Range` ile doğrulandı) | PASS | — |
| Supabase arşivli kayıt | API arşivli sayısı (8) | 8 (`Content-Range` ile doğrulandı) | PASS | — |
| Supabase toplam kayıt | API toplamı (448) | 448 (`Content-Range` ile doğrulandı) | PASS | — |
| Son sync sayaçları | API ile aynı | `active_fetched_count=440, archived_fetched_count=8, upserted_count=448, error_count=0` | PASS | — |
| Local Supabase doğrulama (Docker) | local dry-run/test mümkün olmalı | Docker daemon oturum boyunca yanıt vermedi | **BLOCKED** | Bkz. FAIL/BLOCKED bölümü — Docker Desktop altyapı sorunu, bu fazın koduyla ilgisi yok |
| Varsayılan UI filtresi | yalnız aktif | `Musteriler.tsx`/`DemoHome.tsx` kodu varsayılan `archived=false` sorguluyor (kod incelemesiyle doğrulandı) | PASS | Tarayıcıda görsel olarak yeniden teyit edilmedi (bkz. not aşağıda) |
| UI aktif/arşivli/toplam | Supabase ile aynı | UI, Supabase'deki aynı `count:exact` sorgularını kullanıyor → 440/8/448 | PASS | Aynı not |
| Telefon alanı | gerçek API/Supabase verisi | Hosted REST'ten doğrulandı, ör. `"phone":"02125672019"` | PASS | — |
| Ana sayfa | gerçek sayaçlar | HTTP 200, veri REST üzerinden doğrulandı, güncel bundle canlıda | PASS | Tarayıcıda görsel render bu oturumda teyit edilemedi — self-signed sertifika (bkz. FAIL/BLOCKED) |
| /musteriler | HTTP 200 + gerçek veri | HTTP 200, REST verisi doğrulandı | PASS | Aynı not |
| Müşteri detay route'u | doğru gerçek kayıt | `/musteriler/1011029218` ve `/musteriler/1011029178` HTTP 200, REST'teki kayıtla eşleşiyor | PASS | Aynı not |
| Mobil/yatay taşma | kolon kaybı yok | `overflow-x-auto` + `min-w` kodu deploy edildi; gerçek tarayıcıda scroll/kırpılma davranışı görülmedi | **BLOCKED** | Bkz. FAIL/BLOCKED bölümü |
| Migration deploy | hosted uygulanmış | `supabase migration list`: 4/4 migration local=remote | PASS | İlk deneme hatalıydı, düzeltilip tekrar başarıyla push edildi (bkz. bölüm 7) |
| Edge Function deploy | hosted çalışıyor | Dry-run ve gerçek sync ikisi de 200/success döndü | PASS | — |
| Frontend deploy | canlı bundle güncel | Canlı `index.html` → `index-Cr3lhBdi.js`, yerel build hash'iyle birebir aynı | PASS | — |
| npm test | başarılı | 1/1 test geçti | PASS | — |
| npm run lint | 0 hata | 0 hata, 10 önceden var olan uyarı | PASS | — |
| npm run build:demo | başarılı | Başarılı, `dist/demo` üretildi ve deploy edildi | PASS | — |
| TypeScript kontrolü | 0 hata | 1 hata (`src/pages/Login.tsx:55`) | **FAIL — pre-existing unrelated error** | Bkz. FAIL/BLOCKED bölümü |
| Git commit/push | remote main güncel | `git push` başarılı, `origin/main` bu fazın commit'lerini içeriyor | PASS | — |

## FAIL ve BLOCKED Maddeler

### TypeScript kontrolü (`tsc --noEmit`)
- Durum: FAIL
- Hata mesajı: `src/pages/Login.tsx(55,17): error TS2322: Type '{ variant: string; }' is not assignable to type 'IntrinsicAttributes & LogoProps'. Property 'variant' does not exist on type 'IntrinsicAttributes & LogoProps'.`
- Kesin kök neden: `Login.tsx`, kullanıcının bu oturumlardan önce kendi yazdığı, hâlâ üzerinde çalıştığı bir dosya. `Logo` bileşeninin `LogoProps` tip tanımı `variant` prop'unu içermiyor, ama `Login.tsx` bu prop'u geçiriyor.
- Bu fazdan mı kaynaklandı, önceden mi vardı: Önceden vardı. Faz 1, Faz 1.1 ve Faz 1.2 boyunca `Login.tsx`'e hiç dokunulmadı (kullanıcı talimatı: "Login ile ilgilenme, bu konuya zaman harcama").
- Canlı sistemi etkiliyor mu: Hayır. Gerçek deploy'da kullanılan `npm run build:demo` (Vite/esbuild) tip hatalarını build'i durdurmadan geçiyor; `demo.eclipsemuhendislik.com` başarıyla build edilip deploy edildi ve çalışıyor. `tsc --noEmit` görev talimatındaki zorunlu üçlünün (`npm test`, `npm run lint`, `npm run build:demo`) parçası değil, ek bilgilendirme kontrolü.
- Yapılan denemeler: Hiçbiri — talimat gereği `Login.tsx`'e dokunulmadı.
- Düzeltilmesi için gereken işlem: `LogoProps` tipine `variant` prop'unun eklenmesi. Bu, kullanıcının kendi Login çalışmasının parçası.
- Sonraki faza bırakıldıysa nedeni: Kapsam dışı — kullanıcı açıkça Login ile ilgilenilmemesini istedi.

### Local Supabase doğrulama (Docker)
- Durum: BLOCKED
- Hata mesajı: `npx supabase start` → `{"_tag":"Error","error":{"code":"LegacyDockerLifecycleInspectError","message":"failed to inspect container health"}}`. Sonraki denemelerde `docker ps` / `docker ps -a` → `request returned 500 Internal Server Error for API route ... check if the server supports the requested API version`. Daha sonraki bir deneme 15 saniyede yanıt vermeden zaman aşımına uğradı; `docker version` arka planda boş çıktıyla `exit 0` döndü (daemon'ın kararsız olduğunun ek bir işareti).
- Kesin kök neden: Bu makinedeki Docker Desktop daemon'ı bu oturum boyunca kararsız/yanıtsızdı. Docker Desktop'a özgü bir altyapı sorunu; bu fazın kod veya migration değişikliğiyle hiçbir ilgisi yok.
- Bu fazdan mı kaynaklandı, önceden mi vardı: Bu fazda ortaya çıktı. Faz 1.1'de local Docker sorunsuz çalışmış, local Supabase stack'i başarıyla başlatılıp gerçek uçtan uca test edilmişti (dry-run + real sync + concurrency lock testleri). Bu fazda ortam koşulu değişti; kod değişikliği değil.
- Canlı sistemi etkiliyor mu: Doğrudan hayır. Ancak bu, migration/Edge Function'ı hosted'a göndermeden önce local'de dry-test etme imkanını ortadan kaldırdı. Bunun yerine değişiklikler doğrudan hosted'a push edildi ve orada dry-run + gerçek sync ile doğrulandı; migration'ın ilk hatalı versiyonu hosted'da temiz bir şekilde (transaction rollback, doğrulanmış) geri alındı, kısmi durum oluşmadı.
- Yapılan denemeler: `npx supabase start` (2 kez), `npx supabase stop` sonrası tekrar `start`, `docker ps`, `docker ps -a`, `docker version` — hiçbiri kararlı/kullanılabilir bir sonuç vermedi.
- Düzeltilmesi için gereken işlem: Docker Desktop'ın bu makinede yeniden başlatılması/onarılması. Bu oturumun araçlarıyla yapılamaz, kullanıcı tarafında bir işlem gerektiriyor.
- Sonraki faza bırakıldıysa nedeni: Docker Desktop'ı onarmak bu oturumun yetkisi dışında. Hosted doğrulama (migration, Edge Function, gerçek sync, sayı eşleşmesi) yeterli kanıt sağladığı için faz bu şekilde tamamlandı, ancak local doğrulama adımı resmi olarak BLOCKED işaretleniyor — gizlenmiyor.

### Mobil/yatay taşma görsel doğrulaması
- Durum: BLOCKED
- Hata mesajı: Kod hatası değil — tarayıcı/ağ katmanında: WebFetch → `"self signed certificate"`; yerel `curl` (sertifika doğrulamalı) → `schannel: SEC_E_UNTRUSTED_ROOT (0x80090325)`.
- Kesin kök neden: `demo.eclipsemuhendislik.com` self-signed bir sertifika sunuyor (Faz 1.1'de `openssl s_client` ile doğrulandı: `subject=CN=demo.eclipsemuhendislik.com`, `issuer=CN=demo.eclipsemuhendislik.com`, aynı gün verilmiş). Bu oturumdaki hiçbir sertifika doğrulaması yapan araç (WebFetch, gerçek tarayıcı benzeri istemciler) sayfayı çekip render edemiyor; bu yüzden `overflow-x-auto` düzeltmesinin gerçek bir tarayıcıda beklendiği gibi çalıştığı — kolonların artık kırpılmadığı, yatay kaydırmanın çalıştığı — görsel olarak teyit edilemedi.
- Bu fazdan mı kaynaklandı, önceden mi vardı: Sertifika sorunu önceden vardı (Faz 1.1'de tespit edildi; hosting/SSL sağlayıcı sorunu, bu fazın kod değişikliğiyle ilgisi yok). Ancak bu fazda yapılan CSS düzeltmesinin (`overflow-x-auto`, `min-w-[...]`) gerçekten işe yaradığı, aynı sertifika sorunu yüzünden bu fazda da görsel olarak doğrulanamadı.
- Canlı sistemi etkiliyor mu: Sertifika sorunu evet — gerçek son kullanıcıların tarayıcısında güven uyarısı gösterebilir, ama bu fazın kapsamı dışında bir hosting/DNS/SSL sorunu, kodla ilgisi yok. Scroll/kolon düzeltmesinin kendisi canlıya deploy edildi (yerel build çıktısında ve yüklenen `index-Cr3lhBdi.js`/`index-RqOK1I0q.css` içinde mevcut).
- Yapılan denemeler: `curl -k` (sertifika doğrulaması atlanarak) ile HTTP 200 ve doğru bundle referansı doğrulandı; WebFetch ile gerçek doğrulamalı erişim denendi, sertifika hatasıyla reddedildi; bu ortamda headless tarayıcı (Playwright vb.) kurulu değildi, görev kapsamı dışında ek bağımlılık olarak kurulmadı.
- Düzeltilmesi için gereken işlem: `demo` subdomain'i için geçerli bir TLS sertifikası (AutoSSL/Let's Encrypt) sağlanmalı. Sonrasında Claude Browser veya gerçek bir tarayıcı ile `/musteriler` dar ekran genişliğinde açılıp yatay kaydırmanın çalıştığı ve "Tür" kolonunun artık kırpılmadığı teyit edilmeli.
- Sonraki faza bırakıldıysa nedeni: Sertifika sorunu bu oturumda çözülemez (hosting/SSL sağlayıcı tarafında işlem gerektiriyor, kod değişikliği değil) ve bu ortamda güvenilir bir headless tarayıcı yok. Görsel doğrulama Claude Browser'a veya sertifika düzeltildikten sonraki bir oturuma bırakıldı.

## Genel Karar

**PASS WITH KNOWN ISSUES**

- **Kritik canlı sorun var mı?** Hayır. Migration, Edge Function, gerçek sync, sayı eşleşmesi ve tüm route'lar (HTTP seviyesinde) canlıda PASS.
- **Paraşüt API–Supabase–UI sayıları eşleşiyor mu?** Evet — aktif 440 / arşivli 8 / toplam 448, üç katmanda da birebir eşleşiyor (UI tarafı, Supabase'e karşı UI'ın kullandığı gerçek sorgularla doğrulandı; tam DOM render'ı görsel olarak teyit edilmedi, sebebi yukarıda ayrı madde olarak işaretli).
- **Canlıya deploy edildi mi?** Evet — migration hosted'a uygulandı, Edge Function hosted'a deploy edildi ve gerçek veriyle çalıştırıldı, frontend build'i FTP ile `demo.eclipsemuhendislik.com`'a yüklendi ve bundle hash'i canlıda doğrulandı.
- **Claude Browser testine hazır mı?** Evet, iki bilinen sınırlamayla: (1) self-signed sertifika nedeniyle tarayıcı bir güven uyarısı gösterebilir/bypass gerektirebilir, (2) mobil/yatay taşma düzeltmesi kod olarak deploy edildi ama henüz görsel olarak teyit edilmedi.
- **Bir sonraki gerekli işlem nedir?** (1) `demo` subdomain'i için geçerli SSL sertifikası sağlanmalı, (2) Claude Browser ile gerçek tarayıcı görsel doğrulaması yapılmalı (sayaçlar, Aktif/Arşivli/Tümü filtreleri, telefon alanı, mobil/yatay scroll), (3) Docker Desktop bu makinede onarılmalı ki sonraki fazlarda local doğrulama tekrar mümkün olsun.
