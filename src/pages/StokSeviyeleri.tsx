import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface InventoryLevelDemoRow {
  parasut_id: number;
  product_parasut_id: number | null;
  product_name: string | null;
  product_code: string | null;
  warehouse_parasut_id: number | null;
  warehouse_name: string | null;
  stock_count: number | null;
  initial_stock_count: number | null;
  critical_stock_count: number | null;
}

const StokSeviyeleri = () => {
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [levels, setLevels] = useState<InventoryLevelDemoRow[] | null>(null);
  const [warehouses, setWarehouses] = useState<{ parasut_id: number; name: string | null }[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.functions
      .invoke("products", { body: { action: "warehouses.options" } })
      .then(({ data }) => setWarehouses((data?.data as { parasut_id: number; name: string | null }[] | null) ?? []));
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    (async () => {
      const body: Record<string, unknown> = { action: "levels.list", pageSize: 200 };
      if (warehouseFilter) body.warehouse_id = warehouseFilter;

      const { data, error } = await supabase.functions.invoke("inventory", { body });

      if (cancelled) return;

      if (error || data?.error) {
        setLoadError(error?.message ?? data?.error);
        return;
      }

      setLevels((data?.data as InventoryLevelDemoRow[] | null) ?? []);
      setTotalCount(data?.count ?? 0);
    })();

    return () => {
      cancelled = true;
    };
  }, [warehouseFilter]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link to="/urunler" className="text-sm text-electric-bright hover:underline">
          ← Ürünler
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Stok Seviyeleri</h1>
        <p className="mt-1 text-white/60">
          Paraşüt'ten senkronize edilen gerçek depo bazlı stok seviyeleri. Toplam: {totalCount ?? "—"} (ilk 200 gösterilir)
        </p>

        <div className="mt-6">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="w-full max-w-full truncate rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white sm:w-auto sm:max-w-[220px]"
          >
            <option value="">Tüm depolar</option>
            {warehouses.map((w) => (
              <option key={w.parasut_id} value={w.parasut_id}>
                {w.name ?? `#${w.parasut_id}`}
              </option>
            ))}
          </select>
        </div>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {levels === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : levels.length === 0 ? (
              <p className="text-white/50">Bu filtrede stok seviyesi yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Ürün</th>
                      <th className="px-4 py-2 font-medium">Depo</th>
                      <th className="px-4 py-2 font-medium">Stok miktarı</th>
                      <th className="px-4 py-2 font-medium">Başlangıç</th>
                      <th className="px-4 py-2 font-medium">Kritik seviye</th>
                    </tr>
                  </thead>
                  <tbody>
                    {levels.map((l) => (
                      <tr key={l.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          {l.product_parasut_id ? (
                            <Link to={`/urunler/${l.product_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {l.product_code ? `${l.product_code} — ` : ""}
                              {l.product_name ?? `#${l.product_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">{l.warehouse_name ?? (l.warehouse_parasut_id ? `#${l.warehouse_parasut_id}` : "—")}</td>
                        <td className="px-4 py-2 text-white/70">{l.stock_count ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{l.initial_stock_count ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{l.critical_stock_count ?? "—"}</td>
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

export default StokSeviyeleri;
