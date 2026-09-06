import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ProductDemoRow {
  parasut_id: number;
  code: string | null;
  name: string | null;
  unit: string | null;
  barcode: string | null;
  vat_rate: number | null;
  list_price: number | null;
  currency: string | null;
  buying_price: number | null;
  buying_currency: string | null;
  inventory_tracking: boolean | null;
  initial_stock_count: number | null;
  stock_count: number | null;
  archived: boolean | null;
  category_parasut_id: number | null;
  category_name: string | null;
  synced_at: string;
}

interface InventoryLevelRow {
  parasut_id: number;
  warehouse_parasut_id: number | null;
  warehouse_name: string | null;
  stock_count: number | null;
  initial_stock_count: number | null;
  critical_stock_count: number | null;
}

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

const UrunDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [product, setProduct] = useState<ProductDemoRow | null | undefined>(undefined);
  const [levels, setLevels] = useState<InventoryLevelRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.functions.invoke("products", { body: { action: "products.get", id: Number(parasutId) } });

      if (cancelled) return;

      if (data?.error === "not_found") {
        setProduct(null);
        setLevels([]);
        return;
      }
      if (error || data?.error) {
        setLoadError(error?.message ?? data?.error);
        return;
      }

      const { inventory_levels: levelRows, ...productFields } = data?.data ?? {};
      setProduct((productFields as ProductDemoRow | null) ?? null);
      setLevels((levelRows as InventoryLevelRow[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link to="/urunler" className="text-sm text-electric-bright hover:underline">
          ← Ürünler
        </Link>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && product === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}
        {!loadError && product === null && <p className="mt-6 text-white/50">Ürün bulunamadı (parasut_id: {parasutId}).</p>}

        {product && (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">{product.name ?? `#${product.parasut_id}`}</h1>
            <p className="mt-1 text-white/60">{product.code ?? "—"}</p>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt ID</dt>
                <dd className="mt-1">{product.parasut_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Birim</dt>
                <dd className="mt-1">{product.unit ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Barkod</dt>
                <dd className="mt-1">{product.barcode ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Satış fiyatı</dt>
                <dd className="mt-1">{formatAmount(product.list_price, product.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Alış fiyatı</dt>
                <dd className="mt-1">{formatAmount(product.buying_price, product.buying_currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">KDV oranı</dt>
                <dd className="mt-1">{product.vat_rate != null ? `%${product.vat_rate}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Stok takibi</dt>
                <dd className="mt-1">{product.inventory_tracking ? "Evet" : "Hayır"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Başlangıç stok</dt>
                <dd className="mt-1">{product.initial_stock_count ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Toplam stok (API)</dt>
                <dd className="mt-1">{product.inventory_tracking ? product.stock_count ?? "—" : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Kategori</dt>
                <dd className="mt-1">{product.category_name ?? (product.category_parasut_id ? `#${product.category_parasut_id}` : "—")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Arşivlendi mi</dt>
                <dd className="mt-1">{product.archived ? "Evet" : "Hayır"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Son sync</dt>
                <dd className="mt-1">{new Date(product.synced_at).toLocaleString("tr-TR")}</dd>
              </div>
            </dl>

            <h2 className="mt-8 text-lg font-semibold">Depo bazlı stok seviyeleri</h2>
            {levels === null ? (
              <p className="mt-2 text-white/50">Yükleniyor…</p>
            ) : levels.length === 0 ? (
              <p className="mt-2 text-white/50">Bu ürün için depo bazlı stok seviyesi yok.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
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
                          {l.warehouse_name ?? (l.warehouse_parasut_id ? `#${l.warehouse_parasut_id}` : "—")}
                        </td>
                        <td className="px-4 py-2 text-white/70">{l.stock_count ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{l.initial_stock_count ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{l.critical_stock_count ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UrunDetay;
