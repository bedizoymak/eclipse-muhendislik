import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Phase 13: shared list-page shell for resources that have a real, working
// Parasut list endpoint but 0 real records in this account today
// (item_categories/salaries/taxes/tags/e_invoice_inboxes-style modules).
// The real aggregate count always comes from a durable count view (never
// `.length`, never a hardcoded literal), and the empty state explicitly
// explains "no records in this account" -- never "not supported by the
// API" (the endpoint works; there just isn't data yet).

export interface EmptyResourceColumn<Row> {
  header: string;
  render: (row: Row) => React.ReactNode;
}

interface EmptyResourceListProps<Row extends { parasut_id: number }> {
  backTo: string;
  backLabel: string;
  title: string;
  description: string;
  listView: string;
  countView: string;
  selectColumns: string;
  columns: EmptyResourceColumn<Row>[];
  emptyExplanation: string;
}

function EmptyResourceList<Row extends { parasut_id: number }>({
  backTo,
  backLabel,
  title,
  description,
  listView,
  countView,
  selectColumns,
  columns,
  emptyExplanation,
}: EmptyResourceListProps<Row>) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    Promise.all([
      supabase.from(listView).select(selectColumns).limit(1000),
      supabase.from(countView).select("total_count").single(),
    ]).then(([listResult, countResult]) => {
      if (cancelled) return;
      if (listResult.error) {
        setLoadError(listResult.error.message);
        return;
      }
      if (countResult.error) {
        setLoadError(countResult.error.message);
        return;
      }
      setRows((listResult.data as Row[] | null) ?? []);
      setTotalCount((countResult.data as { total_count: number } | null)?.total_count ?? 0);
    });

    return () => {
      cancelled = true;
    };
  }, [listView, countView, selectColumns]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link to={backTo} className="text-sm text-electric-bright hover:underline">
          ← {backLabel}
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-1 text-white/60">{description}</p>
        <p className="mt-2 text-sm text-white/40">
          Toplam kayıt: <span className="font-medium text-white/70">{totalCount === null ? "…" : totalCount}</span>
        </p>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {rows === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                <p className="font-medium text-white/80">Henüz kayıt bulunmuyor.</p>
                <p className="mt-2">{emptyExplanation}</p>
                <p className="mt-2 text-white/40">
                  Bu kaynak için senkronizasyon altyapısı hazır — Paraşüt hesabında gerçek bir kayıt oluştuğunda
                  otomatik olarak burada listelenecek.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      {columns.map((col) => (
                        <th key={col.header} className="px-4 py-2 font-medium">
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.parasut_id} className="border-t border-white/5">
                        {columns.map((col) => (
                          <td key={col.header} className="px-4 py-2 text-white/70">
                            {col.render(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EmptyResourceList;
