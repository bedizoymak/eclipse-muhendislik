import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
interface SalaryPaymentRow {
  payment_parasut_id: number;
  payment_type: string | null;
  payment_amount: number | null;
  payment_currency: string | null;
  payment_date: string | null;
}

const MaasDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [tags, setTags] = useState<{ tag_parasut_id: number; tag_type: string; tag_name: string | null }[]>([]);
  const [row, setRow] = useState<SalaryDemoRow | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [payments, setPayments] = useState<SalaryPaymentRow[]>([]);

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
    // Phase 13.4 section 4: real payments id/type -- only real fields
    // shown, no fabricated amount/date if a row lacks a joined
    // parasut.payments record (left join in the underlying view -> null).
    supabase
      .from("parasut_salary_payments_demo")
      .select("payment_parasut_id, payment_type, payment_amount, payment_currency, payment_date")
      .eq("salary_parasut_id", parasutId)
      .then(({ data }) => {
        if (!cancelled) setPayments((data as SalaryPaymentRow[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  // Phase 13.4 section 4: resolve employee/category names once the base
  // row (with employee_parasut_id/category_parasut_id) has loaded, and
  // only if a real linked record exists in this account today (0 rows ->
  // no name, no fake link -- the id/type still render from `row` above).
  useEffect(() => {
    if (!supabase || !row) return;
    let cancelled = false;
    if (row.employee_parasut_id != null) {
      supabase
        .from("parasut_employees_demo")
        .select("name")
        .eq("parasut_id", row.employee_parasut_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setEmployeeName((data as { name: string | null } | null)?.name ?? null);
        });
    }
    if (row.category_parasut_id != null) {
      supabase
        .from("parasut_item_categories_demo")
        .select("name")
        .eq("parasut_id", row.category_parasut_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setCategoryName((data as { name: string | null } | null)?.name ?? null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [row]);

  return (
    <>
      <EmptyResourceDetail<SalaryDemoRow>
        backTo="/giderler/maaslar"
        backLabel="Maaşlar"
        title="Maaş"
        view="parasut_salaries_demo"
        selectColumns="parasut_id, parasut_type, description, currency, issue_date, due_date, exchange_rate, net_total, total_paid, remaining, remaining_in_trl, archived, employee_parasut_id, employee_parasut_type, category_parasut_id, category_parasut_type, parasut_created_at, parasut_updated_at"
        onRowLoaded={setRow}
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
            render: (r) =>
              r.employee_parasut_id != null ? (
                employeeName ? (
                  <Link to={`/giderler/calisanlar/${r.employee_parasut_id}`} className="text-electric-bright hover:underline">
                    {employeeName} ({r.employee_parasut_id} / {r.employee_parasut_type ?? "—"})
                  </Link>
                ) : (
                  `${r.employee_parasut_id} / ${r.employee_parasut_type ?? "—"}`
                )
              ) : (
                "—"
              ),
          },
          {
            label: "Kategori (category id/type)",
            render: (r) =>
              r.category_parasut_id != null ? (
                categoryName ? (
                  <Link to={`/stok/kategoriler/${r.category_parasut_id}`} className="text-electric-bright hover:underline">
                    {categoryName} ({r.category_parasut_id} / {r.category_parasut_type ?? "—"})
                  </Link>
                ) : (
                  `${r.category_parasut_id} / ${r.category_parasut_type ?? "—"}`
                )
              ) : (
                "—"
              ),
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

        <h2 className="mt-6 text-sm font-medium text-white/60">Ödemeler (payments ilişkisi)</h2>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">
            Bu maaş kaydı için bağlı ödeme yok (parasut.salary_payments junction tablosu -- gerçek ilişki, bugün 0 satır).
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {payments.map((p) => (
              <li key={`${p.payment_parasut_id}-${p.payment_type}`}>
                {p.payment_parasut_id} / {p.payment_type ?? "—"} —{" "}
                {p.payment_amount != null ? `${p.payment_amount} ${p.payment_currency ?? ""}`.trim() : "—"} —{" "}
                {p.payment_date ?? "—"}
              </li>
            ))}
          </ul>
        )}

        {/* Phase 13.4 section 4: activities is SCHEMA_BLOCKED for Salary
            (real swagger.json documents no `activities` relationship key
            and no /salaries/{id}/activities path -- see the Phase 13.4
            report section 3). No UI section is built for it -- building
            one would fabricate a relationship the API does not have. */}
      </div>
    </>
  );
};

export default MaasDetay;
