import EmptyResourceList from "./EmptyResourceList";

interface SalaryDemoRow {
  parasut_id: number;
  description: string | null;
  currency: string | null;
  issue_date: string | null;
  due_date: string | null;
  net_total: number | null;
  remaining: number | null;
  archived: boolean | null;
}

const Maaslar = () => (
  <EmptyResourceList<SalaryDemoRow>
    backTo="/giderler/calisanlar"
    backLabel="Çalışanlar"
    title="Maaşlar"
    description="Paraşüt'ten senkronize edilen gerçek maaş kayıtları."
    functionName="payroll"
    resource="salaries"
    emptyExplanation="Paraşüt hesabında bu kaynak için mevcut kayıt yok (GET /salaries gerçek olarak boş liste döndürüyor)."
    detailBase="/giderler/maaslar"
    columns={[
      { header: "Açıklama", render: (r) => r.description ?? "—" },
      { header: "Tarih", render: (r) => r.issue_date ?? "—" },
      { header: "Vade", render: (r) => r.due_date ?? "—" },
      { header: "Net Tutar", render: (r) => (r.net_total != null ? `${r.net_total} ${r.currency ?? ""}` : "—") },
      { header: "Kalan", render: (r) => (r.remaining != null ? String(r.remaining) : "—") },
      { header: "Durum", render: (r) => (r.archived ? "Arşivli" : "Aktif") },
    ]}
  />
);

export default Maaslar;
