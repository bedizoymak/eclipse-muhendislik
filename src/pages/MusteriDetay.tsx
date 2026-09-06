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

// Real Parasut contact_people attributes only -- name/email/phone/notes plus
// the real parent-contact relationship id (contact_parasut_id). No title,
// department, role, or "primary contact" field exists on the API resource,
// so none is rendered here.
// Phase 11.1: resource_type is the contact_person's OWN real API root
// `type` (always "contact_people" so far); contact_type is the PARENT
// contact's real API `type` (always "contacts" so far), sourced only from
// the nested include=contact_people.contact relationship on the sync side.
// Neither is ever derived from the id, table name, or route.
interface ContactPersonDemoRow {
  parasut_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  contact_parasut_id: number | null;
  resource_type: string | null;
  contact_type: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

// Phase 1: simple detail view reading the same curated demo view as the
// list page. No mock data -- an unknown parasutId just shows "not found".
const MusteriDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [contact, setContact] = useState<ContactDemoRow | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [people, setPeople] = useState<ContactPersonDemoRow[] | undefined>(undefined);
  const [peopleError, setPeopleError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;

    let cancelled = false;
    supabase.functions
      .invoke("customers", { body: { action: "get", id: Number(parasutId) } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        if (data?.error === "not_found") {
          setContact(null);
          setPeople([]);
          return;
        }
        if (data?.error) {
          setLoadError(data.error);
          return;
        }
        const { contact_people, ...contactRow } = data?.data ?? {};
        setContact((contactRow as ContactDemoRow | null) ?? null);
        setPeople((contact_people as ContactPersonDemoRow[] | null) ?? []);
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

            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold">Yetkili Kişiler</h2>

              {peopleError && (
                <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  Yetkili kişiler okunamadı: {peopleError}
                </div>
              )}

              {!peopleError && people === undefined && <p className="mt-3 text-sm text-white/50">Yükleniyor…</p>}

              {!peopleError && people && people.length === 0 && (
                <p className="mt-3 text-sm text-white/50">İlişkili yetkili kişi yok.</p>
              )}

              {!peopleError && people && people.length > 0 && (
                <div className="mt-3 space-y-4">
                  {people.map((person) => (
                    <div
                      key={person.parasut_id}
                      className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="min-w-[16rem]">
                        <div className="font-medium text-white">{person.name?.trim() || "—"}</div>
                        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-white/50">Paraşüt ID</dt>
                            <dd className="mt-1 break-all">{person.parasut_id}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-white/50">Resource type</dt>
                            <dd className="mt-1 break-all">{person.resource_type ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-white/50">Bağlı müşteri (contact) ID</dt>
                            <dd className="mt-1 break-all">{person.contact_parasut_id ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-white/50">Parent type</dt>
                            <dd className="mt-1 break-all">{person.contact_type ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-white/50">E-posta</dt>
                            <dd className="mt-1 break-all">{person.email?.trim() || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-white/50">Telefon</dt>
                            <dd className="mt-1">{person.phone?.trim() || "—"}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-xs uppercase tracking-wide text-white/50">Not</dt>
                            <dd className="mt-1 whitespace-pre-wrap break-words">{person.notes?.trim() || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-white/50">Oluşturulma (UTC)</dt>
                            <dd className="mt-1">
                              {person.parasut_created_at ? new Date(person.parasut_created_at).toISOString() : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-white/50">Güncellenme (UTC)</dt>
                            <dd className="mt-1">
                              {person.parasut_updated_at ? new Date(person.parasut_updated_at).toISOString() : "—"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default MusteriDetay;
