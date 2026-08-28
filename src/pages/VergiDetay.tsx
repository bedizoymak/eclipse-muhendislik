import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import EmptyResourceDetail from "./EmptyResourceDetail";
import { supabase } from "@/integrations/supabase/client";

interface TaxDemoRow {
  parasut_id: number;
  parasut_type: string | null;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  net_total: number | null;
  total_paid: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  archived: boolean | null;
  category_parasut_id: number | null;
  category_parasut_type: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
}

// Phase 13.2 section 5: full real-field UI access for taxes -- same
// pattern as MaasDetay.tsx (parasut_type, remaining_in_trl, category
// id+type, created_at/updated_at in UTC, real tags junction).
const VergiDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [tags, setTags] = useState<{ tag_parasut_id: number; tag_type: string; tag_name: string | null }[]>([]);

  useEffect(() => {
    if (!supabase || !parasutId) return;
    let cancelled = false;
    supabase
      .from("parasut_tax_tags_demo")
      .select("tag_parasut_id, tag_type, tag_name")
      .eq("tax_parasut_id", parasutId)
      .then(({ data }) => {
        if (!cancelled) setTags(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  return (
    <>
      <EmptyResourceDetail<TaxDemoRow>
        backTo="/giderler/vergiler"
        backLabel="Vergiler"
        title="Vergi"
        view="parasut_taxes_demo"
        selectColumns="parasut_id, parasut_type, description, issue_date, due_date, net_total, total_paid, remaining, remaining_in_trl, archived, category_parasut_id, category_parasut_type, parasut_created_at, parasut_updated_at"
        fields={[
          { label: "Kaynak tipi (parasut_type)", render: (r) => r.parasut_type ?? "—" },
          { label: "Açıklama", render: (r) => r.description ?? "—" },
          { label: "Düzenleme tarihi", render: (r) => r.issue_date ?? "—" },
          { label: "Vade", render: (r) => r.due_date ?? "—" },
          { label: "Net Tutar", render: (r) => (r.net_total != null ? String(r.net_total) : "—") },
          { label: "Ödenen", render: (r) => (r.total_paid != null ? String(r.total_paid) : "—") },
          { label: "Kalan", render: (r) => (r.remaining != null ? String(r.remaining) : "—") },
          { label: "Kalan (TRL)", render: (r) => (r.remaining_in_trl != null ? String(r.remaining_in_trl) : "—") },
          { label: "Durum", render: (r) => (r.archived ? "Arşivli" : "Aktif") },
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
            Bu vergi kaydı için bağlı etiket yok (parasut.tax_tags junction tablosu -- gerçek ilişki, bugün 0 satır).
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

export default VergiDetay;
