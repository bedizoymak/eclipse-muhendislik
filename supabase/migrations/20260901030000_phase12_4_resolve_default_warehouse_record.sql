-- Phase 12.4: resolve the real, independently-synced warehouse record for
-- companies.default_warehouse_parasut_id, while keeping the /me relationship
-- type BLOCKED (unchanged from Phase 12.3).
--
-- Phase 12.3 confirmed (and this phase re-confirmed live, GET /v4/me and
-- GET /v4/{company}/warehouses/1000122982 on 2026-08-28):
--   - included[companies].attributes.default_warehouse_id = 1000122982 (real)
--   - included[companies].relationships.default_warehouse = {"meta":{}}
--     (no data.id/data.type -- genuinely absent, stays NULL, BLOCKED)
--   - a SEPARATE, independent /v4/warehouses sync has a real row for id
--     1000122982: name "Ana Depo", archived false, resource type "warehouses"
--     (root `type` of the warehouse resource itself -- a real API value,
--     but NOT the missing /me relationship type; it must never be used as a
--     substitute for it)
--
-- Phase 12.3 deliberately left this second, independent record unused,
-- per its own instructions. Phase 12.4's instructions are the opposite:
-- since the ID genuinely matches a real, independent warehouse record, that
-- record's real+safe fields (name, archived, its own resource type) must be
-- resolved and shown -- while default_warehouse_parasut_type (the missing
-- /me relationship type) stays exactly as Phase 12.3 left it: NULL/BLOCKED.
--
-- parasut.warehouses.parasut_id is both PRIMARY KEY and UNIQUE
-- (warehouses_pkey, warehouses_parasut_id_key) so a duplicate match is
-- structurally impossible; the join below is written defensively anyway
-- (equality join, one row expected) and would surface duplicates as
-- multiple output rows rather than silently picking one, if that
-- constraint were ever removed.

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
  w.name as default_warehouse_name,
  w.archived as default_warehouse_archived,
  w.resource_type as default_warehouse_resource_type,
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
left join (
  select
    parasut_id,
    name,
    archived,
    raw->>'type' as resource_type
  from parasut.warehouses
) w
  on w.parasut_id = c.default_warehouse_parasut_id
order by c.parasut_id;

grant select on public.parasut_company_profile_demo to authenticated, anon;

comment on view public.parasut_company_profile_demo is
  'Phase 12.4: default_warehouse_parasut_id resolved against the independent parasut.warehouses sync (join on parasut_id, which is PK+UNIQUE, so at most one match). default_warehouse_name/_archived/_resource_type come from that real warehouse record when matched, NULL otherwise -- never guessed from the id, never a SQL literal. default_warehouse_parasut_type stays NULL/BLOCKED: it represents the /me relationships.default_warehouse.data.type, which the API genuinely never returns ({"meta":{}}); default_warehouse_resource_type (the independent warehouse resources own root .type) must never be used in its place. parasut_type/owner_parasut_type/address_parasut_type unchanged from 20260901020000 (real stored columns).';
