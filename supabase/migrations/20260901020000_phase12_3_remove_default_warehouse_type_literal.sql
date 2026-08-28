-- Phase 12.3: remove the last remaining fabricated type literal.
--
-- public.parasut_company_profile_demo currently computes
-- default_warehouse_parasut_type via:
--   case when c.default_warehouse_parasut_id is not null then 'warehouses' end
-- This was deliberately left in place by the post-Phase-12.2 audit migration
-- (20260901010000) on the reasoning that relationships.default_warehouse is
-- permanently {"meta":{}} on this account, so there is no real .type value
-- to discard -- unlike owner/address/company, which really do carry a type
-- in the JSON:API relationship payload that the code was throwing away.
--
-- On further review that reasoning does not hold up for what the value is
-- used for: 'warehouses' here is being assigned to a column whose name and
-- consumption (UI "type" label alongside a real id) represent it as if it
-- were a real API relationship type. But the API genuinely never returns
-- any type for this relationship -- confirmed again in this phase directly
-- against relationships.default_warehouse = {"meta":{}} on GET /v4/me. A
-- plausible label is not a source. The rule from the audit itself applies:
-- a NULL_SOURCE_NOT_RETURNED field must never be shown as if it were real.
--
-- Fix: drop the CASE literal, return NULL. default_warehouse_parasut_id is
-- untouched (real, from attributes.default_warehouse_id, kept as-is). No
-- warehouse name or link is fabricated or joined in here even though a
-- real parasut.warehouses row with this id happens to exist (id 1000122982,
-- name "Ana Depo", verified live via a separate real /v4/warehouses sync)
-- -- that data comes from a different resource/endpoint than the
-- relationship this field represents, and Phase 12.3's instructions are to
-- report this field BLOCKED, not to backfill it from an unrelated table.

drop view if exists public.parasut_company_profile_demo;

create view public.parasut_company_profile_demo
as
select
  c.parasut_id,
  c.parasut_type,
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
  c.owner_parasut_type,
  c.default_warehouse_parasut_id,
  null::text as default_warehouse_parasut_type,
  c.address_parasut_id,
  c.address_parasut_type,
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
  'Phase 12.3: default_warehouse_parasut_type is always NULL -- relationships.default_warehouse is permanently {"meta":{}} on GET /v4/me, so no real type value exists to expose. See migration 20260901020000 header. parasut_type/owner_parasut_type/address_parasut_type unchanged from 20260901010000 (real stored columns).';
