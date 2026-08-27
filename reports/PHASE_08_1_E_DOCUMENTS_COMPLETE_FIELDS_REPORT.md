# Phase 08.1 — E-Belgeler Tüm Gerçek Alanlar Düzeltmesi

**Tarih:** 2026-08-27
**Canlı URL:** https://demo.eclipsemuhendislik.com/satislar/faturalar/1072353915
**Kod commit SHA:** (aşağıda, ikinci commit'te doldurulacak)
**Rapor commit SHA:** (push sonrası doldurulacak)

## Özet

Faz 8'in raporu, base/raw/view/type katmanlarında zaten var olan birçok gerçek `e_invoices`/`e_archives` alanının "ikincil/teknik" gerekçesiyle UI'dan gizlendiğini gösteriyordu. Bu faz **yalnızca UI ve view katmanını** düzeltti: iki gerçek alan (`gtb_ref_no`, `migration_source`) public view'ların select listesinde eksikti (yeni migration ile eklendi); geri kalan tüm alanlar zaten base/raw/view/type'ta mevcuttu, sadece render edilmiyordu (yeni paylaşılan `EDocumentSection` bileşeniyle düzeltildi). **Base mapping eksikliği bulunmadığı için Edge Function deploy veya resync yapılmadı.**

## 1. E-invoice detayında eklenen alanlar

`src/components/EDocumentSection.tsx` (yeni, paylaşılan bileşen — hem `FaturaDetay.tsx` hem `GiderDetay.tsx` kullanıyor) artık 7 alt bölümde **tüm** gerçek `e_invoices` alanlarını gösteriyor:

- **Belge bilgileri**: parasut_id, external_id, uuid, env_uuid, item_type, invoice_type_code, profile_id, archived, non_standard_e_invoice, refund_of_id, vat_exemption_reason_code
- **Durum ve yanıt**: direction, scenario, status, status_code, status_message, response_type
- **Taraf bilgileri**: contact_name, from_vkn, to_vkn, from_address, to_address
- **Tutarlar**: currency, net_total, total_vat
- **Tarihler ve bayraklar**: issue_date, expires_at, is_expired, is_answerable, is_seen, parasut_created_at, parasut_updated_at
- **Dosyalar**: pdf_url, signed_ubl_url, html_url (güvenli buton, yalnızca dolu URL varsa)
- **Ek alanlar**: note, gtb_ref_no, migration_source

Eski, artık API'de dönmeyen kolonlar (`gtb_registration_no`, `gtb_export_date`, `response_note`) UI'a **eklenmedi** — Faz 8 raporunda zaten "current API'de yok" olarak kanıtlanmıştı, bu faz o kanıtı yeniden doğruladı (bkz. bölüm 5).

## 2. E-archive detayında eklenen alanlar

Aynı bileşen, `e_archives` için 5 alt bölüm gösteriyor:

- **Belge bilgileri**: parasut_id, uuid, vkn, invoice_number
- **Durum ve yanıt**: status, is_printed, is_signed, email_status
- **Tarihler ve bayraklar**: printed_at, cancellable_until, parasut_created_at, parasut_updated_at
- **Dosyalar**: pdf_url, signed_ubl_url, html_url
- **Ek alanlar**: note, migration_source

Bu hesapta gerçek null olan `printed_at`, `note`, `email_status`, `migration_source` alanları canlı sayfada doğrulanan şekilde "—" gösteriyor (bkz. bölüm 6).

## 3. Private teknik alanlar

`__rendered_ubl_path`, `__ubl_remote_id`, `__signed_ubl_remote_id` (base tabloda `rendered_ubl_path`/`ubl_remote_id`/`signed_ubl_remote_id` olarak saklanıyor, Faz 8'den beri):

- **Base tabloda korunuyor**: doğrulandı — örnek kayıt `1009548055` için `rendered_ubl_path='519a8d24-6972-43a4-b875-d99f7125c4e4/ERD2023000002668.pdf'`, `ubl_remote_id='d035c277-eb36-4167-a6f5-0758bfb97feb'`, `signed_ubl_remote_id=null` (gerçek).
- **Public view'a açılmıyor**: `information_schema.columns` sorgusuyla doğrulandı — `public.parasut_e_invoices_demo`'nun kolon listesinde bu 3 alan **yok**.
- **TS type/UI'da yok**: `src/lib/eDocuments.ts`'in `EInvoiceRow` arayüzünde bu alanlar tanımlanmadı, `EDocumentSection.tsx` hiçbir yerde render etmiyor.

`parent_type`/`parent_parasut_id` (e_invoices, polimorfik ilişki): public view'da **kalmaya devam ediyor** (Faz 8'den beri) — görev kuralı bunun UI'da tekrar gösterilmesini zorunlu kılmıyor, kaldırılmasını da istemiyor; ilişki zaten parent'ın kendi `active_e_document_type/parasut_id`'si üzerinden UI'da kanıtlanıyor (dokunulmadı).

## 4. UI tasarımı

`EDocumentSection`: özet satırında belge tipi + ID gösteriliyor, "Tüm e-belge alanlarını göster" butonu tüm alanları açılır bir panelde gösteriyor (görevin izin verdiği desen). Uzun UUID/adres/status_message/URL değerleri `break-words`/`break-all` ile sarılıyor; URL'ler tam metin olarak değil, güvenli `<a target="_blank" rel="noopener noreferrer">` buton olarak gösteriliyor — mobilde taşma yaratmıyor (bkz. bölüm 8).

## 5. Uçtan uca denetim

### e_invoices (39 attribute)

| API alanı | Base | Raw | View | TS type | UI | Gerçek değer (1055802035) |
|---|---|---|---|---|---|---|
| external_id | ✅ | ✅ | ✅ | ✅ | ✅ | "HD02026000000002" |
| uuid | ✅ | ✅ | ✅ | ✅ | ✅ | "5e91c83e-..." |
| env_uuid | ✅ | ✅ | ✅ | ✅ | ✅ | null → "—" |
| direction | ✅ | ✅ | ✅ | ✅ | ✅ | "outbound" |
| scenario | ✅ | ✅ | ✅ | ✅ | ✅ | "commercial" |
| status | ✅ | ✅ | ✅ | ✅ | ✅ | "successful" |
| status_code | ✅ | ✅ | ✅ | ✅ | ✅ | "1300" |
| status_message | ✅ | ✅ | ✅ | ✅ | ✅ | "BAŞARIYLA TAMAMLANDI" |
| response_type | ✅ | ✅ | ✅ | ✅ | ✅ | null → "—" (bu kayıtta); "accepted" (1009548055'te) |
| invoice_type_code | ✅ | ✅ | ✅ | ✅ | ✅ | "SATIS" |
| item_type | ✅ | ✅ | ✅ | ✅ | ✅ | "invoice" |
| profile_id | ✅ | ✅ | ✅ | ✅ | ✅ | null → "—" (bu kayıtta); "TICARIFATURA" (1009548055'te) |
| archived | ✅ | ✅ | ✅ | ✅ | ✅ | false → "Hayır" |
| non_standard_e_invoice | ✅ | ✅ | ✅ | ✅ | ✅ | false → "Hayır" |
| refund_of_id | ✅ | ✅ | ✅ | ✅ | ✅ | null → "—" (bu kayıtta); 1061750488 (1048506991'de) |
| vat_exemption_reason_code | ✅ | ✅ | ✅ | ✅ | ✅ | null → "—" (bu kayıtta); "351" (1056182966'da) |
| contact_name | ✅ | ✅ | ✅ | ✅ | ✅ | "CEHA-Dişli Sanayi" |
| from_address/from_vkn | ✅ | ✅ | ✅ | ✅ | ✅ | dolu |
| to_address/to_vkn | ✅ | ✅ | ✅ | ✅ | ✅ | dolu |
| issue_date/expires_at | ✅ | ✅ | ✅ | ✅ | ✅ | "2026-01-06"/"2026-01-13" |
| is_expired | ✅ | ✅ | ✅ | ✅ | ✅ | true → "Evet" |
| is_answerable | ✅ | ✅ | ✅ | ✅ | ✅ | false → "Hayır" |
| is_seen | ✅ | ✅ | ✅ | ✅ | ✅ | false → "Hayır" (bu kayıtta); true (1009548055'te) |
| net_total/total_vat/currency | ✅ | ✅ | ✅ | ✅ | ✅ | 29.400,00 TRL / 0,00 TRL / TRL |
| note | ✅ | ✅ | ✅ | ✅ | ✅ | dolu string |
| pdf_url/signed_ubl_url/html_url | ✅ | ✅ | ✅ | ✅ | ✅ | dolu, link |
| **gtb_ref_no** | ✅ | ✅ | ✅ **(bu fazda view'a eklendi)** | ✅ **(bu fazda tipe eklendi)** | ✅ **(bu fazda eklendi)** | null → "—" |
| **migration_source** | ✅ | ✅ | ✅ **(bu fazda view'a eklendi)** | ✅ **(bu fazda tipe eklendi)** | ✅ **(bu fazda eklendi)** | null → "—" |
| parasut_created_at/updated_at | ✅ | ✅ | ✅ | ✅ | ✅ | UTC |
| `__rendered_ubl_path` (rendered_ubl_path) | ✅ | ✅ | ❌ (bilinçli, private) | ❌ (bilinçli) | ❌ (bilinçli) | private kalıyor |
| `__ubl_remote_id` (ubl_remote_id) | ✅ | ✅ | ❌ | ❌ | ❌ | private kalıyor |
| `__signed_ubl_remote_id` (signed_ubl_remote_id) | ✅ | ✅ | ❌ | ❌ | ❌ | private kalıyor |
| `gtb_registration_no` | eski kolon, dokunulmadı | — | — | — | — | **API'de artık yok** (bkz. Faz 8 raporu bölüm 1) |
| `gtb_export_date` | eski kolon, dokunulmadı | — | — | — | — | **API'de artık yok** |
| `response_note` | eski kolon, dokunulmadı | — | — | — | — | **API'de artık yok** |

### e_archives (17 attribute)

| API alanı | Base | Raw | View | TS type | UI | Gerçek değer |
|---|---|---|---|---|---|---|
| uuid/vkn/invoice_number | ✅ | ✅ | ✅ | ✅ | ✅ | dolu |
| status | ✅ | ✅ | ✅ | ✅ | ✅ | "sent"/"waiting"/"legalized" (3 farklı gerçek değer) |
| is_printed/is_signed | ✅ | ✅ | ✅ | ✅ | ✅ | false → "Hayır" (24/24) |
| printed_at | ✅ | ✅ | ✅ | ✅ | ✅ | null → "—" (24/24) |
| cancellable_until | ✅ | ✅ | ✅ | ✅ | ✅ | UTC |
| note | ✅ | ✅ | ✅ | ✅ | ✅ | null → "—" (24/24) |
| email_status | ✅ | ✅ | ✅ | ✅ | ✅ | null → "—" (24/24) |
| **migration_source** | ✅ | ✅ | ✅ **(bu fazda view'a eklendi)** | ✅ **(bu fazda tipe eklendi)** | ✅ **(bu fazda eklendi)** | null → "—" (24/24) |
| pdf_url/signed_ubl_url/html_url | ✅ | ✅ | ✅ | ✅ | ✅ | dolu, link |
| parasut_created_at/updated_at | ✅ | ✅ | ✅ | ✅ | ✅ | UTC |

**UI sütununda artık hiçbir gerçek attribute için "gösterilmiyor" sonucu kalmadı.**

## 6. Null/sıfır/false/boş string kanıtları (canlı render'dan)

- `env_uuid=null` (1055802035) → "—" ✅; `env_uuid` dolu (1009548055) → gerçek UUID ✅
- `profile_id=null` (1055802035) → "—" ✅; dolu (1009548055) → "TICARIFATURA" ✅
- `refund_of_id=null` (1055802035) → "—" ✅; **dolu gerçek örnek**: belge `1048506991` (üst kayıt `purchase_bills/1028290665`) → `refund_of_id=1061750488` ✅
- `vat_exemption_reason_code=null` → "—" ✅; **dolu gerçek örnek**: belge `1056182966` (üst kayıt `purchase_bills/1032773393`) → `"351"` ✅
- `is_expired=true` (1055802035) → "Evet"; `is_answerable=false`/`is_seen=false` aynı kayıtta → "Hayır"/"Hayır" ✅ — gerçek `false` değerleri "—" ile karıştırılmadı
- `archived=false`/`non_standard_e_invoice=false` → "Hayır" ✅ (0 gizlenen sıfır/false yok)
- e_archives 3 farklı `status`: `sent` (1007488010), `waiting` (1007379160, üst kayıt sales_invoices/1014011187), `legalized` (1015341612, üst kayıt sales_invoices/1027610384) — üçü de canlı sayfada doğrulandı
- e_archives `printed_at`/`note`/`email_status`/`migration_source` — bu hesapta **tüm 24 kayıtta** gerçek null; canlı sayfada "—" olarak doğrulandı
- `note=""` (boş string, gerçek): DB'de 2 örnek bulundu (`1013723173`, `1044882230`) — UI "—" gösteriyor (formatEDocValue boş string'i de "—" yapıyor, kaynak ayrımı DB'de korunuyor, yalnızca ekranda ikisi aynı görünüyor — görevin izin verdiği davranış)
- `note` dolu: canlı sayfalarda birden fazla gerçek örnek görüldü (ör. 1055802035, 1048506991)

## 7. PDF/UBL/HTML URL doğrulaması

Bu hesapta **1238/1238 e_invoices ve 24/24 e_archives**'te `pdf_url`/`signed_ubl_url` her zaman dolu (Faz 8 raporunda kanıtlandı, bu fazda değişmedi) — bu yüzden "boş URL" örneği **üretilemedi**, sayıyla raporlandı. `html_url` de aynı şekilde her zaman dolu; bu faz UI'a `html_url` linkini de ekledi (Faz 8'de yalnızca pdf/ubl gösteriliyordu). Tüm linkler `target="_blank" rel="noopener noreferrer"` ile, ham API URL'si doğrudan kullanılarak render ediliyor — hiçbir URL üretilmedi/dönüştürülmedi.

## 8. Güncel belge ve parent sayıları / regresyon

Bu faz **UI/view düzeltmesi** olduğu için (base mapping eksikliği yok — `gtb_ref_no`/`migration_source` zaten base tabloda vardı, yalnızca view'a eklenmedi) **Edge Function deploy veya resync yapılmadı**. Sayılar salt okunur sorgularla yeniden doğrulandı, hiçbiri değişmedi:

| Metrik | Beklenen | Gerçek |
|---|---:|---:|
| Sales invoices | 451 | **451** ✅ |
| Purchase bills | 811 | **811** ✅ |
| E-invoices | 1238 | **1238** ✅ |
| E-archives | 24 | **24** ✅ |
| Parent bağlantısı | 1262 | **1262** (451+811) ✅ |
| Duplicate | 0 | **0** ✅ |
| Unresolved | 0 | **0** ✅ |
| Stale | 0 | **0** ✅ |
| Error | 0 | **0** ✅ |
| Contacts | 448 | **448** ✅ |
| Products | 2597 | **2597** ✅ |
| Checks | 40 | **40** ✅ |
| Check payments | 35 | **35** ✅ |
| Payments | 1651 | **1651** ✅ |
| Transactions | 1498 | **1498** ✅ |
| Accounts | 3 | **3** ✅ |
| Sales offers | 1 | **1** ✅ |
| Sales offer details | 1 | **1** ✅ |
| Sales offer activities | 2 | **2** ✅ |

Hiçbir sapma yok.

## 9. Deploy ve test

- **Yeni migration**: `supabase/migrations/20260827050000_parasut_e_documents_view_missing_fields.sql` — yalnızca `public.parasut_e_invoices_demo`/`public.parasut_e_archives_demo` view'larını `gtb_ref_no`/`migration_source` ekleyerek yeniden oluşturdu (eski migration'lar değiştirilmedi, base tablo/sync dokunulmadı). `supabase db push` ile hosted DB'ye uygulandı.
- Edge Function **deploy edilmedi** (kod değişmedi).
- `npm test`: 1 test, geçti. `npm run lint`: 0 hata, 10 önceden var olan uyarı (yeni `EDocumentSection.tsx` sıfır yeni uyarı ekledi). `npx tsc --noEmit -p tsconfig.app.json`: yalnızca önceden var olan `Login.tsx:55` hatası. `npm run build:demo`: başarılı, yeni paylaşılan `EDocumentSection-*.js` chunk'ı oluştu.
- FTP deploy: 40 dosya. Canlı: `/` → 200 (yeni bundle hash ile eşleşiyor), `/satislar/faturalar` → 200, `/satislar/faturalar/1072353915` → 200, `/satislar/faturalar/1014217636` → 200, `/giderler/1007881809` → 200, yeni JS chunk'lar → 200.
- PDF/UBL/HTML link kontrolleri: tüm üç örnek sayfada gerçek, dolu URL'ler `<a target="_blank" rel="noopener noreferrer">` olarak doğrulandı.
- 390×844 ve 768×1024 (gerçek headless Chrome CDP), **"Tüm e-belge alanları" paneli açıkken**: `scrollWidth === clientWidth` her ikisinde, hem e_invoice hem e_archive örneklerinde — yatay taşma yok. Console hatası yakalanmadı.

## PASS / FAIL / BLOCKED

**PASS:**
- e_invoices'ın tüm 39 attribute'u ve e_archives'ın tüm 17 attribute'u artık base→raw→view→type→UI zincirinin tamamında erişilebilir
- `gtb_ref_no`/`migration_source` view eksikliği yeni migration ile giderildi (base'de zaten vardı)
- Private teknik alanlar (`__rendered_ubl_path` vb.) base/raw'da korunuyor, public view/type/UI'a hiç açılmadı — doğrulandı
- `refund_of_id`, `vat_exemption_reason_code` dolu gerçek örnekler bulundu ve canlı doğrulandı
- e_archives'ın 3 farklı gerçek statüsü (waiting/legalized/sent) canlı doğrulandı
- Null/sıfır/false ayrımı her alanda doğru
- API'de artık dönmeyen eski kolonlar UI'a eklenmedi
- Base mapping eksikliği olmadığı için gereksiz resync/deploy yapılmadı, sayılar değişmedi
- Regresyon: tüm 18 sayı birebir korundu
- Build/lint/test/tsc/deploy/route/overflow/console doğrulamaları geçti

**FAIL:** Yok.

**BLOCKED (gerçek veri kısıtı):**
- "PDF/UBL URL boş örnek" doğrulanamadı — bu hesapta 1238/1238 ve 24/24 belgenin tamamında bu URL'ler dolu (sayıyla kanıtlandı, Faz 8'den beri değişmedi).

**Ayrı not (bu fazın kapsamı dışı):** `Login.tsx:55` TypeScript hatası önceden mevcut, bu fazda dokunulmadı.

## Kök neden

Faz 8, `active_e_document` ilişkisinin **var olup olmadığını** ve **parent'a doğru bağlandığını** kanıtlamaya odaklandı; UI'a hangi alanların ekleneceğine karar verirken bazı alanları "teknik durum bayrağı"/"ikincil" olarak sınıflandırıp göstermedi — bu, projenin daha önce Faz 7.1'de de düzelttiği aynı hatalı varsayım kalıbıydı (bir alanın "teknik" olması onu API'nin gerçek, güvenli bir iş alanı olmaktan çıkarmaz). Ayrıca `gtb_ref_no`/`migration_source` view'larının select listesine hiç eklenmemişti — Faz 8'in migration'ı yazılırken gözden kaçan saf bir view-katmanı eksikliğiydi.

## Claude Browser için gerçek parent/document örnekleri

- **Sales invoice → e_invoice**: `/satislar/faturalar/1072353915` → belge `1055802035`
- **Sales invoice → e_archive**: `/satislar/faturalar/1014217636` → belge `1007488010`
- **Purchase bill → e_invoice**: `/giderler/1007881809` → belge `1009548055`
- **refund_of_id dolu**: `/giderler/1028290665` → belge `1048506991` (refund_of_id=1061750488)
- **vat_exemption_reason_code dolu**: `/giderler/1032773393` → belge `1056182966` (kod="351")
- **e_archive waiting**: `/satislar/faturalar/1014011187` → belge `1007379160`
- **e_archive legalized**: `/satislar/faturalar/1027610384` → belge `1015341612`

## Genel Karar

**PASS.** e_invoices ve e_archives'ın güncel API'nin döndürdüğü her gerçek ve güvenli iş alanı artık detay UI'dan erişilebilir; hiçbiri "ikincil"/"teknik" gerekçesiyle gizlenmedi. Paraşüt'ün iç `__`-önekli teknik takip alanları base/raw'da korunuyor ama public view/type/UI'a hiç açılmadı — doğrulandı. Null "—", sıfır/false "Hayır" olarak doğru gösteriliyor, hiçbir değer hesaplanmadı/tahmin edilmedi/parent'tan kopyalanmadı. Base mapping zaten eksiksiz olduğu için gereksiz resync yapılmadı; tüm 18 regresyon sayısı birebir korundu. Tek blokaj, bu hesabın gerçek veri hacminin ("boş URL" örneği yok) bir doğrulama kombinasyonunu imkansız kılması — kod eksikliği değil, dürüstçe raporlanan bir veri kısıtı.
