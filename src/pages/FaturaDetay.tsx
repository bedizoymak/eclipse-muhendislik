import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEDocument, type EDocument } from "@/lib/eDocuments";
import { EDocumentSection } from "@/components/EDocumentSection";

interface InvoiceDemoRow {
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
  before_taxes_total: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  payment_status: string | null;
  billing_address: string | null;
  tax_office: string | null;
  tax_number: string | null;
  city: string | null;
  district: string | null;
  order_no: string | null;
  order_date: string | null;
  invoice_note: string | null;
  archived: boolean | null;
  contact_parasut_id: number | null;
  contact_name: string | null;
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

const FaturaDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [invoice, setInvoice] = useState<InvoiceDemoRow | null | undefined>(undefined);
  const [details, setDetails] = useState<DetailRow[] | null>(null);
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
      const [invoiceRes, detailsRes] = await Promise.all([
        supabase
          .from("parasut_sales_invoices_demo")
          .select("*")
          .eq("parasut_id", parasutId)
          .maybeSingle(),
        supabase
          .from("parasut_sales_invoice_details_demo")
          .select("parasut_id, description, quantity, unit_price, vat_rate, discount_type, discount_value, net_total, product_parasut_id, product_name")
          .eq("sales_invoice_parasut_id", parasutId),
      ]);

      if (cancelled) return;

      const firstError = invoiceRes.error?.message ?? detailsRes.error?.message;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      const invoiceRow = (invoiceRes.data as InvoiceDemoRow | null) ?? null;
      setInvoice(invoiceRow);
      setDetails((detailsRes.data as DetailRow[] | null) ?? []);

      if (invoiceRow) {
        const { doc, error } = await fetchActiveEDocument(invoiceRow.active_e_document_type, invoiceRow.active_e_document_parasut_id);
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
        <Link to="/satislar/faturalar" className="text-sm text-electric-bright hover:underline">
          ← Satış Faturaları
        </Link>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && invoice === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}
        {!loadError && invoice === null && <p className="mt-6 text-white/50">Fatura bulunamadı (parasut_id: {parasutId}).</p>}

        {invoice && (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">{invoice.invoice_no ?? `#${invoice.parasut_id}`}</h1>
            <p className="mt-1 text-white/60">
              {invoice.contact_parasut_id ? (
                <Link to={`/musteriler/${invoice.contact_parasut_id}`} className="hover:text-electric-bright hover:underline">
                  {invoice.contact_name ?? `#${invoice.contact_parasut_id}`}
                </Link>
              ) : (
                "—"
              )}
            </p>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt ID</dt>
                <dd className="mt-1">{invoice.parasut_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Düzenleme tarihi</dt>
                <dd className="mt-1">{invoice.issue_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vade tarihi</dt>
                <dd className="mt-1">{invoice.due_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Net toplam</dt>
                <dd className="mt-1">{formatAmount(invoice.net_total, invoice.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Brüt toplam</dt>
                <dd className="mt-1">{formatAmount(invoice.gross_total, invoice.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">KDV</dt>
                <dd className="mt-1">{formatAmount(invoice.total_vat, invoice.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">İndirim</dt>
                <dd className="mt-1">{formatAmount(invoice.total_discount, invoice.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Kalan</dt>
                <dd className="mt-1">{formatAmount(invoice.remaining, invoice.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Ödeme durumu</dt>
                <dd className="mt-1">{invoice.payment_status ? PAYMENT_LABELS[invoice.payment_status] ?? invoice.payment_status : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vergi dairesi</dt>
                <dd className="mt-1">{invoice.tax_office ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vergi no</dt>
                <dd className="mt-1">{invoice.tax_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Şehir / İlçe</dt>
                <dd className="mt-1">{[invoice.city, invoice.district].filter(Boolean).join(" / ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Arşivlendi mi</dt>
                <dd className="mt-1">{invoice.archived ? "Evet" : "Hayır"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Son sync</dt>
                <dd className="mt-1">{new Date(invoice.synced_at).toLocaleString("tr-TR")}</dd>
              </div>
              {invoice.invoice_note && (
                <div className="sm:col-span-3">
                  <dt className="text-xs uppercase tracking-wide text-white/50">Not</dt>
                  <dd className="mt-1">{invoice.invoice_note}</dd>
                </div>
              )}
            </dl>

            <h2 className="mt-8 text-lg font-semibold">Fatura kalemleri</h2>
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
                        <td className="px-4 py-2 text-white/70">{formatAmount(d.unit_price, invoice.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{d.vat_rate ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(d.net_total, invoice.currency)}</td>
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

export default FaturaDetay;
