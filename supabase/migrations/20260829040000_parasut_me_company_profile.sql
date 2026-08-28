-- Phase 12: Şirket Profili ve /v4/me verisi.
--
-- Real API verification (GET https://api.parasut.com/v4/me, live account,
-- this migration's authoring session, token via PARASUT_USERNAME/PASSWORD
-- password grant):
--   * GET /v4/me -> 200. Root resource: id "800086", type "users". Stable
--     across two consecutive calls (same id/attributes/relationships).
--   * Root relationships: user_roles (data: [{id:"875199",type:"user_roles"}]),
--     profile (data: {id:"801196",type:"profiles"}).
--   * included: one user_roles (875199) whose own relationships.company.data
--     is {id:"666034",type:"companies"} -- the real user->company link, NOT
--     derived from the request URL's company_id and NOT a hardcoded
--     "companies" constant. One companies resource (666034, matches
--     PARASUT_COMPANY_ID and the existing parasut.companies row exactly).
--     One addresses resource (295028) reached via companies.relationships
--     .address.data -- NOT a top-level /v4/me relationship; it belongs to
--     the company, not the user. One profiles resource (801196) matching
--     the root user's own profile relationship.
--   * Exactly one company appears in the whole document (no duplicates, no
--     pagination) -- there is no real "active/selected company" concept
--     exposed by this endpoint; the single company is kept as the one real
--     record, never assumed to be "the first of several".
--   * GET /v4/companies -> 200 this session (real `data:[{id:"666034",
--     type:"companies",attributes:{name,app_url}}]` -- a minimal company
--     stub, fewer attributes than the /v4/me included company). Differs
--     from the Phase 8.0 baseline (404) -- re-verified live, not forced;
--     both endpoints agree on the same company id 666034.
--   * GET /v4/{company_id} -> 404 "No route matches." (unchanged from
--     Phase 8.0 baseline).
--   * GET /v4/me?include=bogus_relation -> 200, include silently ignored
--     (no error, same body as plain /v4/me). GET /v4/me?include=company ->
--     200, also silently ignored (company is never a valid direct include
--     on /v4/me; it only ever arrives via user_roles.company).
--
-- Existing parasut.companies row (parasut_id 666034) and parasut.addresses
-- row (parasut_id 295028) were compared field-by-field against this live
-- response: id, address text, phone, parasut_created_at/updated_at all
-- match exactly (only dynamic fields like credit_balance/
-- last_consumption_date legitimately differ, as expected for live
-- counters). The address is REAL and CURRENT, not stale -- its only defect
-- is addressable_type/addressable_parasut_id were never populated (both
-- NULL). This migration adds no data by guesswork; the sync function
-- (Phase 12 code commit) is what populates addressable_type='companies',
-- addressable_parasut_id=666034 from the real relationship, the next time
-- it runs.
--
-- New real columns added to parasut.companies (all present as real
-- attribute keys in the live response above; several are real `false`/
-- real `null` on this account today and are preserved as such, never
-- fabricated):
--   owner_parasut_id, address_parasut_id, default_warehouse_parasut_id,
--   logo_url, credit_balance, last_consumption_date, new_subscription_status,
--   e_invoicing_enabled, e_archiving_enabled, e_despatch_enabled,
--   e_commerce_enabled, e_invoicing_activated_at, e_archiving_activated_at,
--   e_despatch_activated_at, sales_offer_enabled, export_invoice_enabled,
--   using_multiple_warehouses, using_variant, uses_credit_service,
--   credit_service_enabled, can_use_ai_reporting, can_use_ai_support.
-- The remaining bank_sync_setup_* / feature-flag attributes (real, but not
-- individually business-meaningful) are preserved in full inside `raw`
-- (private schema only) and additionally surfaced, in full, via a curated
-- `extra_flags` jsonb column so no real safe company field is left
-- reachable only from raw -- the public view below re-exposes that jsonb
-- column verbatim.
--
-- New private (parasut schema only -- NEVER referenced by any public view)
-- tables:
--   parasut.users        -- root /v4/me user resource. Stores name/email
--                            (both acceptable to show later) alongside
--                            unconfirmed_email/approved_contracts/
--                            approved_new_contracts/is_confirmed/
--                            integration_contract_statuses/
--                            keycloak_tfa_enabled/keycloak_email_otp_enabled.
--                            The keycloak_* fields are 2FA/OTP security
--                            settings and unconfirmed_email/is_confirmed
--                            are account-verification state -- classified
--                            private/base-only, never exposed publicly.
--   parasut.profiles     -- included "profiles" resource (801196): phone,
--                            job_title, settings jsonb, avatar jsonb. UI
--                            preference (settings.is_app_navigation_
--                            collapsed) kept private; phone is real+safe
--                            business contact info and is the one field
--                            surfaced in the public relation view.
--   parasut.user_roles   -- included "user_roles" resource (875199): the
--                            real user<->company relationship object. Its
--                            attributes (sales_invoices/expenditures/
--                            own_expenditures/employees/accounts/settings,
--                            e.g. "rw") are Parasut PERMISSION values --
--                            classified as permission secrets and stored
--                            here ONLY, never in any public view/column.
--                            Only its id/type (a relationship pointer, not
--                            a secret) is re-exposed publicly.
-- No OAuth access/refresh token, password, or API credential is stored in
-- any table -- those never appear anywhere in the /v4/me response body;
-- they exist only as the Authorization header used to call the API and are
-- never persisted.

alter table parasut.companies
  add column if not exists trade_registry_number text,
  add column if not exists owner_parasut_id bigint,
  add column if not exists address_parasut_id bigint,
  add column if not exists default_warehouse_parasut_id bigint,
  add column if not exists logo_url text,
  add column if not exists credit_balance numeric,
  add column if not exists last_consumption_date timestamptz,
  add column if not exists new_subscription_status text,
  add column if not exists e_invoicing_enabled boolean,
  add column if not exists e_archiving_enabled boolean,
  add column if not exists e_despatch_enabled boolean,
  add column if not exists e_commerce_enabled boolean,
  add column if not exists e_invoicing_activated_at date,
  add column if not exists e_archiving_activated_at date,
  add column if not exists e_despatch_activated_at date,
  add column if not exists sales_offer_enabled boolean,
  add column if not exists export_invoice_enabled boolean,
  add column if not exists using_multiple_warehouses boolean,
  add column if not exists using_variant boolean,
  add column if not exists uses_credit_service boolean,
  add column if not exists credit_service_enabled boolean,
  add column if not exists can_use_ai_reporting boolean,
  add column if not exists can_use_ai_support boolean,
  add column if not exists extra_flags jsonb;

create table if not exists parasut.users (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null unique,
  name text,
  email text,
  unconfirmed_email text,
  is_confirmed boolean,
  approved_contracts boolean,
  approved_new_contracts boolean,
  integration_contract_statuses jsonb,
  keycloak_tfa_enabled boolean,
  keycloak_email_otp_enabled boolean,
  raw jsonb not null,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists parasut.profiles (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null unique,
  user_parasut_id bigint,
  phone text,
  job_title text,
  settings jsonb,
  avatar jsonb,
  raw jsonb not null,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists parasut.user_roles (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null unique,
  user_parasut_id bigint,
  company_parasut_id bigint,
  sales_invoices text,
  expenditures text,
  own_expenditures text,
  employees text,
  accounts text,
  settings text,
  user_role_type text,
  raw jsonb not null,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_roles_company_idx on parasut.user_roles(company_parasut_id);
create index if not exists user_roles_user_idx on parasut.user_roles(user_parasut_id);
create index if not exists profiles_user_idx on parasut.profiles(user_parasut_id);

-- Public company profile view: every real, safe, business-meaningful
-- company field (Section 4/section 9 of the Phase 12 spec). No user field,
-- no permission value, no token is exposed here.
create or replace view public.parasut_company_profile_demo
as
select
  c.parasut_id,
  'companies'::text as parasut_type,
  c.name,
  c.legal_name,
  c.tax_office,
  c.tax_number,
  c.mersis_no,
  c.trade_registry_number,
  c.district,
  c.city,
  c.occupation_field,
  c.primary_job,
  c.app_url,
  c.logo_url,
  c.credit_balance,
  c.new_subscription_status,
  c.valid_until,
  c.e_invoicing_enabled,
  c.e_archiving_enabled,
  c.e_despatch_enabled,
  c.e_commerce_enabled,
  c.e_invoicing_activated_at,
  c.e_archiving_activated_at,
  c.e_despatch_activated_at,
  c.sales_offer_enabled,
  c.export_invoice_enabled,
  c.using_multiple_warehouses,
  c.using_variant,
  c.uses_credit_service,
  c.credit_service_enabled,
  c.can_use_ai_reporting,
  c.can_use_ai_support,
  c.accessible,
  c.inspectable,
  c.inventory_enabled,
  c.has_iyzico_integration,
  c.extra_flags,
  c.owner_parasut_id,
  'users'::text as owner_parasut_type,
  c.address_parasut_id,
  case when c.address_parasut_id is not null then 'addresses' end as address_parasut_type,
  a.address as address_text,
  a.phone as address_phone,
  a.fax as address_fax,
  c.parasut_created_at,
  c.parasut_updated_at,
  c.synced_at
from parasut.companies c
left join parasut.addresses a
  on a.parasut_id = c.address_parasut_id
order by c.parasut_id;

grant select on public.parasut_company_profile_demo to authenticated, anon;

-- Public "Paraşüt Kullanıcısı" view: only real, safe, business-meaningful
-- user fields (name/email) plus the real user<->company relationship
-- pointer (id/type only -- never the underlying rw/na permission values,
-- which stay in parasut.user_roles, never public).
create or replace view public.parasut_user_company_relation_demo
as
select
  u.parasut_id as user_parasut_id,
  'users'::text as user_parasut_type,
  u.name as user_name,
  u.email as user_email,
  p.phone as user_phone,
  ur.parasut_id as relation_parasut_id,
  'user_roles'::text as relation_parasut_type,
  ur.company_parasut_id,
  'companies'::text as company_parasut_type
from parasut.user_roles ur
join parasut.users u on u.parasut_id = ur.user_parasut_id
left join parasut.profiles p on p.user_parasut_id = ur.user_parasut_id
order by ur.parasut_id;

grant select on public.parasut_user_company_relation_demo to authenticated, anon;
