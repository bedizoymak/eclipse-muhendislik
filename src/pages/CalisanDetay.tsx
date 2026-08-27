import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface EmployeeDemoRow {
  parasut_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  tckn: string | null;
  archived: boolean | null;
  employment_start_date: string | null;
  employment_end_date: string | null;
  balance: number | null;
  trl_balance: number | null;
  usd_balance: number | null;
  eur_balance: number | null;
  gbp_balance: number | null;
  category_parasut_id: number | null;
  managed_by_user_parasut_id: number | null;
  managed_by_user_role_parasut_id: number | null;
  managed_by_user_role_type: string | null;
  tags_resolved: boolean | null;
  activities_resolved: boolean | null;
  comments_resolved: boolean | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "string" && value.trim() === "") return "—";
  return String(value);
}

function formatApiTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString("tr-TR", { timeZone: "UTC" })} UTC`;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-white/50">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{title}</p>
      <dl className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">{children}</dl>
    </div>
  );
}

const CalisanDetay = () => {
  const { parasutId } = useParams<{ parasutId: string }>();
  const [emp, setEmp] = useState<EmployeeDemoRow | null | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    if (!parasutId) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.from("parasut_employees_demo").select("*").eq("parasut_id", parasutId).maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setEmp((data as EmployeeDemoRow | null) ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [parasutId]);

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link to="/giderler/calisanlar" className="text-sm text-electric-bright hover:underline">
          ← Çalışanlar
        </Link>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && emp === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}
        {!loadError && emp === null && <p className="mt-6 text-white/50">Çalışan bulunamadı (parasut_id: {parasutId}).</p>}

        {emp && (
          <>
            <h1 className="mt-4 font-display text-3xl font-semibold">{emp.name ?? `#${emp.parasut_id}`}</h1>
            <p className="mt-1 text-white/60">{emp.archived ? "Arşivli çalışan" : "Aktif çalışan"}</p>

            <Group title="Genel">
              <Field label="Paraşüt ID" value={emp.parasut_id} />
              <Field label="Ad" value={formatValue(emp.name)} />
              <Field label="E-posta" value={formatValue(emp.email)} />
              <Field label="Telefon" value={formatValue(emp.phone)} />
              <Field label="TCKN" value={formatValue(emp.tckn)} />
              <Field label="IBAN" value={<span className="break-all">{formatValue(emp.iban)}</span>} />
              <Field label="Arşivlendi mi" value={formatValue(emp.archived)} />
              <Field label="İşe başlama tarihi" value={formatValue(emp.employment_start_date)} />
              <Field label="İşten çıkış tarihi" value={formatValue(emp.employment_end_date)} />
            </Group>

            <Group title="Bakiyeler">
              <Field label="Bakiye" value={formatValue(emp.balance)} />
              <Field label="TRL bakiye" value={formatValue(emp.trl_balance)} />
              <Field label="USD bakiye" value={formatValue(emp.usd_balance)} />
              <Field label="EUR bakiye" value={formatValue(emp.eur_balance)} />
              <Field label="GBP bakiye" value={formatValue(emp.gbp_balance)} />
            </Group>

            <Group title="İlişkiler (Paraşüt)">
              <Field label="Kategori (category) ID" value={formatValue(emp.category_parasut_id)} />
              <Field label="Yöneten kullanıcı (managed_by_user) ID" value={formatValue(emp.managed_by_user_parasut_id)} />
              <Field label="Yöneten kullanıcı rolü ID" value={formatValue(emp.managed_by_user_role_parasut_id)} />
              <Field label="Yöneten kullanıcı rolü tipi" value={formatValue(emp.managed_by_user_role_type)} />
            </Group>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-4 text-xs text-electric-bright hover:underline"
            >
              {expanded ? "Diğer alanları gizle" : "Tüm çalışan alanlarını göster"}
            </button>

            {expanded && (
              <>
                <Group title="İlişki çözümleme durumu (Paraşüt API)">
                  <Field
                    label="Etiketler (tags) çözümlendi mi"
                    value={
                      emp.tags_resolved
                        ? "Evet — API gerçekten sorgulandı, gerçek etiket bulunamadı (boş data:[])"
                        : "Hayır — bu senkronizasyonda sorgulanmadı"
                    }
                  />
                  <Field
                    label="Aktiviteler (activities) çözümlendi mi"
                    value={
                      emp.activities_resolved
                        ? "Evet — tekil uç nokta gerçekten sorgulandı, gerçek aktivite bulunamadı (boş data:[])"
                        : "Hayır — bu senkronizasyonda sorgulanmadı"
                    }
                  />
                  <Field
                    label="Yorumlar (comments) çözümlendi mi"
                    value={
                      emp.comments_resolved
                        ? "Evet — tekil uç nokta gerçekten sorgulandı, gerçek yorum bulunamadı (boş data:[])"
                        : "Hayır — bu senkronizasyonda sorgulanmadı"
                    }
                  />
                </Group>

                <Group title="Zaman damgaları">
                  <Field label="Paraşüt'te oluşturulma" value={formatApiTimestamp(emp.parasut_created_at)} />
                  <Field label="Paraşüt'te güncellenme" value={formatApiTimestamp(emp.parasut_updated_at)} />
                  <Field label="Son sync" value={new Date(emp.synced_at).toLocaleString("tr-TR")} />
                </Group>
              </>
            )}

            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Bu hesapta çalışana bağlı gerçek bir maaş (salary) kaydı bulunmuyor (Paraşüt API'sinden <code>GET /salaries</code> gerçek{" "}
              <code>data: []</code> döndürür — 0 kayıt). Bu nedenle burada maaş/bordro bölümü gösterilmiyor.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CalisanDetay;
