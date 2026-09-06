import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface CheckDemoRow {
  parasut_id: number;
  serial_number: string | null;
  bank_identifier: string | null;
  bank_name: string | null;
  due_date: string | null;
  issue_date: string | null;
  net_total: number | null;
  remaining: number | null;
  currency: string | null;
  payment_status: string | null;
  is_cashed: boolean | null;
  is_in: boolean | null;
  is_out: boolean | null;
  issued_by_parasut_id: number | null;
  issued_by_name: string | null;
  given_to_parasut_id: number | null;
  given_to_name: string | null;
}

type DirectionFilter = "all" | "in" | "out";

const PAYMENT_LABELS: Record<string, string> = {
  paid: "Ödendi",
  overdue: "Vadesi geçti",
  unpaid: "Ödenmedi",
  partially_paid: "Kısmi ödendi",
};

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

const Cekler = () => {
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [checks, setChecks] = useState<CheckDemoRow[] | null>(null);
  const [counts, setCounts] = useState<{ in: number; out: number; all: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    (async () => {
      const listBody: Record<string, unknown> = { action: "checks.list", pageSize: 1000 };
      if (directionFilter === "in") listBody.is_in = true;
      if (directionFilter === "out") listBody.is_out = true;
      if (fromDate) listBody.dateFrom = fromDate;
      if (toDate) listBody.dateTo = toDate;

      const [listRes, countsRes] = await Promise.all([
        supabase.functions.invoke("cash", { body: listBody }),
        supabase.functions.invoke("cash", { body: { action: "checks.counts" } }),
      ]);

      if (cancelled) return;

      const firstError = listRes.error?.message ?? listRes.data?.error ?? countsRes.error?.message ?? countsRes.data?.error;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      setChecks((listRes.data?.data as CheckDemoRow[] | null) ?? []);
      setCounts(countsRes.data?.data ?? { in: 0, out: 0, all: 0 });
    })();

    return () => {
      cancelled = true;
    };
  }, [directionFilter, fromDate, toDate]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="text-sm text-electric-bright hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Çekler</h1>
        <p className="mt-1 text-white/60">
          Paraşüt'ten senkronize edilen gerçek çek kayıtları (<code>/checks</code> — resmi dokümantasyonda yer almayan ama gerçek ve çalışan bir API uç noktası).
        </p>

        <div className="mt-6 flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDirectionFilter("all")}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                directionFilter === "all" ? "border-electric-bright bg-electric-bright/10 text-electric-bright" : "border-white/15 text-white/60 hover:text-white"
              }`}
            >
              Tümü {counts ? `(${counts.all})` : ""}
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter("in")}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                directionFilter === "in" ? "border-electric-bright bg-electric-bright/10 text-electric-bright" : "border-white/15 text-white/60 hover:text-white"
              }`}
            >
              Alınan (is_in) {counts ? `(${counts.in})` : ""}
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter("out")}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                directionFilter === "out" ? "border-electric-bright bg-electric-bright/10 text-electric-bright" : "border-white/15 text-white/60 hover:text-white"
              }`}
            >
              Verilen (is_out) {counts ? `(${counts.out})` : ""}
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-2 text-sm text-white/60">
            <label htmlFor="fromDate">Vade:</label>
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
            {checks === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : checks.length === 0 ? (
              <p className="text-white/50">Bu filtrede çek yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Seri no</th>
                      <th className="px-4 py-2 font-medium">Banka</th>
                      <th className="px-4 py-2 font-medium">Vade</th>
                      <th className="px-4 py-2 font-medium">Tutar</th>
                      <th className="px-4 py-2 font-medium">Kalan</th>
                      <th className="px-4 py-2 font-medium">Durum</th>
                      <th className="px-4 py-2 font-medium">Yön</th>
                      <th className="px-4 py-2 font-medium">Keşideci</th>
                      <th className="px-4 py-2 font-medium">Verilen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map((c) => (
                      <tr key={c.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          <Link to={`/nakit/cekler/${c.parasut_id}`} className="hover:text-electric-bright hover:underline">
                            {c.serial_number ?? `#${c.parasut_id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-white/70">{c.bank_identifier ?? c.bank_name ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{c.due_date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(c.net_total, c.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(c.remaining, c.currency)}</td>
                        <td className="px-4 py-2 text-white/70">
                          {c.payment_status ? PAYMENT_LABELS[c.payment_status] ?? c.payment_status : "—"}
                        </td>
                        <td className="px-4 py-2 text-white/70">{c.is_in ? "Alınan" : c.is_out ? "Verilen" : "—"}</td>
                        <td className="px-4 py-2 text-white/70">
                          {c.issued_by_parasut_id ? (
                            <Link to={`/musteriler/${c.issued_by_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {c.issued_by_name ?? `#${c.issued_by_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {c.given_to_parasut_id ? (
                            <Link to={`/musteriler/${c.given_to_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {c.given_to_name ?? `#${c.given_to_parasut_id}`}
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

export default Cekler;
