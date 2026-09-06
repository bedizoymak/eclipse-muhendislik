import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AccountDemoRow {
  parasut_id: number;
  name: string | null;
  account_type: string | null;
  currency: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  balance: number | null;
  archived: boolean | null;
  synced_at: string;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: "Kasa",
  bank: "Banka",
  sys: "Sistem",
};

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

const Hesaplar = () => {
  const [accounts, setAccounts] = useState<AccountDemoRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;
    supabase
      .from("parasut_accounts_demo")
      .select("parasut_id, name, account_type, currency, bank_name, bank_branch, balance, archived, synced_at")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setAccounts((data as AccountDemoRow[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="text-sm text-electric-bright hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Hesaplar</h1>
        <p className="mt-1 text-white/60">
          Paraşüt'ten senkronize edilen gerçek kasa/banka hesapları. Bakiyeler doğrudan Paraşüt API'sinden gelir.
        </p>
        <div className="mt-4">
          <Link to="/nakit/hesap-hareketleri" className="text-sm text-electric-bright hover:underline">
            Hesap hareketleri →
          </Link>
        </div>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {accounts === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : accounts.length === 0 ? (
              <p className="text-white/50">Henüz senkronize edilmiş hesap yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Hesap adı</th>
                      <th className="px-4 py-2 font-medium">Tür</th>
                      <th className="px-4 py-2 font-medium">Para birimi</th>
                      <th className="px-4 py-2 font-medium">Banka</th>
                      <th className="px-4 py-2 font-medium">Bakiye</th>
                      <th className="px-4 py-2 font-medium">Arşiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc) => (
                      <tr key={acc.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">{acc.name ?? `#${acc.parasut_id}`}</td>
                        <td className="px-4 py-2 text-white/70">
                          {acc.account_type ? ACCOUNT_TYPE_LABELS[acc.account_type] ?? acc.account_type : "—"}
                        </td>
                        <td className="px-4 py-2 text-white/70">{acc.currency ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">
                          {[acc.bank_name, acc.bank_branch].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(acc.balance, acc.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{acc.archived ? "Arşivli" : "Aktif"}</td>
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

export default Hesaplar;
