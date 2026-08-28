import EmptyResourceList from "./EmptyResourceList";

interface EInvoiceInboxDemoRow {
  parasut_id: number;
  vkn: string | null;
  name: string | null;
  e_invoice_address: string | null;
  inbox_type: string | null;
}

// Phase 13.1: renamed from "E-Fatura Kutuları" (E-Invoice Inboxes/message
// inbox implication) to "E-Fatura Mükellef Sorgulama" (E-Invoice Taxpayer
// Lookup) -- verified against the real Paraşüt Swagger spec
// (https://apidocs.parasut.com/swagger.json): GET /e_invoice_inboxes takes
// only `filter[vkn]` as a real query param (no other filters, no sort), has
// NO single-GET /{id} endpoint, and the API docs' own prose describes this
// resource as checking "müşterinin e-Fatura gelen kutusu olup olmadığı"
// (whether a customer has an e-invoice inbox) -- i.e. a VKN-keyed directory
// of taxpayers registered for e-invoicing, not a list of received documents
// or messages. No detail route exists here (DETAIL_ENDPOINT_BLOCKED --
// see Phase 13.1 report).
const EFaturaKutulari = () => (
  <EmptyResourceList<EInvoiceInboxDemoRow>
    backTo="/satislar/faturalar"
    backLabel="Faturalar"
    title="E-Fatura Mükellef Sorgulama"
    description="Paraşüt'ten senkronize edilen, VKN'ye göre sorgulanan gerçek e-fatura mükellefi kayıtları (gelen kutusu/mesaj listesi değildir)."
    listView="parasut_e_invoice_inboxes_demo"
    countView="parasut_e_invoice_inbox_counts_demo"
    selectColumns="parasut_id, vkn, name, e_invoice_address, inbox_type"
    emptyExplanation="Paraşüt hesabında bu kaynak için mevcut kayıt yok (GET /e_invoice_inboxes gerçek olarak boş liste döndürüyor)."
    columns={[
      { header: "VKN", render: (r) => r.vkn ?? "—" },
      { header: "Ad", render: (r) => r.name ?? "—" },
      { header: "E-Fatura Adresi", render: (r) => r.e_invoice_address ?? "—" },
      { header: "Tür", render: (r) => r.inbox_type ?? "—" },
    ]}
  />
);

export default EFaturaKutulari;
