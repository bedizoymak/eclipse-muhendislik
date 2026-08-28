# Phase 13.6 — Route Guard, Not Found ve Var Olmayan Kayıt Davranışı

- Kod commit SHA: `226c1abbaa9ac95c4d3a1694eafa1fe4e1c4b0e9`
- Rapor commit SHA: (bu commit)
- Önceki phase (temel alınan): Phase 13.5, kod commit `ad8d084`
- Canlı: https://demo.eclipsemuhendislik.com

Bu phase kapsamında **hiçbir migration, Edge Function, sync veya Paraşüt veri
tablosuna dokunulmadı**. Sadece route/guard ve "kayıt bulunamadı" davranışı
düzeltildi.

## 1. Kök neden

`App.tsx`'teki demo route tablosunda, kimliksiz (statik) alt yollar ile
`:parasutId` dinamik desenleri aynı üst path altında tanımlıydı:

```
/giderler/maaslar            (statik)
/giderler/maaslar/:parasutId (dinamik)
...
/giderler/:parasutId         (catch-all altı)
```

`/giderler/etiketler` ve `/urunler/kategoriler` için gerçek statik route
tanımlı değildi (gerçek yollar `/ayarlar/etiketler` ve `/stok/kategoriler`),
bu yüzden bu iki yol sırasıyla `/giderler/:parasutId` ve `/urunler/:parasutId`
desenlerine `parasutId="etiketler"` / `parasutId="kategoriler"` olarak
düşüyordu. `GiderDetay.tsx` / `UrunDetay.tsx` bu string'i doğrudan
`.eq("parasut_id", parasutId)` ile bigint sütununa karşı sorguluyordu — bu,
gerçek bir sonuç değil, olası bir malformed-request riski.

Ayrıca `MaasDetay.tsx` ve `VergiDetay.tsx`, ana kayıt (salary/tax) henüz
yüklenmeden veya hiç var olmadan, ikincil ilişki sorgusunu (`tags` junction)
koşulsuz olarak (`parasutId` truthy olur olmaz) başlatıyordu — bu da var
olmayan bir kayıt için "gerçek ilişki, bugün 0 satır" mesajı göstererek var
olmayan bir ebeveyn kaydı hakkında zımni bir iddiada bulunuyordu.

Son olarak, tanımsız route'lar (`/e-fatura-kutulari`, `/bilinmeyen-route` vb.)
`<Route path="*" element={<DemoHome />} />` ile sessizce demo ana sayfasına
düşüyordu — gerçek bir 404 ekranı yoktu.

## 2. Yapılan değişiklikler

### 2.1 `src/lib/parasutId.ts` (yeni)
`isValidParasutId(value)` — tam string eşleşmesi yapan `^[1-9][0-9]*$`
regex'i ile doğrulama. ID hiçbir zaman `Number`/`parseInt` ile
dönüştürülmüyor (gerçek büyük Paraşüt ID'lerinde JS double-precision
kaybı riskini önlemek için string olarak tutulup karşılaştırılıyor).
`parseInt("123abc")` gibi kısmi eşleşmeleri KABUL ETMEZ; `0`, negatif,
ondalık, boş, boşluklu ve alfanümerik değerleri reddeder.

### 2.2 `src/components/ParasutIdRoute.tsx` (yeni)
Tüm `/:parasutId` route'ları için paylaşılan, tek noktadan uygulanan route
guard. `useParams` ile parametreyi okur; geçersizse **hiç mount etmeden**
gerçek `NotFound` sayfasını render eder — böylece sarmalanan detay
sayfasının kendi Supabase sorgu efekti asla çalışmaz (component hiç
mount olmuyor, "mount olup sorguyu atla" değil).

### 2.3 `src/App.tsx`
13 adet dinamik `/:parasutId` route'unun tamamı `<ParasutIdRoute>` ile
sarmalandı (bkz. bölüm 4 — tam envanter). Demo route tablosundaki
`<Route path="*" element={<DemoHome />} />` kaldırılıp
`<Route path="*" element={<NotFound />} />` ile değiştirildi.

### 2.4 `src/pages/NotFound.tsx`
Türkçeleştirildi ("Sayfa bulunamadı"), demo modda "Demo ana sayfasına dön"
linkiyle güvenli bir `Link to="/"` sunuyor (marketing modda "Ana sayfaya
dön"). Route'tan hiçbir iş verisi/açıklama türetilmiyor (sadece teşhis
amaçlı `console.error` ile ham path loglanıyor — mevcut davranış korundu).
Supabase sorgusu yok.

### 2.5 `src/pages/MaasDetay.tsx` / `src/pages/VergiDetay.tsx`
İkincil `tags` junction sorgusu artık `row` (ana kayıt) gerçekten
yüklenip var olduğu teyit edilmeden **hiç çalışmıyor**
(`if (!supabase || !parasutId || !row) return;`). Ayrıca "Etiketler"
bölümünün tamamı (`<div>`) artık sadece `row` truthy olduğunda render
ediliyor — var olmayan bir kayıt için ne gerçek etiket listesi ne de
"bağlı etiket yok" boş-durum mesajı gösterilmiyor (ikisi de var olmayan
bir ebeveyni ima eder).

`EtiketDetay.tsx` ve `UrunKategoriDetay.tsx` zaten hiçbir ikincil ilişki
sorgusu çalıştırmıyordu (`UrunKategoriDetay`'daki alt kategoriler,
Faz 13.2'de yakalanmış jsonb sütunundan doğrudan render ediliyor, ayrı bir
sorgu değil) — değişiklik gerekmedi.

### 2.6 `src/test/parasutId.test.ts` (yeni)
`isValidParasutId` için 14 birim testi (bkz. bölüm 5).

## 3. Route/guard envanteri (Bölüm 4 gereksinimi)

Tüm `/:parasutId`-tipi route'lar (demo uygulaması, `src/App.tsx`):

| Route | Sayfa | Guard | Geçersiz ID sorgusu engelleniyor mu | Not Found |
|---|---|---|---|---|
| `/musteriler/:parasutId` | MusteriDetay | ParasutIdRoute | Evet | Evet |
| `/satislar/faturalar/:parasutId` | FaturaDetay | ParasutIdRoute | Evet | Evet |
| `/satislar/tahsilatlar/:parasutId` | TahsilatDetay | ParasutIdRoute | Evet | Evet |
| `/giderler/calisanlar/:parasutId` | CalisanDetay | ParasutIdRoute | Evet | Evet |
| `/giderler/maaslar/:parasutId` | MaasDetay | ParasutIdRoute | Evet | Evet |
| `/giderler/vergiler/:parasutId` | VergiDetay | ParasutIdRoute | Evet | Evet |
| `/giderler/:parasutId` | GiderDetay | ParasutIdRoute | Evet (önceden `/giderler/etiketler` burada malformed sorguya düşüyordu) | Evet |
| `/urunler/:parasutId` | UrunDetay | ParasutIdRoute | Evet (önceden `/urunler/kategoriler` burada malformed sorguya düşüyordu) | Evet |
| `/stok/sevkiyat-irsaliyeleri/:parasutId` | SevkiyatDetay | ParasutIdRoute | Evet | Evet |
| `/nakit/cekler/:parasutId` | CekDetay | ParasutIdRoute | Evet | Evet |
| `/satislar/teklifler/:parasutId` | TeklifDetay | ParasutIdRoute | Evet | Evet |
| `/ayarlar/etiketler/:parasutId` | EtiketDetay | ParasutIdRoute | Evet | Evet |
| `/stok/kategoriler/:parasutId` | UrunKategoriDetay | ParasutIdRoute | Evet | Evet |

Marketing (statik) uygulamasında `:parasutId`-tipi hiçbir route yok
(`/login` ve dil bazlı statik `marketingRoutes` dizisi dışında dinamik
segment içeren route bulunmuyor).

## 4. Geçerli/geçersiz ID testleri (canlıda, headless Chrome/Puppeteer, CDP)

Gerçek çalışan Paraşüt ID'leri önceki phase raporlarından test girdisi
olarak kullanıldı (prodüksiyon kodunda hiçbir ID hardcode edilmedi):

| Girdi | Sonuç |
|---|---|
| `/musteriler/0` | Not Found ("Sayfa bulunamadı"), 0 Supabase isteği |
| `/musteriler/-1` | Not Found, 0 Supabase isteği |
| `/musteriler/1.5` | Not Found, 0 Supabase isteği |
| `/musteriler/123abc` | Not Found, 0 Supabase isteği |
| `/giderler/abc123` | Not Found, 0 Supabase isteği |
| `/giderler/etiketler` | Not Found, 0 Supabase isteği (önceden malformed bigint sorgusu riskiydi) |
| `/urunler/kategoriler` | Not Found, 0 Supabase isteği (önceden malformed bigint sorgusu riskiydi) |

Birim testleri (`src/test/parasutId.test.ts`, 14 test, `npm test` ile
çalıştırıldı — hepsi PASS): `1`, uzun gerçek-boyutlu bir Paraşüt ID string'i
(`"19281928192819281"`) kabul ediliyor; `0`, `-1`, `1.5`, `123abc`,
`abc123`, boş string, sadece boşluk, `undefined`, `null`, öndeki-sıfırlı
`"007"` ve boşluk dolgulu `" 123 "` reddediliyor.

## 5. Global Not Found doğrulaması (canlı, Puppeteer CDP)

| Route | HTTP durumu | "Sayfa bulunamadı" | Supabase isteği | Console hatası |
|---|---|---|---|---|
| `/e-fatura-kutulari` | 200 | Evet | 0 | Sadece teşhis `console.error` (mevcut/beklenen NotFound loglaması) |
| `/bilinmeyen-route` | 200 | Evet | 0 | aynı |
| `/satislar/bilinmeyen/123` | 200 | Evet | 0 | aynı |
| `/giderler/etiketler` | 200 | Evet | 0 | aynı |
| `/urunler/kategoriler` | 200 | Evet | 0 | aynı |

Gerçek hard-refresh'te tüm route'lar HTTP 200 döndü (statik hosting +
SPA fallback `dist/demo/404.html` mevcut, `scripts/create-spa-fallback.mjs`
ile üretiliyor — Faz kapsamında dokunulmadı). 0 başarısız (>=400) network
isteği.

## 6. Var olmayan kayıt davranışı (canlı, Puppeteer CDP)

| Route | HTTP | "Kayıt bulunamadı" | Ana tablo isteği | İkincil ilişki isteği | Console hatası | Ağ hatası |
|---|---|---|---|---|---|---|
| `/giderler/maaslar/999` | 200 | Evet | `parasut_salaries_demo?...parasut_id=eq.999` | **0** (salary_tags sorgusu çalışmadı) | 0 | 0 |
| `/giderler/vergiler/999` | 200 | Evet | `parasut_taxes_demo?...parasut_id=eq.999` | **0** (tax_tags sorgusu çalışmadı) | 0 | 0 |
| `/ayarlar/etiketler/999` | 200 | Evet | `parasut_tags_demo?...parasut_id=eq.999` | 0 (zaten ikincil sorgusu yok) | 0 | 0 |
| `/stok/kategoriler/999` | 200 | Evet | `parasut_item_categories_demo?...parasut_id=eq.999` | 0 (zaten ikincil sorgusu yok) | 0 | 0 |

Her satırda: ana sorgu 200 döndü (0 satır → `maybeSingle()` → `null`),
"Kayıt bulunamadı" gösterildi, hiçbir tags/relationship bölümü render
edilmedi (ne gerçek liste ne de "bağlı X yok" boş-durum mesajı), sahte bir
"Maaş #999" gibi başlık gösterilmedi (`EmptyResourceDetail` her zaman
`{title} #{parasutId}` başlığını gösterir — bu, kullanıcının girdiği route
parametresinin kendisidir, API'den türetilmiş bir iş verisi değildir; kayıt
bulunamadığında altında sadece "Kayıt bulunamadı" bloğu görünür, asla
sahte alan verisi).

## 7. Test / build / typecheck / lint sonuçları

- `npm test`: **49/49 PASS** (3 dosya: `example.test.ts`, `parasutId.test.ts` [14 yeni], `schema_guard.test.ts` [34, önceki fazlardan]).
- `npm run lint`: **0 hata**, 20 önceden var olan (bu fazda dokunulmayan dosyalarda) `react-refresh/only-export-components` uyarısı.
- `npx tsc --noEmit -p tsconfig.app.json`: **tek hata**, bilinen kapsam dışı `src/pages/Login.tsx(55,17)` (`variant` prop `LogoProps`'ta yok) — bu faz kapsamında dokunulmadı, önceki fazlardan beri bilinen bir sorun.
- `npm run build:demo`: **başarılı** (1725 modül, `dist/demo/` üretildi, SPA fallback `404.html` oluşturuldu).
- 390px ve 768px viewport'larda `/bilinmeyen-route` (Not Found) için yatay taşma yok (`scrollWidth === clientWidth` her ikisinde de).

## 8. Deploy ve doğrulama

`python scripts/full_deploy.py` ile hem ana site (`eclipsemuhendislik.com`)
hem demo (`demo.eclipsemuhendislik.com`) yeniden build edilip FTP üzerinden
deploy edildi (main site de deploy edildi çünkü paylaşılan `NotFound.tsx`
her iki modda da kullanılıyor).

Bundle hash doğrulaması: yerel `dist/demo/index.html` içindeki
`index-X969jfgN.js` ile canlı `https://demo.eclipsemuhendislik.com/`
üzerinden çekilen HTML içindeki `index-X969jfgN.js` **birebir eşleşiyor**.

## 9. Nihai değerlendirme

**PASS.**

- Bölüm 1 (numeric ID route guard): tamamlandı — `ParasutIdRoute` + `isValidParasutId`, tüm 13 dinamik route'a uygulandı, `/giderler/etiketler` ve `/urunler/kategoriler` artık Not Found'a düşüyor, 0 Supabase isteği.
- Bölüm 2 (global Not Found): tamamlandı — `path="*"` artık `NotFound`, tüm 5 test route'u doğrulandı, hiçbiri route'tan iş verisi türetmiyor, Supabase sorgusu yok.
- Bölüm 3 (var olmayan kayıt): tamamlandı — 4 route'un tamamında ana sorgu 200/0-satır, "Kayıt bulunamadı" gösteriliyor, ikincil ilişki sorguları (salary_tags, tax_tags) artık `row` onaylanmadan asla çalışmıyor, hiçbir sahte ilişki/başlık verisi yok.
- Bölüm 4 (envanter): tamamlandı — bkz. bölüm 3 tablosu, 13/13 dinamik route guard'lı.
- Bölüm 5 (test): tamamlandı — 14 yeni birim testi + 49/49 toplam test PASS, lint 0 hata, tsc yalnızca bilinen `Login.tsx:55`, build başarılı, 0 yatay taşma.
- Bölüm 6 (deploy): tamamlandı — canlıya deploy edildi, bundle hash doğrulandı.

Bilinen kapsam dışı sorun (bu fazda değiştirilmedi, PASS'i etkilemez):
`src/pages/Login.tsx:55` TS hatası (`LogoProps` üzerinde olmayan `variant`
prop'u) — önceki fazlardan beri bilinen, marketing/login akışına ait,
Phase 13.6'nın route-guard/Not-Found kapsamının tamamen dışında.

Migration, Edge Function, sync veya Paraşüt veri tablolarına **hiç
dokunulmadı** — bu fazın açık kısıtı korundu.
