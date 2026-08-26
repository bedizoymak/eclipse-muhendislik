import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface CheckDemoRow {
  parasut_id: number;
  currency: string | null;
  description: string | null;
  due_date: string | null;
  issue_date: string | null;
  net_total: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  payment_status: string | null;
  is_cashed: boolean | null;
  is_in: boolean | null;
  is_out: boolean | null;
  is_transferred: boolean | null;
  days_overdue: number | null;
  days_till_due_date: number | null;
  bank_identifier: string | null;
  bank_name: string | null;
  serial_number: string | null;
  issued_by_parasut_id: number | null;
  issued_by_type: string | null;
  issued_by_name: string | null;
  given_to_parasut_id: number | null;
  given_to_type: string | null;
  given_to_name: string | null;
  synced_at: string;
}

interface CheckPaymentDemoRow {
  parasut_id: number;
  date: string | null;
  due_date: string | null;
  amount: number | null;
  matched_amount: number | null;
  amount_in_trl: number | null;
  currency: string | null;
  paid_in_currency: string | null;
}

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

// Displays the API's own timestamp as-is -- formatting only, never shifting
// the underlying instant to the browser's local timezone.
function formatApiTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString("tr-TR", { timeZone: "UTC" })} UTC`;
}

const CekDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [check, setCheck] = useState<CheckDemoRow | null | undefined>(undefined);
  const [payments, setPayments] = useState<CheckPaymentDemoRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;

    let cancelled = false;
    (async () => {
      const [checkRes, paymentsRes] = await Promise.all([
        supabase
          .from("parasut_checks_demo")
          .select("*")
          .eq("parasut_id", parasutId)
          .maybeSingle(),
        supabase
          .from("parasut_payments_demo")
          .select("parasut_id, date, due_date, amount, matched_amount, amount_in_trl, currency, paid_in_currency")
          .eq("payable_type", "checks")
          .eq("payable_parasut_id", parasutId),
      ]);
      if (cancelled) return;
      if (checkRes.error) {
        setLoadError(checkRes.error.message);
        return;
      }
      setCheck((checkRes.data as CheckDemoRow | null) ?? null);
      if (!paymentsRes.error) {
        setPayments((paymentsRes.data as CheckPaymentDemoRow[] | null) ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link to="/nakit/cekler" className="text-sm text-electric-bright hover:underline">
          ← Çekler
        </Link>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && check === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}
        {!loadError && check === null && <p className="mt-6 text-white/50">Çek bulunamadı (parasut_id: {parasutId}).</p>}

        {check && (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">{check.serial_number ?? `#${check.parasut_id}`}</h1>
            <p className="mt-1 text-white/60">{check.is_in ? "Alınan çek" : check.is_out ? "Verilen çek" : "—"}</p>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt ID</dt>
                <dd className="mt-1">{check.parasut_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Banka</dt>
                <dd className="mt-1">{check.bank_identifier ?? check.bank_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Düzenleme tarihi</dt>
                <dd className="mt-1">{check.issue_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vade tarihi</dt>
                <dd className="mt-1">{check.due_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Tutar</dt>
                <dd className="mt-1">{formatAmount(check.net_total, check.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Kalan</dt>
                <dd className="mt-1">{formatAmount(check.remaining, check.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Kalan (TL)</dt>
                <dd className="mt-1">{formatAmount(check.remaining_in_trl, "TL")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Ödeme durumu</dt>
                <dd className="mt-1">{check.payment_status ? PAYMENT_LABELS[check.payment_status] ?? check.payment_status : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Tahsil edildi mi</dt>
                <dd className="mt-1">{check.is_cashed ? "Evet" : "Hayır"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vadesi geçen gün</dt>
                <dd className="mt-1">{check.days_overdue ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vadeye kalan gün</dt>
                <dd className="mt-1">{check.days_till_due_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Keşideci (issued_by)</dt>
                <dd className="mt-1">
                  {check.issued_by_parasut_id ? (
                    <Link to={`/musteriler/${check.issued_by_parasut_id}`} className="text-electric-bright hover:underline">
                      {check.issued_by_name ?? `#${check.issued_by_parasut_id}`}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Verilen (given_to)</dt>
                <dd className="mt-1">
                  {check.given_to_parasut_id ? (
                    <Link to={`/musteriler/${check.given_to_parasut_id}`} className="text-electric-bright hover:underline">
                      {check.given_to_name ?? `#${check.given_to_parasut_id}`}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Transfer edildi mi</dt>
                <dd className="mt-1">{check.is_transferred ? "Evet" : "Hayır"}</dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="text-xs uppercase tracking-wide text-white/50">Açıklama</dt>
                <dd className="mt-1">{check.description?.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te oluşturulma</dt>
                <dd className="mt-1">{formatApiTimestamp(check.parasut_created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te güncellenme</dt>
                <dd className="mt-1">{formatApiTimestamp(check.parasut_updated_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Son sync</dt>
                <dd className="mt-1">{new Date(check.synced_at).toLocaleString("tr-TR")}</dd>
              </div>
            </dl>

            <div className="mt-8">
              <h2 className="text-lg font-semibold">İlişkili ödeme</h2>
              {payments === null ? (
                <p className="mt-2 text-sm text-white/50">Yükleniyor…</p>
              ) : payments.length === 0 ? (
                <p className="mt-2 text-sm text-white/50">İlişkili ödeme yok.</p>
              ) : (
                <div className="mt-2 space-y-3">
                  {payments.map((p) => (
                    <dl key={p.parasut_id} className="grid grid-cols-1 gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Ödeme tarihi</dt>
                        <dd className="mt-1">{p.date ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Vade</dt>
                        <dd className="mt-1">{p.due_date ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Tutar</dt>
                        <dd className="mt-1">{formatAmount(p.amount, p.currency)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Eşleşen tutar</dt>
                        <dd className="mt-1">{formatAmount(p.matched_amount, p.paid_in_currency ?? p.currency)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Tutar (TL)</dt>
                        <dd className="mt-1">{formatAmount(p.amount_in_trl, "TL")}</dd>
                      </div>
                    </dl>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/50">
              Not: Bu ekran yalnızca Paraşüt <code>/checks</code> API'sinin gerçekten döndürdüğü alanları gösterir. Çek görseli, ödeme geçmişi (histories) veya
              başka bir sisteme aktarım detayı gibi API'de bulunmayan alanlar burada üretilmez.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CekDetay;
