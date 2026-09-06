import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface WarehouseDemoRow {
  parasut_id: number;
  name: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  archived: boolean | null;
}

const Depolar = () => {
  const [warehouses, setWarehouses] = useState<WarehouseDemoRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;
    supabase.functions
      .invoke("products", { body: { action: "warehouses.list" } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || data?.error) {
          setLoadError(error?.message ?? data?.error);
          return;
        }
        setWarehouses((data?.data as WarehouseDemoRow[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link to="/urunler" className="text-sm text-electric-bright hover:underline">
          ← Ürünler
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Depolar</h1>
        <p className="mt-1 text-white/60">Paraşüt'ten senkronize edilen gerçek depo kayıtları.</p>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {warehouses === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : warehouses.length === 0 ? (
              <p className="text-white/50">Henüz senkronize edilmiş depo yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Ad</th>
                      <th className="px-4 py-2 font-medium">Adres</th>
                      <th className="px-4 py-2 font-medium">Şehir / İlçe</th>
                      <th className="px-4 py-2 font-medium">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouses.map((w) => (
                      <tr key={w.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">{w.name ?? `#${w.parasut_id}`}</td>
                        <td className="px-4 py-2 text-white/70">{w.address ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{[w.city, w.district].filter(Boolean).join(" / ") || "—"}</td>
                        <td className="px-4 py-2 text-white/70">{w.archived ? "Arşivli" : "Aktif"}</td>
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

export default Depolar;
