import EmptyResourceList from "./EmptyResourceList";

interface EInvoiceLookupResultDemoRow {
  parasut_id: number;
  parasut_type: string | null;
  vkn: string | null;
  name: string | null;
  e_invoice_address: string | null;
  inbox_type: string | null;
  address_registered_at: string | null;
  registered_at: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
}

// Phase 13.4: all 10 real Swagger EInvoiceInboxAttributes fields must be
// user-accessible (parasut_id, parasut_type, vkn, e_invoice_address, name,
// inbox_type, address_registered_at, registered_at, created_at,
// updated_at) -- Phase 13.3 only showed 6 of them. There is no
// `GET /e_invoice_inboxes/{id}` (verified against swagger.json), so this
// stays a single wide table on the list route rather than a fake detail
// route. All timestamps are rendered as stored (UTC, ISO 8601) via
// `formatUtc`; null always renders "—", never a derived/fabricated value.
const formatUtc = (v: string | null) => (v ? `${v.replace("T", " ").replace(/\+00:00$|Z$/, "")} UTC` : "—");

// Phase 13.2 problem #1: this resource is NOT a global inbox record list
// -- it is Paraşüt's e-invoice-taxpayer LOOKUP service
// (`GET /e_invoice_inboxes?filter[vkn]=...`, verified against the real
// swagger.json: all attributes readOnly, no relationships, the only real
// filter is filter[vkn], and there is no `GET /{id}`). A `data:[]`
// response therefore means "no VKN has been queried yet", never "0
// records exist in the company's e-invoice inbox" -- there is no such
// global collection to be empty. Reclassified from EMPTY_RESOURCE to
// PARASUT_AUTHORITATIVE_QUERY_RESULT (a query-result CACHE).
//
// Live lookup security (Phase 13.2, critical): a real per-VKN query
// requires the Parasut access token, which must never reach the public,
// anonymous frontend. Today's demo has no authenticated-user backend to
// gate that call behind, so a live query form is intentionally NOT
// built here -- BLOCKED pending a future secure-auth phase (see
// index.ts syncEInvoiceInboxes: status "lookup_required" /
// BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH, never an unfiltered global call).
//
// Phase 13.3 fix: query_vkn (ERP_USER_ENTERED -- who asked for what VKN)
// is no longer read from or exposed by this page at all. It never
// belonged on the Parasut mirror row in the first place (that was the
// Phase 13.2 schema-boundary bug this phase fixes) and the caller-supplied
// VKN now lives only in erp.e_invoice_lookup_requests, which is not
// exposed to anon/public and would need RLS/tenant scoping (out of scope
// until the future secure-auth phase) before any UI could safely show
// "who queried what". This page only ever shows the Parasut-authoritative
// echo (attributes.vkn, name, e_invoice_address, inbox_type) of rows a
// secure backend already queried and stored -- never a global inbox list.
const EFaturaKutulari = () => (
  <EmptyResourceList<EInvoiceLookupResultDemoRow>
    backTo="/satislar/faturalar"
    backLabel="Faturalar"
    title="E-Fatura Mükellef Sorgulama"
    description="VKN'ye göre sorgulanan, güvenli bir arka uç tarafından önceden kaydedilmiş gerçek e-fatura mükellefi sorgu sonuçları (gelen kutusu/mesaj listesi veya şirketin tüm e-fatura kayıtlarının global listesi DEĞİLDİR)."
    functionName="e-documents"
    resource="lookup"
    countColumn="cached_query_result_count"
    countLabel="Önbellekteki sorgu sonucu"
    emptyMeansNoQueryYet
    emptyExplanation="Canlı VKN sorgusu, güvenli kimlik doğrulamalı bir arka uç gerektirir ve bu genel demo üzerinden AÇILMAMIŞTIR (BLOCKED) -- Paraşüt erişim anahtarı hiçbir zaman genel/anonim ön yüze açılmaz. Sorgulanan VKN değeri (kullanıcı girdisi) artık hiçbir zaman bu görünümde yer almaz; yalnızca Paraşüt'ün kendi yanıtı (vkn, ad, e-fatura adresi) gösterilir. Bu ekran yalnızca gelecekte güvenli bir arka ucun gerçekten sorgulayıp kaydettiği sonuçları gösterecektir."
    columns={[
      { header: "Parasut ID", render: (r) => r.parasut_id },
      { header: "Tip", render: (r) => r.parasut_type ?? "—" },
      { header: "VKN (Paraşüt yanıtı)", render: (r) => r.vkn ?? "—" },
      { header: "Ad", render: (r) => r.name ?? "—" },
      { header: "E-Fatura Adresi", render: (r) => r.e_invoice_address ?? "—" },
      { header: "Tür", render: (r) => r.inbox_type ?? "—" },
      { header: "Adres Kayıt Tarihi", render: (r) => formatUtc(r.address_registered_at) },
      { header: "Kayıt Tarihi", render: (r) => formatUtc(r.registered_at) },
      { header: "Oluşturulma (Paraşüt)", render: (r) => formatUtc(r.parasut_created_at) },
      { header: "Güncellenme (Paraşüt)", render: (r) => formatUtc(r.parasut_updated_at) },
    ]}
  />
);

export default EFaturaKutulari;
