import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SupplierDemoRow {
  parasut_id: number;
  name: string | null;
  short_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  archived: boolean | null;
}

type ArchivedFilter = "active" | "archived" | "all";

const ARCHIVED_FILTERS: { value: ArchivedFilter; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "archived", label: "Arşivli" },
  { value: "all", label: "Tümü" },
];

const Tedarikciler = () => {
  const [filter, setFilter] = useState<ArchivedFilter>("active");
  const [suppliers, setSuppliers] = useState<SupplierDemoRow[] | null>(null);
  const [counts, setCounts] = useState<{ active: number; archived: number; all: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    (async () => {
      let listQuery = supabase.from("parasut_suppliers_demo").select("parasut_id, name, short_name, email, phone, city, archived");
      if (filter === "active") listQuery = listQuery.eq("archived", false);
      if (filter === "archived") listQuery = listQuery.eq("archived", true);

      const [listRes, activeRes, archivedRes, allRes] = await Promise.all([
        listQuery,
        supabase.from("parasut_suppliers_demo").select("parasut_id", { count: "exact", head: true }).eq("archived", false),
        supabase.from("parasut_suppliers_demo").select("parasut_id", { count: "exact", head: true }).eq("archived", true),
        supabase.from("parasut_suppliers_demo").select("parasut_id", { count: "exact", head: true }),
      ]);

      if (cancelled) return;

      const firstError = listRes.error?.message ?? activeRes.error?.message ?? archivedRes.error?.message ?? allRes.error?.message;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      setSuppliers((listRes.data as SupplierDemoRow[] | null) ?? []);
      setCounts({ active: activeRes.count ?? 0, archived: archivedRes.count ?? 0, all: allRes.count ?? 0 });
    })();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link to="/giderler" className="text-sm text-electric-bright hover:underline">
          ← Giderler
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Tedarikçiler</h1>
        <p className="mt-1 text-white/60">
          Paraşüt'te <code>account_type = "supplier"</code> olarak tanımlı gerçek contacts kayıtları (isim/bakiye tahmini değil, API alanı).
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {ARCHIVED_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                filter === f.value
                  ? "border-electric-bright bg-electric-bright/10 text-electric-bright"
                  : "border-white/15 text-white/60 hover:text-white"
              }`}
            >
              {f.label} {counts ? `(${counts[f.value === "all" ? "all" : f.value]})` : ""}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {suppliers === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : suppliers.length === 0 ? (
              <p className="text-white/50">Bu filtrede tedarikçi yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Ad</th>
                      <th className="px-4 py-2 font-medium">E-posta</th>
                      <th className="px-4 py-2 font-medium">Telefon</th>
                      <th className="px-4 py-2 font-medium">Şehir</th>
                      <th className="px-4 py-2 font-medium">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr key={s.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          <Link to={`/musteriler/${s.parasut_id}`} className="hover:text-electric-bright hover:underline">
                            {s.name ?? s.short_name ?? `#${s.parasut_id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-white/70">{s.email?.trim() || "—"}</td>
                        <td className="px-4 py-2 text-white/70">{s.phone ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{s.city ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{s.archived ? "Arşivli" : "Aktif"}</td>
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

export default Tedarikciler;
