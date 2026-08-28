import EmptyResourceDetail from "./EmptyResourceDetail";

interface TaxDemoRow {
  parasut_id: number;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  net_total: number | null;
  total_paid: number | null;
  remaining: number | null;
  archived: boolean | null;
}

const VergiDetay = () => (
  <EmptyResourceDetail<TaxDemoRow>
    backTo="/giderler/vergiler"
    backLabel="Vergiler"
    title="Vergi"
    view="parasut_taxes_demo"
    selectColumns="parasut_id, description, issue_date, due_date, net_total, total_paid, remaining, archived"
    fields={[
      { label: "Açıklama", render: (r) => r.description ?? "—" },
      { label: "Düzenleme tarihi", render: (r) => r.issue_date ?? "—" },
      { label: "Vade", render: (r) => r.due_date ?? "—" },
      { label: "Net Tutar", render: (r) => (r.net_total != null ? String(r.net_total) : "—") },
      { label: "Ödenen", render: (r) => (r.total_paid != null ? String(r.total_paid) : "—") },
      { label: "Kalan", render: (r) => (r.remaining != null ? String(r.remaining) : "—") },
      { label: "Durum", render: (r) => (r.archived ? "Arşivli" : "Aktif") },
    ]}
  />
);

export default VergiDetay;
