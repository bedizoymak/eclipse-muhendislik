import { Fragment, useEffect, useState } from "react";
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
  display_exchange_rate_in_pdf: boolean | null;
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
  net_total: number | null;
  net_total_without_invoice_discount: number | null;
  discount_type: string | null;
  discount_value: number | null;
  discount: number | null;
  invoice_discount: number | null;
  excise_duty_type: string | null;
  excise_duty_value: number | null;
  excise_duty: number | null;
  excise_duty_rate: number | null;
  communications_tax_rate: number | null;
  communications_tax: number | null;
  vat_withholding: number | null;
  vat_withholding_rate: number | null;
  accommodation_tax_rate: number | null;
  accommodation_tax: number | null;
  accommodation_tax_exempt: boolean | null;
  product_parasut_id: number | null;
  product_name: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
}

interface ActivityRow {
  parasut_id: number;
  activity_type: string | null;
  date: string | null;
  data_description: string | null;
  data_issue_date: string | null;
  data_due_date: string | null;
  data_net_total: number | null;
  data_currency: string | null;
  data_content: string | null;
  data_status: string | null;
  data_contact_id: number | null;
  data_contact_name: string | null;
  done_by_email: string | null;
  done_by_parasut_id: number | null;
  done_by_type: string | null;
  done_by_name: string | null;
  done_by_user_email: string | null;
  item_parasut_id: number | null;
  item_type: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
}

const ACTIVITY_LABELS: Record<string, string> = {
  new_sales_offer: "Teklif oluşturuldu",
  sales_offer_status_updated: "Durum güncellendi",
};

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

function formatValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "string" && value.trim() === "") return "—";
  return String(value);
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
  const [activities, setActivities] = useState<ActivityRow[] | null>(null);
  const [expandedDetailId, setExpandedDetailId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;

    let cancelled = false;

    (async () => {
      const [offerRes, detailsRes, activitiesRes] = await Promise.all([
        supabase
          .from("parasut_sales_offers_demo")
          .select("*")
          .eq("parasut_id", parasutId)
          .maybeSingle(),
        supabase
          .from("parasut_sales_offer_details_demo")
          .select("*")
          .eq("sales_offer_parasut_id", parasutId),
        supabase
          .from("parasut_sales_offer_activities_demo")
          .select("*")
          .eq("sales_offer_parasut_id", parasutId),
      ]);

      if (cancelled) return;

      const firstError = offerRes.error?.message ?? detailsRes.error?.message ?? activitiesRes.error?.message;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      setOffer((offerRes.data as OfferDemoRow | null) ?? null);
      setDetails((detailsRes.data as DetailRow[] | null) ?? []);
      setActivities((activitiesRes.data as ActivityRow[] | null) ?? []);
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

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-white/50">Genel</h2>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt ID</dt>
                <dd className="mt-1">{offer.parasut_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Açıklama</dt>
                <dd className="mt-1">{formatValue(offer.description)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Durum</dt>
                <dd className="mt-1">{formatValue(offer.status)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Arşivlendi mi</dt>
                <dd className="mt-1">{formatValue(offer.archived)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Düzenleme tarihi</dt>
                <dd className="mt-1">{formatValue(offer.issue_date)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Geçerlilik tarihi</dt>
                <dd className="mt-1">{formatValue(offer.due_date)}</dd>
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
                <dt className="text-xs uppercase tracking-wide text-white/50">Paylaşım sayısı</dt>
                <dd className="mt-1">{formatValue(offer.sharings_count)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">PDF'de kur gösterimi</dt>
                <dd className="mt-1">{formatValue(offer.display_exchange_rate_in_pdf)}</dd>
              </div>
              {offer.content && (
                <div className="sm:col-span-3">
                  <dt className="text-xs uppercase tracking-wide text-white/50">İçerik</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{offer.content}</dd>
                </div>
              )}
            </dl>

            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-white/50">Tutar ve para birimi</h2>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Para birimi</dt>
                <dd className="mt-1">{formatValue(offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Kur</dt>
                <dd className="mt-1">{formatValue(offer.exchange_rate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Brüt toplam</dt>
                <dd className="mt-1">{formatAmount(offer.gross_total, offer.currency)}</dd>
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
                <dt className="text-xs uppercase tracking-wide text-white/50">KDV</dt>
                <dd className="mt-1">{formatAmount(offer.total_vat, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">İndirim</dt>
                <dd className="mt-1">{formatAmount(offer.total_discount, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Fatura indirimi (toplam)</dt>
                <dd className="mt-1">{formatAmount(offer.total_invoice_discount, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Fatura indirimi</dt>
                <dd className="mt-1">{formatAmount(offer.invoice_discount, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Fatura indirimi türü</dt>
                <dd className="mt-1">{formatValue(offer.invoice_discount_type)}</dd>
              </div>
            </dl>

            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-white/50">Stopaj ve vergiler</h2>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Stopaj</dt>
                <dd className="mt-1">{formatAmount(offer.withholding, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Stopaj oranı</dt>
                <dd className="mt-1">{formatValue(offer.withholding_rate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">KDV stopajı</dt>
                <dd className="mt-1">{formatAmount(offer.vat_withholding, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">KDV stopaj oranı</dt>
                <dd className="mt-1">{formatValue(offer.vat_withholding_rate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Toplam KDV stopajı</dt>
                <dd className="mt-1">{formatAmount(offer.total_vat_withholding, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">ÖTV toplamı</dt>
                <dd className="mt-1">{formatAmount(offer.total_excise_duty, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">İletişim vergisi toplamı</dt>
                <dd className="mt-1">{formatAmount(offer.total_communications_tax, offer.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Konaklama vergisi toplamı</dt>
                <dd className="mt-1">{formatAmount(offer.total_accommodation_tax, offer.currency)}</dd>
              </div>
            </dl>

            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-white/50">Fatura / adres bilgileri</h2>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <dt className="text-xs uppercase tracking-wide text-white/50">Fatura adresi</dt>
                <dd className="mt-1">{formatValue(offer.billing_address)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Telefon</dt>
                <dd className="mt-1">{formatValue(offer.billing_phone)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Faks</dt>
                <dd className="mt-1">{formatValue(offer.billing_fax)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Yurt dışı mı</dt>
                <dd className="mt-1">{formatValue(offer.is_abroad)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Şehir</dt>
                <dd className="mt-1">{formatValue(offer.city)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">İlçe</dt>
                <dd className="mt-1">{formatValue(offer.district)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vergi no</dt>
                <dd className="mt-1">{formatValue(offer.tax_number)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Vergi dairesi</dt>
                <dd className="mt-1">{formatValue(offer.tax_office)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Müşteri türü</dt>
                <dd className="mt-1">{formatValue(offer.contact_type)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Sipariş no</dt>
                <dd className="mt-1">{formatValue(offer.order_no)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Sipariş tarihi</dt>
                <dd className="mt-1">{formatValue(offer.order_date)}</dd>
              </div>
            </dl>

            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-white/50">İlişkiler</h2>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Müşteri (contact)</dt>
                <dd className="mt-1">
                  {offer.contact_parasut_id ? (
                    <Link to={`/musteriler/${offer.contact_parasut_id}`} className="text-electric-bright hover:underline">
                      {offer.contact_name ?? `#${offer.contact_parasut_id}`}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
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
                <dt className="text-xs uppercase tracking-wide text-white/50">Son sync</dt>
                <dd className="mt-1">{new Date(offer.synced_at).toLocaleString("tr-TR")}</dd>
              </div>
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
                      <th className="px-4 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d) => (
                      <Fragment key={d.parasut_id}>
                        <tr className="border-t border-white/5">
                          <td className="px-4 py-2">
                            {d.product_parasut_id ? (
                              <Link to={`/urunler/${d.product_parasut_id}`} className="hover:text-electric-bright hover:underline">
                                {d.product_name ?? `#${d.product_parasut_id}`}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2 text-white/70">{formatValue(d.description)}</td>
                          <td className="px-4 py-2 text-white/70">{formatValue(d.quantity)}</td>
                          <td className="px-4 py-2 text-white/70">{formatAmount(d.unit_price, offer.currency)}</td>
                          <td className="px-4 py-2 text-white/70">{formatValue(d.vat_rate)}</td>
                          <td className="px-4 py-2 text-white/70">{formatAmount(d.net_total, offer.currency)}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setExpandedDetailId(expandedDetailId === d.parasut_id ? null : d.parasut_id)}
                              className="text-xs text-electric-bright hover:underline"
                            >
                              {expandedDetailId === d.parasut_id ? "Gizle" : "Detay"}
                            </button>
                          </td>
                        </tr>
                        {expandedDetailId === d.parasut_id && (
                          <tr className="border-t border-white/5 bg-white/5">
                            <td colSpan={7} className="px-4 py-4">
                              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt ID</dt>
                                  <dd className="mt-1">{d.parasut_id}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">Kalem no</dt>
                                  <dd className="mt-1">{formatValue(d.detail_no)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">Net (fatura indirimi öncesi)</dt>
                                  <dd className="mt-1">{formatAmount(d.net_total_without_invoice_discount, offer.currency)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">İndirim türü</dt>
                                  <dd className="mt-1">{formatValue(d.discount_type)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">İndirim değeri</dt>
                                  <dd className="mt-1">{formatValue(d.discount_value)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">İndirim</dt>
                                  <dd className="mt-1">{formatAmount(d.discount, offer.currency)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">Fatura indirimi</dt>
                                  <dd className="mt-1">{formatAmount(d.invoice_discount, offer.currency)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">ÖTV türü</dt>
                                  <dd className="mt-1">{formatValue(d.excise_duty_type)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">ÖTV değeri</dt>
                                  <dd className="mt-1">{formatValue(d.excise_duty_value)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">ÖTV</dt>
                                  <dd className="mt-1">{formatAmount(d.excise_duty, offer.currency)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">ÖTV oranı</dt>
                                  <dd className="mt-1">{formatValue(d.excise_duty_rate)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">İletişim vergisi oranı</dt>
                                  <dd className="mt-1">{formatValue(d.communications_tax_rate)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">İletişim vergisi</dt>
                                  <dd className="mt-1">{formatAmount(d.communications_tax, offer.currency)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">KDV stopajı</dt>
                                  <dd className="mt-1">{formatAmount(d.vat_withholding, offer.currency)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">KDV stopaj oranı</dt>
                                  <dd className="mt-1">{formatValue(d.vat_withholding_rate)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">Konaklama vergisi oranı</dt>
                                  <dd className="mt-1">{formatValue(d.accommodation_tax_rate)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">Konaklama vergisi</dt>
                                  <dd className="mt-1">{formatAmount(d.accommodation_tax, offer.currency)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">Konaklama vergisi muaf mı</dt>
                                  <dd className="mt-1">{formatValue(d.accommodation_tax_exempt)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te oluşturulma</dt>
                                  <dd className="mt-1">{formatApiTimestamp(d.parasut_created_at)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te güncellenme</dt>
                                  <dd className="mt-1">{formatApiTimestamp(d.parasut_updated_at)}</dd>
                                </div>
                              </dl>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="mt-8 text-lg font-semibold">Durum geçmişi</h2>
            <p className="mt-1 text-xs text-white/40">
              Paraşüt'ün tekil teklif uç noktasının (<code>/sales_offers/&#123;id&#125;</code>) döndürdüğü gerçek <code>activities</code> ilişkisi
              (liste uç noktası bu ilişkiyi reddeder, yalnızca tekil uç nokta çözer).
            </p>
            {activities === null ? (
              <p className="mt-2 text-white/50">Yükleniyor…</p>
            ) : activities.length === 0 ? (
              <p className="mt-2 text-white/50">Kayıt yok.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {activities.map((act) => (
                  <div key={act.parasut_id} className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-medium text-white/90">
                        {act.activity_type ? ACTIVITY_LABELS[act.activity_type] ?? act.activity_type : "—"}
                      </span>
                      <span className="text-white/50">{formatApiTimestamp(act.date)}</span>
                    </div>

                    <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Activity Paraşüt ID</dt>
                        <dd className="mt-1">{act.parasut_id}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Yapan (done_by)</dt>
                        <dd className="mt-1">
                          {act.done_by_parasut_id ? (
                            <>
                              {act.done_by_name ?? `#${act.done_by_parasut_id}`}
                              {act.done_by_user_email && <span className="text-white/50"> ({act.done_by_user_email})</span>}
                            </>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">İlgili kayıt (item)</dt>
                        <dd className="mt-1">
                          {act.item_parasut_id && act.item_type === "sales_offers" ? (
                            <Link to={`/satislar/teklifler/${act.item_parasut_id}`} className="text-electric-bright hover:underline">
                              #{act.item_parasut_id}
                            </Link>
                          ) : act.item_parasut_id ? (
                            `${act.item_type ?? "?"} #${act.item_parasut_id}`
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">done_by_email (activity alanı)</dt>
                        <dd className="mt-1">{formatValue(act.done_by_email)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te oluşturulma</dt>
                        <dd className="mt-1">{formatApiTimestamp(act.parasut_created_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt'te güncellenme</dt>
                        <dd className="mt-1">{formatApiTimestamp(act.parasut_updated_at)}</dd>
                      </div>
                    </dl>

                    <p className="mt-3 text-xs uppercase tracking-wide text-white/50">Snapshot (data)</p>
                    <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Durum (status)</dt>
                        <dd className="mt-1">{formatValue(act.data_status)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Açıklama</dt>
                        <dd className="mt-1">{formatValue(act.data_description)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Müşteri</dt>
                        <dd className="mt-1">
                          {act.data_contact_id ? (
                            <Link to={`/musteriler/${act.data_contact_id}`} className="text-electric-bright hover:underline">
                              {act.data_contact_name ?? `#${act.data_contact_id}`}
                            </Link>
                          ) : (
                            formatValue(act.data_contact_name)
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Düzenleme tarihi</dt>
                        <dd className="mt-1">{formatValue(act.data_issue_date)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Geçerlilik tarihi</dt>
                        <dd className="mt-1">{formatValue(act.data_due_date)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-white/50">Net toplam</dt>
                        <dd className="mt-1">{formatAmount(act.data_net_total, act.data_currency)}</dd>
                      </div>
                      {act.data_content && (
                        <div className="sm:col-span-3">
                          <dt className="text-xs uppercase tracking-wide text-white/50">İçerik</dt>
                          <dd className="mt-1 whitespace-pre-wrap">{act.data_content}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeklifDetay;
