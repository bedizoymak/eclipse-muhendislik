import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEDocument, type EDocument } from "@/lib/eDocuments";
import { EDocumentSection } from "@/components/EDocumentSection";

interface BillDemoRow {
  parasut_id: number;
  invoice_no: string | null;
  item_type: string | null;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  exchange_rate: number | null;
  net_total: number | null;
  gross_total: number | null;
  total_vat: number | null;
  total_discount: number | null;
  total_paid: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  payment_status: string | null;
  archived: boolean | null;
  supplier_parasut_id: number | null;
  supplier_name: string | null;
  spender_parasut_id: number | null;
  spender_name: string | null;
  pay_to_parasut_id: number | null;
  pay_to_name: string | null;
  synced_at: string;
  active_e_document_type: string | null;
  active_e_document_parasut_id: number | null;
}

interface DetailRow {
  parasut_id: number;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  discount_type: string | null;
  discount_value: number | null;
  net_total: number | null;
  product_parasut_id: number | null;
  product_name: string | null;
}

interface ExpensePaymentRow {
  parasut_id: number;
  date: string | null;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  transaction_parasut_id: number | null;
  debit_account_name: string | null;
  credit_account_name: string | null;
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

const GiderDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [bill, setBill] = useState<BillDemoRow | null | undefined>(undefined);
  const [details, setDetails] = useState<DetailRow[] | null>(null);
  const [payments, setPayments] = useState<ExpensePaymentRow[] | null>(null);
  const [eDoc, setEDoc] = useState<EDocument | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;

    let cancelled = false;

    (async () => {
      const [billRes, detailsRes, paymentsRes] = await Promise.all([
        supabase.from("parasut_purchase_bills_demo").select("*").eq("parasut_id", parasutId).maybeSingle(),
        supabase
          .from("parasut_purchase_bill_details_demo")
          .select("parasut_id, description, quantity, unit_price, vat_rate, discount_type, discount_value, net_total, product_parasut_id, product_name")
          .eq("purchase_bill_parasut_id", parasutId),
        supabase
          .from("parasut_expense_payments_demo")
          .select("parasut_id, date, amount, currency, notes, transaction_parasut_id, debit_account_name, credit_account_name")
          .eq("payable_parasut_id", parasutId),
      ]);

      if (cancelled) return;

      const firstError = billRes.error?.message ?? detailsRes.error?.message ?? paymentsRes.error?.message;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      const billRow = (billRes.data as BillDemoRow | null) ?? null;
      setBill(billRow);
      setDetails((detailsRes.data as DetailRow[] | null) ?? []);
      setPayments((paymentsRes.data as ExpensePaymentRow[] | null) ?? []);

      if (billRow) {
        const { doc, error } = await fetchActiveEDocument(billRow.active_e_document_type, billRow.active_e_document_parasut_id);
        if (!cancelled) {
          if (error) setLoadError(error);
          else setEDoc(doc);
        }
      } else {
        setEDoc(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link to="/giderler" className="text-sm text-electric-bright hover:underline">
          ← Giderler
        </Link>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && bill === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}
        {!loadError && bill === null && <p className="mt-6 text-white/50">Gider bulunamadı (parasut_id: {parasutId}).</p>}

        {bill && (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">{bill.invoice_no ?? `#${bill.parasut_id}`}</h1>
            <p className="mt-1 text-white/60">
              {bill.supplier_parasut_id ? (
                <Link to={`/musteriler/${bill.supplier_parasut_id}`} className="hover:text-electric-bright hover:underline">
                  {bill.supplier_name ?? `#${bill.supplier_parasut_id}`}
                </Link>
              ) : (
                bill.spender_name ?? "—"
              )}
            </p>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt ID</dt>
                <dd className="mt-1">{bill.parasut_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Düzenleme tarihi</dt>
                <dd className="mt-1">{bill.issue_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vade tarihi</dt>
                <dd className="mt-1">{bill.due_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Net toplam</dt>
                <dd className="mt-1">{formatAmount(bill.net_total, bill.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Brüt toplam</dt>
                <dd className="mt-1">{formatAmount(bill.gross_total, bill.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">KDV</dt>
                <dd className="mt-1">{formatAmount(bill.total_vat, bill.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Ödenen</dt>
                <dd className="mt-1">{formatAmount(bill.total_paid, bill.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Kalan</dt>
                <dd className="mt-1">{formatAmount(bill.remaining, bill.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Ödeme durumu</dt>
                <dd className="mt-1">{bill.payment_status ? PAYMENT_LABELS[bill.payment_status] ?? bill.payment_status : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Ödeme yapılan (pay_to)</dt>
                <dd className="mt-1">{bill.pay_to_name ?? (bill.pay_to_parasut_id ? `#${bill.pay_to_parasut_id}` : "—")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Arşivlendi mi</dt>
                <dd className="mt-1">{bill.archived ? "Evet" : "Hayır"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Son sync</dt>
                <dd className="mt-1">{new Date(bill.synced_at).toLocaleString("tr-TR")}</dd>
              </div>
            </dl>

            <h2 className="mt-8 text-lg font-semibold">Gider kalemleri</h2>
            {details === null ? (
              <p className="mt-2 text-white/50">Yükleniyor…</p>
            ) : details.length === 0 ? (
              <p className="mt-2 text-white/50">Kalem yok.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Ürün</th>
                      <th className="px-4 py-2 font-medium">Açıklama</th>
                      <th className="px-4 py-2 font-medium">Miktar</th>
                      <th className="px-4 py-2 font-medium">Birim fiyat</th>
                      <th className="px-4 py-2 font-medium">KDV %</th>
                      <th className="px-4 py-2 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d) => (
                      <tr key={d.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">{d.product_name ?? (d.product_parasut_id ? `#${d.product_parasut_id}` : "—")}</td>
                        <td className="px-4 py-2 text-white/70">{d.description ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{d.quantity ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(d.unit_price, bill.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{d.vat_rate ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(d.net_total, bill.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="mt-8 text-lg font-semibold">Bağlı ödemeler</h2>
            {payments === null ? (
              <p className="mt-2 text-white/50">Yükleniyor…</p>
            ) : payments.length === 0 ? (
              <p className="mt-2 text-white/50">Bu gidere bağlı ödeme yok.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Tarih</th>
                      <th className="px-4 py-2 font-medium">Tutar</th>
                      <th className="px-4 py-2 font-medium">Not</th>
                      <th className="px-4 py-2 font-medium">Bağlı hesap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          <Link to={`/giderler/odemeler`} className="hover:text-electric-bright hover:underline">
                            {p.date ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(p.amount, p.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{p.notes?.trim() || "—"}</td>
                        <td className="px-4 py-2 text-white/70">
                          {p.debit_account_name ?? p.credit_account_name ?? (p.transaction_parasut_id ? `#${p.transaction_parasut_id}` : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <EDocumentSection eDoc={eDoc} />
          </>
        )}
      </div>
    </div>
  );
};

export default GiderDetay;
