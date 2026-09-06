import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Phase 13.1: generic detail-page shell for the EMPTY_IMPLEMENTABLE
// resources that genuinely have a real single-GET endpoint in the Paraşüt
// Swagger spec (salaries: GET /salaries/{id}, taxes: GET /taxes/{id},
// tags: GET /tags/{id} -- all verified in swagger.json `paths`). It reads
// ONLY the existing public view (never raw), by parasut_id -- there is no
// synthetic/fake row ever constructed. When the id genuinely does not
// exist (expected today, since every one of these resources has 0 real
// rows), it shows a real "Kayıt bulunamadı" state, never a guessed object.
//
// e_invoice_inboxes intentionally has NO such route/page: the real Swagger
// spec defines only GET /e_invoice_inboxes (list, filter[vkn]) with no
// /{id} path at all -- classified DETAIL_ENDPOINT_BLOCKED/UNSUPPORTED, see
// the Phase 13.1 report. Building a fake detail route for it would violate
// the "never guess where list rows will link" rule.

export interface EmptyResourceDetailField<Row> {
  label: string;
  render: (row: Row) => React.ReactNode;
}

interface EmptyResourceDetailProps<Row extends { parasut_id: number }> {
  backTo: string;
  backLabel: string;
  title: string;
  /** Edge Function name (e.g. "payroll", "products", "tags-and-settings"). */
  functionName: string;
  /** Resource key within that function -- calls `${resource}.get`. */
  resource: string;
  fields: EmptyResourceDetailField<Row>[];
  /**
   * Phase 13.4: optional callback fired with the loaded row (or null when
   * genuinely not found) so a parent page can resolve/render further real
   * relationship data (e.g. a linked employee/category name, or a
   * payments junction list) without duplicating this component's own
   * fetch-by-parasut_id logic.
   */
  onRowLoaded?: (row: Row | null) => void;
}

function EmptyResourceDetail<Row extends { parasut_id: number }>({
  backTo,
  backLabel,
  title,
  functionName,
  resource,
  fields,
  onRowLoaded,
}: EmptyResourceDetailProps<Row>) {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [row, setRow] = useState<Row | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;
    let cancelled = false;

    supabase.functions
      .invoke(functionName, { body: { action: `${resource}.get`, id: Number(parasutId) } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (data?.error === "not_found") {
          setRow(null);
          onRowLoaded?.(null);
          return;
        }
        if (error || data?.error) {
          setLoadError(error?.message ?? data?.error);
          return;
        }
        const loaded = (data?.data as unknown as Row | null) ?? null;
        setRow(loaded);
        onRowLoaded?.(loaded);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functionName, resource, parasutId]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link to={backTo} className="text-sm text-electric-bright hover:underline">
          ← {backLabel}
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">
          {!loadError && row ? `${title} #${row.parasut_id}` : title}
        </h1>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && row === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}

        {!loadError && row === null && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
            <p className="font-medium text-white/80">Kayıt bulunamadı.</p>
            <p className="mt-2">
              Bu kaynak için Paraşüt hesabında bu ID'de gerçek bir kayıt yok (bu kaynağın toplam kaydı bugün 0).
            </p>
          </div>
        )}

        {!loadError && row && (
          <dl className="mt-6 divide-y divide-white/10 rounded-xl border border-white/10 bg-white/5">
            {fields.map((f) => (
              <div key={f.label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-sm text-white/50">{f.label}</dt>
                <dd className="text-sm text-white/80">{f.render(row)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

export default EmptyResourceDetail;
