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
  logo_is_processing: boolean | null;
  credit_balance: number | null;
  last_consumption_date: string | null;
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
  inventory_enabled: boolean | null;
  has_iyzico_integration: boolean | null;
  // Phase 12.1: individually classified fields, replacing the Phase 12
  // bulk extra_flags jsonb. `inspectable`/`extra_flags` are intentionally
  // NOT part of this view any more (private/base only from this phase on).
  e_invoice_vkn: string | null;
  display_exchange_rate_in_offer_pdf: boolean | null;
  payment_with_akbank_enabled: boolean | null;
  can_upload_signature: boolean | null;
  invoicing_preferences: Record<string, unknown> | null;
  e_smm_enabled: boolean | null;
  e_smm_activated_at: string | null;
  e_archiving_only_enabled: boolean | null;
  e_archiving_only_activated_at: string | null;
  e_archiving_only_waiting: boolean | null;
  using_sales_receipt: boolean | null;
  using_emikro_einvoice: boolean | null;
  using_emikro_services: boolean | null;
  e_invoicing_waiting: boolean | null;
  e_invoicing_order_details_enabled: boolean | null;
  email_tx_import_enabled: boolean | null;
  bank_sync_setup_is_bankasi_enabled: boolean | null;
  bank_sync_setup_ing_bank_enabled: boolean | null;
  bank_sync_setup_akbank_enabled: boolean | null;
  bank_sync_setup_denizbank_enabled: boolean | null;
  bank_sync_setup_kuveytturk_enabled: boolean | null;
  bank_sync_setup_teb_enabled: boolean | null;
  bank_sync_setup_finansbank_enabled: boolean | null;
  bank_sync_setup_fibabanka_enabled: boolean | null;
  bank_sync_setup_albaraka_enabled: boolean | null;
  bank_sync_setup_ornekbank_enabled: boolean | null;
  bank_sync_setup_yapikredi_enabled: boolean | null;
  bank_sync_setup_vakifbank_enabled: boolean | null;
  bank_sync_setup_enpara_enabled: boolean | null;
  bank_sync_setup_garanti_enabled: boolean | null;
  bank_sync_setup_ziraat_bankasi_enabled: boolean | null;
  bank_sync_setup_halkbank_enabled: boolean | null;
  multiple_bank_integration_enabled: boolean | null;
  e_commerce_integration_enabled: boolean | null;
  fibabanka_credit_application_enabled: boolean | null;
  inbound_edocument_page_enabled: boolean | null;
  batch_updated_vat_rates: boolean | null;
  invoice_note_enabled: boolean | null;
  has_odeal_integration: boolean | null;
  has_507_and_509: boolean | null;
  footer_aggregate_enabled: boolean | null;
  contact_transfer_enabled: boolean | null;
  pending_qr_code_migration: boolean | null;
  ai_support_rag: boolean | null;
  ai_features_enabled: boolean | null;
  owner_parasut_id: number | null;
  owner_parasut_type: string | null;
  default_warehouse_parasut_id: number | null;
  default_warehouse_parasut_type: string | null;
  address_parasut_id: number | null;
  address_parasut_type: string | null;
  address_name: string | null;
  address_text: string | null;
  address_phone: string | null;
  address_fax: string | null;
  address_own_parasut_type: string | null;
  address_addressable_type: string | null;
  address_addressable_parasut_id: number | null;
  address_created_at: string | null;
  address_updated_at: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string | null;
}

interface UserRelationRow {
  user_parasut_id: number;
  user_parasut_type: string;
  user_name: string | null;
  user_email: string | null;
  user_created_at: string | null;
  user_updated_at: string | null;
  profile_parasut_id: number | null;
  profile_parasut_type: string | null;
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
  inventory_enabled: "Stok Takibi Aktif",
  has_iyzico_integration: "Iyzico Entegrasyonu",
  e_invoice_vkn: "E-Fatura VKN",
  display_exchange_rate_in_offer_pdf: "Teklif PDF'inde Döviz Kuru",
  payment_with_akbank_enabled: "Akbank ile Ödeme",
  can_upload_signature: "İmza Yükleme Yetkisi",
  e_smm_enabled: "E-SMM Aktif",
  e_smm_activated_at: "E-SMM Başlangıç",
  e_archiving_only_enabled: "Sadece E-Arşiv Aktif",
  e_archiving_only_activated_at: "Sadece E-Arşiv Başlangıç",
  e_archiving_only_waiting: "Sadece E-Arşiv Bekliyor",
  using_sales_receipt: "Satış Fişi Kullanımı",
  using_emikro_einvoice: "Emikro E-Fatura Kullanımı",
  using_emikro_services: "Emikro Servisleri Kullanımı",
  e_invoicing_waiting: "E-Fatura Bekliyor",
  e_invoicing_order_details_enabled: "E-Fatura Sipariş Detayı",
  email_tx_import_enabled: "E-posta İşlem İçe Aktarma",
  bank_sync_setup_is_bankasi_enabled: "Banka Senkron: İş Bankası",
  bank_sync_setup_ing_bank_enabled: "Banka Senkron: ING",
  bank_sync_setup_akbank_enabled: "Banka Senkron: Akbank",
  bank_sync_setup_denizbank_enabled: "Banka Senkron: Denizbank",
  bank_sync_setup_kuveytturk_enabled: "Banka Senkron: Kuveyt Türk",
  bank_sync_setup_teb_enabled: "Banka Senkron: TEB",
  bank_sync_setup_finansbank_enabled: "Banka Senkron: QNB Finansbank",
  bank_sync_setup_fibabanka_enabled: "Banka Senkron: Fibabanka",
  bank_sync_setup_albaraka_enabled: "Banka Senkron: Albaraka",
  bank_sync_setup_ornekbank_enabled: "Banka Senkron: Örnek Banka",
  bank_sync_setup_yapikredi_enabled: "Banka Senkron: Yapı Kredi",
  bank_sync_setup_vakifbank_enabled: "Banka Senkron: VakıfBank",
  bank_sync_setup_enpara_enabled: "Banka Senkron: Enpara",
  bank_sync_setup_garanti_enabled: "Banka Senkron: Garanti BBVA",
  bank_sync_setup_ziraat_bankasi_enabled: "Banka Senkron: Ziraat Bankası",
  bank_sync_setup_halkbank_enabled: "Banka Senkron: Halkbank",
  multiple_bank_integration_enabled: "Çoklu Banka Entegrasyonu",
  e_commerce_integration_enabled: "E-Ticaret Entegrasyonu",
  fibabanka_credit_application_enabled: "Fibabanka Kredi Başvurusu",
  inbound_edocument_page_enabled: "Gelen E-Belge Sayfası",
  batch_updated_vat_rates: "Toplu KDV Güncellemesi",
  invoice_note_enabled: "Fatura Notu Aktif",
  has_odeal_integration: "Ödeal Entegrasyonu",
  has_507_and_509: "507 ve 509 Kapsamı",
  footer_aggregate_enabled: "Alt Bilgi Toplamı Aktif",
  contact_transfer_enabled: "Cari Aktarımı Aktif",
  pending_qr_code_migration: "QR Kod Geçişi Bekliyor",
  ai_support_rag: "AI Destek (RAG)",
  ai_features_enabled: "AI Özellikleri Aktif",
  logo_is_processing: "Logo İşleniyor mu",
  last_consumption_date: "Son Tüketim Tarihi (UTC)",
};

const BOOLEAN_FIELDS = new Set([
  "e_invoicing_enabled", "e_archiving_enabled", "e_despatch_enabled", "e_commerce_enabled",
  "sales_offer_enabled", "export_invoice_enabled", "using_multiple_warehouses", "using_variant",
  "uses_credit_service", "credit_service_enabled", "can_use_ai_reporting", "can_use_ai_support",
  "accessible", "inventory_enabled", "has_iyzico_integration",
  "display_exchange_rate_in_offer_pdf", "payment_with_akbank_enabled", "can_upload_signature",
  "e_smm_enabled", "e_archiving_only_enabled", "e_archiving_only_waiting", "using_sales_receipt",
  "using_emikro_einvoice", "using_emikro_services", "e_invoicing_waiting",
  "e_invoicing_order_details_enabled", "email_tx_import_enabled",
  "bank_sync_setup_is_bankasi_enabled", "bank_sync_setup_ing_bank_enabled", "bank_sync_setup_akbank_enabled",
  "bank_sync_setup_denizbank_enabled", "bank_sync_setup_kuveytturk_enabled", "bank_sync_setup_teb_enabled",
  "bank_sync_setup_finansbank_enabled", "bank_sync_setup_fibabanka_enabled", "bank_sync_setup_albaraka_enabled",
  "bank_sync_setup_ornekbank_enabled", "bank_sync_setup_yapikredi_enabled", "bank_sync_setup_vakifbank_enabled",
  "bank_sync_setup_enpara_enabled", "bank_sync_setup_garanti_enabled", "bank_sync_setup_ziraat_bankasi_enabled",
  "bank_sync_setup_halkbank_enabled", "multiple_bank_integration_enabled", "e_commerce_integration_enabled",
  "fibabanka_credit_application_enabled", "inbound_edocument_page_enabled", "batch_updated_vat_rates",
  "invoice_note_enabled", "has_odeal_integration", "has_507_and_509", "footer_aggregate_enabled",
  "contact_transfer_enabled", "pending_qr_code_migration", "ai_support_rag", "ai_features_enabled",
  "logo_is_processing",
]);

const DATE_FIELDS = new Set([
  "e_invoicing_activated_at", "e_archiving_activated_at", "e_despatch_activated_at", "valid_until",
  "e_smm_activated_at", "e_archiving_only_activated_at",
]);

const TIMESTAMP_FIELDS = new Set(["last_consumption_date"]);

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
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Varsayılan Depo ID</dt>
                  <dd className="text-sm">
                    {company.default_warehouse_parasut_id ? `#${company.default_warehouse_parasut_id}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Logo İşleniyor mu</dt>
                  <dd className="text-sm">{b(company.logo_is_processing)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Son Tüketim Tarihi (UTC)</dt>
                  <dd className="text-sm">{utcTimestamp(company.last_consumption_date)}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-white/70">Adres Detayı</h3>
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Adres ID / Tür</dt>
                  <dd className="text-sm">
                    {company.address_parasut_id ? `#${company.address_parasut_id} (${company.address_own_parasut_type ?? "—"})` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">İsim</dt>
                  <dd className="text-sm">{s(company.address_name)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Faks</dt>
                  <dd className="text-sm">{s(company.address_fax)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Bağlı Olduğu Kaynak (Addressable)</dt>
                  <dd className="text-sm">
                    {company.address_addressable_parasut_id
                      ? `#${company.address_addressable_parasut_id} (${company.address_addressable_type ?? "—"})`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Adres Oluşturulma (UTC)</dt>
                  <dd className="text-sm">{utcTimestamp(company.address_created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-white/40">Adres Güncellenme (UTC)</dt>
                  <dd className="text-sm">{utcTimestamp(company.address_updated_at)}</dd>
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
                    <dt className="text-xs uppercase tracking-wide text-white/40">Kullanıcı ID / Tür</dt>
                    <dd className="text-sm">#{relation.user_parasut_id} ({relation.user_parasut_type})</dd>
                  </div>
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
                    <dt className="text-xs uppercase tracking-wide text-white/40">Kullanıcı Oluşturulma (UTC)</dt>
                    <dd className="text-sm">{utcTimestamp(relation.user_created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-white/40">Kullanıcı Güncellenme (UTC)</dt>
                    <dd className="text-sm">{utcTimestamp(relation.user_updated_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-white/40">Profil ID / Tür</dt>
                    <dd className="text-sm">
                      {relation.profile_parasut_id ? `#${relation.profile_parasut_id} (${relation.profile_parasut_type ?? "—"})` : "—"}
                    </dd>
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
                      else if (TIMESTAMP_FIELDS.has(key)) display = utcTimestamp(raw as string | null);
                      else display = s(raw as string | number | null);
                      return (
                        <tr key={key} className="border-t border-white/5">
                          <td className="px-4 py-2 text-white/60">{label}</td>
                          <td className="px-4 py-2">{display}</td>
                        </tr>
                      );
                    })}
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
