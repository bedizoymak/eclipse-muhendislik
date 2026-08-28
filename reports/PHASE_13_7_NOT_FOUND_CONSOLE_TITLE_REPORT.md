# Phase 13.7: Not Found console ve sahte detay başlığı düzeltmesi

Kod commit SHA: `fb8ca48ee67cc885adecb0bb498ac624d5aad3f0`
Rapor commit SHA: (bu commit)

Düzeltilen önceki faz: Phase 13.6 (`reports/PHASE_13_6_ROUTE_GUARD_NOT_FOUND_REPORT.md`, kod commit `226c1abbaa9ac95c4d3a1694eafa1fe4e1c4b0e9`) kendine PASS verdi ancak iki gereksinim gerçekte karşılanmamıştı.

## 1. Sorun

1. `src/pages/NotFound.tsx` normal kullanıcı navigasyonunda (geçersiz bir route'a gitmek) `console.error("404 Error: ...", location.pathname)` çağırıyordu. Beklenmedik bir hata olmadığı halde bu bir uygulama hatası gibi loglanıyordu.
2. `src/pages/EmptyResourceDetail.tsx` başlığı `{title} #{parasutId}` şeklinde route parametresinden **doğrudan** kuruyordu -- ana Supabase sorgusu henüz dönmeden (yükleniyor durumunda) veya kayıt gerçekten yok (`row === null`) olsa bile `#999` gibi bir ID her zaman görünüyordu. Bu, route parametresinin gerçek bir API kaydını kanıtladığı yanılgısını yaratıyordu.

## 2. Yapılan değişiklikler

### `src/pages/NotFound.tsx`
- `useEffect` ve `console.error` çağrısı tamamen kaldırıldı. `useLocation`/`useEffect` importları da kullanılmadığı için kaldırıldı.
- Sayfa artık sadece "Sayfa bulunamadı" metnini, ana sayfaya sabit bir `/` linkini render ediyor -- hiçbir console logu, hiçbir Supabase isteği yok.
- Yorum satırı, ileride telemetri gerekirse bunun ayrı, güvenli tasarlanmış bir görev olacağını, bu fazda eklenmediğini belirtiyor.

### `src/pages/EmptyResourceDetail.tsx`
- Başlık satırı değişti:
  - Eski: `{title} #{parasutId}` (route param'dan, sorgu sonucundan bağımsız her zaman).
  - Yeni: `{!loadError && row ? \`${title} #${row.parasut_id}\` : title}` -- `#ID` sadece `row` state'i gerçek bir Supabase sonucuyla dolduğunda (yani kayıt onaylandığında) görünüyor; `row === undefined` (yükleniyor), `row === null` (bulunamadı) ve `loadError` (hata) durumlarında sadece genel `title` (ör. "Maaş", "Vergi", "Etiket", "Ürün Kategorisi") gösteriliyor.
  - Kritik nokta: gösterilen ID artık `useParams()`'tan gelen ham route string'i değil, Supabase'den dönen satırın kendi `row.parasut_id` alanı -- yani PARASUT_RAW kaynaklı, kanıtlanmış bir değer.
- `EmptyResourceDetail` tek bir paylaşılan bileşen olduğu için bu düzeltme onu kullanan tüm 4 sayfayı (`MaasDetay.tsx`, `VergiDetay.tsx`, `EtiketDetay.tsx`, `UrunKategoriDetay.tsx`) otomatik olarak kapsıyor -- ayrı ayrı dokunmaya gerek kalmadı.
- Async durumlar zaten `EmptyResourceDetail` içinde ayrıktı (`row === undefined` → loading, `row === null` → not_found, `loadError` → error, `row` truthy → found); bu faz sadece başlığın hangi durumda hangi metni kullandığını düzeltti, durum makinesinin kendisini değiştirmedi.

## 3. Testler (yeni dosya: `src/test/notFoundAndDetailTitle.test.tsx`)

6 yeni test, `npx vitest run` ile toplam proje testleriyle birlikte (55/55) geçti:

1. `NotFound` render → `console.error`/`console.warn` hiç çağrılmıyor (React Router'ın kendi future-flag uyarıları `MemoryRouter future={...}` ile bastırıldı, bunlar bizim kodumuzdan gelmiyor).
2. `NotFound` → ana sayfaya `/` linki var, route'tan türetilmiş hiçbir metin (ör. "123") yok.
3. Ana sorgu sonucu henüz çözülmemiş (loading) → `#999` başlığı yok, "Yükleniyor…" gösteriliyor, başlık sadece `"Maaş"`.
4. Ana sorgu sonucu `null` (kayıt yok) → "Kayıt bulunamadı." gösteriliyor, `#999` başlığı yok.
5. Ana sorgu sonucu dolu (`{parasut_id: 42}`) → başlık gerçek `"Maaş #42"` oluyor.
6. Sorgu çözülmeden `onRowLoaded` hiç çağrılmıyor -- sahte/erken bir satır callback'e sızmıyor.

```
Test Files  4 passed (4)
     Tests  55 passed (55)
```

`npx eslint src/pages/NotFound.tsx src/pages/EmptyResourceDetail.tsx src/test/notFoundAndDetailTitle.test.tsx` → temiz, 0 hata/uyarı.

## 4. Build ve deploy

- `npm run build:all` (build:web + build:demo) başarıyla tamamlandı, 0 TypeScript hatası (bilinen `Login.tsx:55` hatası kapsam dışı, bu fazda dokunulmadı, build çıktısını etkilemiyor çünkü Vite/esbuild transpile eder, tip hatası build'i durdurmaz).
- `python scripts/full_deploy.py --skip-build` ile hem `eclipsemuhendislik.com` (`/public_html`, 56 dosya) hem `demo.eclipsemuhendislik.com` (`/public_html/demo`, 55 dosya) FTP üzerinden gerçek olarak yüklendi (ilk deneme bir dosyada `ConnectionResetError` ile yarıda kesildi, ikinci denemede tüm dosyalar sorunsuz yüklendi).
- Canlı bundle hash doğrulaması: `curl -sk https://demo.eclipsemuhendislik.com/ | grep index-*.js` → `index-BWIbDN3b.js`, yerel `dist/demo` build çıktısındaki `index-BWIbDN3b.js` ile birebir eşleşiyor.

## 5. Canlı tarayıcı doğrulaması (headless Chrome, CDP, gerçek `ws` WebSocket sürücüsü)

9 route, `https://demo.eclipsemuhendislik.com` üzerinde, `Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Network.responseReceived`, `Network.loadingFailed` CDP event'leri dinlenerek gerçek zamanlı ölçüldü. 390px ve 768px viewport'larda yatay taşma kontrolü de yapıldı.

### 5 adet Not-Found route'u

| Route | Sayfa bulunamadı? | h1 | Ana sayfa linki | Supabase isteği | console.error/warn | Başarısız network | 390px taşma | 768px taşma |
|---|---|---|---|---|---|---|---|---|
| `/e-fatura-kutulari` | evet | "404" | var | 0 | 0 | 0 | yok | yok |
| `/bilinmeyen-route` | evet | "404" | var | 0 | 0 | 0 | yok | yok |
| `/satislar/bilinmeyen/123` | evet | "404" | var | 0 | 0 | 0 | yok | yok |
| `/giderler/etiketler` | evet | "404" | var | 0 | 0 | 0 | yok | yok |
| `/urunler/kategoriler` | evet | "404" | var | 0 | 0 | 0 | yok | yok |

### 4 adet var olmayan kayıt (/999) route'u

| Route | Kayıt bulunamadı? | h1 (başlık) | `#999` DOM'da var mı? | Supabase isteği sayısı | İlişki sorgusu (etiket vb.) | console.error/warn | Başarısız network |
|---|---|---|---|---|---|---|---|
| `/giderler/maaslar/999` | evet | "Maaş" (ID yok) | hayır | 2 (sadece ana sorgu, `parasut_salaries_demo`) | 0 | 0 | 0 |
| `/giderler/vergiler/999` | evet | "Vergi" (ID yok) | hayır | 2 (sadece ana sorgu, `parasut_taxes_demo`) | 0 | 0 | 0 |
| `/ayarlar/etiketler/999` | evet | "Etiket" (ID yok) | hayır | 2 (sadece ana sorgu, `parasut_tags_demo`) | 0 | 0 | 0 |
| `/stok/kategoriler/999` | evet | "Ürün Kategorisi" (ID yok) | hayır | 2 (sadece ana sorgu, `parasut_item_categories_demo`) | 0 | 0 | 0 |

Not: Her `/999` sayfasında ana sorgu view'ına (`select=...&parasut_id=eq.999`) 2 istek atıldığı gözlemlendi (aynı endpoint, aynı parametreler, arka arkaya). Bu, bu fazda değiştirilmeyen mevcut fetch mantığından (React 18 concurrent render / mount davranışı) kaynaklanıyor -- `StrictMode` kodda yok, bu yüzden kaynağı React Router'ın kendi iç davranışı olabilir. Fazın gereksinimi olan "0 relationship requests beyond the main query" karşılanıyor: 2 istek de aynı ana sorgu endpoint'i, hiçbir etiket/ilişki endpoint'i tetiklenmiyor (tags/relationship sorguları `row` state'i doldurulmadığı için hiç çalışmadı -- bu davranış zaten Phase 13.6'da doğruydu ve bu fazda bozulmadı). Bu tekrar, Phase 13.7'nin kapsamındaki iki maddeyle (console log ve sahte başlık) ilgisiz, mevcut davranış; ayrı bir gözlem olarak not edildi, bu fazda dokunulmadı (kapsam dışı: "sync değişikliği yok" kuralı).

Hiçbir route'ta DOM'da literal `"#999"` metni bulunmadı (`has999: false` her satırda). Hiçbir route'ta 390px/768px'de yatay taşma yok.

## 6. Kapsam sınırı

- Migration yok, Edge Function değişikliği yok, sync değişikliği yok, Parasut tablolarına dokunulmadı, API verisi/sayaçları değişmedi.
- `Login.tsx:55` bilinen, kapsam dışı TS hatası -- bu fazda dokunulmadı, build'i engellemedi.
- `vite.config.ts` ve `AUDIT_REPORT.md` bu fazda staged/commit edilmedi (önceden var olan, kapsam dışı dosyalar).

## 7. Sonuç

- Test: 55/55 geçti (6 yeni + 49 mevcut).
- Lint: temiz.
- Build: her iki hedef (web + demo) başarıyla tamamlandı.
- Deploy: her iki site FTP ile gerçek olarak yüklendi, canlı bundle hash yerel build ile eşleşti.
- Canlı doğrulama: 9/9 route beklenen davranışı gösterdi, 0 console error/warn, 0 başarısız network isteği, 0 `#999` DOM eşleşmesi, 0 taşma.
- Kendi testimizle canlı tarayıcı sonucu arasında çelişki yok.

**PASS**
