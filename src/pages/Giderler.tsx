import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { E_DOCUMENT_TYPE_LABELS } from "@/lib/eDocuments";

interface BillDemoRow {
  parasut_id: number;
  invoice_no: string | null;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  net_total: number | null;
  gross_total: number | null;
  total_vat: number | null;
  total_paid: number | null;
  remaining: number | null;
  payment_status: string | null;
  archived: boolean | null;
  supplier_parasut_id: number | null;
  supplier_name: string | null;
  spender_parasut_id: number | null;
  spender_name: string | null;
  active_e_document_type: string | null;
}

type ArchivedFilter = "active" | "archived" | "all";
type PaymentFilter = "all" | "paid" | "overdue" | "unpaid" | "partially_paid";

const ARCHIVED_FILTERS: { value: ArchivedFilter; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "archived", label: "Arşivli" },
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

const Giderler = () => {
  const [archivedFilter, setArchivedFilter] = useState<ArchivedFilter>("active");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [bills, setBills] = useState<BillDemoRow[] | null>(null);
  const [suppliers, setSuppliers] = useState<{ parasut_id: number; name: string | null }[]>([]);
  const [counts, setCounts] = useState<{ active: number; archived: number; all: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("parasut_suppliers_demo")
      .select("parasut_id, name")
      .then(({ data }) => setSuppliers((data as { parasut_id: number; name: string | null }[] | null) ?? []));
  }, []);

  // Tab counts come from a single-row aggregate view (count(*) filter (...)
  // done in SQL), not from fetching real rows and counting them client-side
  // -- that approach silently truncates past PostgREST's default
  // max-rows=1000 (already observed on products/e_invoices). An aggregate
  // query returns exactly one row no matter how many real records exist.
  // This "archived" value is the real column the /purchase_bills sync
  // stores from each bill's own attribute (the API itself has no
  // filter[archived] for this resource -- see syncPurchaseBills -- but the
  // stored value is real, not invented).
  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.from("parasut_purchase_bill_counts_demo").select("*").maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      const row = data as { active_count: number; archived_count: number; total_count: number } | null;
      if (!row) {
        setLoadError("Sayaç verisi alınamadı.");
        return;
      }
      setCounts({ active: row.active_count, archived: row.archived_count, all: row.total_count });
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
        .from("parasut_purchase_bills_demo")
        .select(
          "parasut_id, invoice_no, description, issue_date, due_date, currency, net_total, gross_total, total_vat, total_paid, remaining, payment_status, archived, supplier_parasut_id, supplier_name, spender_parasut_id, spender_name, active_e_document_type",
        );
      if (archivedFilter === "active") listQuery = listQuery.eq("archived", false);
      if (archivedFilter === "archived") listQuery = listQuery.eq("archived", true);
      if (paymentFilter !== "all") listQuery = listQuery.eq("payment_status", paymentFilter);
      if (supplierFilter) listQuery = listQuery.eq("supplier_parasut_id", supplierFilter);
      if (fromDate) listQuery = listQuery.gte("issue_date", fromDate);
      if (toDate) listQuery = listQuery.lte("issue_date", toDate);

      const { data, error } = await listQuery;
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setBills((data as BillDemoRow[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [archivedFilter, paymentFilter, supplierFilter, fromDate, toDate]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="text-sm text-electric-bright hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Giderler</h1>
        <p className="mt-1 text-white/60">Paraşüt'ten senkronize edilen gerçek alış faturaları / giderler.</p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <Link to="/giderler/tedarikciler" className="text-electric-bright hover:underline">
            Tedarikçiler →
          </Link>
          <Link to="/giderler/odemeler" className="text-electric-bright hover:underline">
            Gider ödemeleri →
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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

          <div className="w-full min-w-0 sm:w-auto sm:max-w-[220px]">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
              className="w-full max-w-full truncate rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white"
            >
              <option value="all">Tüm ödeme durumları</option>
              <option value="paid">Ödendi</option>
              <option value="overdue">Vadesi geçti</option>
              <option value="unpaid">Ödenmedi</option>
              <option value="partially_paid">Kısmi ödendi</option>
            </select>
          </div>

          <div className="w-full min-w-0 sm:w-auto sm:max-w-[220px]">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full max-w-full truncate rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white"
            >
              <option value="">Tüm tedarikçiler</option>
              {suppliers.map((s) => (
                <option key={s.parasut_id} value={s.parasut_id}>
                  {s.name ?? `#${s.parasut_id}`}
                </option>
              ))}
            </select>
          </div>

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
            {bills === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : bills.length === 0 ? (
              <p className="text-white/50">Bu filtrede gider yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[1160px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Belge no</th>
                      <th className="px-4 py-2 font-medium">Tedarikçi/Harcayan</th>
                      <th className="px-4 py-2 font-medium">Düzenleme</th>
                      <th className="px-4 py-2 font-medium">Vade</th>
                      <th className="px-4 py-2 font-medium">Net</th>
                      <th className="px-4 py-2 font-medium">Brüt</th>
                      <th className="px-4 py-2 font-medium">KDV</th>
                      <th className="px-4 py-2 font-medium">Ödenen</th>
                      <th className="px-4 py-2 font-medium">Kalan</th>
                      <th className="px-4 py-2 font-medium">Durum</th>
                      <th className="px-4 py-2 font-medium">E-Belge</th>
                      <th className="px-4 py-2 font-medium">Arşiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b) => (
                      <tr key={b.parasut_id} className="border-t border-white/5">
                        <td className="px-4 py-2">
                          <Link to={`/giderler/${b.parasut_id}`} className="hover:text-electric-bright hover:underline">
                            {b.invoice_no ?? `#${b.parasut_id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {b.supplier_parasut_id ? (
                            <Link to={`/musteriler/${b.supplier_parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {b.supplier_name ?? `#${b.supplier_parasut_id}`}
                            </Link>
                          ) : (
                            b.spender_name ?? "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-white/70">{b.issue_date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{b.due_date ?? "—"}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(b.net_total, b.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(b.gross_total, b.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(b.total_vat, b.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(b.total_paid, b.currency)}</td>
                        <td className="px-4 py-2 text-white/70">{formatAmount(b.remaining, b.currency)}</td>
                        <td className="px-4 py-2 text-white/70">
                          {b.payment_status ? PAYMENT_LABELS[b.payment_status] ?? b.payment_status : "—"}
                        </td>
                        <td className="px-4 py-2 text-white/70">
                          {b.active_e_document_type ? E_DOCUMENT_TYPE_LABELS[b.active_e_document_type] ?? b.active_e_document_type : "—"}
                        </td>
                        <td className="px-4 py-2 text-white/70">{b.archived ? "Arşivli" : "Aktif"}</td>
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

export default Giderler;
