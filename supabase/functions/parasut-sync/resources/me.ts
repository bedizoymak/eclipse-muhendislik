// Maps Parasut GET /v4/me -- verified directly against the live API.
//
// Root resource: id "800086", type "users". Real relationships:
// user_roles (array, 1 real item: 875199) and profile (single: 801196).
// Real included resources this session: one "user_roles" (875199), one
// "companies" (666034, reached ONLY via user_roles.relationships.company
// -- never via a direct /v4/me relationship, since /v4/me has none), one
// "addresses" (295028, reached ONLY via the included company's own
// relationships.address -- it is the COMPANY's address, not the user's),
// one "profiles" (801196, the user's own profile).
//
// Security classification (never changed without a fresh live re-check):
//   - users.attributes.name / email: real, safe, business-meaningful ->
//     public (parasut_user_company_relation_demo).
//   - users.attributes.unconfirmed_email / is_confirmed / approved_
//     contracts / approved_new_contracts / integration_contract_statuses:
//     account-verification / legal-consent state -> private/base only.
//   - users.attributes.keycloak_tfa_enabled / keycloak_email_otp_enabled:
//     account SECURITY settings -> private/base only, NEVER public (could
//     aid an attacker if exposed).
//   - user_roles.attributes.{sales_invoices,expenditures,own_expenditures,
//     employees,accounts,settings}: real Parasut PERMISSION values (e.g.
//     "rw"/"na") -> classified as permission secrets, private/base only.
//     Only user_roles.id/type (a relationship pointer) is public.
//   - profiles.attributes.phone: real, safe, business-meaningful -> public.
//   - profiles.attributes.job_title/settings/avatar: job_title real null
//     today (preserved as null); settings is a UI preference (private);
//     avatar preserved private (no real safe business value once avatar
//     itself is null on this account).
//
// No password/hash, OAuth token, refresh token, or API credential is ever
// present in this response body -- none is mapped or stored here.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

function relatedRef(item: JsonApiResource, key: string): { id: number | null; type: string | null } {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return { id: null, type: null };
  const id = Number(rel.id);
  return { id: Number.isFinite(id) ? id : null, type: rel.type ?? null };
}

export interface UserRow {
  parasut_id: number;
  // Real value from item.type (root /v4/me resource envelope) -- never a
  // hardcoded "users" string constant.
  parasut_type: string;
  name: string | null;
  email: string | null;
  unconfirmed_email: string | null;
  is_confirmed: boolean | null;
  approved_contracts: boolean | null;
  approved_new_contracts: boolean | null;
  integration_contract_statuses: unknown;
  keycloak_tfa_enabled: boolean | null;
  keycloak_email_otp_enabled: boolean | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export interface ProfileRow {
  parasut_id: number;
  // Real value from item.type (included "profiles" resource envelope) --
  // never a hardcoded "profiles" string constant.
  parasut_type: string;
  user_parasut_id: number | null;
  phone: string | null;
  job_title: string | null;
  settings: unknown;
  avatar: unknown;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export interface UserRoleRow {
  parasut_id: number;
  // Real value from item.type (included "user_roles" resource envelope) --
  // never a hardcoded "user_roles" string constant.
  parasut_type: string;
  user_parasut_id: number | null;
  company_parasut_id: number | null;
  sales_invoices: string | null;
  expenditures: string | null;
  own_expenditures: string | null;
  employees: string | null;
  accounts: string | null;
  settings: string | null;
  user_role_type: string | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export interface CompanyRow {
  parasut_id: number;
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
  // Phase 12.2: logo.is_processing is a SEPARATE real boolean from the
  // logo.url that already backs logo_url -- it cannot be represented by
  // the URL string and must be stored/shown as its own value.
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
  inspectable: boolean | null;
  inventory_enabled: boolean | null;
  has_iyzico_integration: boolean | null;
  owner_parasut_id: number | null;
  address_parasut_id: number | null;
  default_warehouse_parasut_id: number | null;
  allowed_inspection_at: string | null;
  // Phase 12.1: every remaining real company attribute key, individually
  // classified (see migration 20260830050000 header for the per-field
  // public/private decision table). extra_flags is kept only as a
  // forward-compat catch-all for brand-new unclassified keys -- it should
  // be empty in practice and must never be rendered generically in the UI.
  e_invoice_vkn: string | null;
  display_exchange_rate_in_offer_pdf: boolean | null;
  payment_with_akbank_enabled: boolean | null;
  can_upload_signature: boolean | null;
  invoicing_preferences: unknown;
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
  // private-only (internal/inspection/operator/security-adjacent)
  operator_id: number | null;
  employee_id: number | null;
  used_app: string | null;
  signature: unknown;
  inspectable: boolean | null;
  // separate /v4/companies provenance, never merged into `raw`
  raw_company_list: JsonApiResource | null;
  extra_flags: Record<string, unknown>;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export interface AddressRow {
  parasut_id: number;
  // Phase 12.2: the address resource's OWN JSON:API `type`, taken verbatim
  // from `item.type` (the real included resource envelope) -- never a
  // hardcoded "addresses" string constant.
  parasut_type: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  addressable_type: string | null;
  addressable_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

// Company attribute keys already captured as their own base column --
// everything else real on the resource is preserved verbatim in
// extra_flags so no real field is left reachable only from `raw`.
const COMPANY_KNOWN_KEYS = new Set([
  "created_at", "updated_at", "owner_id", "name", "allowed_inspection_at",
  "app_url", "legal_name", "occupation_field", "district", "city",
  "tax_office", "tax_number", "e_invoice_vkn", "mersis_no",
  "trade_registry_number", "credit_balance", "last_consumption_date",
  "primary_job", "e_invoicing_activated_at", "e_archiving_activated_at",
  "e_despatch_activated_at", "new_subscription_status", "logo_url",
  "default_warehouse_id", "valid_until", "accessible", "inspectable",
  "inventory_enabled", "e_invoicing_enabled", "e_archiving_enabled",
  "e_despatch_enabled", "e_commerce_enabled", "sales_offer_enabled",
  "export_invoice_enabled", "using_multiple_warehouses", "using_variant",
  "uses_credit_service", "credit_service_enabled", "can_use_ai_reporting",
  "can_use_ai_support", "has_iyzico_integration",
  // Phase 12.1: previously bulk-dumped into extra_flags, now individually
  // mapped to their own typed column above (see CompanyRow).
  "display_exchange_rate_in_offer_pdf", "payment_with_akbank_enabled",
  "can_upload_signature", "invoicing_preferences", "e_smm_enabled",
  "e_smm_activated_at", "e_archiving_only_enabled",
  "e_archiving_only_activated_at", "e_archiving_only_waiting",
  "using_sales_receipt", "using_emikro_einvoice", "using_emikro_services",
  "e_invoicing_waiting", "e_invoicing_order_details_enabled",
  "email_tx_import_enabled", "bank_sync_setup_is_bankasi_enabled",
  "bank_sync_setup_ing_bank_enabled", "bank_sync_setup_akbank_enabled",
  "bank_sync_setup_denizbank_enabled", "bank_sync_setup_kuveytturk_enabled",
  "bank_sync_setup_teb_enabled", "bank_sync_setup_finansbank_enabled",
  "bank_sync_setup_fibabanka_enabled", "bank_sync_setup_albaraka_enabled",
  "bank_sync_setup_ornekbank_enabled", "bank_sync_setup_yapikredi_enabled",
  "bank_sync_setup_vakifbank_enabled", "bank_sync_setup_enpara_enabled",
  "bank_sync_setup_garanti_enabled", "bank_sync_setup_ziraat_bankasi_enabled",
  "bank_sync_setup_halkbank_enabled", "multiple_bank_integration_enabled",
  "e_commerce_integration_enabled", "fibabanka_credit_application_enabled",
  "inbound_edocument_page_enabled", "batch_updated_vat_rates",
  "invoice_note_enabled", "has_odeal_integration", "has_507_and_509",
  "footer_aggregate_enabled", "contact_transfer_enabled",
  "pending_qr_code_migration", "ai_support_rag", "ai_features_enabled",
  "operator_id", "employee_id", "used_app", "signature",
  // logo{} duplicates logo_url's value exactly -- not stored a second time,
  // but excluded from extra_flags too (documented, not silently dropped).
  "logo",
]);

export function mapUser(item: JsonApiResource): UserRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) throw new Error(`User resource has a non-numeric id: ${item.id}`);
  return {
    parasut_id: parasutId,
    parasut_type: item.type,
    name: attr(a, "name"),
    email: attr(a, "email"),
    unconfirmed_email: attr(a, "unconfirmed_email"),
    is_confirmed: attr(a, "is_confirmed"),
    approved_contracts: attr(a, "approved_contracts"),
    approved_new_contracts: attr(a, "approved_new_contracts"),
    integration_contract_statuses: attr(a, "integration_contract_statuses"),
    keycloak_tfa_enabled: attr(a, "keycloak_tfa_enabled"),
    keycloak_email_otp_enabled: attr(a, "keycloak_email_otp_enabled"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export function mapProfile(item: JsonApiResource, userParasutId: number | null): ProfileRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) throw new Error(`Profile resource has a non-numeric id: ${item.id}`);
  return {
    parasut_id: parasutId,
    parasut_type: item.type,
    user_parasut_id: userParasutId,
    phone: attr(a, "phone"),
    job_title: attr(a, "job_title"),
    settings: attr(a, "settings"),
    avatar: attr(a, "avatar"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export function mapUserRole(item: JsonApiResource, userParasutId: number | null): UserRoleRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) throw new Error(`UserRole resource has a non-numeric id: ${item.id}`);
  const company = relatedRef(item, "company");
  return {
    parasut_id: parasutId,
    parasut_type: item.type,
    user_parasut_id: userParasutId,
    company_parasut_id: company.id,
    sales_invoices: attr(a, "sales_invoices"),
    expenditures: attr(a, "expenditures"),
    own_expenditures: attr(a, "own_expenditures"),
    employees: attr(a, "employees"),
    accounts: attr(a, "accounts"),
    settings: attr(a, "settings"),
    user_role_type: attr(a, "user_role_type"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export function mapMeCompany(item: JsonApiResource, companyListRaw: JsonApiResource | null = null): CompanyRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) throw new Error(`Company resource has a non-numeric id: ${item.id}`);
  const owner = relatedRef(item, "owner");
  const address = relatedRef(item, "address");

  const extraFlags: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(a)) {
    if (!COMPANY_KNOWN_KEYS.has(key)) extraFlags[key] = value;
  }

  return {
    parasut_id: parasutId,
    name: attr(a, "name"),
    legal_name: attr(a, "legal_name"),
    tax_office: attr(a, "tax_office"),
    tax_number: attr(a, "tax_number"),
    mersis_no: attr(a, "mersis_no"),
    trade_registry_number: attr(a, "trade_registry_number"),
    district: attr(a, "district"),
    city: attr(a, "city"),
    occupation_field: attr(a, "occupation_field"),
    primary_job: attr(a, "primary_job"),
    app_url: attr(a, "app_url"),
    logo_url: attr(a, "logo_url"),
    logo_is_processing: (() => {
      const logo = a["logo"] as { is_processing?: boolean } | null | undefined;
      return logo && typeof logo === "object" ? (logo.is_processing ?? null) : null;
    })(),
    credit_balance: attr(a, "credit_balance"),
    last_consumption_date: attr(a, "last_consumption_date"),
    new_subscription_status: attr(a, "new_subscription_status"),
    valid_until: attr(a, "valid_until"),
    e_invoicing_enabled: attr(a, "e_invoicing_enabled"),
    e_archiving_enabled: attr(a, "e_archiving_enabled"),
    e_despatch_enabled: attr(a, "e_despatch_enabled"),
    e_commerce_enabled: attr(a, "e_commerce_enabled"),
    e_invoicing_activated_at: attr(a, "e_invoicing_activated_at"),
    e_archiving_activated_at: attr(a, "e_archiving_activated_at"),
    e_despatch_activated_at: attr(a, "e_despatch_activated_at"),
    sales_offer_enabled: attr(a, "sales_offer_enabled"),
    export_invoice_enabled: attr(a, "export_invoice_enabled"),
    using_multiple_warehouses: attr(a, "using_multiple_warehouses"),
    using_variant: attr(a, "using_variant"),
    uses_credit_service: attr(a, "uses_credit_service"),
    credit_service_enabled: attr(a, "credit_service_enabled"),
    can_use_ai_reporting: attr(a, "can_use_ai_reporting"),
    can_use_ai_support: attr(a, "can_use_ai_support"),
    accessible: attr(a, "accessible"),
    inspectable: attr(a, "inspectable"),
    inventory_enabled: attr(a, "inventory_enabled"),
    has_iyzico_integration: attr(a, "has_iyzico_integration"),
    owner_parasut_id: owner.id,
    address_parasut_id: address.id,
    // Phase 12.2 fix: relationships.default_warehouse is {"meta":{}} on this
    // account (empty -- no linked warehouse resource, never fabricated) but
    // attributes.default_warehouse_id is a SEPARATE real, independently
    // populated integer (1000122982) -- it must be sourced from the
    // attribute, not the (always-null on this account) relationship
    // pointer, or the real value would be silently dropped.
    default_warehouse_parasut_id: attr(a, "default_warehouse_id"),
    allowed_inspection_at: attr(a, "allowed_inspection_at"),
    e_invoice_vkn: attr(a, "e_invoice_vkn"),
    display_exchange_rate_in_offer_pdf: attr(a, "display_exchange_rate_in_offer_pdf"),
    payment_with_akbank_enabled: attr(a, "payment_with_akbank_enabled"),
    can_upload_signature: attr(a, "can_upload_signature"),
    invoicing_preferences: attr(a, "invoicing_preferences"),
    e_smm_enabled: attr(a, "e_smm_enabled"),
    e_smm_activated_at: attr(a, "e_smm_activated_at"),
    e_archiving_only_enabled: attr(a, "e_archiving_only_enabled"),
    e_archiving_only_activated_at: attr(a, "e_archiving_only_activated_at"),
    e_archiving_only_waiting: attr(a, "e_archiving_only_waiting"),
    using_sales_receipt: attr(a, "using_sales_receipt"),
    using_emikro_einvoice: attr(a, "using_emikro_einvoice"),
    using_emikro_services: attr(a, "using_emikro_services"),
    e_invoicing_waiting: attr(a, "e_invoicing_waiting"),
    e_invoicing_order_details_enabled: attr(a, "e_invoicing_order_details_enabled"),
    email_tx_import_enabled: attr(a, "email_tx_import_enabled"),
    bank_sync_setup_is_bankasi_enabled: attr(a, "bank_sync_setup_is_bankasi_enabled"),
    bank_sync_setup_ing_bank_enabled: attr(a, "bank_sync_setup_ing_bank_enabled"),
    bank_sync_setup_akbank_enabled: attr(a, "bank_sync_setup_akbank_enabled"),
    bank_sync_setup_denizbank_enabled: attr(a, "bank_sync_setup_denizbank_enabled"),
    bank_sync_setup_kuveytturk_enabled: attr(a, "bank_sync_setup_kuveytturk_enabled"),
    bank_sync_setup_teb_enabled: attr(a, "bank_sync_setup_teb_enabled"),
    bank_sync_setup_finansbank_enabled: attr(a, "bank_sync_setup_finansbank_enabled"),
    bank_sync_setup_fibabanka_enabled: attr(a, "bank_sync_setup_fibabanka_enabled"),
    bank_sync_setup_albaraka_enabled: attr(a, "bank_sync_setup_albaraka_enabled"),
    bank_sync_setup_ornekbank_enabled: attr(a, "bank_sync_setup_ornekbank_enabled"),
    bank_sync_setup_yapikredi_enabled: attr(a, "bank_sync_setup_yapikredi_enabled"),
    bank_sync_setup_vakifbank_enabled: attr(a, "bank_sync_setup_vakifbank_enabled"),
    bank_sync_setup_enpara_enabled: attr(a, "bank_sync_setup_enpara_enabled"),
    bank_sync_setup_garanti_enabled: attr(a, "bank_sync_setup_garanti_enabled"),
    bank_sync_setup_ziraat_bankasi_enabled: attr(a, "bank_sync_setup_ziraat_bankasi_enabled"),
    bank_sync_setup_halkbank_enabled: attr(a, "bank_sync_setup_halkbank_enabled"),
    multiple_bank_integration_enabled: attr(a, "multiple_bank_integration_enabled"),
    e_commerce_integration_enabled: attr(a, "e_commerce_integration_enabled"),
    fibabanka_credit_application_enabled: attr(a, "fibabanka_credit_application_enabled"),
    inbound_edocument_page_enabled: attr(a, "inbound_edocument_page_enabled"),
    batch_updated_vat_rates: attr(a, "batch_updated_vat_rates"),
    invoice_note_enabled: attr(a, "invoice_note_enabled"),
    has_odeal_integration: attr(a, "has_odeal_integration"),
    has_507_and_509: attr(a, "has_507_and_509"),
    footer_aggregate_enabled: attr(a, "footer_aggregate_enabled"),
    contact_transfer_enabled: attr(a, "contact_transfer_enabled"),
    pending_qr_code_migration: attr(a, "pending_qr_code_migration"),
    ai_support_rag: attr(a, "ai_support_rag"),
    ai_features_enabled: attr(a, "ai_features_enabled"),
    operator_id: attr(a, "operator_id"),
    employee_id: attr(a, "employee_id"),
    used_app: attr(a, "used_app"),
    signature: attr(a, "signature"),
    inspectable: attr(a, "inspectable"),
    raw_company_list: companyListRaw,
    extra_flags: extraFlags,
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

// /v4/companies is a separate real endpoint/source (Phase 12.1 section 2/3):
// same company id, but a minimal stub (only name/app_url attributes today).
// Its raw resource is attached via the `raw_company_list` field on
// mapMeCompany's result -- never merged into `raw` (the /v4/me-sourced
// document), preserving distinct provenance per field.
export function findCompanyListEntry(companyListResources: JsonApiResource[], companyParasutId: string): JsonApiResource | null {
  return companyListResources.find((c) => c.id === companyParasutId) ?? null;
}

export function mapMeAddress(item: JsonApiResource, addressableType: string | null, addressableParasutId: number | null): AddressRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) throw new Error(`Address resource has a non-numeric id: ${item.id}`);
  return {
    parasut_id: parasutId,
    // Real value from item.type (the address's own JSON:API resource
    // envelope, as returned live by /v4/me's included array) -- proven by
    // the API, not constructed from a constant.
    parasut_type: item.type,
    name: attr(a, "name"),
    address: attr(a, "address"),
    phone: attr(a, "phone"),
    fax: attr(a, "fax"),
    addressable_type: addressableType,
    addressable_parasut_id: addressableParasutId,
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
