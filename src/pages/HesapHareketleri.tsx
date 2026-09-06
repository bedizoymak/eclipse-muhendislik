import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface TransactionDemoRow {
  parasut_id: number;
  description: string | null;
  transaction_type: string | null;
  date: string | null;
  debit_amount: number | null;
  debit_currency: string | null;
  debit_account_parasut_id: number | null;
  debit_account_type: string | null;
  debit_account_name: string | null;
  debit_contact_name: string | null;
  credit_amount: number | null;
  credit_currency: string | null;
  credit_account_parasut_id: number | null;
  credit_account_type: string | null;
  credit_account_name: string | null;
  credit_contact_name: string | null;
}

interface AccountOption {
  parasut_id: number;
  name: string | null;
}

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

function sideLabel(
  accountName: string | null,
  contactName: string | null,
  accountId: number | null,
  accountType: string | null,
): string {
  if (accountName) return accountName;
  if (contactName) return `${contactName} (cari)`;
  if (accountId) return `#${accountId}${accountType ? ` (${accountType})` : ""}`;
  return "—";
}

const HesapHareketleri = () => {
  const [accountFilter, setAccountFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [transactions, setTransactions] = useState<TransactionDemoRow[] | null>(null);
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.functions
      .invoke("cash", { body: { action: "accounts.options" } })
      .then(({ data }) => setAccountOptions((data?.data as AccountOption[] | null) ?? []));
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    (async () => {
      const body: Record<string, unknown> = { action: "transactions.list", pageSize: 200 };
      if (fromDate) body.dateFrom = fromDate;
      if (toDate) body.dateTo = toDate;
      if (transactionType) body.transaction_type = transactionType;
      if (accountFilter) body.account_id = Number(accountFilter);

      const { data, error } = await supabase.functions.invoke("cash", { body });
      if (cancelled) return;
      if (error || data?.error) {
        setLoadError(error?.message ?? data?.error);
        return;
      }
      setTransactions((data?.data as TransactionDemoRow[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountFilter, fromDate, toDate, transactionType]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link to="/nakit/hesaplar" className="text-sm text-electric-bright hover:underline">
          ← Hesaplar
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Hesap Hareketleri</h1>
        <p className="mt-1 text-white/60">Paraşüt'ten senkronize edilen gerçek hesap hareketleri (en fazla 200 gösterilir).</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white"
          >
            <option value="">Tüm hesaplar</option>
            {accountOptions.map((a) => (
              <option key={a.parasut_id} value={a.parasut_id}>
                {a.name ?? `#${a.parasut_id}`}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="İşlem türü (ör. contact_credit)"
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            className="rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white placeholder:text-white/30"
          />

          <div className="flex items-center gap-2 text-sm text-white/60">
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
        </div>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {transactions === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : transactions.length === 0 ? (
              <p className="text-white/50">Bu filtrede hareket yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Tarih</th>
                      <th className="px-4 py-2 font-medium">Açıklama</th>
                      <th className="px-4 py-2 font-medium">Tür</th>
                      <th className="px-4 py-2 font-medium">Borç hesap</th>
                      <th className="px-4 py-2 font-medium">Borç tutar</th>
                      <th className="px-4 py-2 font-medium">Alacak hesap</th>
                      <th className="px-4 py-2 font-medium">Alacak tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">{t.date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{t.description?.trim() || "—"}</td>
                        <td className="px-4 py-2 text-white/70">{t.transaction_type ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">
                          {sideLabel(t.debit_account_name, t.debit_contact_name, t.debit_account_parasut_id, t.debit_account_type)}
                        </td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(t.debit_amount, t.debit_currency)}</td>
                        <td className="px-4 py-2 text-white/70">
                          {sideLabel(t.credit_account_name, t.credit_contact_name, t.credit_account_parasut_id, t.credit_account_type)}
                        </td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(t.credit_amount, t.credit_currency)}</td>
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

export default HesapHareketleri;
