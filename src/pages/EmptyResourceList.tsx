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
  /** Edge Function name (e.g. "payroll", "products", "tags-and-settings"). */
  functionName: string;
  /** Resource key within that function -- calls `${resource}.list` /
   * `${resource}.counts`, matching the Phase 15 domain function actions. */
  resource: string;
  columns: EmptyResourceColumn<Row>[];
  emptyExplanation: string;
  /**
   * Phase 13.1: base path for a real per-row detail route (e.g.
   * "/giderler/maaslar"), only set for resources with a genuine Swagger
   * single-GET endpoint (salaries/taxes/tags). Omit entirely for resources
   * without one (e.g. e_invoice_inboxes -- DETAIL_ENDPOINT_BLOCKED) so no
   * row ever links to a route that doesn't exist.
   */
  detailBase?: string;
  /**
   * Phase 13.2: the count view's column name. Defaults to "total_count"
   * (a real global-resource aggregate). Resources whose count is a
   * query-result cache, not a global total (e_invoice_inboxes), must pass
   * their real column name here (e.g. "cached_query_result_count") so the
   * UI never presents a lookup-cache size as if it were a company total.
   */
  countColumn?: string;
  /** Phase 13.2: label shown before the count (default "Toplam kayıt"). */
  countLabel?: string;
  /**
   * Phase 13.2: when true, this resource has no "0 records exist in the
   * account" semantics at all (e.g. a lookup service where nothing has
   * ever been queried) -- the empty state must say so, never imply a
   * global collection is empty.
   */
  emptyMeansNoQueryYet?: boolean;
}

function EmptyResourceList<Row extends { parasut_id: number }>({
  backTo,
  backLabel,
  title,
  description,
  functionName,
  resource,
  columns,
  emptyExplanation,
  detailBase,
  countColumn = "total_count",
  countLabel = "Toplam kayıt",
  emptyMeansNoQueryYet = false,
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
      supabase.functions.invoke(functionName, { body: { action: `${resource}.list`, pageSize: 1000 } }),
      supabase.functions.invoke(functionName, { body: { action: `${resource}.counts` } }),
    ]).then(([listResult, countResult]) => {
      if (cancelled) return;
      if (listResult.error || listResult.data?.error) {
        setLoadError(listResult.error?.message ?? listResult.data?.error);
        return;
      }
      if (countResult.error || countResult.data?.error) {
        setLoadError(countResult.error?.message ?? countResult.data?.error);
        return;
      }
      setRows((listResult.data?.data as unknown as Row[] | null) ?? []);
      setTotalCount((countResult.data?.data as Record<string, number> | null)?.[countColumn] ?? 0);
    });

    return () => {
      cancelled = true;
    };
  }, [functionName, resource, countColumn]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link to={backTo} className="text-sm text-electric-bright hover:underline">
          ← {backLabel}
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-1 text-white/60">{description}</p>
        <p className="mt-2 text-sm text-white/40">
          {countLabel}: <span className="font-medium text-white/70">{totalCount === null ? "…" : totalCount}</span>
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
                <p className="font-medium text-white/80">
                  {emptyMeansNoQueryYet ? "Henüz VKN sorgusu yapılmadı." : "Henüz kayıt bulunmuyor."}
                </p>
                <p className="mt-2">{emptyExplanation}</p>
                <p className="mt-2 text-white/40">
                  {emptyMeansNoQueryYet
                    ? "Bu kaynak bir sorgu sonucu önbelleğidir — güvenli, yetkili bir arka uç tarafından gerçekten sorgulanan VKN'ler burada listelenecek."
                    : "Bu kaynak için senkronizasyon altyapısı hazır — Paraşüt hesabında gerçek bir kayıt oluştuğunda otomatik olarak burada listelenecek."}
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
                        {columns.map((col, idx) => (
                          <td key={col.header} className="px-4 py-2 text-white/70">
                            {idx === 0 && detailBase ? (
                              <Link to={`${detailBase}/${row.parasut_id}`} className="hover:text-electric-bright hover:underline">
                                {col.render(row)}
                              </Link>
                            ) : (
                              col.render(row)
                            )}
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
