import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { EDocumentSection } from "@/components/EDocumentSection";
import type { EInvoiceRow } from "@/lib/eDocuments";

// Phase 14.2: detail page for a single standalone e-invoice record from
// the full GET /e_invoices universe (may or may not have a real parent
// sales_invoice/purchase_bill link -- both cases are shown honestly).
// Reuses EDocumentSection's full-field display exactly as FaturaDetay.tsx
// / GiderDetay.tsx do for the active-linked case.

const EFaturaDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [row, setRow] = useState<EInvoiceRow | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !parasutId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("e-documents", { body: { action: "invoices.get", id: Number(parasutId) } });
      if (cancelled) return;
      if (data?.error === "not_found") {
        setRow(null);
        return;
      }
      if (error || data?.error) {
        setLoadError(error?.message ?? data?.error);
        return;
      }
      setRow((data?.data as EInvoiceRow | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  // Phase 14.3 fix: a real relationship id/type surviving with no local
  // parent row (parent_resolution_status === "unresolved", e.g. the 4
  // sales_invoices with item_type="cancelled" that neither
  // filter[archived]=false nor =true ever returns) must NEVER be rendered
  // as a route <Link> -- the route would 404 because nothing was ever
  // synced under that id. Only "resolved" is a proven-safe route.
  const isResolved = row?.parent_resolution_status
    ? row.parent_resolution_status === "resolved"
    : Boolean(row?.parent_type && row?.parent_parasut_id); // active-document path: always resolved by construction
  const parentLink =
    row && isResolved
      ? row.parent_type === "sales_invoices" && row.parent_parasut_id
        ? { label: `Satış Faturası #${row.parent_parasut_id}`, to: `/satislar/faturalar/${row.parent_parasut_id}` }
        : row.parent_type === "purchase_bills" && row.parent_parasut_id
          ? { label: `Gider #${row.parent_parasut_id}`, to: `/giderler/${row.parent_parasut_id}` }
          : null
      : null;

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link to="/satislar/e-faturalar" className="text-sm text-electric-bright hover:underline">
          ← e-Faturalar
        </Link>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && row === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}
        {!loadError && row === null && <p className="mt-6 text-white/50">e-Fatura bulunamadı.</p>}

        {!loadError && row && (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold break-words">
              {row.external_id ?? `e-Fatura #${row.parasut_id}`}
            </h1>
            <p className="mt-1 text-white/60">Paraşüt e-fatura ID: {row.parasut_id}</p>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/50">İlişkili belge</p>
              {parentLink ? (
                <Link to={parentLink.to} className="mt-1 inline-block text-electric-bright hover:underline">
                  {parentLink.label}
                </Link>
              ) : row.parent_type ? (
                <p className="mt-1 break-all text-amber-300/80">
                  İlişki mevcut, bağlı kayıt yerel sistemde çözülemedi: {row.parent_type}#{row.parent_parasut_id}
                </p>
              ) : (
                <p className="mt-1 text-white/40">İlişkili Paraşüt faturası/gideri yok</p>
              )}
            </div>

            <EDocumentSection eDoc={{ kind: "e_invoices", row }} />
          </>
        )}
      </div>
    </div>
  );
};

export default EFaturaDetay;
