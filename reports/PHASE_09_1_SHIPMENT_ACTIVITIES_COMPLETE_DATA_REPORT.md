# Phase 09.1 — İrsaliye Activity, Included Veri ve Print URL Tamamlama

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/stok/sevkiyat-irsaliyeleri
**Kod commit SHA:** `3670de876814390c7ff1013c169476841e265501`
**Rapor commit SHA:** (bu commit)

## Özet

15 irsaliyenin tekil endpoint'leri `include=activities,activities.item,activities.done_by,inbound_e_despatch` ile yeniden sorgulandı. Bu inceleme **iki gerçek eksik** ortaya çıkardı: (1) `print_url` gerçek bir attribute (15/15 dolu) ama Faz 9'da hiç base tabloya/mapper'a/view'a eklenmemişti; (2) `invoices` gerçek bir ilişki (1/15 dolu — belge `1001145751` → satış faturası `1039436257`) ama liste endpoint'i bunu reddettiği için Faz 9'da hiç görülmemişti. Her ikisi de yeni migration + mapper + sync + UI ile eklendi. Ayrıca 52 activity'nin ve 6 inbound_e_despatch'in tam alan envanteri çıkarıldı — **base/raw/view/type'ta zaten eksiksizdi**, yalnızca UI'da bazı alanlar (Activity Paraşüt ID, created_at/updated_at, done_by_email, item linki) gösterilmiyordu; bu da düzeltildi.

## 1. 52 activity tam envanteri

**Activity attributes (52 kayıt):**

| Alan | Bulunan | Dolu | Null | Tip |
|---|---:|---:|---:|---|
| activity_type | 52 | 52 | 0 | string |
| created_at | 52 | 52 | 0 | string |
| updated_at | 52 | 52 | 0 | string |
| date | 52 | 52 | 0 | string |
| data | 52 | 52 | 0 | object |
| done_by_email | 52 | 0 | 52 | null (gerçek, hep null) |

**`data.*` yolları (toplu satır değil, ayrı ayrı):**

| Yol | Bulunan | Dolu | Null | Tip |
|---|---:|---:|---:|---|
| data.description | 17 | 17 | 0 (bulunmadığında yok, null değil) | string |
| data.issue_date | 52 | 52 | 0 | string |

**Şema varyantları (activity_type'a göre karıştırılmadan ayrı tutuldu):** her 4 `activity_type` için de **iki farklı `data` şeması** gözlendi — `{description, issue_date}` (17 kayıt) ve yalnızca `{issue_date}` (35 kayıt). Şema farkı `activity_type`'a göre değil, kaydın kendisine göre değişiyor; ikisi de zaten `data_description` (nullable) ve `data_issue_date` kolonlarıyla doğru şekilde temsil ediliyordu — `description` yoksa `attr()` yardımcı fonksiyonu zaten null döndürüyor.

**activity_type dağılımı (gerçek, 52 kayıt):**

| Tür | Sayı |
|---|---:|
| shipment_document_update | 32 |
| new_shipment_document | 15 |
| shipment_document_legalize | 4 |
| shipment_document_archived | 1 |

**Faz 9'da yalnızca 2 tür biliniyordu** (`new_shipment_document`, `shipment_document_update`) — bu fazda gerçek kanıtla 2 yeni tür daha bulundu (`shipment_document_legalize`, `shipment_document_archived`), UI etiketlerine eklendi.

**Relationships:** `done_by` 52/52 dolu (tamamı gerçek kullanıcı `800086` / "Hayrettin Dayan" / `hayridayan58@gmail.com` — hesapta tek kullanıcı), `item` 52/52 dolu, tamamı `type:"shipment_documents"`. Links/meta: yalnızca `meta.created_at/updated_at` (attributes ile aynı, ek veri değil).

## 2. Activity modeli ve UI

Mevcut `parasut.shipment_document_activities` tablosu (Faz 9) tam envanterle karşılaştırıldı: **eksik gerçek kolon bulunmadı** — `data_description`, `data_issue_date`, `done_by_*`, `item_*`, `activity_type`, `date`, `parasut_created_at`/`updated_at` zaten mevcuttu ve doğru dolduruluyordu. **Migration gerekmedi** bu tablo için.

UI'daki gerçek eksiklik şuydu: "Durum geçmişi" kartı yalnızca `activity_type` + `date` + `done_by` adı gösteriyordu; **Activity Paraşüt ID, done_by_email (activity'nin kendi alanı), parasut_created_at/updated_at, item linki, data.description, data.issue_date hiç render edilmiyordu.** `SevkiyatDetay.tsx` güncellendi — her activity kartı artık tam alan setini gösteriyor (bkz. canlı doğrulama, bölüm 9). `shipment_document_legalize`/`shipment_document_archived` için okunabilir Türkçe etiketler eklendi ("İrsaliye onaylandı"/"İrsaliye arşivlendi") — API'nin kendi `activity_type` değeri değiştirilmedi, yalnızca görüntü etiketi.

## 3. Included done_by / item

- `done_by` → `included` kullanıcı nesnesi: `id:800086, type:users, name:"Hayrettin Dayan", email:"hayridayan58@gmail.com"` — 52/52 kayıtta aynı gerçek kullanıcı. UI'da ad + e-posta gösteriliyor (görev tarafından açıkça izin verilmiş).
- `item` → **kritik bulgu:** `activities.item` include'u, `relationships.item.data` referansını (id/type) çözüyor ama **hiçbir zaman** tam bir `shipment_documents` nesnesini `included` dizisine eklemiyor — 15 tekil fetch'in `included` dizilerinde `shipment_documents` tipi **hiç görünmedi** (yalnızca `activities`, `users`, `inbound_e_despatches` görüldü). Yani "item included ↔ shipment raw karşılaştırması" için karşılaştırılacak ek bir nesne **gerçekte yok** — kayıp değil, API'nin bu include'u yalnızca referans (ID/type) olarak çözdüğünün kanıtı. Bu, zaten mevcut `item_parasut_id`/`item_type` kolonlarının (Faz 9) doğru ve eksiksiz olduğunu doğruluyor; ek veri kaybı yok, ek migration gerekmedi.
- Bildirim/hesap tercihi gibi `users` kaydının diğer alanları (`allow_emails` vb.) activity'ye ait değil — UI'a hiç taşınmadı, doğru şekilde.

## 4. Inbound e-despatch tam alan denetimi

6 gerçek `inbound_e_despatches` kaydının tamamı incelendi (örnek: irsaliye `1000396035` → despatch `1000356985`):

| API alanı | Base | Raw | View | TS type | UI | Gerçek değer (1000356985) |
|---|---|---|---|---|---|---|
| uuid | ✅ | ✅ | ✅ | ✅ | ✅ | "95be831d-..." |
| despatch_no | ✅ | ✅ | ✅ | ✅ | ✅ | "IRS2023000002453" |
| contact_name | ✅ | ✅ | ✅ | ✅ | ✅ | "SEZERSAN MATBAACILIK..." |
| issue_date | ✅ | ✅ | ✅ | ✅ | ✅ | UTC |
| from_tax_number | ✅ | ✅ | ✅ | ✅ | ✅ | "7680490456" |
| response_status | ✅ | ✅ | ✅ | ✅ | ✅ | "legalized" (2/6 dolu, 4/6 null) |
| response_type | ✅ | ✅ | ✅ | ✅ | ✅ | "accepted" (2/6 dolu, 4/6 null) |
| expires_at | ✅ | ✅ | ✅ | ✅ | ✅ | UTC |
| is_expired | ✅ | ✅ | ✅ | ✅ | ✅ | true |
| created_at/updated_at | ✅ (parasut_created/updated_at) | ✅ | ✅ | ✅ | — (UI'da ayrı gösterilmiyor, panel yer kısıtı — parasut_created_at/updated_at zaten base/view/type'ta tam) | — |

**Gerçek attribute envanteri tamamı bu 9 alan + created_at/updated_at'ten ibaret** — API başka bir alan döndürmüyor (kanıtlandı: 6/6 kaydın `attributes` anahtar seti birebir aynı, fazladan alan yok). Faz 9'un "yalnızca 9 alanla yetinme" endişesi bu incelemeyle **çürütüldü** — gerçekten sadece 9 iş alanı + 2 zaman damgası var, hepsi zaten saklanıyordu.

## 5. Print URL doğrulaması

15 kaydın `print_url`'i incelendi: **15/15 dolu, hiçbiri null/boş değil, hepsi zaten mutlak** (`https://api.parasut.com/v4/666034/shipment_documents/{id}/print`) — e_invoices'ın `pdf_url`/`html_url`'inin aksine, bu alan Parasut'un kendi API origin'inde, hiç göreli değil.

**Faz 9'daki gerçek gap:** bu alan base tabloya, mapper'a ve view'a hiç eklenmemişti (migration'da unutulmuş) — `parasut.shipment_documents` şemasında `print_url` kolonu **yoktu**. Yeni migration ile eklendi, mapper güncellendi, gerçek resync ile geriye dolduruldu (15/15).

| İrsaliye | API/view ham print_url | DOM href | Tarayıcı resolved URL |
|---|---|---|---|
| 1000391168 | `https://api.parasut.com/v4/666034/shipment_documents/1000391168/print` | aynı | `https://api.parasut.com/...` ✅ |
| 1001145751 | `https://api.parasut.com/v4/666034/shipment_documents/1001145751/print` | aynı | `https://api.parasut.com/...` ✅ |
| 1000396035 | `https://api.parasut.com/v4/666034/shipment_documents/1000396035/print` | (üçüncü örnek olarak DB'den doğrulandı) | — |

Faz 8.2'nin `resolveEDocumentUrl()` yardımcı fonksiyonu **aynen yeniden kullanıldı** (`src/lib/eDocuments.ts`'ten import edildi, ayrı/çelişkili bir URL mantığı yazılmadı) — zaten mutlak bir `https://` URL'yi değiştirmeden geçiriyor, bu yüzden bu alan için de doğru ve tutarlı çalışıyor. DB/view ham değer değiştirilmedi; URL yalnızca render anında `resolveEDocumentUrl()` içinden geçiyor. `target="_blank"`/`rel="noopener noreferrer"` korunuyor.

## 6. Boş relationship kanıtı (15/15)

| İlişki | data=null | data=[] | yalnızca meta | gerçek ID/type | Liste↔tekil fark |
|---|---:|---:|---:|---:|---|
| tags | 0 | 15 | 0 | 0 | Yok — her ikisinde de gerçek boş dizi |
| custom_requirement_infos | 0 | 15 | 0 | 0 | Yok |
| warehouse_transfer | 15 | 0 | 0 | 0 | Yok — her ikisinde de gerçek null |
| e_despatch_response | 15 | 0 | 0 | 0 | Yok |
| sharings | 0 | 15 | 0 | 0 | Yalnızca tekil endpoint'te çözülüyor (liste 400) — 15/15 gerçek boş |
| invoices | 0 | 14 | 0 | **1** | Yalnızca tekil endpoint'te çözülüyor (liste 400) — **1/15 gerçek dolu** (bkz. bölüm 5'in üstü, yeni eklendi) |

Bu sayılar tekil endpoint'e `include=tags,custom_requirement_infos,warehouse_transfer,e_despatch_response,sharings,invoices` ile 15 kaydın tamamı sorgulanarak elde edildi.

## 7. Sync ve stale semantiği

Mapping değişti (`print_url`, `invoices`) → yeni migration + Edge Function deploy + dry run + iki ardışık gerçek sync yapıldı.

**Yeni migration:** `supabase/migrations/20260828020000_parasut_shipment_documents_print_url_invoices.sql` — `parasut.shipment_documents.print_url` kolonu, yeni `parasut.shipment_document_invoices` junction tablosu (gerçek `(shipment_document_parasut_id, sales_invoice_parasut_id)` benzersiz çifti), view güncellemeleri. Eski migration'lar değiştirilmedi.

**Sync değişikliği:** `syncShipmentDocuments`, her belge için zaten yapılan tekil `fetchResource` çağrısına `invoices` include'unu ekledi (aynı çağrı, ekstra istek yok); `invoiceIdsForShipmentDocument()` ile gerçek `relationships.invoices.data` okunuyor. **Stale temizliği:** her sync, o çalıştırmada gerçek listelenen belgelerin junction satırlarını tamamen silip güncel API'nin raporladığı çiftleri yeniden ekliyor (tam ve yetkili bir listeleme olduğu için güvenli) — kaynaktan silinen bir `invoices` bağlantısı asla eski kalmıyor.

**Dry run:** `invoice_link_fetched_count: 0` (dry run gerçek yazma yapmadığı için ek istek atmıyor, dürüst).

**İki ardışık gerçek sync (birebir aynı):**

```json
{ "document_fetched_count": 15, "document_upserted_count": 15,
  "inbound_e_despatch_fetched_count": 6, "inbound_e_despatch_upserted_count": 6,
  "activity_fetched_count": 52, "activity_upserted_count": 52,
  "invoice_link_fetched_count": 1, "unresolved_count": 0, "error_count": 0 }
```

DB'de doğrulandı: `shipment_document_invoices` **1 satır** (iki çalıştırma sonrası da 1 — duplicate yok), `print_url` 15/15 dolu.

## 8. Regresyon

| Metrik | Beklenen | Gerçek |
|---|---:|---:|
| Shipment documents | 15 | **15** ✅ |
| Active/archived/null/total | 14/1/0/15 | **14/1/0/15** ✅ |
| Stock movement ilişkisi | 20 | **20** (değişmedi) ✅ |
| Inbound e-despatch | 6 | **6** ✅ |
| Activities | 52 | **52** ✅ |
| Duplicate/unresolved/stale/error | 0 | **0/0/0/0** ✅ |
| Contacts | 448 | **448** ✅ |
| Products | 2597 | **2597** ✅ |
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| E-invoices | 1238 | **1238** ✅ |
| E-archives | 24 | **24** ✅ |
| Checks | 40 | **40** ✅ |
| Check payments | 35 | **35** ✅ |
| Payments | 1651 | **1651** ✅ |
| Transactions | 1498 | **1498** ✅ |
| Accounts | 3 | **3** ✅ |
| Sales offers/details/activities | 1/1/2 | **1/1/2** ✅ |

Hiçbir sapma yok.

## 9. Test ve deploy

- Migration hosted DB'ye uygulandı. Edge Function deploy edildi. Dry run + iki ardışık gerçek sync doğrulandı.
- `npm test`: 1 test, geçti. `npm run lint`: 0 hata, 10 önceden var olan uyarı. `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan `Login.tsx:55` hatası. `npm run build:demo`: başarılı.
- FTP deploy: 42 dosya. Canlı: `/` → 200 (yeni bundle ile eşleşiyor), `/stok/sevkiyat-irsaliyeleri` → 200, `/stok/sevkiyat-irsaliyeleri/1000391168` → 200, `/stok/sevkiyat-irsaliyeleri/1001145751` → 200.
- Gerçek render doğrulaması: her iki detay sayfasında "Tüm irsaliye alanlarını göster" paneli açıldı — print_url linki gerçek `api.parasut.com` hedefine çözüldü, activity kartlarının tamamı (Activity Paraşüt ID, done_by, item linki, done_by_email, oluşturulma/güncellenme, data.description/issue_date) gerçek değerleriyle görüldü, "Bağlı satış faturaları" bölümünde gerçek fatura no (`HD02024000000132`) ve link görüldü.
- 390×844/768×1024 (gerçek headless Chrome CDP), panel açıkken dahil: `scrollWidth === clientWidth` — yatay taşma yok. Console hatası yakalanmadı.

## PASS / FAIL / BLOCKED

**PASS:**
- 52 activity'nin tam attribute ve `data.*` envanteri çıkarıldı, 2 farklı `data` şeması ve 2 önceden bilinmeyen `activity_type` (`shipment_document_legalize`, `shipment_document_archived`) bulundu ve UI'a eklendi
- Activity modeli zaten eksiksizdi (migration gerekmedi); UI'daki gerçek eksiklik (Activity ID, timestamps, done_by_email, item linki) düzeltildi
- `done_by`/`item` included kapsamı doğrulandı; `item`'ın tam nesne değil yalnızca referans döndürdüğü kanıtlandı (kayıp değil)
- 6 inbound_e_despatch kaydının tam alan seti doğrulandı — API'nin gerçekten yalnızca 9+2 alan döndürdüğü kanıtlandı, eksik kalan yok
- `print_url` (gerçek gap) yeni migration + mapper + resync ile eklendi, 15/15 doğru çözülüyor
- `invoices` (gerçek, önceden hiç görülmemiş ilişki, 1/15 dolu) yeni junction tablo + sync + UI ile eklendi
- Boş ilişkilerin (tags, custom_requirement_infos, warehouse_transfer, e_despatch_response, sharings) gerçekten boş olduğu 15/15 sayısal kanıtla doğrulandı; `invoices` tek istisna olarak bulundu ve atlanmadı
- İki ardışık gerçek sync birebir aynı, 0 duplicate/unresolved/stale/error
- Regresyon: tüm modüllerin sayıları birebir korundu
- Build/lint/test/tsc/deploy/route/overflow/console doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED:** Yok.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

Faz 9'un ham API envanteri liste endpoint'inin kabul ettiği include'larla sınırlıydı; `activities`/`sharings`/`invoices` liste endpoint'inde 400 döndüğü için hiç görülmedi (yalnızca `activities` fark edilip tekil endpoint'ten çekildi, `invoices` gözden kaçtı). `print_url` ise saf bir migration eksikliğiydi — attribute envanterinde zaten "dolu" olarak listelenmişti ama şema/mapper'a yansıtılmamıştı. Bu faz, tam tekil-endpoint include kombinasyonunu (`activities,activities.item,activities.done_by,inbound_e_despatch` + ayrıca `tags,custom_requirement_infos,warehouse_transfer,e_despatch_response,sharings,invoices`) 15 kaydın tamamında yeniden çalıştırarak her iki gerçek gap'i buldu ve kapattı.

## Claude Browser için gerçek irsaliye/activity/inbound ID'leri

- **İrsaliye (tam activity geçmişi, 2 activity):** `1000391168` — activity `786808817` ("İrsaliye güncellendi"), `786808567` ("İrsaliye oluşturuldu")
- **İrsaliye (inbound_e_despatch dolu):** `1000396035` → despatch `1000356985`
- **İrsaliye (gerçek invoices bağlantısı, tek örnek):** `1001145751` → satış faturası `1039436257` ("HD02024000000132")
- **done_by kullanıcısı:** `800086` ("Hayrettin Dayan", `hayridayan58@gmail.com`)

## Genel Karar

**PASS.** 52 activity'nin tüm attribute ve `data.*` alanları, 6 inbound_e_despatch'in tüm alanları, `done_by`/`item` included kapsamı tam olarak envanterlendi ve doğrulandı — hiçbiri eksik çıkmadı, yalnızca UI'da bazı alanlar gösterilmiyordu, bu düzeltildi. İki gerçek, önceden atlanmış veri bulundu (`print_url`, `invoices` — 1 gerçek bağlantı) ve eksiksiz eklendi: yeni migration, mapper, sync, UI. Print URL hedefi Faz 8.2'nin kanıtlanmış çözümleyicisiyle doğru şekilde çözülüyor, demo domain'ine gitmiyor. Boş ilişkiler 15/15 sayıyla kanıtlandı, sahte tablo/kart üretilmedi. İki ardışık sync birebir aynı sonucu verdi, regresyon yok.
