import EmptyResourceDetail from "./EmptyResourceDetail";

interface SalaryDemoRow {
  parasut_id: number;
  description: string | null;
  currency: string | null;
  issue_date: string | null;
  due_date: string | null;
  exchange_rate: number | null;
  net_total: number | null;
  total_paid: number | null;
  remaining: number | null;
  archived: boolean | null;
}

const MaasDetay = () => (
  <EmptyResourceDetail<SalaryDemoRow>
    backTo="/giderler/maaslar"
    backLabel="Maaşlar"
    title="Maaş"
    view="parasut_salaries_demo"
    selectColumns="parasut_id, description, currency, issue_date, due_date, exchange_rate, net_total, total_paid, remaining, archived"
    fields={[
      { label: "Açıklama", render: (r) => r.description ?? "—" },
      { label: "Para birimi", render: (r) => r.currency ?? "—" },
      { label: "Düzenleme tarihi", render: (r) => r.issue_date ?? "—" },
      { label: "Vade", render: (r) => r.due_date ?? "—" },
      { label: "Kur", render: (r) => (r.exchange_rate != null ? String(r.exchange_rate) : "—") },
      { label: "Net Tutar", render: (r) => (r.net_total != null ? String(r.net_total) : "—") },
      { label: "Ödenen", render: (r) => (r.total_paid != null ? String(r.total_paid) : "—") },
      { label: "Kalan", render: (r) => (r.remaining != null ? String(r.remaining) : "—") },
      { label: "Durum", render: (r) => (r.archived ? "Arşivli" : "Aktif") },
    ]}
  />
);

export default MaasDetay;
