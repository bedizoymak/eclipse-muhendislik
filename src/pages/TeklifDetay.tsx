import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface OfferDemoRow {
  parasut_id: number;
  description: string | null;
  content: string | null;
  status: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  exchange_rate: number | null;
  net_total: number | null;
  net_total_in_trl: number | null;
  gross_total: number | null;
  total_vat: number | null;
  total_discount: number | null;
  total_invoice_discount: number | null;
  invoice_discount_type: string | null;
  invoice_discount: number | null;
  withholding: number | null;
  withholding_rate: number | null;
  vat_withholding: number | null;
  vat_withholding_rate: number | null;
  total_vat_withholding: number | null;
  total_excise_duty: number | null;
  total_communications_tax: number | null;
  total_accommodation_tax: number | null;
  billing_address: string | null;
  billing_phone: string | null;
  billing_fax: string | null;
  tax_office: string | null;
  tax_number: string | null;
  city: string | null;
  district: string | null;
  is_abroad: boolean | null;
  order_no: string | null;
  order_date: string | null;
  sharings_count: number | null;
  contact_type: string | null;
  archived: boolean | null;
  contact_parasut_id: number | null;
  contact_name: string | null;
  sales_invoice_parasut_id: number | null;
  sales_invoice_no: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

interface DetailRow {
  parasut_id: number;
  description: string | null;
  detail_no: number | null;
  quantity: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  discount_type: string | null;
  discount_value: number | null;
  net_total: number | null;
  product_parasut_id: number | null;
  product_name: string | null;
}

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

const TeklifDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [offer, setOffer] = useState<OfferDemoRow | null | undefined>(undefined);
  const [details, setDetails] = useState<DetailRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;

    let cancelled = false;

    (async () => {
      const [offerRes, detailsRes] = await Promise.all([
        supabase
          .from("parasut_sales_offers_demo")
          .select("*")
          .eq("parasut_id", parasutId)
          .maybeSingle(),
        supabase
          .from("parasut_sales_offer_details_demo")
          .select(
            "parasut_id, description, detail_no, quantity, unit_price, vat_rate, discount_type, discount_value, net_total, product_parasut_id, product_name",
          )
          .eq("sales_offer_parasut_id", parasutId),
      ]);

      if (cancelled) return;

      const firstError = offerRes.error?.message ?? detailsRes.error?.message;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      setOffer((offerRes.data as OfferDemoRow | null) ?? null);
      setDetails((detailsRes.data as DetailRow[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link to="/satislar/teklifler" className="text-sm text-electric-bright hover:underline">
          ← Satış Teklifleri
        </Link>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && offer === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}
        {!loadError && offer === null && <p className="mt-6 text-white/50">Teklif bulunamadı (parasut_id: {parasutId}).</p>}

        {offer && (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">{offer.description?.trim() || `#${offer.parasut_id}`}</h1>
            <p className="mt-1 text-white/60">
              {offer.contact_parasut_id ? (
                <Link to={`/musteriler/${offer.contact_parasut_id}`} className="hover:text-electric-bright hover:underline">
                  {offer.contact_name ?? `#${offer.contact_parasut_id}`}
                </Link>
              ) : (
                "—"
              )}
            </p>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt ID</dt>
                <dd className="mt-1">{offer.parasut_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Durum</dt>
                <dd className="mt-1">{offer.status ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Düzenleme tarihi</dt>
                <dd className="mt-1">{offer.issue_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Geçerlilik tarihi</dt>
                <dd className="mt-1">{offer.due_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Net toplam</dt>
                <dd className="mt-1">{formatAmount(offer.net_total, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Net toplam (TL)</dt>
                <dd className="mt-1">{formatAmount(offer.net_total_in_trl, "TL")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Brüt toplam</dt>
                <dd className="mt-1">{formatAmount(offer.gross_total, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">KDV</dt>
                <dd className="mt-1">{formatAmount(offer.total_vat, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">İndirim</dt>
                <dd className="mt-1">{formatAmount(offer.total_discount, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Fatura indirimi</dt>
                <dd className="mt-1">{formatAmount(offer.total_invoice_discount, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Stopaj</dt>
                <dd className="mt-1">{formatAmount(offer.withholding, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vergi dairesi</dt>
                <dd className="mt-1">{offer.tax_office ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vergi no</dt>
                <dd className="mt-1">{offer.tax_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Şehir / İlçe</dt>
                <dd className="mt-1">{[offer.city, offer.district].filter(Boolean).join(" / ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Sipariş no</dt>
                <dd className="mt-1">{offer.order_no ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Sipariş tarihi</dt>
                <dd className="mt-1">{offer.order_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paylaşım sayısı</dt>
                <dd className="mt-1">{offer.sharings_count ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Bağlı satış faturası</dt>
                <dd className="mt-1">
                  {offer.sales_invoice_parasut_id ? (
                    <Link to={`/satislar/faturalar/${offer.sales_invoice_parasut_id}`} className="text-electric-bright hover:underline">
                      {offer.sales_invoice_no ?? `#${offer.sales_invoice_parasut_id}`}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Arşivlendi mi</dt>
                <dd className="mt-1">{offer.archived ? "Evet" : "Hayır"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te oluşturulma</dt>
                <dd className="mt-1">{formatApiTimestamp(offer.parasut_created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te güncellenme</dt>
                <dd className="mt-1">{formatApiTimestamp(offer.parasut_updated_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Son sync</dt>
                <dd className="mt-1">{new Date(offer.synced_at).toLocaleString("tr-TR")}</dd>
              </div>
              {offer.content && (
                <div className="sm:col-span-3">
                  <dt className="text-xs uppercase tracking-wide text-white/50">İçerik</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{offer.content}</dd>
                </div>
              )}
            </dl>

            <h2 className="mt-8 text-lg font-semibold">Teklif kalemleri</h2>
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
                        <td className="px-4 py-2">
                          {d.product_parasut_id ? (
                            <Link to={`/urunler/${d.product_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {d.product_name ?? `#${d.product_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">{d.description?.trim() || "—"}</td>
                        <td className="px-4 py-2 text-white/70">{d.quantity ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(d.unit_price, offer.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{d.vat_rate ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(d.net_total, offer.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeklifDetay;
