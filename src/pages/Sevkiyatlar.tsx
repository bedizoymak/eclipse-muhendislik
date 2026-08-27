import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ShipmentDocumentDemoRow {
  parasut_id: number;
  description: string | null;
  despatch_no: string | null;
  status: string | null;
  inflow: boolean | null;
  issue_date: string | null;
  shipment_date: string | null;
  archived: boolean | null;
  contact_parasut_id: number | null;
  contact_name: string | null;
  carrier_legal_name: string | null;
  carrier_license_plate: string | null;
}

type ArchivedFilter = "active" | "archived" | "all";

const ARCHIVED_FILTERS: { value: ArchivedFilter; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "archived", label: "Arşivli" },
  { value: "all", label: "Tümü" },
];

const Sevkiyatlar = () => {
  const [archivedFilter, setArchivedFilter] = useState<ArchivedFilter>("active");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [docs, setDocs] = useState<ShipmentDocumentDemoRow[] | null>(null);
  const [counts, setCounts] = useState<{ active: number; archived: number; all: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Durable, row-limit-proof counters -- single-row SQL aggregate view
  // (Phase 8.3 pattern), not a full-row fetch counted client-side.
  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("parasut_shipment_document_counts_demo").select("*").maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      const row = data as { active_count: number; archived_count: number; total_count: number } | null;
      if (!row) {
        setLoadError("Sayaç verisi alınamadı.");
        return;
      }
      setCounts({ active: row.active_count, archived: row.archived_count, all: row.total_count });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    (async () => {
      let listQuery = supabase
        .from("parasut_shipment_documents_demo")
        .select(
          "parasut_id, description, despatch_no, status, inflow, issue_date, shipment_date, archived, contact_parasut_id, contact_name, carrier_legal_name, carrier_license_plate",
        );
      if (archivedFilter === "active") listQuery = listQuery.eq("archived", false);
      if (archivedFilter === "archived") listQuery = listQuery.eq("archived", true);
      if (fromDate) listQuery = listQuery.gte("issue_date", fromDate);
      if (toDate) listQuery = listQuery.lte("issue_date", toDate);

      const { data, error } = await listQuery;
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setDocs((data as ShipmentDocumentDemoRow[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [archivedFilter, fromDate, toDate]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link to="/stok/hareketleri" className="text-sm text-electric-bright hover:underline">
          ← Stok hareketleri
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Sevkiyat İrsaliyeleri</h1>
        <p className="mt-1 text-white/60">Paraşüt'ten senkronize edilen gerçek sevkiyat irsaliyeleri.</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-wrap gap-2">
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

          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-white/60">
            <label htmlFor="fromDate" className="shrink-0">
              Tarih:
            </label>
            <input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-navy-deep px-2 py-1 text-white sm:flex-none"
            />
            <span className="shrink-0">–</span>
            <input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-navy-deep px-2 py-1 text-white sm:flex-none"
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
            {docs === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : docs.length === 0 ? (
              <p className="text-white/50">Bu filtrede irsaliye yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">İrsaliye</th>
                      <th className="px-4 py-2 font-medium">Müşteri</th>
                      <th className="px-4 py-2 font-medium">Düzenleme</th>
                      <th className="px-4 py-2 font-medium">Sevkiyat</th>
                      <th className="px-4 py-2 font-medium">Yön</th>
                      <th className="px-4 py-2 font-medium">Durum</th>
                      <th className="px-4 py-2 font-medium">Taşıyıcı</th>
                      <th className="px-4 py-2 font-medium">Plaka</th>
                      <th className="px-4 py-2 font-medium">Arşiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          <Link to={`/stok/sevkiyat-irsaliyeleri/${d.parasut_id}`} className="hover:text-electric-bright hover:underline">
                            {d.despatch_no ?? d.description ?? `#${d.parasut_id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {d.contact_parasut_id ? (
                            <Link to={`/musteriler/${d.contact_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {d.contact_name ?? `#${d.contact_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">{d.issue_date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{d.shipment_date ? d.shipment_date.slice(0, 10) : "—"}</td>
                        <td className="px-4 py-2 text-white/70">{d.inflow ? "Giriş" : "Çıkış"}</td>
                        <td className="px-4 py-2 text-white/70">{d.status ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{d.carrier_legal_name ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{d.carrier_license_plate ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{d.archived ? "Arşivli" : "Aktif"}</td>
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

export default Sevkiyatlar;
