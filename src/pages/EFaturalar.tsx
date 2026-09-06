import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Phase 14.2: standalone e_invoices collection -- the account's real,
// full GET /e_invoices universe (1693 records as of this phase), fetched
// and stored independently of the active-document link that
// FaturaDetay.tsx / GiderDetay.tsx already show via EDocumentSection.
// Do NOT confuse this page with EFaturaKutulari.tsx
// (/satislar/e-fatura-mukellefleri), which is a VKN lookup tool against a
// different resource (e_invoice_inboxes) and shares no data with this one.

interface EInvoiceListRow {
  parasut_id: number;
  external_id: string | null;
  direction: string | null;
  contact_name: string | null;
  issue_date: string | null;
  status: string | null;
  net_total: number | null;
  total_vat: number | null;
  currency: string | null;
  archived: boolean | null;
  parent_type: string | null;
  parent_parasut_id: number | null;
  // Phase 14.3: 'resolved' | 'unresolved' | 'no_relationship' -- see
  // parasut.e_invoices_with_resolution. A real relationship id/type with
  // no local parent row ('unresolved') must never be shown or linked as
  // "no relationship" or as a working route.
  parent_resolution_status: "resolved" | "unresolved" | "no_relationship";
}

interface CountsRow {
  total_e_invoices: number;
  linked_sales_invoice_count: number;
  linked_purchase_bill_count: number;
  unlinked_count: number;
  inbound_count: number;
  outbound_count: number;
  unresolved_relationship_count: number;
  resolved_sales_relationship: number;
  unresolved_sales_relationship: number;
  resolved_purchase_relationship: number;
  unresolved_purchase_relationship: number;
  no_invoice_relationship: number;
  total_with_relationship: number;
}

type LinkFilter = "all" | "linked" | "unlinked";
type DirectionFilter = "all" | "inbound" | "outbound";

function formatAmount(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

function parentLink(row: EInvoiceListRow): { label: string; to: string } | null {
  // Phase 14.3 fix: only a proven-resolvable route (parent row exists
  // locally) may ever render as a <Link>. An 'unresolved' real
  // relationship (e.g. cancelled sales_invoices never fetched by the
  // active/archived list sync) must show its real id/type as plain text.
  if (row.parent_resolution_status !== "resolved") return null;
  if (row.parent_type === "sales_invoices" && row.parent_parasut_id) {
    return { label: `Satış Faturası #${row.parent_parasut_id}`, to: `/satislar/faturalar/${row.parent_parasut_id}` };
  }
  if (row.parent_type === "purchase_bills" && row.parent_parasut_id) {
    return { label: `Gider #${row.parent_parasut_id}`, to: `/giderler/${row.parent_parasut_id}` };
  }
  return null;
}

const EFaturalar = () => {
  const [rows, setRows] = useState<EInvoiceListRow[] | null>(null);
  const [counts, setCounts] = useState<CountsRow | null>(null);
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("all");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("e-documents", { body: { action: "invoices.counts" } });
      if (cancelled) return;
      if (error || data?.error) {
        setLoadError(error?.message ?? data?.error);
        return;
      }
      setCounts((data?.data as CountsRow | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const body: Record<string, unknown> = { action: "invoices.list", pageSize: 1000 };
      if (linkFilter === "linked") body.linked = true;
      if (linkFilter === "unlinked") body.linked = false;
      if (directionFilter !== "all") body.direction = directionFilter;

      const { data, error } = await supabase.functions.invoke("e-documents", { body });
      if (cancelled) return;
      if (error || data?.error) {
        setLoadError(error?.message ?? data?.error);
        return;
      }
      setRows((data?.data as EInvoiceListRow[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [linkFilter, directionFilter]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="text-sm text-electric-bright hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">e-Faturalar</h1>
        <p className="mt-1 text-white/60">
          Paraşüt <code className="text-white/40">GET /e_invoices</code> uç noktasından senkronize edilen gerçek, bağımsız
          e-fatura evreni (satış/gider fatura bağlantısı olsun olmasın).
        </p>

        {counts && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10">
            {[
              ["Toplam", counts.total_e_invoices],
              ["Satış faturasına bağlı", counts.linked_sales_invoice_count],
              ["Gidere bağlı", counts.linked_purchase_bill_count],
              ["Bağlantısız", counts.unlinked_count],
              ["Gelen (inbound)", counts.inbound_count],
              ["Giden (outbound)", counts.outbound_count],
              ["Çözümlenemeyen ilişki (tip)", counts.unresolved_relationship_count],
              ["Satış: çözülemeyen ilişki", counts.unresolved_sales_relationship],
              ["Gider: çözülemeyen ilişki", counts.unresolved_purchase_relationship],
              ["İlişkisi olan (toplam)", counts.total_with_relationship],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/50">{label}</div>
                <div className="mt-1 font-display text-xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="flex gap-2">
            {(
              [
                ["all", "Tümü"],
                ["linked", "Bağlantılı"],
                ["unlinked", "Bağlantısız"],
              ] as [LinkFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLinkFilter(value)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  linkFilter === value
                    ? "border-electric-bright bg-electric-bright/10 text-electric-bright"
                    : "border-white/15 text-white/60 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as DirectionFilter)}
            className="rounded-lg border border-white/15 bg-navy-deep px-3 py-1.5 text-sm text-white"
          >
            <option value="all">Tüm yönler</option>
            <option value="inbound">Gelen</option>
            <option value="outbound">Giden</option>
          </select>
        </div>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {rows === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : rows.length === 0 ? (
              <p className="text-white/50">Bu filtrede e-fatura yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Dış Numara</th>
                      <th className="px-4 py-2 font-medium">Yön</th>
                      <th className="px-4 py-2 font-medium">Cari</th>
                      <th className="px-4 py-2 font-medium">Düzenleme</th>
                      <th className="px-4 py-2 font-medium">Durum</th>
                      <th className="px-4 py-2 font-medium">Net</th>
                      <th className="px-4 py-2 font-medium">KDV</th>
                      <th className="px-4 py-2 font-medium">Arşiv</th>
                      <th className="px-4 py-2 font-medium">Bağlantı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const link = parentLink(row);
                      return (
                        <tr key={row.parasut_id} className="border-t border-white/5">
                          <td className="px-4 py-2">
                            <Link
                              to={`/satislar/e-faturalar/${row.parasut_id}`}
                              className="hover:text-electric-bright hover:underline"
                            >
                              {row.external_id ?? `#${row.parasut_id}`}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-white/70">{row.direction ?? "—"}</td>
                          <td className="px-4 py-2 text-white/70 max-w-[220px] truncate">{row.contact_name ?? "—"}</td>
                          <td className="px-4 py-2 text-white/70">{row.issue_date ?? "—"}</td>
                          <td className="px-4 py-2 text-white/70">{row.status ?? "—"}</td>
                          <td className="px-4 py-2 text-white/70">{formatAmount(row.net_total, row.currency)}</td>
                          <td className="px-4 py-2 text-white/70">{formatAmount(row.total_vat, row.currency)}</td>
                          <td className="px-4 py-2 text-white/70">{row.archived ? "Arşivli" : "Aktif"}</td>
                          <td className="px-4 py-2 text-white/70">
                            {link ? (
                              <Link to={link.to} className="hover:text-electric-bright hover:underline">
                                {link.label}
                              </Link>
                            ) : row.parent_type ? (
                              <span className="text-amber-300/80 break-all" title="İlişki mevcut, bağlı kayıt yerel sistemde çözülemedi">
                                İlişki mevcut, bağlı kayıt yerel sistemde çözülemedi: {row.parent_type}#{row.parent_parasut_id}
                              </span>
                            ) : (
                              <span className="text-white/40">İlişkili Paraşüt faturası/gideri yok</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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

export default EFaturalar;
