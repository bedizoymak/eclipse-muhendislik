import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  stock_count: number | null;
  archived: boolean | null;
  category_parasut_id: number | null;
  category_name: string | null;
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

const Urunler = () => {
  const [archivedFilter, setArchivedFilter] = useState<ArchivedFilter>("active");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [trackingFilter, setTrackingFilter] = useState<"all" | "tracked" | "untracked">("all");
  const [products, setProducts] = useState<ProductDemoRow[] | null>(null);
  const [categories, setCategories] = useState<{ parasut_id: number; name: string | null }[]>([]);
  const [counts, setCounts] = useState<{ active: number; archived: number; all: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.functions
      .invoke("products", { body: { action: "products.categoryOptions" } })
      .then(({ data }) => setCategories((data?.data as { parasut_id: number; name: string | null }[] | null) ?? []));
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    (async () => {
      const listBody: Record<string, unknown> = { action: "products.list", pageSize: 200 };
      if (archivedFilter === "active") listBody.archived = false;
      if (archivedFilter === "archived") listBody.archived = true;
      if (categoryFilter) listBody.category_id = categoryFilter;
      if (trackingFilter === "tracked") listBody.inventory_tracking = true;
      if (trackingFilter === "untracked") listBody.inventory_tracking = false;

      const [listRes, countsRes] = await Promise.all([
        supabase.functions.invoke("products", { body: listBody }),
        supabase.functions.invoke("products", { body: { action: "products.counts" } }),
      ]);

      if (cancelled) return;

      const firstError = listRes.error?.message ?? listRes.data?.error ?? countsRes.error?.message ?? countsRes.data?.error;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      setProducts((listRes.data?.data as ProductDemoRow[] | null) ?? []);
      setCounts(countsRes.data?.data ?? { active: 0, archived: 0, all: 0 });
    })();

    return () => {
      cancelled = true;
    };
  }, [archivedFilter, categoryFilter, trackingFilter]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="text-sm text-electric-bright hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Ürünler</h1>
        <p className="mt-1 text-white/60">Paraşüt'ten senkronize edilen gerçek ürün/hizmet kayıtları (ilk 200 gösterilir).</p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <Link to="/stok/kategoriler" className="text-electric-bright hover:underline">
            Ürün kategorileri →
          </Link>
          <Link to="/stok/depolar" className="text-electric-bright hover:underline">
            Depolar →
          </Link>
          <Link to="/stok/seviyeleri" className="text-electric-bright hover:underline">
            Stok seviyeleri →
          </Link>
          <Link to="/stok/hareketleri" className="text-electric-bright hover:underline">
            Stok hareketleri →
          </Link>
        </div>

        <div className="mt-6 flex min-w-0 flex-wrap items-center gap-3">
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

          <div className="w-full min-w-0 sm:w-auto sm:max-w-[220px]">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full max-w-full truncate rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white"
            >
              <option value="">Tüm kategoriler</option>
              {categories.map((c) => (
                <option key={c.parasut_id} value={c.parasut_id}>
                  {c.name ?? `#${c.parasut_id}`}
                </option>
              ))}
            </select>
          </div>

          <select
            value={trackingFilter}
            onChange={(e) => setTrackingFilter(e.target.value as "all" | "tracked" | "untracked")}
            className="rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white"
          >
            <option value="all">Stok takibi: tümü</option>
            <option value="tracked">Takip ediliyor</option>
            <option value="untracked">Takip edilmiyor</option>
          </select>
        </div>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {products === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : products.length === 0 ? (
              <p className="text-white/50">Bu filtrede ürün yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Kod / Ad</th>
                      <th className="px-4 py-2 font-medium">Birim</th>
                      <th className="px-4 py-2 font-medium">Satış fiyatı</th>
                      <th className="px-4 py-2 font-medium">Alış fiyatı</th>
                      <th className="px-4 py-2 font-medium">KDV</th>
                      <th className="px-4 py-2 font-medium">Stok takibi</th>
                      <th className="px-4 py-2 font-medium">Stok miktarı</th>
                      <th className="px-4 py-2 font-medium">Kategori</th>
                      <th className="px-4 py-2 font-medium">Arşiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          <Link to={`/urunler/${p.parasut_id}`} className="hover:text-electric-bright hover:underline">
                            {p.code ? `${p.code} — ` : ""}
                            {p.name ?? `#${p.parasut_id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-white/70">{p.unit ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(p.list_price, p.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(p.buying_price, p.buying_currency)}</td>
                        <td className="px-4 py-2 text-white/70">{p.vat_rate != null ? `%${p.vat_rate}` : "—"}</td>
                        <td className="px-4 py-2 text-white/70">{p.inventory_tracking ? "Evet" : "Hayır"}</td>
                        <td className="px-4 py-2 text-white/70">{p.inventory_tracking ? p.stock_count ?? "—" : "—"}</td>
                        <td className="px-4 py-2 text-white/70">{p.category_name ?? (p.category_parasut_id ? `#${p.category_parasut_id}` : "—")}</td>
                        <td className="px-4 py-2 text-white/70">{p.archived ? "Arşivli" : "Aktif"}</td>
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

export default Urunler;
