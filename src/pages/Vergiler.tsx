import EmptyResourceList from "./EmptyResourceList";

interface TaxDemoRow {
  parasut_id: number;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  net_total: number | null;
  remaining: number | null;
  archived: boolean | null;
}

const Vergiler = () => (
  <EmptyResourceList<TaxDemoRow>
    backTo="/giderler"
    backLabel="Giderler"
    title="Vergiler"
    description="Paraşüt'ten senkronize edilen gerçek vergi kayıtları."
    functionName="payroll"
    resource="taxes"
    emptyExplanation="Paraşüt hesabında bu kaynak için mevcut kayıt yok (GET /taxes gerçek olarak boş liste döndürüyor)."
    detailBase="/giderler/vergiler"
    columns={[
      { header: "Açıklama", render: (r) => r.description ?? "—" },
      { header: "Tarih", render: (r) => r.issue_date ?? "—" },
      { header: "Vade", render: (r) => r.due_date ?? "—" },
      { header: "Net Tutar", render: (r) => (r.net_total != null ? String(r.net_total) : "—") },
      { header: "Kalan", render: (r) => (r.remaining != null ? String(r.remaining) : "—") },
      { header: "Durum", render: (r) => (r.archived ? "Arşivli" : "Aktif") },
    ]}
  />
);

export default Vergiler;
