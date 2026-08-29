import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { E_DOCUMENT_TYPE_LABELS } from "@/lib/eDocuments";

interface InvoiceDemoRow {
  parasut_id: number;
  invoice_no: string | null;
  item_type: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  net_total: number | null;
  gross_total: number | null;
  total_vat: number | null;
  remaining: number | null;
  payment_status: string | null;
  archived: boolean | null;
  contact_parasut_id: number | null;
  contact_name: string | null;
  active_e_document_type: string | null;
}

// Phase 14.4: "cancelled" is a real, separate item_type value from the API
// -- a cancelled invoice can have archived=false, same as an active one, so
// this must be its own filter, never derived from/confused with archived.
type ArchivedFilter = "active" | "archived" | "cancelled" | "all";
type PaymentFilter = "all" | "paid" | "overdue" | "unpaid" | "partially_paid";

const ARCHIVED_FILTERS: { value: ArchivedFilter; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "archived", label: "Arşivli" },
  { value: "cancelled", label: "İptal" },
  { value: "all", label: "Tümü" },
];

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

const Faturalar = () => {
  const [archivedFilter, setArchivedFilter] = useState<ArchivedFilter>("active");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [invoices, setInvoices] = useState<InvoiceDemoRow[] | null>(null);
  const [counts, setCounts] = useState<{ active: number; archived: number; cancelled: number; all: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Tab counts come from a single-row aggregate view (count(*) filter (...)
  // done in SQL), not from fetching real rows and counting them client-side
  // -- that approach silently truncates past PostgREST's default
  // max-rows=1000 (already observed on products/e_invoices). An aggregate
  // query returns exactly one row no matter how many real records exist,
  // so it's never subject to that row cap.
  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.from("parasut_sales_invoice_counts_demo").select("*").maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      const row = data as { active_count: number; archived_count: number; cancelled_count: number; total_count: number } | null;
      if (!row) {
        setLoadError("Sayaç verisi alınamadı.");
        return;
      }
      // active_count from the view is a raw archived=false count, which
      // still includes cancelled invoices (a cancelled invoice can have
      // archived=false too) -- subtract cancelled_count here so the "Aktif"
      // tab label never shows a cancelled invoice as if it were active.
      setCounts({
        active: row.active_count - row.cancelled_count,
        archived: row.archived_count,
        cancelled: row.cancelled_count,
        all: row.total_count,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    (async () => {
      let listQuery = supabase
        .from("parasut_sales_invoices_demo")
        .select(
          "parasut_id, invoice_no, item_type, issue_date, due_date, currency, net_total, gross_total, total_vat, remaining, payment_status, archived, contact_parasut_id, contact_name, active_e_document_type",
        );
      // "cancelled" is item_type="cancelled" (real API field), never derived
      // from archived -- a cancelled invoice can independently be
      // archived=false or =true. "active"/"archived" both explicitly
      // exclude cancelled invoices so a cancelled record is never shown
      // mixed into either tab.
      if (archivedFilter === "active") listQuery = listQuery.eq("archived", false).neq("item_type", "cancelled");
      if (archivedFilter === "archived") listQuery = listQuery.eq("archived", true).neq("item_type", "cancelled");
      if (archivedFilter === "cancelled") listQuery = listQuery.eq("item_type", "cancelled");
      if (paymentFilter !== "all") listQuery = listQuery.eq("payment_status", paymentFilter);
      if (fromDate) listQuery = listQuery.gte("issue_date", fromDate);
      if (toDate) listQuery = listQuery.lte("issue_date", toDate);

      const { data, error } = await listQuery;
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setInvoices((data as InvoiceDemoRow[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [archivedFilter, paymentFilter, fromDate, toDate]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="text-sm text-electric-bright hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Satış Faturaları</h1>
        <p className="mt-1 text-white/60">Paraşüt'ten senkronize edilen gerçek satış faturaları.</p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <Link to="/satislar/e-fatura-mukellefleri" className="text-electric-bright hover:underline">
            E-Fatura mükellef sorgulama →
          </Link>
          <Link to="/satislar/e-faturalar" className="text-electric-bright hover:underline">
            Tüm e-Faturalar →
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-wrap gap-2">
            {ARCHIVED_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setArchivedFilter(f.value)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  archivedFilter === f.value
                    ? "border-electric-bright bg-electric-bright/10 text-electric-bright"
                    : "border-white/15 text-white/60 hover:text-white"
                }`}
              >
                {f.label} {counts ? `(${counts[f.value === "all" ? "all" : f.value]})` : ""}
              </button>
            ))}
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
            className="w-full min-w-0 rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white sm:w-auto"
          >
            <option value="all">Tüm ödeme durumları</option>
            <option value="paid">Ödendi</option>
            <option value="overdue">Vadesi geçti</option>
            <option value="unpaid">Ödenmedi</option>
            <option value="partially_paid">Kısmi ödendi</option>
          </select>

          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-white/60">
            <label htmlFor="fromDate" className="shrink-0">
              Tarih:
            </label>
            <input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-navy-deep px-2 py-1 text-white sm:flex-none"
            />
            <span className="shrink-0">–</span>
            <input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-navy-deep px-2 py-1 text-white sm:flex-none"
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
            {invoices === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : invoices.length === 0 ? (
              <p className="text-white/50">Bu filtrede fatura yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Fatura No</th>
                      <th className="px-4 py-2 font-medium">Müşteri</th>
                      <th className="px-4 py-2 font-medium">Düzenleme</th>
                      <th className="px-4 py-2 font-medium">Vade</th>
                      <th className="px-4 py-2 font-medium">Net</th>
                      <th className="px-4 py-2 font-medium">Brüt</th>
                      <th className="px-4 py-2 font-medium">KDV</th>
                      <th className="px-4 py-2 font-medium">Kalan</th>
                      <th className="px-4 py-2 font-medium">Ödeme Durumu</th>
                      <th className="px-4 py-2 font-medium">Fatura Türü</th>
                      <th className="px-4 py-2 font-medium">E-Belge</th>
                      <th className="px-4 py-2 font-medium">Arşiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          <Link to={`/satislar/faturalar/${inv.parasut_id}`} className="hover:text-electric-bright hover:underline">
                            {inv.invoice_no ?? `#${inv.parasut_id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {inv.contact_parasut_id ? (
                            <Link to={`/musteriler/${inv.contact_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {inv.contact_name ?? `#${inv.contact_parasut_id}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">{inv.issue_date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{inv.due_date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(inv.net_total, inv.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(inv.gross_total, inv.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(inv.total_vat, inv.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(inv.remaining, inv.currency)}</td>
                        <td className="px-4 py-2 text-white/70">
                          {inv.payment_status ? PAYMENT_LABELS[inv.payment_status] ?? inv.payment_status : "—"}
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {inv.item_type === "cancelled" ? (
                            <span className="text-red-300">İptal Edildi</span>
                          ) : (
                            inv.item_type ?? "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {inv.active_e_document_type ? E_DOCUMENT_TYPE_LABELS[inv.active_e_document_type] ?? inv.active_e_document_type : "—"}
                        </td>
                        <td className="px-4 py-2 text-white/70">{inv.archived == null ? "—" : inv.archived ? "Arşivli" : "Arşivsiz"}</td>
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

export default Faturalar;
