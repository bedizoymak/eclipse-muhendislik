import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ContactDemoRow {
  parasut_id: number;
  name: string | null;
  short_name: string | null;
  email: string | null;
  contact_type: string | null;
  city: string | null;
  archived: boolean | null;
  synced_at: string;
}

interface SyncStatusRow {
  resource: string;
  status: string;
  dry_run: boolean;
  started_at: string;
  finished_at: string | null;
  fetched_count: number;
  upserted_count: number;
  error_count: number;
  error_message: string | null;
}

// Phase 1 temporary verification view: confirms the parasut-sync Edge
// Function actually wrote real Parasut data into Supabase. Not a dashboard.
const DemoHome = () => {
  const [contacts, setContacts] = useState<ContactDemoRow[] | null>(null);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY eksik).");
      return;
    }

    let cancelled = false;

    (async () => {
      const [contactsRes, countRes, syncRes] = await Promise.all([
        supabase
          .from("parasut_contacts_demo")
          .select("parasut_id, name, short_name, email, contact_type, city, archived, synced_at")
          .limit(20),
        supabase.from("parasut_contacts_demo").select("parasut_id", { count: "exact", head: true }),
        supabase
          .from("parasut_sync_status_demo")
          .select("*")
          .eq("resource", "contacts")
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (contactsRes.error || countRes.error || syncRes.error) {
        setLoadError(
          contactsRes.error?.message ?? countRes.error?.message ?? syncRes.error?.message ?? "Bilinmeyen hata",
        );
        return;
      }

      setContacts(contactsRes.data ?? []);
      setContactCount(countRes.count ?? 0);
      setSyncStatus((syncRes.data as SyncStatusRow | null) ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-electric-bright">Eclipse Mühendislik</p>
        <h1 className="mt-4 font-display text-3xl font-semibold md:text-4xl">Paraşüt senkronizasyon doğrulaması</h1>
        <p className="mt-2 text-white/60">demo.eclipsemuhendislik.com — geçici teknik doğrulama görünümü (Faz 1)</p>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Gerçek contact sayısı</p>
                <p className="mt-1 text-2xl font-semibold">{contactCount ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Son sync durumu</p>
                <p className="mt-1 text-2xl font-semibold">{syncStatus?.status ?? "henüz çalışmadı"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Son sync zamanı</p>
                <p className="mt-1 text-sm font-medium">
                  {syncStatus?.finished_at ? new Date(syncStatus.finished_at).toLocaleString("tr-TR") : "—"}
                </p>
              </div>
            </div>

            {syncStatus?.error_message && (
              <p className="mt-3 text-sm text-red-300">Son hata: {syncStatus.error_message}</p>
            )}

            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">İlk 20 gerçek contact</h2>
                <Link to="/musteriler" className="text-sm text-electric-bright hover:underline">
                  Tüm müşteriler →
                </Link>
              </div>
              {contacts === null ? (
                <p className="text-white/50">Yükleniyor…</p>
              ) : contacts.length === 0 ? (
                <p className="text-white/50">Henüz senkronize edilmiş contact yok.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-white/50">
                      <tr>
                        <th className="px-4 py-2 font-medium">Ad</th>
                        <th className="px-4 py-2 font-medium">E-posta</th>
                        <th className="px-4 py-2 font-medium">Şehir</th>
                        <th className="px-4 py-2 font-medium">Tür</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact) => (
                        <tr key={contact.parasut_id} className="border-t border-white/5">
                          <td className="px-4 py-2">
                            <Link to={`/musteriler/${contact.parasut_id}`} className="hover:text-electric-bright hover:underline">
                              {contact.name ?? contact.short_name ?? `#${contact.parasut_id}`}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-white/70">{contact.email ?? "—"}</td>
                          <td className="px-4 py-2 text-white/70">{contact.city ?? "—"}</td>
                          <td className="px-4 py-2 text-white/70">{contact.contact_type ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DemoHome;
