-- Phase 12.1: Şirket tüm alanlar, /companies farkı ve public güvenlik.
--
-- Corrects Phase 12 (migration 20260829040000_parasut_me_company_profile.sql,
-- kept unmodified). Phase 12 bulk-collected 30+ real company attribute keys
-- into a single `extra_flags` jsonb column and exposed the WHOLE blob to the
-- public view. This migration re-extracts every one of those keys
-- individually from the live GET /v4/me included company (666034) response
-- (re-verified live, this session) and makes a per-field public/private
-- decision -- no field is left inside a collective jsonb blob rendered
-- generically to the public.
--
-- Live re-verification this session (two consecutive GET /v4/me calls,
-- byte-identical): full attribute key list on the included company 666034
-- resource (90 real keys, several nested):
--   created_at, updated_at, owner_id, name, allowed_inspection_at, app_url,
--   legal_name, occupation_field, district, city, tax_office, tax_number,
--   e_invoice_vkn, mersis_no (null), trade_registry_number (null),
--   credit_balance, last_consumption_date, display_exchange_rate_in_offer_pdf,
--   used_app (null), primary_job, e_invoicing_activated_at,
--   e_archiving_activated_at, e_smm_activated_at (null),
--   e_archiving_only_activated_at (null), e_despatch_activated_at,
--   new_subscription_status, employee_id (null), payment_with_akbank_enabled,
--   can_upload_signature, operator_id (null), invoicing_preferences ({}),
--   logo_url, default_warehouse_id, valid_until, accessible, inspectable,
--   inventory_enabled, e_commerce_enabled, e_invoicing_enabled,
--   e_archiving_enabled, e_archiving_only_enabled, e_smm_enabled,
--   e_despatch_enabled, sales_offer_enabled, export_invoice_enabled,
--   using_sales_receipt, using_multiple_warehouses, using_variant,
--   using_emikro_einvoice, e_invoicing_waiting, e_archiving_only_waiting,
--   uses_credit_service, credit_service_enabled, can_use_ai_reporting,
--   can_use_ai_support, has_iyzico_integration, logo.{url,is_processing}
--   (identical value to logo_url -- NOT stored a second time),
--   signature.{url,is_processing} (both null today),
--   e_invoicing_order_details_enabled, email_tx_import_enabled,
--   bank_sync_setup_{is_bankasi,ing_bank,akbank,denizbank,kuveytturk,teb,
--   finansbank,fibabanka,albaraka,ornekbank,yapikredi,vakifbank,enpara,
--   garanti,ziraat_bankasi,halkbank}_enabled (16 real booleans),
--   multiple_bank_integration_enabled, e_commerce_integration_enabled,
--   fibabanka_credit_application_enabled, using_emikro_services,
--   inbound_edocument_page_enabled, batch_updated_vat_rates,
--   invoice_note_enabled, has_odeal_integration, has_507_and_509,
--   footer_aggregate_enabled, contact_transfer_enabled,
--   pending_qr_code_migration, ai_support_rag, ai_features_enabled.
-- Every key above is now mapped to its own named column below -- none of
-- them are left inside `extra_flags`. `extra_flags` is kept (for forward
-- compatibility if Parasut adds a brand-new key later) but the UI must
-- never render it generically -- only pre-classified named columns render.
--
-- Per-field PUBLIC/PRIVATE decision (justification):
--   PUBLIC (safe, real, business-meaningful; moved to public view):
--     e_invoice_vkn (duplicate of tax_number, same real value),
--     display_exchange_rate_in_offer_pdf, payment_with_akbank_enabled,
--     can_upload_signature, invoicing_preferences (jsonb, no credentials),
--     e_smm_enabled/e_smm_activated_at, e_archiving_only_enabled/
--     _activated_at/_waiting, using_sales_receipt, using_emikro_einvoice,
--     using_emikro_services, e_invoicing_waiting,
--     e_invoicing_order_details_enabled, email_tx_import_enabled,
--     bank_sync_setup_*_enabled (16 -- these are "is bank-sync turned on
--     for bank X", not credentials/tokens for that bank),
--     multiple_bank_integration_enabled, e_commerce_integration_enabled,
--     fibabanka_credit_application_enabled, inbound_edocument_page_enabled,
--     batch_updated_vat_rates, invoice_note_enabled, has_odeal_integration,
--     has_507_and_509, footer_aggregate_enabled, contact_transfer_enabled,
--     pending_qr_code_migration, ai_support_rag, ai_features_enabled.
--   PRIVATE (internal-system/inspection/operator/security-adjacent --
--     base/raw only, NEVER in a public view/column):
--     operator_id (internal Parasut support-operator id assigned to this
--       account -- an internal access/inspection concept),
--     employee_id (internal linkage, not a public company fact),
--     used_app (internal usage-tracking marker),
--     allowed_inspection_at (internal inspection scheduling -- already a
--       base column from Phase 12 but was never in the public view; stays
--       that way, confirmed here explicitly),
--     inspectable (Phase 12 REGRESSION: this WAS in the Phase 12 public
--       view `parasut_company_profile_demo`. Reclassified private in this
--       migration and dropped from the view below -- it flags whether
--       Parasut/an operator can internally inspect this account, a
--       security/access-adjacent fact, not a business fact for a public
--       demo page),
--     signature jsonb (digital-signature upload state; both fields null
--       today but the shape can hold a signature file reference later --
--       kept private by classification, not because of today's null).
--
-- `/v4/companies` (re-verified live, this session, 3 separate calls
-- including `?include=bogus`, `?filter[bogus_filter]=1`, `?page[size]=1`):
-- 200, always the SAME single real company id 666034, attributes limited to
-- {name, app_url} only (no pagination -- one item, ignores include/filter
-- silently, same as /v4/me does). `/v4/companies/666034` and
-- `/v4/companies/999999999` both -> 404 "No route matches." (route does not
-- exist at all, not a per-id 404). `app_url` value from `/v4/companies` is
-- BYTE-IDENTICAL to the `app_url` already present on /v4/me's included
-- company -- no discrepancy, both a durable absolute URL
-- (https://uygulama.parasut.com/666034, host uygulama.parasut.com, no query
-- string, no signature/token, not S3-style) -- real+safe, already public
-- since Phase 12, kept public. Because `/v4/companies` is a strictly
-- smaller subset (2 of many attributes) of what `/v4/me` already includes,
-- it adds no new field -- but its raw response is stored separately, with
-- its own provenance, in `raw_company_list` (never merged into `raw`, which
-- is the /v4/me-sourced raw and is renamed in comment to raw_me_company
-- semantics without breaking the existing column name).

alter table parasut.companies
  add column if not exists e_invoice_vkn text,
  add column if not exists display_exchange_rate_in_offer_pdf boolean,
  add column if not exists payment_with_akbank_enabled boolean,
  add column if not exists can_upload_signature boolean,
  add column if not exists invoicing_preferences jsonb,
  add column if not exists e_smm_enabled boolean,
  add column if not exists e_smm_activated_at date,
  add column if not exists e_archiving_only_enabled boolean,
  add column if not exists e_archiving_only_activated_at date,
  add column if not exists e_archiving_only_waiting boolean,
  add column if not exists using_sales_receipt boolean,
  add column if not exists using_emikro_einvoice boolean,
  add column if not exists using_emikro_services boolean,
  add column if not exists e_invoicing_waiting boolean,
  add column if not exists e_invoicing_order_details_enabled boolean,
  add column if not exists email_tx_import_enabled boolean,
  add column if not exists bank_sync_setup_is_bankasi_enabled boolean,
  add column if not exists bank_sync_setup_ing_bank_enabled boolean,
  add column if not exists bank_sync_setup_akbank_enabled boolean,
  add column if not exists bank_sync_setup_denizbank_enabled boolean,
  add column if not exists bank_sync_setup_kuveytturk_enabled boolean,
  add column if not exists bank_sync_setup_teb_enabled boolean,
  add column if not exists bank_sync_setup_finansbank_enabled boolean,
  add column if not exists bank_sync_setup_fibabanka_enabled boolean,
  add column if not exists bank_sync_setup_albaraka_enabled boolean,
  add column if not exists bank_sync_setup_ornekbank_enabled boolean,
  add column if not exists bank_sync_setup_yapikredi_enabled boolean,
  add column if not exists bank_sync_setup_vakifbank_enabled boolean,
  add column if not exists bank_sync_setup_enpara_enabled boolean,
  add column if not exists bank_sync_setup_garanti_enabled boolean,
  add column if not exists bank_sync_setup_ziraat_bankasi_enabled boolean,
  add column if not exists bank_sync_setup_halkbank_enabled boolean,
  add column if not exists multiple_bank_integration_enabled boolean,
  add column if not exists e_commerce_integration_enabled boolean,
  add column if not exists fibabanka_credit_application_enabled boolean,
  add column if not exists inbound_edocument_page_enabled boolean,
  add column if not exists batch_updated_vat_rates boolean,
  add column if not exists invoice_note_enabled boolean,
  add column if not exists has_odeal_integration boolean,
  add column if not exists has_507_and_509 boolean,
  add column if not exists footer_aggregate_enabled boolean,
  add column if not exists contact_transfer_enabled boolean,
  add column if not exists pending_qr_code_migration boolean,
  add column if not exists ai_support_rag boolean,
  add column if not exists ai_features_enabled boolean,
  -- private-only (never selected by the public view below)
  add column if not exists operator_id bigint,
  add column if not exists employee_id bigint,
  add column if not exists used_app text,
  add column if not exists signature jsonb,
  -- separate real /v4/companies provenance, never merged into `raw`
  add column if not exists raw_company_list jsonb;

-- Recreate the public company view WITHOUT `extra_flags` (no more generic
-- blob) and WITHOUT `inspectable` (reclassified private this phase). All
-- newly-classified-public fields are added individually. Dropped and
-- recreated (not `create or replace`) because the column set/order changes
-- (Postgres forbids renaming/reordering existing view output columns via
-- `create or replace view`).
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
  c.address_parasut_id,
  case when c.address_parasut_id is not null then 'addresses' end as address_parasut_type,
  a.name as address_name,
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

comment on view public.parasut_company_profile_demo is
  'Phase 12.1: per-field classified public company profile. extra_flags and inspectable intentionally excluded (private/base only) -- see migration 20260830050000 header for the full per-key security decision table.';
