# Phase 08 — E-Belgeler: e-Fatura / e-Arşiv

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/satislar/faturalar
**Kod commit SHA:** `3e16793e45b987f7027fc0264c0960fa033cfb3b`
**Rapor commit SHA:** (bu commit)

## 1. Gerçek API envanteri

Tüm pagination sayfaları gerçek isteklerle çekildi (`page[size]=25`, API'nin gerçek üst sınırı — `page[size]=100` denemesi `400 "Page size is too big"` verdi, kanıtla düzeltildi).

- **`sales_invoices`**: `filter[archived]=false` → 449, `filter[archived]=true` → 2, **toplam 451** (DB ile birebir).
- **`purchase_bills`**: `filter[archived]` gerçek API'de **400** ("`'archived' is not a valid filter`") — bu, projenin daha önce de doğruladığı gerçek bir kısıt (Faz 4); tek tam listeleme yapıldı, **811** kayıt (DB ile birebir).
- İki isteğe de `include=...,active_e_document` eklendi, mevcut include'lar korundu.

**e_invoices attribute envanteri (1238 kayıt, birleşik SI+PB):**

| Alan | Bulunan | Dolu | Null | Boş | Tip |
|---|---:|---:|---:|---:|---|
| `created_at`/`updated_at` | 1238 | 1238 | 0 | 0 | string |
| `external_id` | 1238 | 1238 | 0 | 0 | string |
| `uuid` | 1238 | 1238 | 0 | 0 | string |
| `env_uuid` | 1238 | 811 | 427 | 0 | string/null |
| `from_address`/`from_vkn`/`to_address`/`to_vkn` | 1238 | 1238 | 0 | 0 | string |
| `direction` | 1238 | 1238 | 0 | 0 | string |
| `note` | 1238 | 1064 | 87 | 87 (boş string) | string/null |
| `response_type` | 1238 | 390 | 848 | 0 | string/null |
| `contact_name` | 1238 | 1238 | 0 | 0 | string |
| `scenario` | 1238 | 1238 | 0 | 0 | string |
| `status`/`status_code` | 1238 | 1238 | 0 | 0 | string |
| `status_message` | 1238 | 427 | 811 | 0 | string/null |
| `gtb_ref_no` | 1238 | 0 | 1238 | 0 | null (yalnızca null, gerçek) |
| `issue_date` | 1238 | 1238 | 0 | 0 | string |
| `expires_at` | 1238 | 1238 | 0 | 0 | string |
| `is_expired` | 1238 | 1238 (false=2) | 0 | 0 | boolean |
| `is_answerable` | 1238 | 1238 (false=1237) | 0 | 0 | boolean |
| `is_seen` | 1238 | 1238 (false=328) | 0 | 0 | boolean |
| `net_total`/`total_vat` | 1238 | 1238 | 0 | 0 | string (sayısal) |
| `currency`/`item_type` | 1238 | 1238 | 0 | 0 | string |
| `invoice_type_code` | 1238 | 1092 | 146 | 0 | string/null |
| `non_standard_e_invoice` | 1238 | 1238 (false=1205) | 0 | 0 | boolean |
| `archived` | 1238 | 1238 (false=1238) | 0 | 0 | boolean |
| `migration_source` | 1238 | 0 | 1238 | 0 | null (gerçek) |
| `profile_id` | 1238 | 847 | 391 | 0 | string/null |
| `refund_of_id` | 1238 | 1 | 1237 | 0 | number/null |
| `vat_exemption_reason_code` | 1238 | 3 | 1235 | 0 | string/null |
| `pdf_url`/`signed_ubl_url`/`html_url` | 1238 | 1238 | 0 | 0 | string |
| `__rendered_ubl_path`/`__ubl_remote_id` | 1238 | 811 | 427 | 0 | string/null |
| `__signed_ubl_remote_id` | 1238 | 0 | 1238 | 0 | null (gerçek) |

`gtb_registration_no`, `gtb_export_date`, `response_note` — script'in eski attr listesinde vardı ama **gerçek response'ta hiç görünmüyor** (Parasut API'sinin güncel sürümünde artık dönmüyor); eski migration'daki bu 3 kolon dokunulmadan bırakıldı (dead ama zararsız), yeni sync bunları yazmıyor.

**e_archives attribute envanteri (24 kayıt):**

| Alan | Bulunan | Dolu | Null | Tip |
|---|---:|---:|---:|---|
| `created_at`/`updated_at` | 24 | 24 | 0 | string |
| `uuid`/`vkn`/`invoice_number` | 24 | 24 | 0 | string |
| `status` | 24 | 24 | 0 | string |
| `is_printed`/`is_signed` | 24 | 24 (hepsi false) | 0 | boolean |
| `cancellable_until` | 24 | 24 | 0 | string |
| `pdf_url`/`signed_ubl_url`/`html_url` | 24 | 24 | 0 | string |
| `printed_at` | 24 | 0 | 24 | null (gerçek) |
| `note`/`email_status`/`migration_source` | 24 | 0 | 24 | null (gerçek) |

**Relationships (her iki tip için de):** `e_invoices.invoice/responses/activities` ve `e_archives.sales_invoice` — **tamamı boş `{"meta":{}}`**, include edilse bile (`activities.item`/`activities.done_by` deseniyle aynı şekilde ayrıca denendi, sonuç değişmedi). Bu yüzden parent bağlantısı **her zaman parent'ın kendi `relationships.active_e_document`'inden** alındı, child'dan asla tahmin edilmedi.

Başka bir `active_e_document` tipi (ör. `e_smms`) bu hesapta **hiç görülmedi** — eklenmedi.

## 2. Parent–document ilişki modeli

- **451/451 sales_invoices** ve **811/811 purchase_bills**'in gerçek, dolu bir `active_e_document`'ı var (0 belgesiz parent).
- Tip dağılımı: sales_invoices → 427 `e_invoices` + 24 `e_archives`; purchase_bills → 811 `e_invoices` + **0** `e_archives` (bu hesapta hiç gözlenmedi).
- **`e_invoices` gerçekten polimorfik**: hem sales_invoices hem purchase_bills'e bağlanıyor. Mevcut `invoice_parasut_id` kolonu (eski migration) bu ayrımı temsil edemiyordu — bu yüzden **yeni, gerçek polimorfik `parent_type` (`sales_invoices`/`purchase_bills`) + `parent_parasut_id` kolonları eklendi**, eski `invoice_parasut_id` dokunulmadan (zaten null) bırakıldı.
- `e_archives` yalnızca `sales_invoice_parasut_id` ile — bu hesapta hiç purchase_bill'e bağlanmadığı için mevcut kolon doğru ve yeterli, değiştirilmedi.
- **Hiçbir belge birden fazla parent'a bağlı değil** (0 çakışma, hem `e_invoices` hem `e_archives` için doğrulandı).
- ID namespace çakışması yok (`e_invoices` ve `e_archives` arasında 0 ortak ID).

## 3. Mevcut 1259 kaydın denetimi

`scripts/sync_parasut.py` ile daha önce doldurulmuş 1236 `e_invoices` + 23 `e_archives` satırı incelendi:

- **DB'de olup canlı API'de artık görülmeyen (stale) satır: 0** hem `e_invoices` hem `e_archives` için.
- **Canlı API'de olup DB'de henüz olmayan (yeni) kayıt:** `e_invoices` +2, `e_archives` +1 — zaman geçtikçe gerçekleşen doğal büyüme, zorlanmadı.
- Duplicate `parasut_id`: **0** (hem eski hem yeni durumda).
- Raw payload: eski 1259 satırın **hiçbirinde boş `raw` yok** (`raw = '{}'` veya null: 0/0).
- Eski satırların durumu: tümü `status='successful'` idi (script'in tek seferlik anlık görüntüsü); gerçek API'de bu hesabın e_archives'i **3 farklı durum** gösteriyor (`waiting:1, legalized:12, sent:11`) — script bunları henüz güncellemişti, bu faz gerçek güncel durumları yazdı.
- Eski kayıtlar **silinmedi, yeniden oluşturulmadı** — `parasut_id` üzerinden güvenli upsert ile üzerine yazıldı (aynı upsert deseni, `onConflict: "parasut_id"`).
- Aynı ID farklı resource type'ında bulunmuyor (bölüm 2'de doğrulandı, 0 çakışma).

## 4. Supabase modeli

Yeni migration: `supabase/migrations/20260827040000_parasut_e_documents_full_data.sql` (eski migration'lar değiştirilmedi).

- `parasut.e_invoices`'a 19 eksik gerçek kolon eklendi (`archived, expires_at, html_url, invoice_type_code, is_seen, migration_source, non_standard_e_invoice, pdf_url, profile_id, refund_of_id, signed_ubl_url, status_code, status_message, total_vat, vat_exemption_reason_code, rendered_ubl_path, ubl_remote_id, signed_ubl_remote_id`) + gerçek polimorfik `parent_type`/`parent_parasut_id`.
- `parasut.e_archives`'a 5 eksik gerçek kolon eklendi (`email_status, html_url, migration_source, pdf_url, signed_ubl_url`).
- `raw jsonb` her iki tabloda da korunuyor, tam.
- İndeksler: `e_invoices(parent_type, parent_parasut_id)`, `e_archives(sales_invoice_parasut_id)` (ikincisi zaten vardı, `if not exists` ile korundu).
- Upsert anahtarı: `parasut_id` (her iki tabloda da zaten `unique` — Faz 0'dan).
- Yeni public view'lar: `public.parasut_e_invoices_demo`, `public.parasut_e_archives_demo` — yalnızca güvenli iş alanları, `raw` ve iç `__`-önekli teknik alanlar (`rendered_ubl_path` vb.) dışarı çıkmıyor.
- Mevcut `public.parasut_sales_invoices_demo`/`public.parasut_purchase_bills_demo` view'ları, gerçek kaynak SQL'leri okunarak (tahmin edilmeden) `active_e_document_type`/`active_e_document_parasut_id` eklenmiş hâliyle yeniden oluşturuldu — mevcut hiçbir kolon kaybolmadı/yeniden adlandırılmadı.

## 5. Edge Function sync

- `syncSalesInvoices`: include listesine yalnızca `active_e_document` eklendi (`details,details.product,contact,active_e_document`).
- `syncPurchaseBills`: aynı şekilde (`supplier,spender,pay_to,details,details.product,active_e_document`).
- Yeni paylaşılan yardımcı fonksiyon `syncActiveEDocuments()` (`index.ts`): her iki sync tarafından çağrılıyor; parent'ın `relationships.active_e_document.data`'sını okuyor, `included`'dan çözüyor, tipe göre (`e_invoices`/`e_archives`) ayırıp batch upsert ediyor.
- **Stale link temizliği**: her sync tam bir listeleme olduğu için (sales_invoices: aktif+arşivli ayrı akış; purchase_bills: tek tam listeleme), o parent tipine ait ama artık güncel çözümlenen kümede olmayan `e_invoices`/`e_archives` satırlarının `parent_type`/`parent_parasut_id` (veya `sales_invoice_parasut_id`) alanı **null'a çekiliyor, satır silinmiyor**. Bu çalıştırmada gerçek veri zaten tutarlı olduğu için **0 stale link kaldırıldı** (kanıtlı, zorlanmadı).
- `dry_run`: doğrulandı, hem sales_invoices hem purchase_bills için doğru sayaçlarla (yazmadan).
- Eşzamanlı sync kilidi: mevcut `sync_runs` mekanizması değiştirilmeden kullanıldı.
- **`sync_runs`'da olmayan kolona yazılmadı**: yeni e-belge sayaçları (`e_invoice_fetched_count` vb.) yalnızca HTTP `responseFields`'da; `dbFields` yalnızca zaten var olan kolonları (`fetched_count, upserted_count, detail_fetched_count, detail_upserted_count, unresolved_count, error_count`) kullanıyor — Faz 6.2'de bulunan bug'ın tekrarı önlendi.
- Sayaçlar (gerçek, iki sync'ten): `e_invoice_fetched/upserted`, `e_archive_fetched/upserted`, `parent_linked_count`, `parent_without_document_count`, `duplicate_count`, `unresolved_count`, `stale_link_removed_count`, `error_count` — hepsi response'ta.

## 6. Frontend

- `/satislar/faturalar` (`Faturalar.tsx`): yeni "E-Belge" kolonu, gerçek `active_e_document_type` (e-Fatura/e-Arşiv) veya "—".
- `/satislar/faturalar/:parasutId` (`FaturaDetay.tsx`): yeni "E-Belge" bölümü — gerçek tipe göre (e_invoices/e_archives) tüm iş alanlarını gösteriyor (durum, external_id/fatura no, UUID, yön/senaryo, tarihler, net/KDV, VKN'ler, oluşturulma/güncellenme — UTC, PDF/UBL linkleri).
- `/giderler` (`Giderler.tsx`) ve `/giderler/:parasutId` (`GiderDetay.tsx`): aynı desen.
- Paylaşılan mantık: yeni `src/lib/eDocuments.ts` — `fetchActiveEDocument()` parent'ın **kendi** `active_e_document_type`/`active_e_document_parasut_id`'sini okuyup doğru view'dan (e_invoices ya da e_archives) tek kaydı çekiyor; parent'ın belgesi yoksa (`type`/`id` null) hiç sorgu atmadan `null` dönüyor.
- **PDF/UBL linkleri**: yalnızca gerçek, dolu `pdf_url`/`signed_ubl_url` varsa `<a href=... target="_blank" rel="noopener noreferrer">` gösteriliyor; null ise "—". URL hiçbir şekilde üretilmedi/dönüştürülmedi — API'nin verdiği ham URL doğrudan kullanıldı. Uygulama içi PDF üretimi yok.
- Belgesi olmayan bir parent olsaydı "E-belge yok" gösterilecekti (kod yolu var, `eDoc === null` dalı) — ancak bu hesapta **gerçekten hiç böyle bir kayıt yok** (bkz. bölüm 8), bu yüzden canlı olarak gösterilemedi; sahte bir örnek de üretilmedi.
- Tutarlar yalnızca e-belgenin kendi `net_total`/`total_vat` alanlarından — parent faturadan kopyalanmadı/hesaplanmadı.

## 7. Uçtan uca veri denetimi

| API alanı | Base | Raw | View | TS type | UI | Null korunuyor |
|---|---|---|---|---|---|---|
| e_invoices: external_id, uuid, status, status_code, status_message | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| e_invoices: direction, scenario, item_type, invoice_type_code | ✅ | ✅ | ✅ | ✅ | ✅ (invoice_type_code hariç, base/view/type'ta var, UI'da gösterilmiyor — iş açısından ikincil, diğer tüm iş alanları gösteriliyor) | ✅ |
| e_invoices: issue_date, expires_at, is_expired, is_answerable, is_seen | ✅ | ✅ | ✅ | ✅ | ✅ (issue_date/expires_at gösteriliyor; is_expired/is_answerable/is_seen base/view/type'ta, UI'da yok — teknik durum bayrakları) | ✅ |
| e_invoices: net_total, total_vat, currency | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| e_invoices: contact_name, from_address/vkn, to_address/vkn, note | ✅ | ✅ | ✅ | ✅ | ✅ (VKN'ler gösteriliyor; adres/not alanları base/view/type'ta) | ✅ |
| e_invoices: pdf_url, signed_ubl_url, html_url | ✅ | ✅ | ✅ | ✅ | ✅ (pdf/ubl link olarak) | ✅ |
| e_invoices: archived, non_standard_e_invoice, migration_source, profile_id, refund_of_id, vat_exemption_reason_code, response_type, env_uuid | ✅ **(bu fazda eklendi)** | ✅ | ✅ | ✅ | — (base/view/type'ta tam; UI'da öncelikli iş alanları gösterildi, bu alanlar ikincil/teknik) | ✅ |
| e_invoices: rendered_ubl_path, ubl_remote_id, signed_ubl_remote_id | ✅ **(bu fazda eklendi)** | ✅ | — (public view'a bilinçli olarak alınmadı, Parasut-içi teknik takip alanları) | — | — | ✅ |
| e_invoices: parent_type, parent_parasut_id | ✅ **(bu fazda eklendi, polimorfik)** | — (relationship, raw'da zaten var) | — (view parent bilgisini expose etmiyor; parent kendi `active_e_document_parasut_id`'siyle geri bağlanıyor) | n/a | n/a (parent sayfası zaten kendi ID'siyle sorguluyor) | ✅ |
| e_archives: uuid, vkn, invoice_number, status | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| e_archives: is_printed, is_signed, printed_at, cancellable_until | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (printed_at null → "—") |
| e_archives: pdf_url, signed_ubl_url, html_url | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| e_archives: note, email_status, migration_source | ✅ **(bu fazda eklendi: email_status/migration_source)** | ✅ | ✅ | ✅ | — (base/view/type'ta tam, tümü bu hesapta gerçek null) | ✅ |
| e_archives: sales_invoice_parasut_id | ✅ (mevcuttu, doldurulmadıydı) | — | ✅ | n/a | n/a | ✅ |
| sales_invoices/purchase_bills: active_e_document_type/parasut_id | ✅ (mevcuttu, **doldurulmadıydı**) | — | ✅ **(bu fazda eklendi)** | ✅ | ✅ **(bu fazda eklendi)** | ✅ |

**Doğrulanan gerçek örnekler:**
- **3 e_invoice bağlı sales invoice**: `1072353915`→e_invoice `1055802035` (outbound, successful), `1014238248`, `1015540821`.
- **3 e_invoice bağlı purchase bill**: `1007881809`→e_invoice `1009548055` (inbound, successful), `1008041958`, `1008041965`.
- **3 e_archive bağlı sales invoice**: `1014217636`→e_archive `1007488010` (sent), `1023708069`, `1024020569`.
- **Null alanlı 3 e-belge**: e_invoices'te `env_uuid`/`response_type`/`profile_id` null olan kayıtlar (427/1238 `env_uuid` null); e_archives'te `printed_at`/`note`/`email_status` her zaman null (24/24) — canlı sayfada `1014217636` üzerinde "Yazdırılma tarihi: —" olarak doğrulandı.
- **PDF URL / Signed UBL URL dolu örnekler**: yukarıdaki 3 kayıtta da doğrulandı (hepsi dolu, canlı linkler render edildi).
- **PDF URL / Signed UBL URL boş örnekler**: **bu hesapta yok** — 1238/1238 e_invoices ve 24/24 e_archives'te bu iki alan da her zaman dolu (sayıyla kanıtlandı, bölüm 8). Sahte boş örnek üretilmedi.
- **Farklı status değerlerinden örnekler**: e_invoices tek durumda (`successful`, 1238/1238 — bu hesabın gerçek durumu); e_archives 3 farklı durumda (`waiting:1, legalized:12, sent:11`) — canlıda `successful` (e_invoice) ve `sent` (e_archive) render edildi.
- **E-belgesiz 3 parent**: **bu hesapta yok** — 451/451 sales_invoices ve 811/811 purchase_bills'in tamamının gerçek bir belgesi var (0 belgesiz). Sahte örnek üretilmedi, sayıyla kanıtlandı.

## 8. Sayı mutabakatı

| Metrik | Değer (bu faz, gerçek) |
|---|---:|
| Sales invoice toplamı | 451 (449 aktif + 2 arşivli) |
| → e_invoices | 427 |
| → e_archives | 24 |
| Purchase bill toplamı | 811 |
| → e_invoices | 811 |
| → e_archives | 0 |
| Benzersiz e_invoice | 1238 |
| Benzersiz e_archive | 24 |
| Parent'a bağlı (linked) | 1262/1262 (451+811) |
| Belgesiz parent | 0 |
| Birden fazla parent'a bağlı child | 0 |
| Duplicate | 0 |
| Unresolved | 0 |
| Stale link kaldırılan | 0 |
| Error | 0 |

Eski rapordaki 1236/23/1259 sayıları **zorlanmadı** — güncel gerçek değerler (1238/24/1262) hesabın doğal büyümesini yansıtıyor (2 yeni e_invoice + 1 yeni e_archive, script'in çalıştığı andan bu yana geçen zamanda).

**İki ardışık gerçek sync** (hem sales_invoices hem purchase_bills için ayrı ayrı) birebir aynı sonucu verdi — sayılar bölüm 5'te gösterilen tek çalıştırmayla identik tekrarlandı.

## 9. Regresyon

| Metrik | Beklenen | Gerçek |
|---|---:|---:|
| Contacts | 448 | **448** ✅ |
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| Products | 2597 | **2597** ✅ |
| Checks | 40 | **40** ✅ |
| Check payments | 35 | **35** ✅ |
| Payments | 1651 | **1651** ✅ |
| Transactions | 1498 | **1498** ✅ |
| Accounts | 3 | **3** ✅ |
| Sales offers | 1 | **1** ✅ |
| Sales offer details | 1 | **1** ✅ |
| Sales offer activities | 2 | **2** ✅ |

## 10. Deploy ve test

- Migration hosted DB'ye uygulandı (`supabase db push`).
- Edge Function deploy edildi (`supabase functions deploy parasut-sync`).
- Dry run: her iki resource için doğrulandı (bölüm 5/8).
- İki ardışık gerçek sync: her iki resource için doğrulandı, birebir aynı sonuç.
- `npm test`: 1 test, geçti. `npm run lint`: 0 hata, 10 önceden var olan uyarı. `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan `Login.tsx:55` hatası (bu faza ait değil). `npm run build:demo`: başarılı.
- FTP deploy: 39 dosya. Canlı: `/` → 200 (yeni bundle hash ile eşleşiyor), `/satislar/faturalar` → 200, `/giderler` → 200, `/satislar/faturalar/1072353915` → 200, `/giderler/1007881809` → 200, yeni JS chunk'lar → 200.
- PDF/UBL link kontrolleri: gerçek dolu URL'lerde `<a target="_blank" rel="noopener noreferrer">` doğrulandı; link hedefi API'nin kendi `pdf_url`/`signed_ubl_url` değeri, üretilmedi.
- 390×844 ve 768×1024 (gerçek headless Chrome CDP), hem liste hem E-Belge paneli açık detay sayfalarında: `scrollWidth === clientWidth` — yatay taşma yok. Console hatası yakalanmadı.
- Gerçek render doğrulaması: 3 farklı senaryo (SI→e_invoice, SI→e_archive, PB→e_invoice) canlı sayfadan metin olarak çekildi, tüm alanlar gerçek değerleriyle görüldü (bölüm 7).

## PASS / FAIL / BLOCKED

**PASS:**
- Gerçek API envanteri (tam pagination, tüm attribute'lar, tüm relationship'ler) çıkarıldı
- Parent–document ilişki modeli gerçek response'a göre kuruldu (polimorfik `e_invoices`, tekil-tip `e_archives`) — varsayılmadı
- Mevcut 1259 kayıt denetlendi: 0 stale, 0 duplicate, raw eksiksiz, güncel API ile eşleşiyor
- Eksik gerçek kolonlar yeni migration ile eklendi, eski migration'lar değiştirilmedi
- Edge Function sync'i mevcut modüler desene uygun şekilde genişletildi, `sync_runs` şema uyumsuzluğu riski önceden kontrol edildi
- Parent'ların `active_e_document_type/parasut_id`'si artık doğru dolduruluyor
- İki ardışık gerçek sync birebir aynı sonuç verdi
- Frontend'de her iki belge tipi de (e_invoices/e_archives) gerçek alanlarıyla gösteriliyor, PDF/UBL yalnızca gerçek URL varsa link
- Regresyon: 12 modülün sayıları birebir korundu
- Build/lint/test/tsc/deploy/route/overflow/console doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED (gerçek veri kısıtı, kod eksikliği değil):**
- "E-belgesiz 3 parent" ve "PDF/UBL URL boş 3 örnek" doğrulaması **yapılamadı** çünkü bu hesapta gerçekten hiç böyle bir kayıt yok (451/451 ve 811/811 parent'ın tamamında belge var; 1238/1238 ve 24/24 belgenin tamamında pdf_url/signed_ubl_url dolu) — sayıyla kanıtlandı, sahte örnek üretilmedi.
- `gtb_registration_no`/`gtb_export_date`/`response_note` (eski migration'ın script-kaynaklı kolonları) gerçek API'de artık hiç dönmüyor — dokunulmadan bırakıldı, yeni sync bunlara yazmıyor.

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

`parasut.e_invoices`/`e_archives` tabloları Faz 0'ın ilk şema migration'ında tanımlanmıştı ve bir kerelik `scripts/sync_parasut.py` ile gerçek veriyle doldurulmuştu, ama Edge Function'ın kendi `syncSalesInvoices`/`syncPurchaseBills` fonksiyonları hiçbir zaman `active_e_document` include'unu istemedi — bu yüzden parent'ların `active_e_document_type/parasut_id` kolonları (zaten mapper'da okunuyor olsa da) hep null kaldı ve child tablolardaki geri-bağlantı hiç kurulmadı. Kök neden, önceki fazlarda bu ilişkinin taranmamış olmasıydı; bu faz gerçek API keşfiyle (Faz 8.0) tespit edilen boşluğu, aynı include-genişletme + polimorfik backfill desenini (Faz 6.2/7'de kanıtlanmış) uygulayarak kapattı.

## Claude Browser için gerçek parent/document ID örnekleri

- **Sales invoice → e_invoice**: parent `1072353915` → belge `1055802035` (`/satislar/faturalar/1072353915`)
- **Sales invoice → e_archive**: parent `1014217636` → belge `1007488010` (`/satislar/faturalar/1014217636`)
- **Purchase bill → e_invoice**: parent `1007881809` → belge `1009548055` (`/giderler/1007881809`)

## Genel Karar

**PASS.** Sales_invoices ve purchase_bills'in gerçek `active_e_document` ilişkisi artık Paraşüt API → Supabase base/raw → güvenli public view → mevcut fatura/gider UI zincirinin tamamında, hiçbir alan/ilişki kaybolmadan, hiçbir parent tahminle eşleştirilmeden, hiçbir null doldurulmadan mevcut. `e_invoices`'ın gerçekten polimorfik olduğu keşfedildi ve doğru şekilde modellendi (yeni `parent_type`/`parent_parasut_id`, eski belirsiz kolon dokunulmadan bırakıldı). Mevcut 1259 kayıt denetlendi, stale/duplicate bulunmadı, güncel gerçek sayılar (1238/24) zorlanmadan raporlandı. İki ardışık sync birebir aynı sonucu verdi. Tek blokaj, hesabın gerçek veri hacminin (her parent'ın dolu olması, her belgenin URL'lerinin dolu olması) bazı "boş/eksik örnek" doğrulamalarını imkansız kılması — kod tarafında bir eksiklik değil, dürüstçe raporlanan bir veri kısıtı.
