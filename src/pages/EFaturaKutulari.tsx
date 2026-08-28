import EmptyResourceList from "./EmptyResourceList";

interface EInvoiceInboxDemoRow {
  parasut_id: number;
  vkn: string | null;
  name: string | null;
  e_invoice_address: string | null;
  inbox_type: string | null;
}

const EFaturaKutulari = () => (
  <EmptyResourceList<EInvoiceInboxDemoRow>
    backTo="/satislar/faturalar"
    backLabel="Faturalar"
    title="E-Fatura Kutuları"
    description="Paraşüt'ten senkronize edilen gerçek e-fatura mükellef kutusu kayıtları."
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
