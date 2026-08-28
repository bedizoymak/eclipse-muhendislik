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
  extra_flags: Record<string, unknown>;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export interface AddressRow {
  parasut_id: number;
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
]);

export function mapUser(item: JsonApiResource): UserRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) throw new Error(`User resource has a non-numeric id: ${item.id}`);
  return {
    parasut_id: parasutId,
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

export function mapMeCompany(item: JsonApiResource): CompanyRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) throw new Error(`Company resource has a non-numeric id: ${item.id}`);
  const owner = relatedRef(item, "owner");
  const address = relatedRef(item, "address");
  const defaultWarehouse = relatedRef(item, "default_warehouse");

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
    default_warehouse_parasut_id: defaultWarehouse.id,
    allowed_inspection_at: attr(a, "allowed_inspection_at"),
    extra_flags: extraFlags,
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export function mapMeAddress(item: JsonApiResource, addressableType: string | null, addressableParasutId: number | null): AddressRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) throw new Error(`Address resource has a non-numeric id: ${item.id}`);
  return {
    parasut_id: parasutId,
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
