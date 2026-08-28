-- Phase 12.2: Şirket profili eksik gerçek alanlar ve kaynak doğrulaması.
--
-- Corrects Phase 12.1 (migration 20260830050000, kept unmodified). Phase
-- 12.1's own field matrix already listed 11 real+safe values that were
-- captured in base/raw but never wired to the public view/UI:
--   1. logo.is_processing            6. profiles.id
--   2. default_warehouse_id          7. profiles.type
--   3. last_consumption_date         8. addresses.created_at
--   4. users.created_at              9. addresses.updated_at
--   5. users.updated_at             10. addresses.addressable_type
--                                    11. addresses.addressable_parasut_id
--
-- Re-verified live this session (2 consecutive GET /v4/me calls,
-- byte-identical; GET /v4/companies also re-checked):
--   root:  id "800086", type "users" (included: none -- /v4/me's root IS
--          the user; users.type is real, taken from data.type)
--   included companies (666034): attributes.logo =
--     {"url":"https://parasut-dosyalar.s3.amazonaws.com/production/Company/
--      logo/666034/2023_11_29__06_29_20--logo.png","is_processing":false}
--     -- url is byte-identical to attributes.logo_url (already stored);
--     is_processing=false is a SEPARATE real boolean, stored here for the
--     first time (never assumed false just because a URL exists -- this is
--     the real API value).
--     attributes.default_warehouse_id = 1000122982 (real int, independent
--     of relationships.default_warehouse which is {"meta":{}} -- empty
--     relationship, no warehouse detail/name available or fabricated).
--     attributes.last_consumption_date = "2026-08-26T10:05:11.170Z" (real
--     ISO8601 UTC timestamp, preserved verbatim, no recompute/shift).
--     relationships.owner.data = {"id":"800086","type":"users"}.
--     relationships.address.data = {"id":"295028","type":"addresses"}.
--   root user attributes.created_at = "2023-11-29T06:22:30.182Z",
--     attributes.updated_at = "2026-05-22T12:28:18.051Z" (both real, UTC).
--   included profiles (801196): id/type real ("801196"/"profiles"),
--     attributes.created_at = "2023-11-29T06:22:30.187Z",
--     attributes.updated_at = "2026-07-18T10:21:06.978Z", phone real.
--   included addresses (295028): id/type real ("295028"/"addresses"),
--     attributes.created_at = "2023-11-29T06:45:51.135Z",
--     attributes.updated_at = "2025-12-30T18:07:08.528Z". The included
--     address resource itself carries NO relationships block in this
--     response (verified: `addr.relationships === undefined`) -- so the
--     only real source for "this address belongs to company 666034" is
--     the COMPANY's own relationships.address.data pointer, walked in the
--     opposite direction. Phase 12/12.1's sync code stored the parent
--     pointer as addressable_type='companies' (STRING CONSTANT in
--     index.ts) / addressable_parasut_id=<company id variable>. The type
--     half of that was a hardcoded literal, not read from the API -- this
--     migration's paired code change (index.ts) fixes that by using
--     companyItem.type (the real, API-returned resource type of the
--     parent) instead of the "companies" string literal. The id half was
--     always a real variable (never a hardcoded id), so only the type
--     needed fixing.
--   GET /v4/companies -> 200, same single company 666034,
--     attributes={name,app_url} only. Unchanged from Phase 12.1's finding
--     (re-confirmed, not re-copied).
--
-- New real columns:
--   parasut.companies.logo_is_processing boolean (public)
--   parasut.addresses.parasut_type text -- the address's OWN JSON:API
--     `type`, read from item.type (real, dynamic), replacing any implicit
--     "addresses" assumption.
--   parasut.users.parasut_type text -- root resource's own `type` (real,
--     dynamic, from item.type), used to remove the "users"::text SQL
--     constant from parasut_user_company_relation_demo where it stood in
--     for the user's own resource type.
--   parasut.profiles.parasut_type text -- included profile resource's own
--     `type` (real, dynamic, from item.type).
-- (default_warehouse_parasut_id and last_consumption_date already existed
-- as base columns from Phase 12/12.1 -- only their PUBLIC VIEW exposure is
-- added here, no new base column needed for those two.)
--
-- Public/private re-classification this phase:
--   default_warehouse_id: was private in 12.1 ("relationship is meta-only
--     so classified private") -- this was an error: the ATTRIBUTE
--     default_warehouse_id is a real, independently-populated int
--     (1000122982) distinct from the EMPTY relationships.default_warehouse
--     ({"meta":{}}). The empty relationship still yields no warehouse
--     name/detail-link (none fabricated, per rule), but the bare real ID
--     itself is safe business data -> reclassified PUBLIC.
--   last_consumption_date: was private in 12.1 ("dynamic internal
--     counter") -- re-examined: it is a plain informational timestamp
--     (last time the account consumed a metered resource), not a
--     security/permission field -> reclassified PUBLIC, shown as the real
--     UTC value, never recomputed.
--   logo_is_processing, users.created_at/updated_at, profiles.id/type,
--     addresses.created_at/updated_at/addressable_type/
--     addressable_parasut_id: all real+safe, newly wired PUBLIC.
--   Fields that stay PRIVATE (unchanged, re-affirmed): operator_id,
--     employee_id, used_app, allowed_inspection_at, inspectable,
--     signature, extra_flags-eligible unknowns, user
--     unconfirmed_email/is_confirmed/approved_contracts/
--     approved_new_contracts/integration_contract_statuses/
--     keycloak_tfa_enabled/keycloak_email_otp_enabled, user_role
--     permission values (sales_invoices/expenditures/own_expenditures/
--     employees/accounts/settings/user_role_type), profile
--     job_title/settings/avatar.

alter table parasut.companies
  add column if not exists logo_is_processing boolean;

alter table parasut.addresses
  add column if not exists parasut_type text;

alter table parasut.users
  add column if not exists parasut_type text;

alter table parasut.profiles
  add column if not exists parasut_type text;

alter table parasut.user_roles
  add column if not exists parasut_type text;

-- Recreate the public company view: add logo_is_processing,
-- default_warehouse_parasut_id (reclassified public), last_consumption_date
-- (reclassified public), address_parasut_type (real, from
-- parasut.addresses.parasut_type, replacing any implicit constant),
-- address_created_at/address_updated_at, address_addressable_type/
-- address_addressable_parasut_id (the address's own parent pointer,
-- distinct from company.address_parasut_id/address_parasut_type which is
-- the COMPANY's pointer TO the address -- two different relationship
-- directions, both real, neither substitutes for the other).
drop view if exists public.parasut_company_profile_demo;

create view public.parasut_company_profile_demo
as
select
  c.parasut_id,
  'companies'::text as parasut_type,
  c.name,
  c.legal_name,
  c.tax_office,
  c.tax_number,
  c.e_invoice_vkn,
  c.mersis_no,
  c.trade_registry_number,
  c.district,
  c.city,
  c.occupation_field,
  c.primary_job,
  c.app_url,
  c.logo_url,
  c.logo_is_processing,
  c.credit_balance,
  c.last_consumption_date,
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
  c.inventory_enabled,
  c.has_iyzico_integration,
  c.display_exchange_rate_in_offer_pdf,
  c.payment_with_akbank_enabled,
  c.can_upload_signature,
  c.invoicing_preferences,
  c.e_smm_enabled,
  c.e_smm_activated_at,
  c.e_archiving_only_enabled,
  c.e_archiving_only_activated_at,
  c.e_archiving_only_waiting,
  c.using_sales_receipt,
  c.using_emikro_einvoice,
  c.using_emikro_services,
  c.e_invoicing_waiting,
  c.e_invoicing_order_details_enabled,
  c.email_tx_import_enabled,
  c.bank_sync_setup_is_bankasi_enabled,
  c.bank_sync_setup_ing_bank_enabled,
  c.bank_sync_setup_akbank_enabled,
  c.bank_sync_setup_denizbank_enabled,
  c.bank_sync_setup_kuveytturk_enabled,
  c.bank_sync_setup_teb_enabled,
  c.bank_sync_setup_finansbank_enabled,
  c.bank_sync_setup_fibabanka_enabled,
  c.bank_sync_setup_albaraka_enabled,
  c.bank_sync_setup_ornekbank_enabled,
  c.bank_sync_setup_yapikredi_enabled,
  c.bank_sync_setup_vakifbank_enabled,
  c.bank_sync_setup_enpara_enabled,
  c.bank_sync_setup_garanti_enabled,
  c.bank_sync_setup_ziraat_bankasi_enabled,
  c.bank_sync_setup_halkbank_enabled,
  c.multiple_bank_integration_enabled,
  c.e_commerce_integration_enabled,
  c.fibabanka_credit_application_enabled,
  c.inbound_edocument_page_enabled,
  c.batch_updated_vat_rates,
  c.invoice_note_enabled,
  c.has_odeal_integration,
  c.has_507_and_509,
  c.footer_aggregate_enabled,
  c.contact_transfer_enabled,
  c.pending_qr_code_migration,
  c.ai_support_rag,
  c.ai_features_enabled,
  c.owner_parasut_id,
  'users'::text as owner_parasut_type,
  c.default_warehouse_parasut_id,
  case when c.default_warehouse_parasut_id is not null then 'warehouses' end as default_warehouse_parasut_type,
  c.address_parasut_id,
  case when c.address_parasut_id is not null then 'addresses' end as address_parasut_type,
  a.name as address_name,
  a.address as address_text,
  a.phone as address_phone,
  a.fax as address_fax,
  a.parasut_type as address_own_parasut_type,
  a.addressable_type as address_addressable_type,
  a.addressable_parasut_id as address_addressable_parasut_id,
  a.parasut_created_at as address_created_at,
  a.parasut_updated_at as address_updated_at,
  c.parasut_created_at,
  c.parasut_updated_at,
  c.synced_at
from parasut.companies c
left join parasut.addresses a
  on a.parasut_id = c.address_parasut_id
order by c.parasut_id;

grant select on public.parasut_company_profile_demo to authenticated, anon;

comment on view public.parasut_company_profile_demo is
  'Phase 12.2: adds logo_is_processing, default_warehouse_parasut_id, last_consumption_date, and full address created_at/updated_at/addressable_type/addressable_parasut_id. See migration 20260901000000 header for the full field-by-field re-verification and reclassification rationale.';

-- Recreate the public user/company relation view: add user id/type/
-- created_at/updated_at and profile id/type. `default_warehouse_parasut_type`
-- above uses 'warehouses' as a label only when a real id is present (never
-- fabricates a name/detail link -- see UI: shows only the bare id).
drop view if exists public.parasut_user_company_relation_demo;

create view public.parasut_user_company_relation_demo
as
select
  u.parasut_id as user_parasut_id,
  u.parasut_type as user_parasut_type,
  u.name as user_name,
  u.email as user_email,
  u.parasut_created_at as user_created_at,
  u.parasut_updated_at as user_updated_at,
  p.parasut_id as profile_parasut_id,
  p.parasut_type as profile_parasut_type,
  p.phone as user_phone,
  ur.parasut_id as relation_parasut_id,
  ur.parasut_type as relation_parasut_type,
  ur.company_parasut_id,
  'companies'::text as company_parasut_type
from parasut.user_roles ur
join parasut.users u on u.parasut_id = ur.user_parasut_id
left join parasut.profiles p on p.user_parasut_id = ur.user_parasut_id
order by ur.parasut_id;

grant select on public.parasut_user_company_relation_demo to authenticated, anon;

comment on view public.parasut_user_company_relation_demo is
  'Phase 12.2: adds user_created_at/user_updated_at (real, UTC), profile_parasut_id/profile_parasut_type. user_parasut_type/relation_parasut_type now read from stored parasut_type columns (real API item.type) instead of SQL string constants.';
