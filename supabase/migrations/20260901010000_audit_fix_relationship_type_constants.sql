-- EK DENETIM (post-Phase-12.2 project-wide constant/fabricated-data audit):
-- found that public.parasut_company_profile_demo and
-- public.parasut_user_company_relation_demo were still emitting SQL
-- literal type constants ('companies'::text as parasut_type,
-- 'users'::text as owner_parasut_type, 'addresses'/'warehouses' via CASE,
-- 'companies'::text as company_parasut_type) even though the REAL value
-- was already available at sync time from the JSON:API relationship
-- payload (relationships.owner.data.type, relationships.address.data.type,
-- relationships.company.data.type, and the company resource's own
-- item.type) and simply discarded by the mapper (only .id was kept, .type
-- was computed by relatedRef() and thrown away). This is the exact
-- FORBIDDEN_HARDCODED_DATA pattern already fixed once for
-- addresses.addressable_type in Phase 12.2 section 8 -- it was missed for
-- these other four type fields. Fixed at the source: the Edge Function
-- (supabase/functions/parasut-sync/resources/me.ts) now captures and
-- stores the real type alongside each id; this migration adds the
-- matching columns and repoints the two views at them, removing every
-- remaining literal type constant from both views.

alter table parasut.companies
  add column if not exists parasut_type text,
  add column if not exists owner_parasut_type text,
  add column if not exists address_parasut_type text;

alter table parasut.user_roles
  add column if not exists company_parasut_type text;

-- Recreate public.parasut_company_profile_demo: parasut_type,
-- owner_parasut_type, address_parasut_type now read from real stored
-- columns (populated from item.type / relatedRef(...).type at sync time)
-- instead of SQL string literals. default_warehouse_parasut_type is left
-- as-is (CASE ... then 'warehouses' end) -- unlike owner/address, Parasut
-- never returns a real relationships.default_warehouse.data.type on this
-- account (the relationship itself is permanently {"meta":{}} / empty, so
-- there is no real type value to capture at all, not even a discarded
-- one); it is used only as a label gated on a real non-null id, per the
-- Phase 12.2 §9 empty-relationship rule, and is documented as such.
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
  case when c.default_warehouse_parasut_id is not null then 'warehouses' end as default_warehouse_parasut_type,
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
  'Post-Phase-12.2 audit fix: parasut_type, owner_parasut_type, address_parasut_type now read from real stored columns (item.type / relationship .type captured at sync time) instead of SQL string literals. See migration 20260901010000 header.';

-- Recreate public.parasut_user_company_relation_demo: company_parasut_type
-- now read from the real stored column (relationships.company.data.type,
-- captured via relatedRef() at sync time) instead of a SQL literal.
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
  ur.company_parasut_type
from parasut.user_roles ur
join parasut.users u on u.parasut_id = ur.user_parasut_id
left join parasut.profiles p on p.user_parasut_id = ur.user_parasut_id
order by ur.parasut_id;

grant select on public.parasut_user_company_relation_demo to authenticated, anon;

comment on view public.parasut_user_company_relation_demo is
  'Post-Phase-12.2 audit fix: company_parasut_type now read from the real stored column (relationships.company.data.type) instead of a SQL literal. See migration 20260901010000 header.';
