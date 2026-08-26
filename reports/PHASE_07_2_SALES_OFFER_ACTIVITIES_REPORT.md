# Phase 07.2 — Satış Teklifi Activity Verisini Eksiksiz Tamamlama

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/satislar/teklifler/1001300304
**Kod commit SHA:** (aşağıda, ikinci commit'te doldurulacak)
**Rapor commit SHA:** (push sonrası doldurulacak)

## 1. Ham activity envanteri

`GET /v4/{company_id}/sales_offers/1001300304?include=activities,activities.item,activities.done_by` yeniden sorgulandı.

### Activity 1347475910

- **root:** `id: "1347475910"`, `type: "activities"`
- **attributes:** `created_at: "2025-12-05T08:03:43.631Z"`, `updated_at: "2025-12-05T08:03:43.631Z"`, `activity_type: "new_sales_offer"`, `date: "2025-12-05T08:03:43.417Z"`, `done_by_email: null`
- **`data` (9 anahtar):** `description: "asfsdf"`, `issue_date: "2025-12-05"`, `due_date: "2025-12-05"`, `net_total: "1480.8"` (string), `currency: "TRL"`, `content: "sdfsdfsdf"`, `status: "waiting"`, `contact_id: 1011029197` (number), `contact_name: "ONUR YEDEK PARÇA MAKİNA KALIP SANAYİ VE TİCARET LİMİTED ŞİRKETİ"`
- **relationships:** `done_by: {data:{id:"800086",type:"users"}}`, `item: {data:{id:"1001300304",type:"sales_offers"}}`
- **links:** yok. **meta:** `{created_at, updated_at}` (attributes ile aynı, ek veri değil).

### Activity 1427639960

- **root:** `id: "1427639960"`, `type: "activities"`
- **attributes:** `created_at/updated_at: "2026-03-13T08:31:03.784Z"`, `activity_type: "sales_offer_status_updated"`, `date: "2026-03-13T08:31:03.782Z"`, `done_by_email: null`
- **`data` (aynı 9 anahtar, farklı değerler):** `description: "asfsdf"`, `issue_date: "2025-12-05"`, `due_date: "2025-12-05"`, `net_total: "1480.8"`, `currency: "TRL"`, `content: "sdfsdfsdf"`, **`status: "rejected"`** (farklı — bu activity'nin kendi anlamı), `contact_id: 1011029197`, `contact_name`: aynı.
- **relationships:** `done_by: {data:{id:"800086",type:"users"}}`, `item: {data:{id:"1001300304",type:"sales_offers"}}`
- **links/meta:** aynı desende.

**İki activity'nin `data` şeması birebir aynı** (9 anahtar, aynı tipler); yalnızca `status` alanı gerçek olay farkını yansıtıyor (waiting → rejected). Farklı şema bulunmadı; alan adı/anlam tahmin edilmedi (Parasut'un kendi verdiği anahtar isimleri aynen kullanıldı).

**`included` (her ikisi için ortak):**
- `users:800086` — "Hayrettin Dayan", `email: "hayridayan58@gmail.com"`, birçok bildirim/tercih alanı (kapsam dışı, kullanıcı hesabı ayarları — teklif activity'siyle ilgisiz, saklanmadı).
- `sales_offers:1001300304` — zaten bilinen teklifin kendisi (item ilişkisi kendine referans veriyor).

## 2. Normalleştirme kararı

`data.*`'nın 9 alanı da iş açısından anlamlı ve **sabit şemalı** (iki farklı activity_type'ta bile birebir aynı anahtar seti) — bu yüzden ayrı, tipli kolonlara normalize edildi: `data_description, data_issue_date, data_due_date, data_net_total, data_currency, data_content, data_status, data_contact_id, data_contact_name`. Mevcut opak `data jsonb` kolonu **kaldırılmadı** ama yeni migration'da view'dan çıkarıldı çünkü artık her alanı ayrı, isimli, tipli kolon olarak sunuluyor (ham `data` hâlâ base tabloda `raw` içinde ve ayrıca `data` sütununda korunuyor, denetim amaçlı).

`done_by`/`item` için: `include=activities` tek başına relationshipleri boş `{"meta":{}}` döndürüyordu (Faz 7.1'in kullandığı include); `include=activities.item,activities.done_by` eklenince gerçek veriye ulaşıldığı doğrulandı. Projede `parasut.users` tablosu olmadığından, gerçek `done_by` kullanıcısının adı/e-postası (`Hayrettin Dayan` / `hayridayan58@gmail.com`) sync anında `included`'dan çözülüp doğrudan `done_by_name`/`done_by_user_email` kolonlarına yazıldı — tahmin edilmedi, API'nin kendi `users` resource'undan alındı.

Hiçbir değer tercüme edilerek anlamı değiştirilmedi (`status` alanı ham API değeriyle — "waiting"/"rejected" — saklandı, UI'da olduğu gibi gösteriliyor). Eksik alan başka alandan türetilmedi. Yeni migration: `20260827030000_parasut_sales_offer_activities_data_fields.sql` (eski migration'lar değiştirilmedi; `CREATE OR REPLACE VIEW`'ın mevcut `data` kolonunu yeniden adlandıramaması nedeniyle o view drop+recreate edildi, base tablo yalnızca `ALTER TABLE ... ADD COLUMN` ile genişletildi).

## 3. Activity UI

"Durum geçmişi" bölümü artık her gerçek activity için gösteriyor: Activity Paraşüt ID, activity_type (okunabilir etiket + ham değer), date (UTC), done_by (gerçek ad + e-posta, link'e gerek yok çünkü projede contact/user detay sayfası yok), item (gerçek `sales_offers` ilişkisiyse gerçek teklif linki), activity'nin kendi `done_by_email` alanı (gerçek null → "—", kullanıcı e-postasıyla karıştırılmadı), `parasut_created_at`/`parasut_updated_at`, ve tüm `data.*` alanları ayrı ayrı ("Snapshot (data)" alt bölümü: durum, açıklama, müşteri — gerçek contact linkiyle, tarihler, net toplam, içerik).

## 4. Tam zincir denetimi

| API yolu | Base | Raw | View | TS type | UI | Gerçek değer (1427639960) |
|---|---|---|---|---|---|---|
| `id` (activity parasut_id) | ✅ | ✅ | ✅ | ✅ | ✅ | 1427639960 |
| `activity_type` | ✅ | ✅ | ✅ | ✅ | ✅ | "sales_offer_status_updated" |
| `date` | ✅ | ✅ | ✅ | ✅ | ✅ | UTC, doğrulandı |
| `created_at`/`updated_at` → parasut_created_at/updated_at | ✅ | ✅ | ✅ | ✅ | ✅ | UTC, doğrulandı |
| `done_by_email` (activity'nin kendi alanı) | ✅ | ✅ | ✅ | ✅ | ✅ | null → "—" |
| `data.description` | ✅ **(bu fazda kolon)** | ✅ | ✅ | ✅ | ✅ | "asfsdf" |
| `data.issue_date` | ✅ **(bu fazda kolon)** | ✅ | ✅ | ✅ | ✅ | "2025-12-05" |
| `data.due_date` | ✅ **(bu fazda kolon)** | ✅ | ✅ | ✅ | ✅ | "2025-12-05" |
| `data.net_total` | ✅ **(bu fazda kolon)** | ✅ | ✅ | ✅ | ✅ | 1480.8 |
| `data.currency` | ✅ **(bu fazda kolon)** | ✅ | ✅ | ✅ | ✅ | "TRL" |
| `data.content` | ✅ **(bu fazda kolon)** | ✅ | ✅ | ✅ | ✅ | "sdfsdfsdf" |
| `data.status` | ✅ **(bu fazda kolon)** | ✅ | ✅ | ✅ | ✅ | "rejected" |
| `data.contact_id` | ✅ **(bu fazda kolon)** | ✅ | ✅ | ✅ | ✅ | 1011029197 |
| `data.contact_name` | ✅ **(bu fazda kolon)** | ✅ | ✅ | ✅ | ✅ | "ONUR YEDEK..." |
| `relationships.done_by` (id/type) | ✅ **(bu fazda düzeltildi)** | ✅ | ✅ | ✅ | ✅ | 800086/users |
| `included.users.name` (done_by adı) | ✅ **(bu fazda kolon: done_by_name)** | ✅ | ✅ | ✅ | ✅ | "Hayrettin Dayan" |
| `included.users.email` (done_by e-postası) | ✅ **(bu fazda kolon: done_by_user_email)** | ✅ | ✅ | ✅ | ✅ | "hayridayan58@gmail.com" |
| `relationships.item` (id/type) | ✅ (Faz 7.1'den, teyit edildi) | ✅ | ✅ | ✅ | ✅ | 1001300304/sales_offers |

Teklif ve kalem alanlarının Faz 7.1'deki durumu **değişmedi** — bu fazda yalnızca `sales_offer_activities` tablosu/view'ı ve `TeklifDetay.tsx`'in activity bölümü değiştirildi.

## 5. Null/sıfır/false koruması

- `done_by_email` (activity'nin kendi alanı, iki kayıtta da gerçek `null`) → UI "—" ✅ — bu, `done_by_user_email` (gerçek, dolu) ile **karıştırılmadı**; ikisi ayrı ayrı gösteriliyor.
- `data.*` alanlarının hiçbiri null değil bu iki kayıtta (hepsi dolu) — null doldurma riski yok, gerçek durum bu.
- `item_type`/`done_by_type` gibi tip alanları boş string değil, gerçek `"sales_offers"`/`"users"` string değerleri.

## 6. Sync ve sayılar

| Sayaç | Değer |
|---|---|
| Teklif | 1 |
| Kalem | 1 |
| Activity | 2 |
| Activity benzersiz ID | 2 |
| Duplicate | 0 |
| Unresolved | 0 |
| Error | 0 |

Mapping/şema değişti (yeni kolonlar + `done_by` çözümleme mantığı) → **iki ardışık gerçek sync çalıştırıldı**, birebir aynı sonuç:

```json
{ "offer_fetched_count": 1, "detail_fetched_count": 1, "activity_fetched_count": 2,
  "activity_upserted_count": 2, "unresolved_count": 0, "error_count": 0 }
```

DB'de doğrulandı: `sales_offer_activities` 2 satır/2 benzersiz `parasut_id`, `done_by_parasut_id=800086`, `done_by_name="Hayrettin Dayan"`, `done_by_user_email="hayridayan58@gmail.com"` her iki satırda da doğru. API'de silinmiş bir activity tespit edilmedi (hesapta hâlâ tam olarak bu 2 kayıt var).

## 7. Regresyon

| Metrik | Beklenen | Gerçek |
|---|---|---|
| Contacts | 448 | **448** ✅ |
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| Products | 2597 | **2597** ✅ |
| Checks | 40 | **40** ✅ |
| Check payments | 35 | **35** ✅ |
| Payments | 1651 | **1651** ✅ |
| Transactions | 1498 | **1498** ✅ |
| Accounts | 3 | **3** ✅ |

## 8. Test ve deploy

- Migration `20260827030000_...sql` hosted DB'ye `supabase db push` ile uygulandı.
- Edge Function (`index.ts`, `resources/sales_offers.ts`) `supabase functions deploy parasut-sync` ile deploy edildi.
- Dry run + iki ardışık gerçek sync: doğrulandı (bölüm 6).
- `npm test`: 1 test, geçti. `npm run lint`: 0 hata, 10 önceden var olan uyarı. `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan `Login.tsx:55` hatası (bu faza ait değil). `npm run build:demo`: başarılı, yeni `TeklifDetay-DlrQVsVD.js`.
- FTP deploy: 38 dosya. Canlı: `/` → 200 (`index-COko8EIw.js`, yeni build ile eşleşiyor), `/satislar/teklifler` → 200, `/satislar/teklifler/1001300304` → 200, yeni JS chunk → 200.
- 390×844 ve 768×1024 (activity paneli açıkken, gerçek headless Chrome CDP): `scrollWidth === clientWidth` — yatay taşma yok. Console hatası yakalanmadı.
- Gerçek render doğrulaması: sayfa metni çekildi, her iki activity'nin tüm alanları (done_by adı/e-postası, item linki, 9 data alanı) ekranda gerçek değerleriyle görüldü.

## PASS / FAIL / BLOCKED

**PASS:**
- İki activity'nin tam ham envanteri çıkarıldı, `data.*` şeması karşılaştırıldı (aynı bulundu)
- `data.*`'nın 9 alanı da normalize edilip base/view/type/UI zincirinin tamamında erişilebilir
- `done_by`/`item` ilişkilerinin gerçekte dolu olduğu (yalnızca doğru include ile) kanıtlandı ve düzeltildi
- Gerçek `done_by` kullanıcı adı/e-postası (API'nin kendi `users` included'ından) eklendi, tahmin edilmedi
- Null (`done_by_email`) ile dolu gerçek değer (`done_by_user_email`) karıştırılmadı
- İki ardışık gerçek sync birebir aynı, duplicate/unresolved/error yok
- Regresyon: 9 modül birebir korundu
- Build/lint/test/tsc/deploy/route/overflow/console doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:** Yok.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

Faz 7.1, `activities`'i keşfederken yalnızca `include=activities` kullanmıştı — bu, activity'nin kendi `attributes`/`data`'sını görünür kıldı ama `relationships.done_by`/`item`'ı boş `{"meta":{}}` olarak bıraktı (Parasut'un her ilişkinin kendi include'unu istediği, projede defalarca görülen aynı davranış). Ayrıca `data` alanı hiç ayrıştırılmadan opak jsonb olarak saklanmıştı. Bu faz, `activities.item`/`activities.done_by` alt-include'larını ekleyerek ilişkileri çözdü ve `data`'nın sabit şemasını normalize ederek her alanı UI'ya taşıdı.

## Genel Karar

**PASS.** İki gerçek activity kaydının hem kendi attribute'ları hem `data.*` içindeki 9 alan hem de `done_by`/`item` ilişkileri artık base → raw → view → type → UI zincirinin tamamında, gerçek API değerleriyle, hiçbir tahmin/doldurma olmadan erişilebilir. `done_by_email` (activity'nin kendi alanı, gerçek null) ile `done_by_user_email` (gerçek, çözülmüş kullanıcı e-postası) birbirine karıştırılmadı. Regresyon yok, iki ardışık sync birebir aynı sonucu verdi.
