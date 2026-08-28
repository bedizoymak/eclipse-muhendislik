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
      const { data, error } = await supabase
        .from("parasut_e_invoices_demo")
        .select("*")
        .eq("parasut_id", Number(parasutId))
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setRow((data as EInvoiceRow | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  const parentLink = row
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
                  Çözümlenemeyen ilişki: {row.parent_type}#{row.parent_parasut_id}
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
