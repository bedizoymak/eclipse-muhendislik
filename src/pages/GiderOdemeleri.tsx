import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ExpensePaymentRow {
  parasut_id: number;
  date: string | null;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  payable_parasut_id: number | null;
  invoice_no: string | null;
  supplier_parasut_id: number | null;
  supplier_name: string | null;
  transaction_parasut_id: number | null;
  debit_account_name: string | null;
  credit_account_name: string | null;
}

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

const GiderOdemeleri = () => {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [payments, setPayments] = useState<ExpensePaymentRow[] | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    (async () => {
      const body: Record<string, unknown> = { action: "payments.list", pageSize: 1000 };
      if (fromDate) body.dateFrom = fromDate;
      if (toDate) body.dateTo = toDate;

      const [listRes, countRes] = await Promise.all([
        supabase.functions.invoke("expenses", { body }),
        supabase.functions.invoke("expenses", { body: { action: "payments.counts" } }),
      ]);

      if (cancelled) return;

      const firstError = listRes.error?.message ?? listRes.data?.error ?? countRes.error?.message ?? countRes.data?.error;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      setPayments((listRes.data?.data as ExpensePaymentRow[] | null) ?? []);
      setTotalCount(countRes.data?.data?.total ?? 0);
    })();

    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link to="/giderler" className="text-sm text-electric-bright hover:underline">
          ← Giderler
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Gider Ödemeleri</h1>
        <p className="mt-1 text-white/60">
          Paraşüt'ten senkronize edilen gerçek gider ödemeleri (alış faturalarına bağlı). Toplam: {totalCount ?? "—"}
        </p>
        <p className="mt-1 text-xs text-white/40">
          Satış tahsilatlarından ayrı bir görünüm — bkz. <Link to="/satislar/tahsilatlar" className="underline">Tahsilatlar</Link>.
        </p>

        <div className="mt-6 flex items-center gap-2 text-sm text-white/60">
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

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {payments === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : payments.length === 0 ? (
              <p className="text-white/50">Bu filtrede gider ödemesi yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Tarih</th>
                      <th className="px-4 py-2 font-medium">Tutar</th>
                      <th className="px-4 py-2 font-medium">Not</th>
                      <th className="px-4 py-2 font-medium">Bağlı gider</th>
                      <th className="px-4 py-2 font-medium">Tedarikçi</th>
                      <th className="px-4 py-2 font-medium">Bağlı hesap/hareket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">{p.date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(p.amount, p.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{p.notes?.trim() || "—"}</td>
                        <td className="px-4 py-2 text-white/70">
                          {p.payable_parasut_id ? (
                            <Link to={`/giderler/${p.payable_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {p.invoice_no ?? `#${p.payable_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {p.supplier_parasut_id ? (
                            <Link to={`/musteriler/${p.supplier_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {p.supplier_name ?? `#${p.supplier_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {p.debit_account_name ?? p.credit_account_name ?? (p.transaction_parasut_id ? `#${p.transaction_parasut_id}` : "—")}
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

export default GiderOdemeleri;
