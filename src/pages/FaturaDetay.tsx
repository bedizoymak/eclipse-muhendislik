import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { E_DOCUMENT_TYPE_LABELS, fetchActiveEDocument, type EDocument } from "@/lib/eDocuments";

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

// Displays the API's own timestamp as-is -- formatting only, never shifting
// the underlying instant to the browser's local timezone.
function formatApiTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString("tr-TR", { timeZone: "UTC" })} UTC`;
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

            <h2 className="mt-8 text-lg font-semibold">E-Belge</h2>
            {eDoc === undefined ? (
              <p className="mt-2 text-white/50">Yükleniyor…</p>
            ) : eDoc === null ? (
              <p className="mt-2 text-white/50">E-belge yok.</p>
            ) : eDoc.kind === "e_invoices" ? (
              <dl className="mt-3 grid grid-cols-1 gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Belge tipi</dt>
                  <dd className="mt-1">{E_DOCUMENT_TYPE_LABELS.e_invoices}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Belge Paraşüt ID</dt>
                  <dd className="mt-1">{eDoc.row.parasut_id}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Durum</dt>
                  <dd className="mt-1">{eDoc.row.status ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Belge no (external_id)</dt>
                  <dd className="mt-1">{eDoc.row.external_id ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">UUID</dt>
                  <dd className="mt-1 break-all">{eDoc.row.uuid ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Yön</dt>
                  <dd className="mt-1">{eDoc.row.direction ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Senaryo</dt>
                  <dd className="mt-1">{eDoc.row.scenario ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Düzenleme tarihi</dt>
                  <dd className="mt-1">{eDoc.row.issue_date ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Son geçerlilik</dt>
                  <dd className="mt-1">{eDoc.row.expires_at ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Net toplam</dt>
                  <dd className="mt-1">{formatAmount(eDoc.row.net_total, eDoc.row.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">KDV</dt>
                  <dd className="mt-1">{formatAmount(eDoc.row.total_vat, eDoc.row.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Gönderen VKN</dt>
                  <dd className="mt-1">{eDoc.row.from_vkn ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Alıcı VKN</dt>
                  <dd className="mt-1">{eDoc.row.to_vkn ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te oluşturulma</dt>
                  <dd className="mt-1">{formatApiTimestamp(eDoc.row.parasut_created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te güncellenme</dt>
                  <dd className="mt-1">{formatApiTimestamp(eDoc.row.parasut_updated_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">PDF</dt>
                  <dd className="mt-1">
                    {eDoc.row.pdf_url ? (
                      <a href={eDoc.row.pdf_url} target="_blank" rel="noopener noreferrer" className="text-electric-bright hover:underline">
                        PDF'i görüntüle
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">İmzalı UBL</dt>
                  <dd className="mt-1">
                    {eDoc.row.signed_ubl_url ? (
                      <a href={eDoc.row.signed_ubl_url} target="_blank" rel="noopener noreferrer" className="text-electric-bright hover:underline">
                        UBL'i görüntüle
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <dl className="mt-3 grid grid-cols-1 gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Belge tipi</dt>
                  <dd className="mt-1">{E_DOCUMENT_TYPE_LABELS.e_archives}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Belge Paraşüt ID</dt>
                  <dd className="mt-1">{eDoc.row.parasut_id}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Durum</dt>
                  <dd className="mt-1">{eDoc.row.status ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Fatura no</dt>
                  <dd className="mt-1">{eDoc.row.invoice_number ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">UUID</dt>
                  <dd className="mt-1 break-all">{eDoc.row.uuid ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">VKN</dt>
                  <dd className="mt-1">{eDoc.row.vkn ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Yazdırıldı mı</dt>
                  <dd className="mt-1">{eDoc.row.is_printed ? "Evet" : "Hayır"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">İmzalı mı</dt>
                  <dd className="mt-1">{eDoc.row.is_signed ? "Evet" : "Hayır"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Yazdırılma tarihi</dt>
                  <dd className="mt-1">{formatApiTimestamp(eDoc.row.printed_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">İptal edilebilirlik son tarihi</dt>
                  <dd className="mt-1">{formatApiTimestamp(eDoc.row.cancellable_until)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te oluşturulma</dt>
                  <dd className="mt-1">{formatApiTimestamp(eDoc.row.parasut_created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te güncellenme</dt>
                  <dd className="mt-1">{formatApiTimestamp(eDoc.row.parasut_updated_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">PDF</dt>
                  <dd className="mt-1">
                    {eDoc.row.pdf_url ? (
                      <a href={eDoc.row.pdf_url} target="_blank" rel="noopener noreferrer" className="text-electric-bright hover:underline">
                        PDF'i görüntüle
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/50">İmzalı UBL</dt>
                  <dd className="mt-1">
                    {eDoc.row.signed_ubl_url ? (
                      <a href={eDoc.row.signed_ubl_url} target="_blank" rel="noopener noreferrer" className="text-electric-bright hover:underline">
                        UBL'i görüntüle
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FaturaDetay;
