import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface StockMovementDemoRow {
  parasut_id: number;
  date: string | null;
  quantity: number | null;
  product_parasut_id: number | null;
  product_name: string | null;
  warehouse_parasut_id: number | null;
  warehouse_name: string | null;
  source_type: string | null;
  source_parasut_id: number | null;
  contact_parasut_id: number | null;
  contact_name: string | null;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  sales_invoice_details: "Satış faturası kalemi",
  purchase_bill_details: "Alış faturası kalemi",
  shipment_documents: "İrsaliye",
};

const StokHareketleri = () => {
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [movements, setMovements] = useState<StockMovementDemoRow[] | null>(null);
  const [warehouses, setWarehouses] = useState<{ parasut_id: number; name: string | null }[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("parasut_warehouses_demo")
      .select("parasut_id, name")
      .then(({ data }) => setWarehouses((data as { parasut_id: number; name: string | null }[] | null) ?? []));
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    (async () => {
      let listQuery = supabase
        .from("parasut_stock_movements_demo")
        .select(
          "parasut_id, date, quantity, product_parasut_id, product_name, warehouse_parasut_id, warehouse_name, source_type, source_parasut_id, contact_parasut_id, contact_name",
        )
        .limit(200);
      if (warehouseFilter) listQuery = listQuery.eq("warehouse_parasut_id", warehouseFilter);
      if (productFilter) listQuery = listQuery.eq("product_parasut_id", productFilter);
      if (fromDate) listQuery = listQuery.gte("date", fromDate);
      if (toDate) listQuery = listQuery.lte("date", toDate);

      const [listRes, countRes] = await Promise.all([
        listQuery,
        supabase.from("parasut_stock_movements_demo").select("parasut_id", { count: "exact", head: true }),
      ]);

      if (cancelled) return;

      const firstError = listRes.error?.message ?? countRes.error?.message;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      setMovements((listRes.data as StockMovementDemoRow[] | null) ?? []);
      setTotalCount(countRes.count ?? 0);
    })();

    return () => {
      cancelled = true;
    };
  }, [warehouseFilter, productFilter, fromDate, toDate]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link to="/urunler" className="text-sm text-electric-bright hover:underline">
          ← Ürünler
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Stok Hareketleri</h1>
        <p className="mt-1 text-white/60">
          Paraşüt'ten senkronize edilen gerçek stok hareketleri. Toplam: {totalCount ?? "—"} (ilk 200 gösterilir)
        </p>

        <div className="mt-6 flex min-w-0 flex-wrap items-center gap-3">
          <div className="w-full min-w-0 sm:w-auto sm:max-w-[220px]">
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full max-w-full truncate rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white"
            >
              <option value="">Tüm depolar</option>
              {warehouses.map((w) => (
                <option key={w.parasut_id} value={w.parasut_id}>
                  {w.name ?? `#${w.parasut_id}`}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            placeholder="Ürün parasut_id"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="min-w-0 rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white placeholder:text-white/30"
          />

          <div className="flex min-w-0 items-center gap-2 text-sm text-white/60">
            <label htmlFor="fromDate">Tarih:</label>
            <input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="min-w-0 rounded-lg border border-white/15 bg-navy-deep px-2 py-1 text-white"
            />
            <span>–</span>
            <input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="min-w-0 rounded-lg border border-white/15 bg-navy-deep px-2 py-1 text-white"
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
            {movements === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : movements.length === 0 ? (
              <p className="text-white/50">Bu filtrede hareket yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Tarih</th>
                      <th className="px-4 py-2 font-medium">Miktar</th>
                      <th className="px-4 py-2 font-medium">Ürün</th>
                      <th className="px-4 py-2 font-medium">Depo</th>
                      <th className="px-4 py-2 font-medium">Kaynak</th>
                      <th className="px-4 py-2 font-medium">Müşteri/Tedarikçi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">{m.date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{m.quantity ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">
                          {m.product_parasut_id ? (
                            <Link to={`/urunler/${m.product_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {m.product_name ?? `#${m.product_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">{m.warehouse_name ?? (m.warehouse_parasut_id ? `#${m.warehouse_parasut_id}` : "—")}</td>
                        <td className="px-4 py-2 text-white/70">
                          {m.source_type ? SOURCE_TYPE_LABELS[m.source_type] ?? m.source_type : "—"}
                          {m.source_parasut_id ? ` (#${m.source_parasut_id})` : ""}
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {m.contact_parasut_id ? (
                            <Link to={`/musteriler/${m.contact_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {m.contact_name ?? `#${m.contact_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
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

export default StokHareketleri;
