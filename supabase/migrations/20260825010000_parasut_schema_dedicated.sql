-- Parasut (parasut.com) API mirror schema, in its own `parasut` schema.
-- Generated from https://apidocs.parasut.com/swagger.json (API v4).
--
-- Supersedes the earlier public.parasut_* tables (dropped below): moved into
-- a dedicated schema, unprefixed table names, since the tables were empty.
--
-- Every table stores mapped columns for convenient querying PLUS a `raw`
-- jsonb column holding the complete API resource payload, so no data the
-- Parasut API returns is ever lost even if a field isn't mapped to a column.
--
-- RLS is enabled on every table with NO policies: this data is financial/PII
-- and is intended to be written and read only by a trusted backend sync
-- process using the service_role key. Note: to query this schema through
-- PostgREST/supabase-js (even with the service role key), add "parasut" to
-- Project Settings -> API -> Exposed schemas in the Supabase dashboard --
-- otherwise a direct Postgres connection (e.g. from a sync script) bypasses
-- that restriction entirely.

-- Drop the old public.parasut_* tables from the previous migration attempt.
drop table if exists public.parasut_companies cascade;
drop table if exists public.parasut_item_categories cascade;
drop table if exists public.parasut_tags cascade;
drop table if exists public.parasut_taxes cascade;
drop table if exists public.parasut_accounts cascade;
drop table if exists public.parasut_contacts cascade;
drop table if exists public.parasut_contact_people cascade;
drop table if exists public.parasut_addresses cascade;
drop table if exists public.parasut_employees cascade;
drop table if exists public.parasut_salaries cascade;
drop table if exists public.parasut_bank_fees cascade;
drop table if exists public.parasut_warehouses cascade;
drop table if exists public.parasut_products cascade;
drop table if exists public.parasut_inventory_levels cascade;
drop table if exists public.parasut_purchase_bills cascade;
drop table if exists public.parasut_purchase_bill_details cascade;
drop table if exists public.parasut_sales_invoices cascade;
drop table if exists public.parasut_sales_invoice_details cascade;
drop table if exists public.parasut_sales_offers cascade;
drop table if exists public.parasut_sales_offer_details cascade;
drop table if exists public.parasut_shipment_documents cascade;
drop table if exists public.parasut_stock_movements cascade;
drop table if exists public.parasut_stock_updates cascade;
drop table if exists public.parasut_stock_update_details cascade;
drop table if exists public.parasut_payments cascade;
drop table if exists public.parasut_transactions cascade;
drop table if exists public.parasut_e_invoices cascade;
drop table if exists public.parasut_e_archives cascade;
drop table if exists public.parasut_e_smms cascade;
drop table if exists public.parasut_e_invoice_inboxes cascade;
drop table if exists public.parasut_trackable_jobs cascade;
drop function if exists public.parasut_set_updated_at() cascade;

create extension if not exists pgcrypto;
create schema if not exists parasut;

create or replace function parasut.set_updated_at()
returns trigger
language plpgsql
set search_path = parasut
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Company
create table parasut.companies (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  name text,
  legal_name text,
  tax_office text,
  tax_number text,
  mersis_no text,
  district text,
  city text,
  occupation_field text,
  primary_job text,
  app_url text,
  subscription_status text,
  subscription_status_for_analytics text,
  subscription_started_at timestamptz,
  subscription_renewed_at timestamptz,
  subscription_value numeric,
  valid_until timestamptz,
  trial_expiration_at timestamptz,
  is_in_trial_period boolean,
  end_of_grace_period_at timestamptz,
  is_in_grace_period boolean,
  total_unused_bonus_months numeric,
  is_active boolean,
  accessible boolean,
  inspectable boolean,
  inventory_enabled boolean,
  has_iyzico_integration boolean,
  has_active_subscription boolean,
  allowed_inspection_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_parasut_id_key unique (parasut_id)
);

-- ItemCategory
create table parasut.item_categories (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  name text,
  full_path text,
  bg_color text,
  text_color text,
  category_type text,
  parent_category_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_categories_parasut_id_key unique (parasut_id)
);

-- Tag
create table parasut.tags (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  name text,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_parasut_id_key unique (parasut_id)
);

-- Tax
create table parasut.taxes (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  description text,
  issue_date date,
  due_date date,
  net_total numeric,
  total_paid numeric,
  remaining numeric,
  remaining_in_trl numeric,
  archived boolean,
  category_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taxes_parasut_id_key unique (parasut_id)
);

-- Account
create table parasut.accounts (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  name text,
  account_type text,
  currency text,
  bank_name text,
  bank_branch text,
  bank_account_no text,
  iban text,
  balance numeric,
  used_for text,
  last_used_at timestamptz,
  last_adjustment_date date,
  bank_integration_type text,
  associate_email text,
  archived boolean,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_parasut_id_key unique (parasut_id)
);

-- Contact
create table parasut.contacts (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  name text,
  short_name text,
  email text,
  contact_type text,
  tax_office text,
  tax_number text,
  district text,
  postal_code text,
  city text,
  country text,
  address text,
  phone text,
  fax text,
  is_abroad boolean,
  archived boolean,
  iban text,
  account_type text,
  untrackable boolean,
  invoicing_preferences jsonb,
  balance numeric,
  trl_balance numeric,
  usd_balance numeric,
  eur_balance numeric,
  gbp_balance numeric,
  category_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_parasut_id_key unique (parasut_id)
);

-- ContactPerson
create table parasut.contact_people (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  name text,
  email text,
  phone text,
  notes text,
  contact_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_people_parasut_id_key unique (parasut_id)
);

-- Address
create table parasut.addresses (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  name text,
  address text,
  phone text,
  fax text,
  addressable_type text,
  addressable_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_parasut_id_key unique (parasut_id)
);

-- Employee
create table parasut.employees (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  name text,
  email text,
  iban text,
  archived boolean,
  balance numeric,
  trl_balance numeric,
  usd_balance numeric,
  eur_balance numeric,
  gbp_balance numeric,
  category_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_parasut_id_key unique (parasut_id)
);

-- Salary
create table parasut.salaries (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  description text,
  currency text,
  issue_date date,
  due_date date,
  exchange_rate numeric,
  net_total numeric,
  total_paid numeric,
  remaining numeric,
  remaining_in_trl numeric,
  archived boolean,
  employee_parasut_id bigint,
  category_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salaries_parasut_id_key unique (parasut_id)
);

-- BankFee
create table parasut.bank_fees (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  description text,
  currency text,
  issue_date date,
  due_date date,
  exchange_rate numeric,
  net_total numeric,
  total_paid numeric,
  remaining numeric,
  remaining_in_trl numeric,
  archived boolean,
  category_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_fees_parasut_id_key unique (parasut_id)
);

-- Warehouse
create table parasut.warehouses (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  name text,
  address text,
  city text,
  district text,
  is_abroad boolean,
  archived boolean,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouses_parasut_id_key unique (parasut_id)
);

-- Product
create table parasut.products (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  code text,
  name text,
  vat_rate numeric,
  sales_excise_duty numeric,
  sales_excise_duty_type text,
  sales_excise_duty_code text,
  purchase_excise_duty numeric,
  purchase_excise_duty_type text,
  unit text,
  communications_tax_rate numeric,
  archived boolean,
  list_price numeric,
  currency text,
  buying_price numeric,
  buying_currency text,
  list_price_in_trl numeric,
  buying_price_in_trl numeric,
  inventory_tracking boolean,
  initial_stock_count numeric,
  stock_count numeric,
  gtip text,
  barcode text,
  sales_invoice_details_count bigint,
  purchase_invoice_details_count bigint,
  category_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_parasut_id_key unique (parasut_id)
);

-- InventoryLevel
create table parasut.inventory_levels (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  stock_count numeric,
  initial_stock_count numeric,
  critical_stock_count numeric,
  product_parasut_id bigint,
  warehouse_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_levels_parasut_id_key unique (parasut_id)
);

-- PurchaseBill
create table parasut.purchase_bills (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  item_type text,
  description text,
  issue_date date,
  due_date date,
  invoice_no text,
  currency text,
  exchange_rate numeric,
  net_total numeric,
  withholding_rate numeric,
  invoice_discount_type text,
  invoice_discount numeric,
  gross_total numeric,
  total_excise_duty numeric,
  total_communications_tax numeric,
  total_vat numeric,
  total_vat_withholding numeric,
  total_discount numeric,
  total_invoice_discount numeric,
  remaining numeric,
  remaining_in_trl numeric,
  payment_status text,
  is_detailed boolean,
  sharings_count bigint,
  e_invoices_count bigint,
  remaining_reimbursement numeric,
  remaining_reimbursement_in_trl numeric,
  total_paid numeric,
  archived boolean,
  category_parasut_id bigint,
  spender_parasut_id bigint,
  supplier_parasut_id bigint,
  pay_to_parasut_id bigint,
  recurrence_plan_parasut_id bigint,
  active_e_document_type text,
  active_e_document_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_bills_parasut_id_key unique (parasut_id)
);

-- PurchaseBillDetail
create table parasut.purchase_bill_details (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  quantity numeric,
  unit_price numeric,
  vat_rate numeric,
  vat_withholding_rate numeric,
  vat_withholding numeric,
  discount_type text,
  discount_value numeric,
  excise_duty_type text,
  excise_duty_value numeric,
  communications_tax_rate numeric,
  description text,
  net_total numeric,
  purchase_bill_parasut_id bigint,
  warehouse_parasut_id bigint,
  product_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_bill_details_parasut_id_key unique (parasut_id)
);

-- SalesInvoice
create table parasut.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  invoice_no text,
  invoice_series text,
  invoice_id bigint,
  item_type text,
  description text,
  issue_date date,
  due_date date,
  currency text,
  exchange_rate numeric,
  net_total numeric,
  gross_total numeric,
  withholding numeric,
  withholding_rate numeric,
  total_excise_duty numeric,
  total_communications_tax numeric,
  total_vat numeric,
  total_vat_withholding numeric,
  total_discount numeric,
  total_invoice_discount numeric,
  before_taxes_total numeric,
  remaining numeric,
  remaining_in_trl numeric,
  payment_status text,
  invoice_discount_type text,
  invoice_discount numeric,
  billing_address text,
  billing_postal_code text,
  billing_phone text,
  billing_fax text,
  tax_office text,
  tax_number text,
  country text,
  city text,
  district text,
  is_abroad boolean,
  order_no text,
  order_date date,
  shipment_addres text,
  shipment_included boolean,
  cash_sale boolean,
  payer_tax_numbers jsonb,
  invoice_note text,
  append_contact_balance boolean,
  e_document_accounts jsonb,
  archived boolean,
  category_parasut_id bigint,
  contact_parasut_id bigint,
  sales_offer_parasut_id bigint,
  recurrence_plan_parasut_id bigint,
  active_e_document_type text,
  active_e_document_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_invoices_parasut_id_key unique (parasut_id)
);

-- SalesInvoiceDetail
create table parasut.sales_invoice_details (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  quantity numeric,
  unit_price numeric,
  vat_rate numeric,
  vat_withholding_rate numeric,
  vat_withholding numeric,
  discount_type text,
  discount_value numeric,
  excise_duty_type text,
  excise_duty_value numeric,
  communications_tax_rate numeric,
  description text,
  delivery_method text,
  shipping_method text,
  net_total numeric,
  sales_invoice_parasut_id bigint,
  warehouse_parasut_id bigint,
  product_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_invoice_details_parasut_id_key unique (parasut_id)
);

-- SalesOffers
create table parasut.sales_offers (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  content text,
  contact_type text,
  status text,
  display_exchange_rate_in_pdf boolean,
  net_total numeric,
  gross_total numeric,
  withholding numeric,
  withholding_rate numeric,
  total_excise_duty numeric,
  total_communications_tax numeric,
  total_accommodation_tax numeric,
  total_vat numeric,
  total_vat_withholding numeric,
  vat_withholding numeric,
  total_discount numeric,
  total_invoice_discount numeric,
  description text,
  issue_date date,
  due_date date,
  currency text,
  exchange_rate numeric,
  invoice_discount_type text,
  invoice_discount numeric,
  billing_address text,
  billing_phone text,
  billing_fax text,
  tax_office text,
  tax_number text,
  city text,
  district text,
  is_abroad boolean,
  order_no text,
  order_date date,
  sharings_count bigint,
  archived boolean,
  contact_parasut_id bigint,
  sales_invoice_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_offers_parasut_id_key unique (parasut_id)
);

-- SalesOffersDetails
create table parasut.sales_offer_details (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  description text,
  net_total numeric,
  unit_price numeric,
  vat_rate numeric,
  quantity numeric,
  discount_type text,
  discount_value numeric,
  communications_tax_rate numeric,
  excise_duty_type text,
  excise_duty numeric,
  excise_duty_rate numeric,
  discount numeric,
  communications_tax numeric,
  detail_no bigint,
  net_total_without_invoice_discount numeric,
  vat_withholding numeric,
  vat_withholding_rate numeric,
  accommodation_tax_rate numeric,
  accommodation_tax numeric,
  accommodation_tax_exempt boolean,
  excise_duty_value numeric,
  sales_offer_parasut_id bigint,
  product_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_offer_details_parasut_id_key unique (parasut_id)
);

-- ShipmentDocument
create table parasut.shipment_documents (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  invoice_no text,
  print_note text,
  printed_at timestamptz,
  inflow boolean,
  description text,
  city text,
  district text,
  address text,
  issue_date date,
  shipment_date date,
  procurement_number text,
  archived boolean,
  contact_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipment_documents_parasut_id_key unique (parasut_id)
);

-- StockMovement
create table parasut.stock_movements (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  detail_no bigint,
  date date,
  quantity numeric,
  warehouse_parasut_id bigint,
  product_parasut_id bigint,
  source_type text,
  source_parasut_id bigint,
  contact_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_movements_parasut_id_key unique (parasut_id)
);

-- StockUpdate
create table parasut.stock_updates (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_updates_parasut_id_key unique (parasut_id)
);

-- StockUpdateDetail
create table parasut.stock_update_details (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  old_total_inventory numeric,
  new_total_inventory numeric,
  stock_update_parasut_id bigint,
  warehouse_parasut_id bigint,
  product_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_update_details_parasut_id_key unique (parasut_id)
);

-- Payment
create table parasut.payments (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  date date,
  amount numeric,
  currency text,
  notes text,
  payable_type text,
  payable_parasut_id bigint,
  transaction_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_parasut_id_key unique (parasut_id)
);

-- Transaction
create table parasut.transactions (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  description text,
  transaction_type text,
  date date,
  amount_in_trl numeric,
  debit_amount numeric,
  debit_currency text,
  credit_amount numeric,
  credit_currency text,
  debit_account_parasut_id bigint,
  credit_account_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_parasut_id_key unique (parasut_id)
);

-- EInvoice
create table parasut.e_invoices (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  external_id text,
  uuid text,
  env_uuid text,
  from_address text,
  from_vkn text,
  to_address text,
  to_vkn text,
  direction text,
  note text,
  response_type text,
  contact_name text,
  scenario text,
  status text,
  gtb_ref_no text,
  gtb_registration_no text,
  gtb_export_date date,
  response_note text,
  issue_date date,
  is_expired boolean,
  is_answerable boolean,
  net_total numeric,
  currency text,
  item_type text,
  invoice_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint e_invoices_parasut_id_key unique (parasut_id)
);

-- EArchive
create table parasut.e_archives (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  uuid text,
  vkn text,
  invoice_number text,
  note text,
  is_printed boolean,
  status text,
  printed_at timestamptz,
  cancellable_until timestamptz,
  is_signed boolean,
  sales_invoice_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint e_archives_parasut_id_key unique (parasut_id)
);

-- ESmm
create table parasut.e_smms (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  uuid text,
  vkn text,
  invoice_number numeric,
  is_printed boolean,
  pdf_url text,
  printed_at timestamptz,
  sales_invoice_parasut_id bigint,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint e_smms_parasut_id_key unique (parasut_id)
);

-- EInvoiceInbox
create table parasut.e_invoice_inboxes (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  vkn text,
  e_invoice_address text,
  name text,
  inbox_type text,
  address_registered_at timestamptz,
  registered_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint e_invoice_inboxes_parasut_id_key unique (parasut_id)
);

-- TrackableJob
create table parasut.trackable_jobs (
  id uuid primary key default gen_random_uuid(),
  parasut_id text not null,
  status text,
  errors jsonb,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trackable_jobs_parasut_id_key unique (parasut_id)
);

-- Indexes on relationship columns
create index if not exists item_categories_parent_category_parasut_id_idx on parasut.item_categories(parent_category_parasut_id);
create index if not exists taxes_category_parasut_id_idx on parasut.taxes(category_parasut_id);
create index if not exists contacts_category_parasut_id_idx on parasut.contacts(category_parasut_id);
create index if not exists contact_people_contact_parasut_id_idx on parasut.contact_people(contact_parasut_id);
create index if not exists addresses_addressable_parasut_id_idx on parasut.addresses(addressable_parasut_id);
create index if not exists employees_category_parasut_id_idx on parasut.employees(category_parasut_id);
create index if not exists salaries_employee_parasut_id_idx on parasut.salaries(employee_parasut_id);
create index if not exists salaries_category_parasut_id_idx on parasut.salaries(category_parasut_id);
create index if not exists bank_fees_category_parasut_id_idx on parasut.bank_fees(category_parasut_id);
create index if not exists products_category_parasut_id_idx on parasut.products(category_parasut_id);
create index if not exists inventory_levels_product_parasut_id_idx on parasut.inventory_levels(product_parasut_id);
create index if not exists inventory_levels_warehouse_parasut_id_idx on parasut.inventory_levels(warehouse_parasut_id);
create index if not exists purchase_bills_category_parasut_id_idx on parasut.purchase_bills(category_parasut_id);
create index if not exists purchase_bills_spender_parasut_id_idx on parasut.purchase_bills(spender_parasut_id);
create index if not exists purchase_bills_supplier_parasut_id_idx on parasut.purchase_bills(supplier_parasut_id);
create index if not exists purchase_bills_pay_to_parasut_id_idx on parasut.purchase_bills(pay_to_parasut_id);
create index if not exists purchase_bills_recurrence_plan_parasut_id_idx on parasut.purchase_bills(recurrence_plan_parasut_id);
create index if not exists purchase_bills_active_e_document_parasut_id_idx on parasut.purchase_bills(active_e_document_parasut_id);
create index if not exists purchase_bill_details_purchase_bill_parasut_id_idx on parasut.purchase_bill_details(purchase_bill_parasut_id);
create index if not exists purchase_bill_details_warehouse_parasut_id_idx on parasut.purchase_bill_details(warehouse_parasut_id);
create index if not exists purchase_bill_details_product_parasut_id_idx on parasut.purchase_bill_details(product_parasut_id);
create index if not exists sales_invoices_category_parasut_id_idx on parasut.sales_invoices(category_parasut_id);
create index if not exists sales_invoices_contact_parasut_id_idx on parasut.sales_invoices(contact_parasut_id);
create index if not exists sales_invoices_sales_offer_parasut_id_idx on parasut.sales_invoices(sales_offer_parasut_id);
create index if not exists sales_invoices_recurrence_plan_parasut_id_idx on parasut.sales_invoices(recurrence_plan_parasut_id);
create index if not exists sales_invoices_active_e_document_parasut_id_idx on parasut.sales_invoices(active_e_document_parasut_id);
create index if not exists sales_invoice_details_sales_invoice_parasut_id_idx on parasut.sales_invoice_details(sales_invoice_parasut_id);
create index if not exists sales_invoice_details_warehouse_parasut_id_idx on parasut.sales_invoice_details(warehouse_parasut_id);
create index if not exists sales_invoice_details_product_parasut_id_idx on parasut.sales_invoice_details(product_parasut_id);
create index if not exists sales_offers_contact_parasut_id_idx on parasut.sales_offers(contact_parasut_id);
create index if not exists sales_offers_sales_invoice_parasut_id_idx on parasut.sales_offers(sales_invoice_parasut_id);
create index if not exists sales_offer_details_sales_offer_parasut_id_idx on parasut.sales_offer_details(sales_offer_parasut_id);
create index if not exists sales_offer_details_product_parasut_id_idx on parasut.sales_offer_details(product_parasut_id);
create index if not exists shipment_documents_contact_parasut_id_idx on parasut.shipment_documents(contact_parasut_id);
create index if not exists stock_movements_warehouse_parasut_id_idx on parasut.stock_movements(warehouse_parasut_id);
create index if not exists stock_movements_product_parasut_id_idx on parasut.stock_movements(product_parasut_id);
create index if not exists stock_movements_source_parasut_id_idx on parasut.stock_movements(source_parasut_id);
create index if not exists stock_movements_contact_parasut_id_idx on parasut.stock_movements(contact_parasut_id);
create index if not exists stock_update_details_stock_update_parasut_id_idx on parasut.stock_update_details(stock_update_parasut_id);
create index if not exists stock_update_details_warehouse_parasut_id_idx on parasut.stock_update_details(warehouse_parasut_id);
create index if not exists stock_update_details_product_parasut_id_idx on parasut.stock_update_details(product_parasut_id);
create index if not exists payments_payable_parasut_id_idx on parasut.payments(payable_parasut_id);
create index if not exists payments_transaction_parasut_id_idx on parasut.payments(transaction_parasut_id);
create index if not exists transactions_debit_account_parasut_id_idx on parasut.transactions(debit_account_parasut_id);
create index if not exists transactions_credit_account_parasut_id_idx on parasut.transactions(credit_account_parasut_id);
create index if not exists e_invoices_invoice_parasut_id_idx on parasut.e_invoices(invoice_parasut_id);
create index if not exists e_archives_sales_invoice_parasut_id_idx on parasut.e_archives(sales_invoice_parasut_id);
create index if not exists e_smms_sales_invoice_parasut_id_idx on parasut.e_smms(sales_invoice_parasut_id);

-- updated_at triggers
create trigger companies_updated_at before update on parasut.companies for each row execute function parasut.set_updated_at();
create trigger item_categories_updated_at before update on parasut.item_categories for each row execute function parasut.set_updated_at();
create trigger tags_updated_at before update on parasut.tags for each row execute function parasut.set_updated_at();
create trigger taxes_updated_at before update on parasut.taxes for each row execute function parasut.set_updated_at();
create trigger accounts_updated_at before update on parasut.accounts for each row execute function parasut.set_updated_at();
create trigger contacts_updated_at before update on parasut.contacts for each row execute function parasut.set_updated_at();
create trigger contact_people_updated_at before update on parasut.contact_people for each row execute function parasut.set_updated_at();
create trigger addresses_updated_at before update on parasut.addresses for each row execute function parasut.set_updated_at();
create trigger employees_updated_at before update on parasut.employees for each row execute function parasut.set_updated_at();
create trigger salaries_updated_at before update on parasut.salaries for each row execute function parasut.set_updated_at();
create trigger bank_fees_updated_at before update on parasut.bank_fees for each row execute function parasut.set_updated_at();
create trigger warehouses_updated_at before update on parasut.warehouses for each row execute function parasut.set_updated_at();
create trigger products_updated_at before update on parasut.products for each row execute function parasut.set_updated_at();
create trigger inventory_levels_updated_at before update on parasut.inventory_levels for each row execute function parasut.set_updated_at();
create trigger purchase_bills_updated_at before update on parasut.purchase_bills for each row execute function parasut.set_updated_at();
create trigger purchase_bill_details_updated_at before update on parasut.purchase_bill_details for each row execute function parasut.set_updated_at();
create trigger sales_invoices_updated_at before update on parasut.sales_invoices for each row execute function parasut.set_updated_at();
create trigger sales_invoice_details_updated_at before update on parasut.sales_invoice_details for each row execute function parasut.set_updated_at();
create trigger sales_offers_updated_at before update on parasut.sales_offers for each row execute function parasut.set_updated_at();
create trigger sales_offer_details_updated_at before update on parasut.sales_offer_details for each row execute function parasut.set_updated_at();
create trigger shipment_documents_updated_at before update on parasut.shipment_documents for each row execute function parasut.set_updated_at();
create trigger stock_movements_updated_at before update on parasut.stock_movements for each row execute function parasut.set_updated_at();
create trigger stock_updates_updated_at before update on parasut.stock_updates for each row execute function parasut.set_updated_at();
create trigger stock_update_details_updated_at before update on parasut.stock_update_details for each row execute function parasut.set_updated_at();
create trigger payments_updated_at before update on parasut.payments for each row execute function parasut.set_updated_at();
create trigger transactions_updated_at before update on parasut.transactions for each row execute function parasut.set_updated_at();
create trigger e_invoices_updated_at before update on parasut.e_invoices for each row execute function parasut.set_updated_at();
create trigger e_archives_updated_at before update on parasut.e_archives for each row execute function parasut.set_updated_at();
create trigger e_smms_updated_at before update on parasut.e_smms for each row execute function parasut.set_updated_at();
create trigger e_invoice_inboxes_updated_at before update on parasut.e_invoice_inboxes for each row execute function parasut.set_updated_at();
create trigger trackable_jobs_updated_at before update on parasut.trackable_jobs for each row execute function parasut.set_updated_at();

-- Row level security (service_role only; no policies = no anon/authenticated access)
alter table parasut.companies enable row level security;
alter table parasut.item_categories enable row level security;
alter table parasut.tags enable row level security;
alter table parasut.taxes enable row level security;
alter table parasut.accounts enable row level security;
alter table parasut.contacts enable row level security;
alter table parasut.contact_people enable row level security;
alter table parasut.addresses enable row level security;
alter table parasut.employees enable row level security;
alter table parasut.salaries enable row level security;
alter table parasut.bank_fees enable row level security;
alter table parasut.warehouses enable row level security;
alter table parasut.products enable row level security;
alter table parasut.inventory_levels enable row level security;
alter table parasut.purchase_bills enable row level security;
alter table parasut.purchase_bill_details enable row level security;
alter table parasut.sales_invoices enable row level security;
alter table parasut.sales_invoice_details enable row level security;
alter table parasut.sales_offers enable row level security;
alter table parasut.sales_offer_details enable row level security;
alter table parasut.shipment_documents enable row level security;
alter table parasut.stock_movements enable row level security;
alter table parasut.stock_updates enable row level security;
alter table parasut.stock_update_details enable row level security;
alter table parasut.payments enable row level security;
alter table parasut.transactions enable row level security;
alter table parasut.e_invoices enable row level security;
alter table parasut.e_archives enable row level security;
alter table parasut.e_smms enable row level security;
alter table parasut.e_invoice_inboxes enable row level security;
alter table parasut.trackable_jobs enable row level security;

grant usage on schema parasut to service_role;
grant all on all tables in schema parasut to service_role;
alter default privileges in schema parasut grant all on tables to service_role;

