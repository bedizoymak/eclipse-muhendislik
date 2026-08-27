import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveEDocumentUrl } from "@/lib/eDocuments";

interface ShipmentDocumentDemoRow {
  parasut_id: number;
  description: string | null;
  uuid: string | null;
  despatch_no: string | null;
  order_no: string | null;
  order_date: string | null;
  status: string | null;
  status_message: string | null;
  status_changed_at: string | null;
  shipment_document_type: string | null;
  inflow: boolean | null;
  is_commercial: boolean | null;
  issue_date: string | null;
  issue_datetime: string | null;
  shipment_date: string | null;
  printed_issue_date: string | null;
  printed_at: string | null;
  print_note: string | null;
  legalized_at: string | null;
  sharings_count: number | null;
  has_invoice: boolean | null;
  invoice_no: string | null;
  procurement_number: string | null;
  carrier_legal_name: string | null;
  carrier_tax_number: string | null;
  carrier_license_plate: string | null;
  drivers_info: unknown;
  address: string | null;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  company_address: string | null;
  company_city: string | null;
  company_district: string | null;
  company_postal_code: string | null;
  archived: boolean | null;
  contact_parasut_id: number | null;
  contact_name: string | null;
  warehouse_transfer_parasut_id: number | null;
  e_despatch_response_type: string | null;
  e_despatch_response_parasut_id: number | null;
  inbound_e_despatch_parasut_id: number | null;
  print_url: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

interface InvoiceLinkRow {
  sales_invoice_parasut_id: number;
  sales_invoice_no: string | null;
}

interface InboundEDespatchRow {
  parasut_id: number;
  uuid: string | null;
  despatch_no: string | null;
  contact_name: string | null;
  issue_date: string | null;
  from_tax_number: string | null;
  response_status: string | null;
  response_type: string | null;
  expires_at: string | null;
  is_expired: boolean | null;
}

interface StockMovementRow {
  parasut_id: number;
  date: string | null;
  quantity: number | null;
  product_parasut_id: number | null;
  product_name: string | null;
  warehouse_parasut_id: number | null;
  warehouse_name: string | null;
}

interface ActivityRow {
  parasut_id: number;
  activity_type: string | null;
  date: string | null;
  data_description: string | null;
  data_issue_date: string | null;
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
  new_shipment_document: "İrsaliye oluşturuldu",
  shipment_document_update: "İrsaliye güncellendi",
  shipment_document_legalize: "İrsaliye onaylandı",
  shipment_document_archived: "İrsaliye arşivlendi",
};


function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "string" && value.trim() === "") return "—";
  return String(value);
}

function formatApiTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString("tr-TR", { timeZone: "UTC" })} UTC`;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-white/50">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{title}</p>
      <dl className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">{children}</dl>
    </div>
  );
}

const SevkiyatDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [doc, setDoc] = useState<ShipmentDocumentDemoRow | null | undefined>(undefined);
  const [inbound, setInbound] = useState<InboundEDespatchRow | null>(null);
  const [movements, setMovements] = useState<StockMovementRow[] | null>(null);
  const [activities, setActivities] = useState<ActivityRow[] | null>(null);
  const [invoiceLinks, setInvoiceLinks] = useState<InvoiceLinkRow[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;

    let cancelled = false;

    (async () => {
      const [docRes, movementsRes, activitiesRes, invoiceLinksRes] = await Promise.all([
        supabase.from("parasut_shipment_documents_demo").select("*").eq("parasut_id", parasutId).maybeSingle(),
        supabase
          .from("parasut_stock_movements_demo")
          .select("parasut_id, date, quantity, product_parasut_id, product_name, warehouse_parasut_id, warehouse_name")
          .eq("source_type", "shipment_documents")
          .eq("source_parasut_id", parasutId),
        supabase
          .from("parasut_shipment_document_activities_demo")
          .select(
            "parasut_id, activity_type, date, data_description, data_issue_date, done_by_email, done_by_parasut_id, done_by_type, done_by_name, done_by_user_email, item_parasut_id, item_type, parasut_created_at, parasut_updated_at",
          )
          .eq("shipment_document_parasut_id", parasutId),
        supabase
          .from("parasut_shipment_document_invoices_demo")
          .select("sales_invoice_parasut_id, sales_invoice_no")
          .eq("shipment_document_parasut_id", parasutId),
      ]);

      if (cancelled) return;

      const firstError = docRes.error?.message ?? movementsRes.error?.message ?? activitiesRes.error?.message ?? invoiceLinksRes.error?.message;
      if (firstError) {
        setLoadError(firstError);
        return;
      }

      const docRow = (docRes.data as ShipmentDocumentDemoRow | null) ?? null;
      setDoc(docRow);
      setMovements((movementsRes.data as StockMovementRow[] | null) ?? []);
      setActivities((activitiesRes.data as ActivityRow[] | null) ?? []);
      setInvoiceLinks((invoiceLinksRes.data as InvoiceLinkRow[] | null) ?? []);

      if (docRow?.inbound_e_despatch_parasut_id) {
        const { data, error } = await supabase
          .from("parasut_inbound_e_despatches_demo")
          .select("parasut_id, uuid, despatch_no, contact_name, issue_date, from_tax_number, response_status, response_type, expires_at, is_expired")
          .eq("parasut_id", docRow.inbound_e_despatch_parasut_id)
          .maybeSingle();
        if (!cancelled && !error) setInbound((data as InboundEDespatchRow | null) ?? null);
      } else {
        setInbound(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link to="/stok/sevkiyat-irsaliyeleri" className="text-sm text-electric-bright hover:underline">
          ← Sevkiyat İrsaliyeleri
        </Link>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && doc === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}
        {!loadError && doc === null && <p className="mt-6 text-white/50">İrsaliye bulunamadı (parasut_id: {parasutId}).</p>}

        {doc && (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">{doc.despatch_no ?? doc.description ?? `#${doc.parasut_id}`}</h1>
            <p className="mt-1 text-white/60">
              {doc.contact_parasut_id ? (
                <Link to={`/musteriler/${doc.contact_parasut_id}`} className="hover:text-electric-bright hover:underline">
                  {doc.contact_name ?? `#${doc.contact_parasut_id}`}
                </Link>
              ) : (
                "—"
              )}
            </p>

            <Group title="Genel">
              <Field label="Paraşüt ID" value={doc.parasut_id} />
              <Field label="Açıklama" value={formatValue(doc.description)} />
              <Field label="Belge no (despatch_no)" value={formatValue(doc.despatch_no)} />
              <Field label="Yön" value={doc.inflow ? "Giriş" : "Çıkış"} />
              <Field label="İrsaliye tipi" value={formatValue(doc.shipment_document_type)} />
              <Field label="Ticari mi" value={formatValue(doc.is_commercial)} />
              <Field label="Arşivlendi mi" value={formatValue(doc.archived)} />
              <Field label="Düzenleme tarihi" value={formatValue(doc.issue_date)} />
              <Field label="Sevkiyat tarihi (UTC)" value={formatApiTimestamp(doc.shipment_date)} />
            </Group>

            <Group title="Durum ve belge">
              <Field label="Durum (status)" value={formatValue(doc.status)} />
              <Field label="Durum mesajı" value={formatValue(doc.status_message)} />
              <Field label="Durum değişim zamanı" value={formatApiTimestamp(doc.status_changed_at)} />
              <Field label="Onaylandı (legalized_at)" value={formatApiTimestamp(doc.legalized_at)} />
              <Field label="Faturası var mı" value={formatValue(doc.has_invoice)} />
              <Field label="Fatura no" value={formatValue(doc.invoice_no)} />
              <Field label="Sipariş no" value={formatValue(doc.order_no)} />
              <Field label="Sipariş tarihi" value={formatValue(doc.order_date)} />
              <Field label="Tedarik no (procurement_number)" value={formatValue(doc.procurement_number)} />
              <Field label="Paylaşım sayısı" value={formatValue(doc.sharings_count)} />
            </Group>

            <Group title="Bağlantılar">
              <Field
                label="Müşteri (contact)"
                value={
                  doc.contact_parasut_id ? (
                    <Link to={`/musteriler/${doc.contact_parasut_id}`} className="text-electric-bright hover:underline">
                      {doc.contact_name ?? `#${doc.contact_parasut_id}`}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Depo transferi (warehouse_transfer)" value={formatValue(doc.warehouse_transfer_parasut_id)} />
              <Field label="e-İrsaliye yanıtı (e_despatch_response)" value={formatValue(doc.e_despatch_response_parasut_id)} />
            </Group>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-4 text-xs text-electric-bright hover:underline"
            >
              {expanded ? "Diğer alanları gizle" : "Tüm irsaliye alanlarını göster"}
            </button>

            {expanded && (
              <>
                <Group title="Taşıyıcı">
                  <Field label="Taşıyıcı unvanı" value={formatValue(doc.carrier_legal_name)} />
                  <Field label="Taşıyıcı VKN" value={formatValue(doc.carrier_tax_number)} />
                  <Field label="Plaka" value={formatValue(doc.carrier_license_plate)} />
                  <Field label="Sürücü bilgisi" value={doc.drivers_info ? JSON.stringify(doc.drivers_info) : "—"} />
                </Group>

                <Group title="Adres">
                  <Field label="Adres" value={formatValue(doc.address)} />
                  <Field label="Şehir" value={formatValue(doc.city)} />
                  <Field label="İlçe" value={formatValue(doc.district)} />
                  <Field label="Posta kodu" value={formatValue(doc.postal_code)} />
                  <Field label="Şirket adresi" value={formatValue(doc.company_address)} />
                  <Field label="Şirket şehri" value={formatValue(doc.company_city)} />
                  <Field label="Şirket ilçesi" value={formatValue(doc.company_district)} />
                  <Field label="Şirket posta kodu" value={formatValue(doc.company_postal_code)} />
                </Group>

                <Group title="Yazdırma ve zaman damgaları">
                  <Field label="uuid" value={<span className="break-all">{formatValue(doc.uuid)}</span>} />
                  <Field label="issue_datetime (UTC)" value={formatApiTimestamp(doc.issue_datetime)} />
                  <Field label="Yazdırılma tarihi" value={formatApiTimestamp(doc.printed_at)} />
                  <Field label="Yazdırılan düzenleme tarihi" value={formatValue(doc.printed_issue_date)} />
                  <Field label="Yazdırma notu" value={formatValue(doc.print_note)} />
                  <Field
                    label="Yazdırma bağlantısı (print_url)"
                    value={
                      resolveEDocumentUrl(doc.print_url) ? (
                        <a
                          href={resolveEDocumentUrl(doc.print_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-electric-bright hover:underline"
                        >
                          Yazdırma sayfasını aç
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Field label="Paraşüt'te oluşturulma" value={formatApiTimestamp(doc.parasut_created_at)} />
                  <Field label="Paraşüt'te güncellenme" value={formatApiTimestamp(doc.parasut_updated_at)} />
                  <Field label="Son sync" value={new Date(doc.synced_at).toLocaleString("tr-TR")} />
                </Group>

                <Group title="Bağlı satış faturaları (invoices)">
                  {invoiceLinks === null ? (
                    <Field label="Durum" value="Yükleniyor…" />
                  ) : invoiceLinks.length === 0 ? (
                    <Field label="Durum" value="Bağlı satış faturası yok." />
                  ) : (
                    invoiceLinks.map((link) => (
                      <Field
                        key={link.sales_invoice_parasut_id}
                        label="Satış faturası"
                        value={
                          <Link
                            to={`/satislar/faturalar/${link.sales_invoice_parasut_id}`}
                            className="text-electric-bright hover:underline"
                          >
                            {link.sales_invoice_no ?? `#${link.sales_invoice_parasut_id}`}
                          </Link>
                        }
                      />
                    ))
                  )}
                </Group>
              </>
            )}

            <div className="mt-8">
              <h2 className="text-lg font-semibold">Gelen e-İrsaliye (inbound_e_despatch)</h2>
              {!doc.inbound_e_despatch_parasut_id ? (
                <p className="mt-2 text-white/50">İlişkili gelen e-irsaliye yok.</p>
              ) : inbound === null ? (
                <p className="mt-2 text-white/50">Yükleniyor…</p>
              ) : (
                <dl className="mt-3 grid grid-cols-1 gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
                  <Field label="Paraşüt ID" value={inbound.parasut_id} />
                  <Field label="Belge no" value={formatValue(inbound.despatch_no)} />
                  <Field label="uuid" value={<span className="break-all">{formatValue(inbound.uuid)}</span>} />
                  <Field label="Gönderen" value={formatValue(inbound.contact_name)} />
                  <Field label="Gönderen VKN" value={formatValue(inbound.from_tax_number)} />
                  <Field label="Düzenleme tarihi (UTC)" value={formatApiTimestamp(inbound.issue_date)} />
                  <Field label="Yanıt durumu" value={formatValue(inbound.response_status)} />
                  <Field label="Yanıt tipi" value={formatValue(inbound.response_type)} />
                  <Field label="Son geçerlilik (UTC)" value={formatApiTimestamp(inbound.expires_at)} />
                  <Field label="Süresi doldu mu" value={formatValue(inbound.is_expired)} />
                </dl>
              )}
            </div>

            <h2 className="mt-8 text-lg font-semibold">Stok hareketleri</h2>
            {movements === null ? (
              <p className="mt-2 text-white/50">Yükleniyor…</p>
            ) : movements.length === 0 ? (
              <p className="mt-2 text-white/50">İlişkili stok hareketi yok.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Tarih</th>
                      <th className="px-4 py-2 font-medium">Miktar</th>
                      <th className="px-4 py-2 font-medium">Ürün</th>
                      <th className="px-4 py-2 font-medium">Depo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">{formatValue(m.date)}</td>
                        <td className="px-4 py-2 text-white/70">{formatValue(m.quantity)}</td>
                        <td className="px-4 py-2 text-white/70">
                          {m.product_parasut_id ? (
                            <Link to={`/urunler/${m.product_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {m.product_name ?? `#${m.product_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">{m.warehouse_name ?? (m.warehouse_parasut_id ? `#${m.warehouse_parasut_id}` : "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="mt-8 text-lg font-semibold">Durum geçmişi</h2>
            <p className="mt-1 text-xs text-white/40">
              Paraşüt'ün tekil irsaliye uç noktasının döndürdüğü gerçek <code>activities</code> ilişkisi (liste uç noktası bu ilişkiyi reddeder).
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
                      <Field label="Activity Paraşüt ID" value={act.parasut_id} />
                      <Field
                        label="Yapan (done_by)"
                        value={
                          act.done_by_parasut_id ? (
                            <>
                              {act.done_by_name ?? `#${act.done_by_parasut_id}`}
                              {act.done_by_user_email && <span className="text-white/50"> ({act.done_by_user_email})</span>}
                            </>
                          ) : (
                            "—"
                          )
                        }
                      />
                      <Field
                        label="İlgili kayıt (item)"
                        value={
                          act.item_parasut_id && act.item_type === "shipment_documents" ? (
                            <Link to={`/stok/sevkiyat-irsaliyeleri/${act.item_parasut_id}`} className="text-electric-bright hover:underline">
                              #{act.item_parasut_id}
                            </Link>
                          ) : act.item_parasut_id ? (
                            `${act.item_type ?? "?"} #${act.item_parasut_id}`
                          ) : (
                            "—"
                          )
                        }
                      />
                      <Field label="done_by_email (activity alanı)" value={formatValue(act.done_by_email)} />
                      <Field label="Paraşüt'te oluşturulma" value={formatApiTimestamp(act.parasut_created_at)} />
                      <Field label="Paraşüt'te güncellenme" value={formatApiTimestamp(act.parasut_updated_at)} />
                      <Field label="Açıklama (data.description)" value={formatValue(act.data_description)} />
                      <Field label="Düzenleme tarihi (data.issue_date)" value={formatValue(act.data_issue_date)} />
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

export default SevkiyatDetay;
