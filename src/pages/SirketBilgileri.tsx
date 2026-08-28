import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface CompanyProfileRow {
  parasut_id: number;
  parasut_type: string;
  name: string | null;
  legal_name: string | null;
  tax_office: string | null;
  tax_number: string | null;
  mersis_no: string | null;
  trade_registry_number: string | null;
  district: string | null;
  city: string | null;
  occupation_field: string | null;
  primary_job: string | null;
  app_url: string | null;
  logo_url: string | null;
  credit_balance: number | null;
  new_subscription_status: string | null;
  valid_until: string | null;
  e_invoicing_enabled: boolean | null;
  e_archiving_enabled: boolean | null;
  e_despatch_enabled: boolean | null;
  e_commerce_enabled: boolean | null;
  e_invoicing_activated_at: string | null;
  e_archiving_activated_at: string | null;
  e_despatch_activated_at: string | null;
  sales_offer_enabled: boolean | null;
  export_invoice_enabled: boolean | null;
  using_multiple_warehouses: boolean | null;
  using_variant: boolean | null;
  uses_credit_service: boolean | null;
  credit_service_enabled: boolean | null;
  can_use_ai_reporting: boolean | null;
  can_use_ai_support: boolean | null;
  accessible: boolean | null;
  inspectable: boolean | null;
  inventory_enabled: boolean | null;
  has_iyzico_integration: boolean | null;
  extra_flags: Record<string, unknown> | null;
  owner_parasut_id: number | null;
  owner_parasut_type: string | null;
  address_parasut_id: number | null;
  address_parasut_type: string | null;
  address_text: string | null;
  address_phone: string | null;
  address_fax: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string | null;
}

interface UserRelationRow {
  user_parasut_id: number;
  user_parasut_type: string;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  relation_parasut_id: number;
  relation_parasut_type: string;
  company_parasut_id: number;
  company_parasut_type: string;
}

function b(value: boolean | null): string {
  if (value === null) return "—";
  return value ? "Evet" : "Hayır";
}

function s(value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function dateOnly(value: string | null): string {
  if (!value) return "—";
  // Date-only fields (e.g. e_invoicing_activated_at) come back as
  // "YYYY-MM-DD" already; never fabricate a time component.
  return value.length <= 10 ? value : value.slice(0, 10);
}

function utcTimestamp(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().replace("T", " ").replace("Z", " UTC");
}

const FIELD_LABELS: Record<string, string> = {
  legal_name: "Ünvan",
  tax_office: "Vergi Dairesi",
  tax_number: "Vergi Numarası",
  mersis_no: "Mersis No",
  trade_registry_number: "Ticaret Sicil No",
  district: "İlçe",
  city: "İl",
  occupation_field: "Faaliyet Alanı",
  primary_job: "Ana İş Kolu",
  credit_balance: "Kredi Bakiyesi",
  new_subscription_status: "Abonelik Durumu",
  valid_until: "Geçerlilik Tarihi",
  e_invoicing_enabled: "E-Fatura Aktif",
  e_archiving_enabled: "E-Arşiv Aktif",
  e_despatch_enabled: "E-İrsaliye Aktif",
  e_commerce_enabled: "E-Ticaret Aktif",
  e_invoicing_activated_at: "E-Fatura Başlangıç",
  e_archiving_activated_at: "E-Arşiv Başlangıç",
  e_despatch_activated_at: "E-İrsaliye Başlangıç",
  sales_offer_enabled: "Satış Teklifi Aktif",
  export_invoice_enabled: "İhracat Faturası Aktif",
  using_multiple_warehouses: "Çoklu Depo Kullanımı",
  using_variant: "Varyant Kullanımı",
  uses_credit_service: "Kredi Servisi Kullanımı",
  credit_service_enabled: "Kredi Servisi Aktif",
  can_use_ai_reporting: "AI Raporlama Yetkisi",
  can_use_ai_support: "AI Destek Yetkisi",
  accessible: "Erişilebilir",
  inspectable: "İncelenebilir",
  inventory_enabled: "Stok Takibi Aktif",
  has_iyzico_integration: "Iyzico Entegrasyonu",
};

const BOOLEAN_FIELDS = new Set([
  "e_invoicing_enabled", "e_archiving_enabled", "e_despatch_enabled", "e_commerce_enabled",
  "sales_offer_enabled", "export_invoice_enabled", "using_multiple_warehouses", "using_variant",
  "uses_credit_service", "credit_service_enabled", "can_use_ai_reporting", "can_use_ai_support",
  "accessible", "inspectable", "inventory_enabled", "has_iyzico_integration",
]);

const DATE_FIELDS = new Set(["e_invoicing_activated_at", "e_archiving_activated_at", "e_despatch_activated_at", "valid_until"]);

const SirketBilgileri = () => {
  const [company, setCompany] = useState<CompanyProfileRow | null | undefined>(undefined);
  const [relation, setRelation] = useState<UserRelationRow | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoadError("Supabase yapılandırılmamış.");
      return;
    }
    let cancelled = false;
    supabase
      .from("parasut_company_profile_demo")
      .select("*")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setCompany((data as CompanyProfileRow) ?? null);
      });
    supabase
      .from("parasut_user_company_relation_demo")
      .select("*")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return;
        setRelation((data as UserRelationRow) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const extraEntries = company?.extra_flags ? Object.entries(company.extra_flags) : [];

  return (
    <div className="min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="text-sm text-electric-bright hover:underline">
          ← Ana sayfa
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Şirket Bilgileri</h1>
        <p className="mt-1 text-white/60">
          Paraşüt <code>/v4/me</code> uç noktasından senkronize edilen gerçek şirket profili. Hiçbir alan tahmin
          edilmez; API'de bulunmayan hiçbir bilgi gösterilmez.
        </p>

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Veri okunamadı: {loadError}
          </div>
        )}

        {!loadError && company === undefined && <p className="mt-6 text-white/50">Yükleniyor…</p>}

        {!loadError && company === null && <p className="mt-6 text-white/50">Henüz senkronize edilmiş şirket profili yok.</p>}

        {!loadError && company && (
          <>
            <div className="mt-6 rounded-xl border border-white/10 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{s(company.name)}</h2>
                  <p className="text-sm text-white/50">
                    Paraşüt ID: {company.parasut_id} · Tür: {company.parasut_type}
                  </p>
                </div>
                {company.logo_url && (
                  <img src={company.logo_url} alt="Şirket logosu" className="h-14 w-14 rounded-lg border border-white/10 object-contain bg-white/5" />
                )}
              </div>

              <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Ünvan</dt>
                  <dd className="text-sm">{s(company.legal_name)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Vergi Dairesi / No</dt>
                  <dd className="text-sm">{s(company.tax_office)} / {s(company.tax_number)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">İl / İlçe</dt>
                  <dd className="text-sm">{s(company.city)} / {s(company.district)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Faaliyet Alanı</dt>
                  <dd className="text-sm">{s(company.occupation_field)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Adres</dt>
                  <dd className="text-sm">
                    {s(company.address_text)}
                    {company.address_phone ? <div className="text-white/60">Tel: {company.address_phone}</div> : null}
                    {company.address_parasut_id ? (
                      <div className="text-xs text-white/40">
                        Adres ID: {company.address_parasut_id} ({company.address_parasut_type})
                      </div>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Abonelik Durumu</dt>
                  <dd className="text-sm">{s(company.new_subscription_status)} · Geçerlilik: {dateOnly(company.valid_until)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Kredi Bakiyesi</dt>
                  <dd className="text-sm">{s(company.credit_balance)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Sahip (Owner)</dt>
                  <dd className="text-sm">
                    {company.owner_parasut_id ? `#${company.owner_parasut_id} (${company.owner_parasut_type})` : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-white/70">E-Belge ve Modül Ayarları</h3>
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">E-Fatura</dt>
                  <dd className="text-sm">{b(company.e_invoicing_enabled)} · Başlangıç: {dateOnly(company.e_invoicing_activated_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">E-Arşiv</dt>
                  <dd className="text-sm">{b(company.e_archiving_enabled)} · Başlangıç: {dateOnly(company.e_archiving_activated_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">E-İrsaliye</dt>
                  <dd className="text-sm">{b(company.e_despatch_enabled)} · Başlangıç: {dateOnly(company.e_despatch_activated_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">E-Ticaret</dt>
                  <dd className="text-sm">{b(company.e_commerce_enabled)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Stok Takibi</dt>
                  <dd className="text-sm">{b(company.inventory_enabled)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Çoklu Depo</dt>
                  <dd className="text-sm">{b(company.using_multiple_warehouses)}</dd>
                </div>
              </dl>
            </div>

            {relation && (
              <div className="mt-4 rounded-xl border border-white/10 p-6">
                <h3 className="text-sm font-semibold text-white/70">Paraşüt Kullanıcısı</h3>
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-white/40">Ad</dt>
                    <dd className="text-sm">{s(relation.user_name)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-white/40">E-posta</dt>
                    <dd className="text-sm">{s(relation.user_email)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-white/40">Telefon</dt>
                    <dd className="text-sm">{s(relation.user_phone)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-white/40">Kullanıcı–Şirket İlişkisi</dt>
                    <dd className="text-sm">
                      #{relation.relation_parasut_id} ({relation.relation_parasut_type}) → #{relation.company_parasut_id} ({relation.company_parasut_type})
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-white/10 p-6 text-xs text-white/40">
              Oluşturulma (UTC): {utcTimestamp(company.parasut_created_at)} · Güncellenme (UTC): {utcTimestamp(company.parasut_updated_at)} · Son senkronizasyon (UTC): {utcTimestamp(company.synced_at)}
            </div>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-4 rounded-lg border border-electric-bright/40 px-4 py-2 text-sm text-electric-bright hover:bg-electric-bright/10"
            >
              {expanded ? "Tüm şirket alanlarını gizle" : "Tüm şirket alanlarını göster"}
            </button>

            {expanded && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-4 py-2 font-medium">Alan</th>
                      <th className="px-4 py-2 font-medium">Değer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(FIELD_LABELS).map(([key, label]) => {
                      const raw = (company as unknown as Record<string, unknown>)[key];
                      let display: string;
                      if (BOOLEAN_FIELDS.has(key)) display = b(raw as boolean | null);
                      else if (DATE_FIELDS.has(key)) display = dateOnly(raw as string | null);
                      else display = s(raw as string | number | null);
                      return (
                        <tr key={key} className="border-t border-white/5">
                          <td className="px-4 py-2 text-white/60">{label}</td>
                          <td className="px-4 py-2">{display}</td>
                        </tr>
                      );
                    })}
                    {extraEntries.map(([key, value]) => (
                      <tr key={key} className="border-t border-white/5">
                        <td className="px-4 py-2 text-white/60">{key}</td>
                        <td className="px-4 py-2">
                          {value === null ? "—" : typeof value === "boolean" ? b(value) : String(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SirketBilgileri;
