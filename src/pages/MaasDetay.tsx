import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import EmptyResourceDetail from "./EmptyResourceDetail";
import { supabase } from "@/integrations/supabase/client";

interface SalaryDemoRow {
  parasut_id: number;
  parasut_type: string | null;
  description: string | null;
  currency: string | null;
  issue_date: string | null;
  due_date: string | null;
  exchange_rate: number | null;
  net_total: number | null;
  total_paid: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  archived: boolean | null;
  employee_parasut_id: number | null;
  employee_parasut_type: string | null;
  category_parasut_id: number | null;
  category_parasut_type: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
}

// Phase 13.2 section 5: full real-field UI access for salaries -- adds
// parasut_type, remaining_in_trl, employee/category id+type,
// created_at/updated_at (shown verbatim in UTC, never hidden as
// "technical"), and the real tags junction (parasut.salary_tags via
// public.parasut_salary_tags_demo) rendered separately below the base
// field list since it is a to-many relationship. All 0 today (0 real
// salaries) -- this is the ready UI/type/view chain, not a fake row.
const MaasDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [tags, setTags] = useState<{ tag_parasut_id: number; tag_type: string; tag_name: string | null }[]>([]);

  useEffect(() => {
    if (!supabase || !parasutId) return;
    let cancelled = false;
    supabase
      .from("parasut_salary_tags_demo")
      .select("tag_parasut_id, tag_type, tag_name")
      .eq("salary_parasut_id", parasutId)
      .then(({ data }) => {
        if (!cancelled) setTags(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  return (
    <>
      <EmptyResourceDetail<SalaryDemoRow>
        backTo="/giderler/maaslar"
        backLabel="Maaşlar"
        title="Maaş"
        view="parasut_salaries_demo"
        selectColumns="parasut_id, parasut_type, description, currency, issue_date, due_date, exchange_rate, net_total, total_paid, remaining, remaining_in_trl, archived, employee_parasut_id, employee_parasut_type, category_parasut_id, category_parasut_type, parasut_created_at, parasut_updated_at"
        fields={[
          { label: "Kaynak tipi (parasut_type)", render: (r) => r.parasut_type ?? "—" },
          { label: "Açıklama", render: (r) => r.description ?? "—" },
          { label: "Para birimi", render: (r) => r.currency ?? "—" },
          { label: "Düzenleme tarihi", render: (r) => r.issue_date ?? "—" },
          { label: "Vade", render: (r) => r.due_date ?? "—" },
          { label: "Kur", render: (r) => (r.exchange_rate != null ? String(r.exchange_rate) : "—") },
          { label: "Net Tutar", render: (r) => (r.net_total != null ? String(r.net_total) : "—") },
          { label: "Ödenen", render: (r) => (r.total_paid != null ? String(r.total_paid) : "—") },
          { label: "Kalan", render: (r) => (r.remaining != null ? String(r.remaining) : "—") },
          { label: "Kalan (TRL)", render: (r) => (r.remaining_in_trl != null ? String(r.remaining_in_trl) : "—") },
          { label: "Durum", render: (r) => (r.archived ? "Arşivli" : "Aktif") },
          {
            label: "Çalışan (employee id/type)",
            render: (r) => (r.employee_parasut_id != null ? `${r.employee_parasut_id} / ${r.employee_parasut_type ?? "—"}` : "—"),
          },
          {
            label: "Kategori (category id/type)",
            render: (r) => (r.category_parasut_id != null ? `${r.category_parasut_id} / ${r.category_parasut_type ?? "—"}` : "—"),
          },
          { label: "Oluşturulma (UTC)", render: (r) => r.parasut_created_at ?? "—" },
          { label: "Güncellenme (UTC)", render: (r) => r.parasut_updated_at ?? "—" },
        ]}
      />
      <div className="mx-auto max-w-2xl px-6 pb-10 text-white">
        <h2 className="mt-2 text-sm font-medium text-white/60">Etiketler (tags ilişkisi)</h2>
        {tags.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">
            Bu maaş kaydı için bağlı etiket yok (parasut.salary_tags junction tablosu -- gerçek ilişki, bugün 0 satır).
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {tags.map((t) => (
              <li key={`${t.tag_parasut_id}-${t.tag_type}`}>
                {t.tag_name ?? "—"} (id {t.tag_parasut_id} / {t.tag_type})
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default MaasDetay;
