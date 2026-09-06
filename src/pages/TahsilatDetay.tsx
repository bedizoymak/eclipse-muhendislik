import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface PaymentDemoRow {
  parasut_id: number;
  date: string | null;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  payable_type: string | null;
  payable_parasut_id: number | null;
  invoice_no: string | null;
  contact_parasut_id: number | null;
  contact_name: string | null;
  transaction_parasut_id: number | null;
  transaction_description: string | null;
  transaction_type: string | null;
  debit_account_parasut_id: number | null;
  debit_account_type: string | null;
  debit_account_name: string | null;
  credit_account_parasut_id: number | null;
  credit_account_type: string | null;
  credit_account_name: string | null;
  synced_at: string;
}

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

const TahsilatDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [payment, setPayment] = useState<PaymentDemoRow | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;

    let cancelled = false;
    supabase.functions
      .invoke("sales", { body: { action: "payments.get", id: Number(parasutId) } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (data?.error === "not_found") {
          setPayment(null);
          return;
        }
        if (error || data?.error) {
          setLoadError(error?.message ?? data?.error);
          return;
        }
        setPayment((data?.data as PaymentDemoRow | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link to="/satislar/tahsilatlar" className="text-sm text-electric-bright hover:underline">
          ← Tahsilatlar
        </Link>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && payment === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}
        {!loadError && payment === null && <p className="mt-6 text-white/50">Tahsilat bulunamadı (parasut_id: {parasutId}).</p>}

        {payment && (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">{formatAmount(payment.amount, payment.currency)}</h1>
            <p className="mt-1 text-white/60">{payment.date ?? "—"}</p>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt ID</dt>
                <dd className="mt-1">{payment.parasut_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Açıklama / Not</dt>
                <dd className="mt-1">{payment.notes?.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Bağlı fatura</dt>
                <dd className="mt-1">
                  {payment.payable_parasut_id ? (
                    <Link to={`/satislar/faturalar/${payment.payable_parasut_id}`} className="text-electric-bright hover:underline">
                      {payment.invoice_no ?? `#${payment.payable_parasut_id}`}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Bağlı müşteri</dt>
                <dd className="mt-1">
                  {payment.contact_parasut_id ? (
                    <Link to={`/musteriler/${payment.contact_parasut_id}`} className="text-electric-bright hover:underline">
                      {payment.contact_name ?? `#${payment.contact_parasut_id}`}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Bağlı hareket</dt>
                <dd className="mt-1">
                  {payment.transaction_parasut_id ? `#${payment.transaction_parasut_id} — ${payment.transaction_description?.trim() || payment.transaction_type || "—"}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Borç hesap</dt>
                <dd className="mt-1">{payment.debit_account_name ?? (payment.debit_account_parasut_id ? `#${payment.debit_account_parasut_id} (${payment.debit_account_type ?? "—"})` : "—")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Alacak hesap</dt>
                <dd className="mt-1">{payment.credit_account_name ?? (payment.credit_account_parasut_id ? `#${payment.credit_account_parasut_id} (${payment.credit_account_type ?? "—"})` : "—")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Son sync</dt>
                <dd className="mt-1">{new Date(payment.synced_at).toLocaleString("tr-TR")}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </div>
  );
};

export default TahsilatDetay;
