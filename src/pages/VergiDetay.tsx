import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
// Phase 13.4 section 4: adds category name+link (when a real linked
// category record exists). activities is NOT built here -- the real
// swagger.json documents no Tax.relationships.activities key and no
// /taxes/{id}/activities path (see report section 3); it was a
// fabricated manifest row in Phase 13.3, corrected in Phase 13.4.
// Phase 13.5: the "payments" section is also removed. Re-verified live:
// `/taxes/{id}/payments` documents ONLY a POST method (payment-creation
// write action), and `definitions.Tax.properties.relationships.properties`
// never had a `payments` key -- only `category`, `tags`. No real GET
// relationship ever existed to show here; the correct fix is no section
// at all, not an empty-state message (which would still wrongly imply a
// checkable relationship). See supabase/functions/parasut-sync/index.ts
// TAX_WRITE_CAPABILITIES for how this POST action is tracked instead.
const VergiDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [tags, setTags] = useState<{ tag_parasut_id: number; tag_type: string; tag_name: string | null }[]>([]);
  const [row, setRow] = useState<TaxDemoRow | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);

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

  useEffect(() => {
    if (!supabase || !row || row.category_parasut_id == null) return;
    let cancelled = false;
    supabase
      .from("parasut_item_categories_demo")
      .select("name")
      .eq("parasut_id", row.category_parasut_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCategoryName((data as { name: string | null } | null)?.name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [row]);

  return (
    <>
      <EmptyResourceDetail<TaxDemoRow>
        backTo="/giderler/vergiler"
        backLabel="Vergiler"
        title="Vergi"
        view="parasut_taxes_demo"
        selectColumns="parasut_id, parasut_type, description, issue_date, due_date, net_total, total_paid, remaining, remaining_in_trl, archived, category_parasut_id, category_parasut_type, parasut_created_at, parasut_updated_at"
        onRowLoaded={setRow}
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
