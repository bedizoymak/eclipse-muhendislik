# Phase 08.2 — E-Belge URL, Sayaç Network ve Mobil Filtre Düzeltmesi

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/satislar/faturalar
**Kod commit SHA:** `add6eb8376a0fa82e8bd01b2be33651ecbbd2305`
**Rapor commit SHA:** (bu commit)

## Özet

`PHASE_08_BROWSER_REPORT.md`'nin bulduğu 2 FAIL ve 1 mobil kullanılabilirlik sorunu düzeltildi. Üçü de **UI katmanı** sorunuydu — API verisi, e-belge mapping'i, parent ilişkileri ve alan kapsamı doğruydu, hiçbiri değiştirilmedi. **Migration veya Edge Function deploy gerekmedi.**

## 1. URL çözümleme kuralı

`src/lib/eDocuments.ts`'e tek, paylaşılan `resolveEDocumentUrl()` yardımcı fonksiyonu eklendi ve `src/components/EDocumentSection.tsx`'in `LinkButton`'ı (hem fatura hem gider ekranında kullanılan tek yer) artık `pdf_url`/`signed_ubl_url`/`html_url`'nin üçünü de bu fonksiyondan geçiriyor:

```ts
const PARASUT_APP_ORIGIN = "https://uygulama.parasut.com";
export function resolveEDocumentUrl(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  if (value.trim().startsWith("//")) return null; // protocol-relative reddedilir
  let resolved: URL;
  try { resolved = new URL(value, PARASUT_APP_ORIGIN); } catch { return null; }
  if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return null;
  return resolved.href;
}
```

- Göreli yol (`/666034/...`) → `PARASUT_APP_ORIGIN` tabanına çözülür.
- Zaten mutlak `https://...` (ör. `signed_ubl_url`) → **değiştirilmeden** geçer.
- `null`/boş → link üretilmez, `LinkButton` "—" gösterir.
- `//host/...` (protokol-relative) → reddedilir (base'e göre farklı bir host'a sessizce çözülmesin diye).
- `javascript:`/`data:` gibi güvensiz şema → `new URL()` ya parse hatası verir ya da protokol kontrolünde elenir.
- DB/view'daki ham değer **değiştirilmedi** — çözümleme yalnızca render anında, `LinkButton` içinde yapılıyor.

## 2. Gerçek URL doğrulaması (3 örnek, canlı)

| Kayıt | Alan | API'deki ham değer | href (DOM) | Tarayıcının çözdüğü adres |
|---|---|---|---|---|
| SI `1072353915` → belge `1055802035` | pdf_url | `/666034/e_invoices/1055802035/show_original` | `https://uygulama.parasut.com/666034/e_invoices/1055802035/show_original` | ✅ uygulama.parasut.com |
| | html_url | `/666034/e_invoices/1055802035/fetch_preview_html` | `https://uygulama.parasut.com/666034/e_invoices/1055802035/fetch_preview_html` | ✅ uygulama.parasut.com |
| | signed_ubl_url | `https://uygulama.parasut.com/666034/e_invoices/1055802035/signed_ubl` | aynı (değişmedi) | ✅ uygulama.parasut.com |
| PB `1007881809` → belge `1009548055` | pdf_url | `/666034/e_invoices/1009548055/show_original` | `https://uygulama.parasut.com/666034/e_invoices/1009548055/show_original` | ✅ |
| | html_url | `/666034/e_invoices/1009548055/fetch_preview_html` | `https://uygulama.parasut.com/666034/e_invoices/1009548055/fetch_preview_html` | ✅ |
| | signed_ubl_url | mutlak | aynı | ✅ |
| SI `1014217636` → belge `1007488010` (e_archive) | pdf_url | `/666034/e_archives/1007488010.pdf` | `https://uygulama.parasut.com/666034/e_archives/1007488010.pdf` | ✅ |
| | html_url | `/666034/e_archives/1007488010.html` | `https://uygulama.parasut.com/666034/e_archives/1007488010.html` | ✅ |
| | signed_ubl_url | mutlak | aynı | ✅ |

**Demo domain'ine çözümlenen belge linki: 0/9.** Null/boş URL için sahte buton: 0 (bu hesapta zaten hiçbir belgede boş URL yok, Faz 8/8.1'de kanıtlanmıştı). Tüm linklerde `target="_blank"` ve `rel="noopener noreferrer"` korunuyor (DOM'dan doğrulandı).

## 3. Sayaç 503 hatası düzeltmesi

**Eski desen** (`Faturalar.tsx`/`Giderler.tsx`): her sayfa yüklemesinde `Promise.all` ile eşzamanlı olarak 1 liste sorgusu + **3 ayrı `count=exact` HEAD isteği** (`archived=false`, `archived=true`, filtre yok) atılıyordu — Range header'sız, hepsi aynı anda. Bu istekler tekrarlanabilir şekilde 503 dönüyordu.

**Yeni desen**: sekme sayaçları artık ayrı bir `useEffect` içinde, yalnızca `archived` kolonunu çeken **tek** hafif `GET` isteğiyle (`select=archived`, filtre yok) hesaplanıyor — 451/811 satır, sayfalama sınırının (PostgREST varsayılan 1000) çok altında, gerçek ve eksiksiz. Aktif/arşivli/toplam sayıları bu tek response'un satırlarından `archived===false`/`archived===true` ile türetiliyor; sabit veya eski değer yazılmadı. Liste sorgusu ayrı bir `useEffect`'te, filtre değiştiğinde bağımsız çalışıyor — sayaç isteğiyle artık aynı anda tekrar tetiklenmiyor.

Sales invoices için `archived` ayrımı gerçek API `filter[archived]` davranışına (Faz 2'den beri doğrulanmış) dayanıyor. Purchase bills için API'nin bağımsız `filter[archived]` desteği olmadığı (Faz 4/8'de kanıtlanmıştı) korunuyor — sekme anlamı **değiştirilmedi**, yalnızca her bill'in kendi gerçek `archived` alanından (tek tam listelemeyle senkronize edilmiş) türetiliyor; API'de filtre olmaması bahane edilip sayaç uydurulmadı.

## 4. Network doğrulaması

Gerçek headless Chrome CDP ile her iki liste sayfası doğrudan açıldı, network response'ları izlendi:

- `/satislar/faturalar`: 4 Supabase isteği (2× `select=archived` sayaç + 2× filtrelenmiş liste — CDP navigasyonunun kendi tekrar tetiklemesinden, uygulama kodunda tekrar yok), **hepsi 200**, 0 başarısız.
- `/giderler`: 6 Supabase isteği (tedarikçi listesi + sayaç + liste, ×2), **hepsi 200**, 0 başarısız.
- **503 yok, başarısız HEAD/GET/RPC yok.**
- Console/React runtime hatası yakalanmadı.
- Liste kayıtları önceki fazlarla aynı (451/811).

Sayaçların geldiği sorgu: `GET /rest/v1/parasut_sales_invoices_demo?select=archived` (ve purchase_bills için aynısı) — response'un satır sayısı ve her satırın gerçek `archived` değeri üzerinden `Array.filter().length` ile hesaplanıyor, ayrı bir `count` response alanına bağımlı değil.

## Aktif/arşivli/toplam sayaçları (canlı, doğrudan sorgulanan)

| Kaynak | Aktif | Arşivli | Toplam |
|---|---:|---:|---:|
| Sales invoices | **449** | **2** | **451** |
| Purchase bills | **810** | **1** | **811** |

Rapordaki beklenen değerlerle birebir eşleşiyor, zorlanmadı.

## 5. 390px mobil filtre düzeltmesi

Sorun: tarih filtresi satırı (`flex items-center gap-2`) kendi içinde `flex-wrap` içermiyordu, bu yüzden iki `<input type=date>` + tire, dar viewport'ta kendi container'ından taşıyor/kırpılıyordu (body taşması yoktu ama kontrol kırpılıyordu).

Düzeltme (`Faturalar.tsx` ve `Giderler.tsx`, aynı desen):
- Üst filtre satırı `flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center` — mobilde tek kolon, `sm:` ve üstünde yatay.
- Ödeme durumu `<select>` mobilde `w-full`, `sm:w-auto`.
- Tarih grubu artık `flex-wrap` alıyor; her `<input type=date>` `min-w-0 flex-1 sm:flex-none` — mobilde container genişliğini paylaşarak küçülüyor, `sm:` üstünde eski sabit genişliğine dönüyor.
- Yalnızca `overflow-x-hidden` eklenerek içerik kırpılmadı — gerçek flex/grid yerleşimi düzeltildi.

**Doğrulama (gerçek headless Chrome, 390px):** tarih input'unun `getBoundingClientRect().right` değeri (205.98) viewport genişliğinin (390) içinde — taşma/kırpılma yok. 768px ve masaüstünde eski yerleşim korunuyor (`filterRect.right` 201.98/390 → 433.98/768, container içinde). Body `scrollWidth === clientWidth` her iki genişlikte de doğrulandı (bkz. bölüm 7).

## 6. E-belge regresyonu

E-belge alanları/ilişkileri bu fazda **değiştirilmedi**. Salt okunur sorgularla yeniden doğrulandı:

| Metrik | Beklenen | Gerçek |
|---|---:|---:|
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| E-invoices | 1238 | **1238** ✅ |
| E-archives | 24 | **24** ✅ |
| Parent bağlantısı | 1262 | **1262** (451+811) ✅ |
| Duplicate/unresolved/stale | 0 | **0/0/0** ✅ |

Örnek detaylarda (1072353915, 1007881809, 1014217636) Faz 8.1'in tüm alanları (39 e_invoice / 17 e_archive attribute) hâlâ "Tüm e-belge alanlarını göster" panelinde erişilebilir — yalnızca link `href`'leri değişti, alan kapsamı aynı kaldı. Private teknik alanlar (`rendered_ubl_path` vb.) hâlâ public view/type/UI'a açılmıyor (Faz 8.1'den beri değişmedi, bu fazda dokunulmadı).

## 7. Test ve deploy

- `npm test`: 1 test, geçti. `npm run lint`: 0 hata, 10 önceden var olan uyarı. `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan `Login.tsx:55` hatası. `npm run build:demo`: başarılı.
- **Migration/Edge Function deploy yapılmadı** — UI-only düzeltme yeterliydi, sayaçlar için yeni view/RPC gerekmedi (mevcut view'ların `archived` kolonu zaten yeterliydi).
- FTP deploy: 40 dosya. Canlı: `/` → 200 (yeni bundle hash `index-A8bRvRV9.js` ile eşleşiyor), `/satislar/faturalar` → 200, `/giderler` → 200, `/satislar/faturalar/1072353915` → 200, `/satislar/faturalar/1014217636` → 200, `/giderler/1007881809` → 200.
- PDF/UBL/HTML href kontrolleri: bölüm 2'de doğrulandı, 9/9 doğru hedefe çözülüyor.
- 390×844 ve 768×1024 (gerçek headless Chrome CDP): liste sayfalarında ve "Tüm e-belge alanları" paneli açıkken detay sayfalarında `scrollWidth === clientWidth` — yatay taşma yok. Filtre kontrolleri 390px'te görünür ve kullanılabilir.
- Console/network kontrolü: 0 başarısız istek, 0 console hatası (bölüm 4).

## PASS / FAIL / BLOCKED

**PASS:**
- PDF/HTML linkleri artık göreli değil, `uygulama.parasut.com` tabanına doğru çözülüyor (9/9 doğrulanan örnek)
- Signed UBL URL değiştirilmedi (zaten mutlaktı)
- Protokol-relative/güvensiz şema koruması eklendi (kod yolu var, bu hesapta tetiklenecek gerçek örnek yok)
- Sayaç 503 hatası giderildi: 3 eşzamanlı Range'siz HEAD yerine 1 hafif GET, gerçek `archived` kolonundan türetilen sayaçlar
- Network doğrulamasında 0 başarısız istek, 0 console hatası
- Aktif/arşivli/toplam sayaçları gerçek API/DB değerleriyle birebir (449/2/451, 810/1/811)
- 390px mobil filtre taşması/kırpılması düzeltildi, 768px/masaüstü bozulmadı
- E-belge alan kapsamı ve regresyon sayıları değişmedi
- Base mapping eksikliği olmadığı için migration/Edge Function deploy/resync yapılmadı
- Build/lint/test/tsc/deploy/route doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:** Yok.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

1. **PDF/HTML linkleri**: Paraşüt API'si `pdf_url`/`html_url`'i göreli yol olarak döndürüyor (`signed_ubl_url` ise mutlak) — bu tutarsızlık daha önce hiç fark edilmemişti çünkü Faz 8/8.1'in doğrulamaları hep ham `href` değerine bakmış, tarayıcının bunu hangi origin'e çözdüğüne bakmamıştı. Çözüm: render katmanında tek, paylaşılan bir `resolveEDocumentUrl()` ile mutlaklaştırma.
2. **Sayaç 503**: sekme sayaçları için `count=exact` HEAD isteklerinin 3'ünün de her sayfa yüklemesinde eşzamanlı ve Range'siz atılması, Supabase/PostgREST tarafında tekrarlanabilir bir 503'e yol açıyordu. Aynı bilgi zaten tek bir hafif `select=archived` GET'iyle güvenilir şekilde elde edilebildiği için ayrı count sorguları tamamen kaldırıldı.
3. **Mobil filtre**: tarih girişi grubunun kendi içinde `flex-wrap` olmaması, dar viewport'ta iki input + ayıraç'ın tek satıra sıkışmaya zorlanmasına neden oluyordu.

## Claude Browser için gerçek route ve belge ID'leri

- `/satislar/faturalar/1072353915` → e_invoice `1055802035`
- `/giderler/1007881809` → e_invoice `1009548055`
- `/satislar/faturalar/1014217636` → e_archive `1007488010`
- `/satislar/faturalar` (liste, sayaç: 449/2/451)
- `/giderler` (liste, sayaç: 810/1/811)

## Genel Karar

**PASS.** PDF ve HTML e-belge linkleri artık her durumda gerçek Paraşüt uygulama alan adına çözülüyor (9/9 doğrulanan örnekte demo domain'ine giden 0 link); sekme sayaçları artık başarısız olmayan tek bir gerçek sorgudan, sabit/eski değer kullanılmadan hesaplanıyor (network doğrulamasında 0 başarısız istek); 390px'te tarih filtresi artık kendi container'ı içinde kalıyor, 768px/masaüstü bozulmadı. E-belge veri modeli, alan kapsamı ve parent ilişkileri değiştirilmedi, regresyon yok. Üç sorun da UI katmanında çözüldü, migration/deploy/resync gerekmedi.
