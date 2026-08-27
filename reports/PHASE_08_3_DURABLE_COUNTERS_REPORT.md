# Phase 08.3 — 1000+ Kayıtta Güvenli Sayaç Düzeltmesi

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/satislar/faturalar
**Kod commit SHA:** `8ed091b8a6bc5b87ef8137efe6e4274a360498ac`
**Rapor commit SHA:** (bu commit)

## Özet

Faz 8.2'nin sayaç düzeltmesi (`select=archived` ile tüm satırları çekip frontend'de sayma) bugün doğru sonuç veriyordu (451/811 satır) ama PostgREST'in varsayılan `max-rows=1000` sınırına karşı **kırılgandı** — bu proje zaten `products` (2597) ve `e_invoices` (1238) üzerinde bu sınırın gerçek satırları sessizce 1000'e kestiğini gözlemlemişti. Bu faz sayaçları **tek satırlık SQL `count(*) filter (...)` aggregate view'larına** taşıdı — bu view'lar her zaman tam olarak 1 satır döndürür, `max-rows` yalnızca o tek satırı sınırlar, asla sayımın kendisini etkilemez.

## 1. Dayanıklı sayaç modeli

Yeni migration: `supabase/migrations/20260827060000_parasut_invoice_bill_counts.sql` (eski migration'lar değiştirilmedi).

```sql
create view public.parasut_sales_invoice_counts_demo
as
select
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) filter (where archived is null) as null_archived_count,
  count(*) as total_count
from parasut.sales_invoices;

create view public.parasut_purchase_bill_counts_demo
as
select
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) filter (where archived is null) as null_archived_count,
  count(*) as total_count
from parasut.purchase_bills;

grant select on public.parasut_sales_invoice_counts_demo to authenticated, anon;
grant select on public.parasut_purchase_bill_counts_demo to authenticated, anon;
```

- `archived` her iki base tabloda da nullable; `null` **hiçbir kategoriye zorlanmadı** — ayrı `null_archived_count` ile sayılıyor.
- Base tablodan (`parasut.sales_invoices`/`parasut.purchase_bills`) doğrudan, `public.parasut_*_demo` view'ları üzerinden değil — bu, çift filtreleme/gizli join maliyetini önlüyor ve sayım kaynağını en doğrudan gerçek veriye bağlıyor.
- Sıradan `view` (RPC/`SECURITY DEFINER` değil) — anon/authenticated'a yalnızca `grant select` verildi, RLS zaten `parasut.*` tablolarında etkin (yalnızca `service_role` doğrudan erişebilir), view owner-privilege ile çalışıyor (projenin diğer tüm `*_demo` view'larıyla aynı, kanıtlanmış desen). Hiçbir raw/private kolon expose edilmiyor — yalnızca 4 tamsayı.
- Fatura/gider satırları bu endpoint üzerinden **hiç** açılmıyor — view yalnızca aggregate sayılar döndürüyor, tek satır.

## 2. Frontend

`Faturalar.tsx`/`Giderler.tsx`: sayaç `useEffect`'i artık `supabase.from("parasut_sales_invoice_counts_demo").select("*").maybeSingle()` (ve purchase_bills için aynı desen) çağırıyor — **tek istek**, response'un `active_count`/`archived_count`/`total_count` alanlarından doğrudan state'e yazılıyor. Eski `select=archived` ile tüm satırları indirip frontend'de `Array.filter().length` yapan kod **tamamen kaldırıldı**. İstek başarısız olursa (`error` dolu veya `data` null) eski/sahte sayı gösterilmiyor — `loadError` state'i set ediliyor, aynı mevcut hata UI'ı (`Veri okunamadı: ...`) devreye giriyor. Liste sorgusu (filtrelenmiş satırlar) ayrı `useEffect`'te, sekme geçişinde sayaç isteğini tekrar tetiklemiyor (bağımlılık dizisinde yok, doğrulandı — bkz. bölüm 4). Liste filtreleri (`archivedFilter`/`paymentFilter`/tarih) sayaç kaynağını etkilemiyor çünkü sayaç view'ı hiçbir filtre parametresi almıyor, her zaman tüm gerçek tabloyu sayıyor.

## 3. 1000+ dayanıklılık kanıtı

Gerçek veri değiştirilmedi, sahte kayıt eklenmedi/çoğaltılmadı/silinmedi. Kanıt SQL yapısından:

- `count(*) filter (where ...)` PostgreSQL'de **tek bir aggregate satır** üretir — kaynak tablo kaç satır içerirse içersin (451, 811, ya da gelecekte 10.000), view'ın kendi çıktısı her zaman **tam olarak 1 satır**dır.
- PostgREST'in `max-rows=1000` ayarı, response'taki **satır sayısını** sınırlar. Bir aggregate view'ın çıktısı zaten 1 satır olduğu için bu sınır asla devreye girmez — 1000 sınırı yalnızca ham satırları (`select * from parasut.sales_invoices`) veya eski `select=archived` yaklaşımını etkiler, `count(*)` sonucunu asla.
- Bu proje **zaten** aynı gerçek kısıtı kanıtlamıştı: `products` tablosu 2597 gerçek satır içeriyor ama düz `select` ile 1000'e kesiliyor (Faz 5'ten beri bilinen davranış); `e_invoices` 1238 gerçek satır içeriyor, aynı şekilde kesilir. Bu iki örnek, "1000 satırı aşan gerçek veri, düz `select` ile eksik döner" iddiasının bu projede zaten canlı olarak doğrulanmış olduğunu gösteriyor — yeni sayaç view'larının **neden** gerekli olduğunun doğrudan kanıtı.

**Canlı gerçek sonuç** (bu fazda sorgulandı):

| Kaynak | active_count | archived_count | null_archived_count | total_count |
|---|---:|---:|---:|---:|
| Sales invoices | **449** | **2** | **0** | **451** |
| Purchase bills | **810** | **1** | **0** | **811** |

**Mutabakat:** `449 + 2 + 0 = 451` ✅ ve `810 + 1 + 0 = 811` ✅ — her iki kaynakta da denklik sağlanıyor.

## 4. Network testi

Gerçek headless Chrome CDP ile her iki liste sayfası doğrudan açıldı, hard refresh yapıldı, sekmeler arasında geçildi (Arşivli→Tümü→Aktif), 40 saniye açık bırakıldı:

- İlk yüklemede: `/satislar/faturalar` → 4 Supabase isteği (2× liste + 2× sayaç, CDP'nin kendi çift-navigasyon davranışından; uygulama kodunda tekrar yok).
- Sekme geçişlerinden sonra: 9 istek (yalnızca liste sorguları arttı, **sayaç isteği artmadı** — sekme değişimi yeni sayaç isteği üretmiyor, doğrulandı).
- Hard refresh sonrası: 11 istek.
- 40 saniye boşta bekledikten sonra: **hâlâ 11 istek** — sonsuz/tekrarlı istek yok.
- **Başarısız istek: 0/11.** Console/React runtime hatası: **0**.
- Eski `select=archived` ile tam satır indiren istek: **0/11** (kaldırıldığı doğrulandı — yalnızca `parasut_sales_invoice_counts_demo?select=*` / `parasut_purchase_bill_counts_demo?select=*` görülüyor, response'ları yalnızca 4 aggregate alan içeriyor).

Response örneği (gerçek): `parasut_sales_invoice_counts_demo?select=*` → `[{"active_count":449,"archived_count":2,"null_archived_count":0,"total_count":451}]`.

## 5. Veri ve UI regresyonu

E-belge alanları/ilişkileri bu fazda **değiştirilmedi**:

| Metrik | Beklenen | Gerçek |
|---|---:|---:|
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| E-invoices | 1238 | **1238** ✅ |
| E-archives | 24 | **24** ✅ |
| Parent bağlantısı | 1262 | **1262** ✅ |
| Duplicate/unresolved/stale | 0 | **0/0/0** ✅ |

Faz 8.1'in 39 gerçek `e_invoices` attribute'u ve 17 gerçek `e_archives` attribute'u hâlâ "Tüm e-belge alanlarını göster" panelinde erişilebilir (dokunulmadı). Faz 8.2'nin PDF/HTML/UBL URL çözümleyicisi (`resolveEDocumentUrl`) değişmedi, hedefler hâlâ doğru (`uygulama.parasut.com`). Private teknik alanlar (`rendered_ubl_path` vb.) hâlâ public değil. Null/sıfır/false ayrımı korunuyor.

## 6. Responsive

390×844 ve 768×1024 (gerçek headless Chrome CDP): `/satislar/faturalar`, `/giderler` ve E-Belge paneli açık `/satislar/faturalar/1072353915` — `scrollWidth === clientWidth` her durumda. Sayaçlar (ör. "Aktif (449)") taşmıyor, filtreler kırpılmıyor (Faz 8.2'nin düzeltmesi korunuyor), e-belge paneli açıkken detay ekranı bozulmuyor.

## 7. Test ve deploy

- Yeni migration hosted DB'ye `supabase db push` ile uygulandı.
- **Edge Function deploy edilmedi** (sync mapping'i değişmedi, yalnızca yeni salt-okunur view'lar + frontend sorgu değişikliği).
- `npm test`: 1 test, geçti. `npm run lint`: 0 hata, 10 önceden var olan uyarı. `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan `Login.tsx:55` hatası. `npm run build:demo`: başarılı.
- FTP deploy: 40 dosya. Canlı: `/` → 200 (yeni bundle `index-CKJP14Bp.js` ile eşleşiyor), `/satislar/faturalar` → 200, `/giderler` → 200.
- Network/console kontrolü: bölüm 4'te ayrıntılı, 0 başarısız istek, 0 console hatası.
- 390px/768px responsive ölçümü: bölüm 6'da ayrıntılı, taşma yok.

## PASS / FAIL / BLOCKED

**PASS:**
- Sayaçlar artık tek satırlık SQL aggregate view'lardan geliyor, `max-rows=1000` sınırından etkilenmiyor — SQL yapısıyla ve projenin kendi products/e_invoices örnekleriyle kanıtlandı
- `null_archived_count` ayrı sayılıyor, hiçbir null zorla aktif/arşivli kategorisine sokulmadı
- Mutabakat denklemi her iki kaynakta da sağlanıyor (449+2+0=451, 810+1+0=811)
- Eski `select=archived` tam satır indirme isteği tamamen kaldırıldı, network doğrulamasında 0 örneği kaldı
- 3 eşzamanlı Range'siz HEAD isteğine geri dönülmedi
- Network testinde 0 başarısız istek, 0 sonsuz/tekrarlı istek, 0 console hatası (40 saniye boşta dahil)
- Sekme geçişi/filtre uygulama sayaç isteğini tekrar tetiklemiyor
- E-belge alan kapsamı, ilişkileri, URL çözümlemesi ve private alan koruması değişmedi
- Responsive: 390px/768px'te sayaç/filtre/panel taşması yok
- Build/lint/test/tsc/deploy/route doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:** Yok.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

Faz 8.2'nin sayaç düzeltmesi, 503 hatasını gidermek için 3 HEAD isteğini 1 `select=archived` GET'ine indirgemişti — bu, o anki veri hacminde (451/811, PostgREST'in 1000 satır sınırının altında) doğru sonuç verdi, ama frontend'de "tüm satırları çek, say" yaklaşımı hâlâ örtük olarak satır sayısına bağımlıydı. Bu proje kendi içinde `products`/`e_invoices` üzerinde bu sınırın gerçek veriyi sessizce kestiğini zaten kanıtlamıştı; aynı kırılganlık sayaçlara da uygulanabilirdi. Kök çözüm, sayma işini frontend'den veritabanına (`count(*) filter`) taşımaktı — bu, satır sayısından tamamen bağımsız, her zaman tek satır döndüren bir işlem.

## Claude Browser için gerçek route'lar

- `/satislar/faturalar` (sayaç: 449/2/451, aggregate view: `parasut_sales_invoice_counts_demo`)
- `/giderler` (sayaç: 810/1/811, aggregate view: `parasut_purchase_bill_counts_demo`)
- `/satislar/faturalar/1072353915` (E-Belge paneli, Faz 8.1/8.2'den değişmedi)

## Genel Karar

**PASS.** Fatura ve gider sayaçları artık PostgREST'in `max-rows=1000` sınırından tamamen bağımsız, tek satırlık SQL `count(*) filter (...)` aggregate view'larından geliyor — bu proje kendi `products`/`e_invoices` deneyimiyle bu sınırın gerçek veriyi sessizce kestiğini zaten kanıtlamıştı, yeni çözüm bu riski yapısal olarak ortadan kaldırıyor. `null_archived_count` ayrı sayılıyor, mutabakat denklemi sağlanıyor, hiçbir sabit/eski/sahte sayı kullanılmadı. Eski tam-satır-indirme isteği tamamen kaldırıldı; network testinde 0 başarısız istek, 0 sonsuz döngü, 0 console hatası. E-belge veri modeli, alan kapsamı ve URL çözümlemesi değişmedi, regresyon yok.
