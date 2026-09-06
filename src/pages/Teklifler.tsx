import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface OfferDemoRow {
  parasut_id: number;
  description: string | null;
  status: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  net_total: number | null;
  gross_total: number | null;
  total_vat: number | null;
  archived: boolean | null;
  contact_parasut_id: number | null;
  contact_name: string | null;
}

type ArchivedFilter = "active" | "archived" | "all";

const ARCHIVED_FILTERS: { value: ArchivedFilter; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "archived", label: "Arşivli" },
  { value: "all", label: "Tümü" },
];

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

const Teklifler = () => {
  const [archivedFilter, setArchivedFilter] = useState<ArchivedFilter>("active");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [offers, setOffers] = useState<OfferDemoRow[] | null>(null);
  const [counts, setCounts] = useState<{ active: number; archived: number; all: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    (async () => {
      const listBody: Record<string, unknown> = { action: "offers.list", pageSize: 1000 };
      if (archivedFilter === "active") listBody.archived = false;
      if (archivedFilter === "archived") listBody.archived = true;
      if (fromDate) listBody.dateFrom = fromDate;
      if (toDate) listBody.dateTo = toDate;

      const [listRes, countsRes] = await Promise.all([
        supabase.functions.invoke("sales", { body: listBody }),
        supabase.functions.invoke("sales", { body: { action: "offers.counts" } }),
      ]);

      if (cancelled) return;

      const firstError = listRes.error?.message ?? listRes.data?.error ?? countsRes.error?.message ?? countsRes.data?.error;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      setOffers((listRes.data?.data as OfferDemoRow[] | null) ?? []);
      setCounts(countsRes.data?.data ?? { active: 0, archived: 0, all: 0 });
    })();

    return () => {
      cancelled = true;
    };
  }, [archivedFilter, fromDate, toDate]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="text-sm text-electric-bright hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Satış Teklifleri</h1>
        <p className="mt-1 text-white/60">Paraşüt'ten senkronize edilen gerçek satış teklifleri.</p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {ARCHIVED_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setArchivedFilter(f.value)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  archivedFilter === f.value
                    ? "border-electric-bright bg-electric-bright/10 text-electric-bright"
                    : "border-white/15 text-white/60 hover:text-white"
                }`}
              >
                {f.label} {counts ? `(${counts[f.value === "all" ? "all" : f.value]})` : ""}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-white/60">
            <label htmlFor="fromDate">Tarih:</label>
            <input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-white/15 bg-navy-deep px-2 py-1 text-white"
            />
            <span>–</span>
            <input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-white/15 bg-navy-deep px-2 py-1 text-white"
            />
          </div>
        </div>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {offers === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : offers.length === 0 ? (
              <p className="text-white/50">Bu filtrede teklif yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Teklif</th>
                      <th className="px-4 py-2 font-medium">Müşteri</th>
                      <th className="px-4 py-2 font-medium">Düzenleme</th>
                      <th className="px-4 py-2 font-medium">Geçerlilik</th>
                      <th className="px-4 py-2 font-medium">Net</th>
                      <th className="px-4 py-2 font-medium">Brüt</th>
                      <th className="px-4 py-2 font-medium">KDV</th>
                      <th className="px-4 py-2 font-medium">Durum</th>
                      <th className="px-4 py-2 font-medium">Arşiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o) => (
                      <tr key={o.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          <Link to={`/satislar/teklifler/${o.parasut_id}`} className="hover:text-electric-bright hover:underline">
                            {o.description?.trim() || `#${o.parasut_id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {o.contact_parasut_id ? (
                            <Link to={`/musteriler/${o.contact_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {o.contact_name ?? `#${o.contact_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">{o.issue_date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{o.due_date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(o.net_total, o.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(o.gross_total, o.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(o.total_vat, o.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{o.status ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{o.archived ? "Arşivli" : "Aktif"}</td>
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
};

export default Teklifler;
