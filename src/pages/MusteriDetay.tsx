import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ContactDemoRow {
  parasut_id: number;
  name: string | null;
  short_name: string | null;
  email: string | null;
  phone: string | null;
  contact_type: string | null;
  city: string | null;
  archived: boolean | null;
  synced_at: string;
}

// Phase 1: simple detail view reading the same curated demo view as the
// list page. No mock data -- an unknown parasutId just shows "not found".
const MusteriDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [contact, setContact] = useState<ContactDemoRow | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;

    let cancelled = false;
    supabase
      .from("parasut_contacts_demo")
      .select("parasut_id, name, short_name, email, phone, contact_type, city, archived, synced_at")
      .eq("parasut_id", parasutId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setContact((data as ContactDemoRow | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link to="/musteriler" className="text-sm text-electric-bright hover:underline">
          ← Müşteriler
        </Link>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && contact === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}
        {!loadError && contact === null && <p className="mt-6 text-white/50">Müşteri bulunamadı (parasut_id: {parasutId}).</p>}

        {contact && (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">{contact.name ?? contact.short_name ?? `#${contact.parasut_id}`}</h1>
            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt ID</dt>
                <dd className="mt-1">{contact.parasut_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Tür</dt>
                <dd className="mt-1">{contact.contact_type ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">E-posta</dt>
                <dd className="mt-1">{contact.email?.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Telefon</dt>
                <dd className="mt-1">{contact.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Şehir</dt>
                <dd className="mt-1">{contact.city ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Arşivlendi mi</dt>
                <dd className="mt-1">{contact.archived ? "Evet" : "Hayır"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Son sync</dt>
                <dd className="mt-1">{new Date(contact.synced_at).toLocaleString("tr-TR")}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </div>
  );
};

export default MusteriDetay;
