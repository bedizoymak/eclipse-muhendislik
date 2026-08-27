import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface EmployeeDemoRow {
  parasut_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  tckn: string | null;
  archived: boolean | null;
  employment_start_date: string | null;
  employment_end_date: string | null;
  category_parasut_id: number | null;
}

type ArchivedFilter = "active" | "archived" | "all";

const ARCHIVED_FILTERS: { value: ArchivedFilter; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "archived", label: "Arşivli" },
  { value: "all", label: "Tümü" },
];

function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "string" && value.trim() === "") return "—";
  return String(value);
}

const Calisanlar = () => {
  const [archivedFilter, setArchivedFilter] = useState<ArchivedFilter>("active");
  const [rows, setRows] = useState<EmployeeDemoRow[] | null>(null);
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
      const { data, error } = await supabase.from("parasut_employee_counts_demo").select("*").maybeSingle();
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
        .from("parasut_employees_demo")
        .select("parasut_id, name, email, phone, iban, tckn, archived, employment_start_date, employment_end_date, category_parasut_id");
      if (archivedFilter === "active") listQuery = listQuery.eq("archived", false);
      if (archivedFilter === "archived") listQuery = listQuery.eq("archived", true);

      const { data, error } = await listQuery;
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setRows((data as EmployeeDemoRow[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [archivedFilter]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link to="/giderler" className="text-sm text-electric-bright hover:underline">
          ← Giderler
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Çalışanlar</h1>
        <p className="mt-1 text-white/60">Paraşüt'ten senkronize edilen gerçek çalışan kayıtları.</p>

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
        </div>

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
              <p className="text-white/50">Bu filtrede çalışan yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Paraşüt ID</th>
                      <th className="px-4 py-2 font-medium">Ad</th>
                      <th className="px-4 py-2 font-medium">E-posta</th>
                      <th className="px-4 py-2 font-medium">Telefon</th>
                      <th className="px-4 py-2 font-medium">TCKN</th>
                      <th className="px-4 py-2 font-medium">İşe başlama</th>
                      <th className="px-4 py-2 font-medium">İşten çıkış</th>
                      <th className="px-4 py-2 font-medium">Kategori ID</th>
                      <th className="px-4 py-2 font-medium">Arşiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          <Link to={`/giderler/calisanlar/${r.parasut_id}`} className="hover:text-electric-bright hover:underline">
                            #{r.parasut_id}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          <Link to={`/giderler/calisanlar/${r.parasut_id}`} className="hover:text-electric-bright hover:underline">
                            {r.name ?? `#${r.parasut_id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-white/70">{formatValue(r.email)}</td>
                        <td className="px-4 py-2 text-white/70">{formatValue(r.phone)}</td>
                        <td className="px-4 py-2 text-white/70">{formatValue(r.tckn)}</td>
                        <td className="px-4 py-2 text-white/70">{formatValue(r.employment_start_date)}</td>
                        <td className="px-4 py-2 text-white/70">{formatValue(r.employment_end_date)}</td>
                        <td className="px-4 py-2 text-white/70">{formatValue(r.category_parasut_id)}</td>
                        <td className="px-4 py-2 text-white/70">{r.archived ? "Arşivli" : "Aktif"}</td>
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

export default Calisanlar;
