import EmptyResourceList from "./EmptyResourceList";

interface EInvoiceLookupResultDemoRow {
  parasut_id: number;
  parasut_type: string | null;
  query_vkn: string | null;
  vkn: string | null;
  name: string | null;
  e_invoice_address: string | null;
  inbox_type: string | null;
}

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
// built here -- BLOCKED pending a future secure-auth phase. This page
// only ever displays rows a secure backend already queried and stored
// (query_vkn/queried_at populated by that future backend, not by this
// demo's own bulk sync, which calls this endpoint unfiltered purely to
// keep schema/unknown-key detection plumbing warm -- see
// supabase/functions/parasut-sync/index.ts syncEInvoiceInboxes comment).
const EFaturaKutulari = () => (
  <EmptyResourceList<EInvoiceLookupResultDemoRow>
    backTo="/satislar/faturalar"
    backLabel="Faturalar"
    title="E-Fatura Mükellef Sorgulama"
    description="VKN'ye göre sorgulanan, güvenli bir arka uç tarafından önceden kaydedilmiş gerçek e-fatura mükellefi sorgu sonuçları (gelen kutusu/mesaj listesi veya şirketin tüm e-fatura kayıtlarının global listesi DEĞİLDİR)."
    listView="parasut_e_invoice_lookup_results_demo"
    countView="parasut_e_invoice_lookup_result_counts_demo"
    countColumn="cached_query_result_count"
    countLabel="Önbellekteki sorgu sonucu"
    selectColumns="parasut_id, parasut_type, query_vkn, vkn, name, e_invoice_address, inbox_type"
    emptyMeansNoQueryYet
    emptyExplanation="Canlı VKN sorgusu, güvenli kimlik doğrulamalı bir arka uç gerektirir ve bu genel demo üzerinden AÇILMAMIŞTIR (BLOCKED) -- Paraşüt erişim anahtarı hiçbir zaman genel/anonim ön yüze açılmaz. Bu ekran yalnızca gelecekte güvenli bir arka ucun gerçekten sorgulayıp kaydettiği sonuçları gösterecektir."
    columns={[
      { header: "Sorgulanan VKN", render: (r) => r.query_vkn ?? "—" },
      { header: "VKN (Paraşüt yanıtı)", render: (r) => r.vkn ?? "—" },
      { header: "Ad", render: (r) => r.name ?? "—" },
      { header: "E-Fatura Adresi", render: (r) => r.e_invoice_address ?? "—" },
      { header: "Tür", render: (r) => r.inbox_type ?? "—" },
    ]}
  />
);

export default EFaturaKutulari;
