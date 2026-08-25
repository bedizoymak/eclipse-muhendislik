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

const Musteriler = () => {
  const [contacts, setContacts] = useState<ContactDemoRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;
    supabase
      .from("parasut_contacts_demo")
      .select("parasut_id, name, short_name, email, contact_type, city, archived, synced_at")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setContacts(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm text-electric-bright hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Müşteriler</h1>
        <p className="mt-1 text-white/60">Paraşüt'ten senkronize edilen gerçek contact kayıtları.</p>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && (
          <div className="mt-6">
            {contacts === null ? (
              <p className="text-white/50">Yükleniyor…</p>
            ) : contacts.length === 0 ? (
              <p className="text-white/50">Henüz senkronize edilmiş müşteri yok.</p>
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
        )}
      </div>
    </div>
  );
};

export default Musteriler;
