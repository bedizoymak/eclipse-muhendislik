-- Parasut (parasut.com) API mirror schema.
-- Generated from https://apidocs.parasut.com/swagger.json (API v4).
-- Every table stores mapped columns for convenient querying PLUS a `raw`
-- jsonb column holding the complete API resource payload, so no data the
-- Parasut API returns is ever lost even if a field isn't mapped to a column.
--
-- RLS is enabled on every table with NO policies: this data is financial/PII
-- and is intended to be written and read only by a trusted backend sync
-- process using the service_role key, never the client-side anon/publishable
-- key. Add explicit policies later if any of this data needs to be exposed
-- to authenticated app users.

create extension if not exists pgcrypto;

create or replace function public.parasut_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Company
create table public.parasut_companies (
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
  constraint parasut_companies_parasut_id_key unique (parasut_id)
);

-- ItemCategory
create table public.parasut_item_categories (
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
  constraint parasut_item_categories_parasut_id_key unique (parasut_id)
);

-- Tag
create table public.parasut_tags (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  name text,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parasut_tags_parasut_id_key unique (parasut_id)
);

-- Tax
create table public.parasut_taxes (
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
  constraint parasut_taxes_parasut_id_key unique (parasut_id)
);

-- Account
create table public.parasut_accounts (
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
  constraint parasut_accounts_parasut_id_key unique (parasut_id)
);

-- Contact
create table public.parasut_contacts (
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
  constraint parasut_contacts_parasut_id_key unique (parasut_id)
);

-- ContactPerson
create table public.parasut_contact_people (
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
  constraint parasut_contact_people_parasut_id_key unique (parasut_id)
);

-- Address
create table public.parasut_addresses (
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
  constraint parasut_addresses_parasut_id_key unique (parasut_id)
);

-- Employee
create table public.parasut_employees (
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
  constraint parasut_employees_parasut_id_key unique (parasut_id)
);

-- Salary
create table public.parasut_salaries (
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
  constraint parasut_salaries_parasut_id_key unique (parasut_id)
);

-- BankFee
create table public.parasut_bank_fees (
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
  constraint parasut_bank_fees_parasut_id_key unique (parasut_id)
);

-- Warehouse
create table public.parasut_warehouses (
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
  constraint parasut_warehouses_parasut_id_key unique (parasut_id)
);

-- Product
create table public.parasut_products (
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
  constraint parasut_products_parasut_id_key unique (parasut_id)
);

-- InventoryLevel
create table public.parasut_inventory_levels (
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
  constraint parasut_inventory_levels_parasut_id_key unique (parasut_id)
);

-- PurchaseBill
create table public.parasut_purchase_bills (
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
  constraint parasut_purchase_bills_parasut_id_key unique (parasut_id)
);

-- PurchaseBillDetail
create table public.parasut_purchase_bill_details (
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
  constraint parasut_purchase_bill_details_parasut_id_key unique (parasut_id)
);

-- SalesInvoice
create table public.parasut_sales_invoices (
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
  constraint parasut_sales_invoices_parasut_id_key unique (parasut_id)
);

-- SalesInvoiceDetail
create table public.parasut_sales_invoice_details (
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
  constraint parasut_sales_invoice_details_parasut_id_key unique (parasut_id)
);

-- SalesOffers
create table public.parasut_sales_offers (
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
  constraint parasut_sales_offers_parasut_id_key unique (parasut_id)
);

-- SalesOffersDetails
create table public.parasut_sales_offer_details (
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
  constraint parasut_sales_offer_details_parasut_id_key unique (parasut_id)
);

-- ShipmentDocument
create table public.parasut_shipment_documents (
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
  constraint parasut_shipment_documents_parasut_id_key unique (parasut_id)
);

-- StockMovement
create table public.parasut_stock_movements (
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
  constraint parasut_stock_movements_parasut_id_key unique (parasut_id)
);

-- StockUpdate
create table public.parasut_stock_updates (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parasut_stock_updates_parasut_id_key unique (parasut_id)
);

-- StockUpdateDetail
create table public.parasut_stock_update_details (
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
  constraint parasut_stock_update_details_parasut_id_key unique (parasut_id)
);

-- Payment
create table public.parasut_payments (
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
  constraint parasut_payments_parasut_id_key unique (parasut_id)
);

-- Transaction
create table public.parasut_transactions (
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
  constraint parasut_transactions_parasut_id_key unique (parasut_id)
);

-- EInvoice
create table public.parasut_e_invoices (
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
  constraint parasut_e_invoices_parasut_id_key unique (parasut_id)
);

-- EArchive
create table public.parasut_e_archives (
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
  constraint parasut_e_archives_parasut_id_key unique (parasut_id)
);

-- ESmm
create table public.parasut_e_smms (
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
  constraint parasut_e_smms_parasut_id_key unique (parasut_id)
);

-- EInvoiceInbox
create table public.parasut_e_invoice_inboxes (
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
  constraint parasut_e_invoice_inboxes_parasut_id_key unique (parasut_id)
);

-- TrackableJob
create table public.parasut_trackable_jobs (
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
  constraint parasut_trackable_jobs_parasut_id_key unique (parasut_id)
);

-- Indexes on relationship columns
create index if not exists parasut_item_categories_parent_category_parasut_id_idx on public.parasut_item_categories(parent_category_parasut_id);
create index if not exists parasut_taxes_category_parasut_id_idx on public.parasut_taxes(category_parasut_id);
create index if not exists parasut_contacts_category_parasut_id_idx on public.parasut_contacts(category_parasut_id);
create index if not exists parasut_contact_people_contact_parasut_id_idx on public.parasut_contact_people(contact_parasut_id);
create index if not exists parasut_addresses_addressable_parasut_id_idx on public.parasut_addresses(addressable_parasut_id);
create index if not exists parasut_employees_category_parasut_id_idx on public.parasut_employees(category_parasut_id);
create index if not exists parasut_salaries_employee_parasut_id_idx on public.parasut_salaries(employee_parasut_id);
create index if not exists parasut_salaries_category_parasut_id_idx on public.parasut_salaries(category_parasut_id);
create index if not exists parasut_bank_fees_category_parasut_id_idx on public.parasut_bank_fees(category_parasut_id);
create index if not exists parasut_products_category_parasut_id_idx on public.parasut_products(category_parasut_id);
create index if not exists parasut_inventory_levels_product_parasut_id_idx on public.parasut_inventory_levels(product_parasut_id);
create index if not exists parasut_inventory_levels_warehouse_parasut_id_idx on public.parasut_inventory_levels(warehouse_parasut_id);
create index if not exists parasut_purchase_bills_category_parasut_id_idx on public.parasut_purchase_bills(category_parasut_id);
create index if not exists parasut_purchase_bills_spender_parasut_id_idx on public.parasut_purchase_bills(spender_parasut_id);
create index if not exists parasut_purchase_bills_supplier_parasut_id_idx on public.parasut_purchase_bills(supplier_parasut_id);
create index if not exists parasut_purchase_bills_pay_to_parasut_id_idx on public.parasut_purchase_bills(pay_to_parasut_id);
create index if not exists parasut_purchase_bills_recurrence_plan_parasut_id_idx on public.parasut_purchase_bills(recurrence_plan_parasut_id);
create index if not exists parasut_purchase_bills_active_e_document_parasut_id_idx on public.parasut_purchase_bills(active_e_document_parasut_id);
create index if not exists parasut_purchase_bill_details_purchase_bill_parasut_id_idx on public.parasut_purchase_bill_details(purchase_bill_parasut_id);
create index if not exists parasut_purchase_bill_details_warehouse_parasut_id_idx on public.parasut_purchase_bill_details(warehouse_parasut_id);
create index if not exists parasut_purchase_bill_details_product_parasut_id_idx on public.parasut_purchase_bill_details(product_parasut_id);
create index if not exists parasut_sales_invoices_category_parasut_id_idx on public.parasut_sales_invoices(category_parasut_id);
create index if not exists parasut_sales_invoices_contact_parasut_id_idx on public.parasut_sales_invoices(contact_parasut_id);
create index if not exists parasut_sales_invoices_sales_offer_parasut_id_idx on public.parasut_sales_invoices(sales_offer_parasut_id);
create index if not exists parasut_sales_invoices_recurrence_plan_parasut_id_idx on public.parasut_sales_invoices(recurrence_plan_parasut_id);
create index if not exists parasut_sales_invoices_active_e_document_parasut_id_idx on public.parasut_sales_invoices(active_e_document_parasut_id);
create index if not exists parasut_sales_invoice_details_sales_invoice_parasut_id_idx on public.parasut_sales_invoice_details(sales_invoice_parasut_id);
create index if not exists parasut_sales_invoice_details_warehouse_parasut_id_idx on public.parasut_sales_invoice_details(warehouse_parasut_id);
create index if not exists parasut_sales_invoice_details_product_parasut_id_idx on public.parasut_sales_invoice_details(product_parasut_id);
create index if not exists parasut_sales_offers_contact_parasut_id_idx on public.parasut_sales_offers(contact_parasut_id);
create index if not exists parasut_sales_offers_sales_invoice_parasut_id_idx on public.parasut_sales_offers(sales_invoice_parasut_id);
create index if not exists parasut_sales_offer_details_sales_offer_parasut_id_idx on public.parasut_sales_offer_details(sales_offer_parasut_id);
create index if not exists parasut_sales_offer_details_product_parasut_id_idx on public.parasut_sales_offer_details(product_parasut_id);
create index if not exists parasut_shipment_documents_contact_parasut_id_idx on public.parasut_shipment_documents(contact_parasut_id);
create index if not exists parasut_stock_movements_warehouse_parasut_id_idx on public.parasut_stock_movements(warehouse_parasut_id);
create index if not exists parasut_stock_movements_product_parasut_id_idx on public.parasut_stock_movements(product_parasut_id);
create index if not exists parasut_stock_movements_source_parasut_id_idx on public.parasut_stock_movements(source_parasut_id);
create index if not exists parasut_stock_movements_contact_parasut_id_idx on public.parasut_stock_movements(contact_parasut_id);
create index if not exists parasut_stock_update_details_stock_update_parasut_id_idx on public.parasut_stock_update_details(stock_update_parasut_id);
create index if not exists parasut_stock_update_details_warehouse_parasut_id_idx on public.parasut_stock_update_details(warehouse_parasut_id);
create index if not exists parasut_stock_update_details_product_parasut_id_idx on public.parasut_stock_update_details(product_parasut_id);
create index if not exists parasut_payments_payable_parasut_id_idx on public.parasut_payments(payable_parasut_id);
create index if not exists parasut_payments_transaction_parasut_id_idx on public.parasut_payments(transaction_parasut_id);
create index if not exists parasut_transactions_debit_account_parasut_id_idx on public.parasut_transactions(debit_account_parasut_id);
create index if not exists parasut_transactions_credit_account_parasut_id_idx on public.parasut_transactions(credit_account_parasut_id);
create index if not exists parasut_e_invoices_invoice_parasut_id_idx on public.parasut_e_invoices(invoice_parasut_id);
create index if not exists parasut_e_archives_sales_invoice_parasut_id_idx on public.parasut_e_archives(sales_invoice_parasut_id);
create index if not exists parasut_e_smms_sales_invoice_parasut_id_idx on public.parasut_e_smms(sales_invoice_parasut_id);

-- updated_at triggers
create trigger parasut_companies_updated_at before update on public.parasut_companies for each row execute function public.parasut_set_updated_at();
create trigger parasut_item_categories_updated_at before update on public.parasut_item_categories for each row execute function public.parasut_set_updated_at();
create trigger parasut_tags_updated_at before update on public.parasut_tags for each row execute function public.parasut_set_updated_at();
create trigger parasut_taxes_updated_at before update on public.parasut_taxes for each row execute function public.parasut_set_updated_at();
create trigger parasut_accounts_updated_at before update on public.parasut_accounts for each row execute function public.parasut_set_updated_at();
create trigger parasut_contacts_updated_at before update on public.parasut_contacts for each row execute function public.parasut_set_updated_at();
create trigger parasut_contact_people_updated_at before update on public.parasut_contact_people for each row execute function public.parasut_set_updated_at();
create trigger parasut_addresses_updated_at before update on public.parasut_addresses for each row execute function public.parasut_set_updated_at();
create trigger parasut_employees_updated_at before update on public.parasut_employees for each row execute function public.parasut_set_updated_at();
create trigger parasut_salaries_updated_at before update on public.parasut_salaries for each row execute function public.parasut_set_updated_at();
create trigger parasut_bank_fees_updated_at before update on public.parasut_bank_fees for each row execute function public.parasut_set_updated_at();
create trigger parasut_warehouses_updated_at before update on public.parasut_warehouses for each row execute function public.parasut_set_updated_at();
create trigger parasut_products_updated_at before update on public.parasut_products for each row execute function public.parasut_set_updated_at();
create trigger parasut_inventory_levels_updated_at before update on public.parasut_inventory_levels for each row execute function public.parasut_set_updated_at();
create trigger parasut_purchase_bills_updated_at before update on public.parasut_purchase_bills for each row execute function public.parasut_set_updated_at();
create trigger parasut_purchase_bill_details_updated_at before update on public.parasut_purchase_bill_details for each row execute function public.parasut_set_updated_at();
create trigger parasut_sales_invoices_updated_at before update on public.parasut_sales_invoices for each row execute function public.parasut_set_updated_at();
create trigger parasut_sales_invoice_details_updated_at before update on public.parasut_sales_invoice_details for each row execute function public.parasut_set_updated_at();
create trigger parasut_sales_offers_updated_at before update on public.parasut_sales_offers for each row execute function public.parasut_set_updated_at();
create trigger parasut_sales_offer_details_updated_at before update on public.parasut_sales_offer_details for each row execute function public.parasut_set_updated_at();
create trigger parasut_shipment_documents_updated_at before update on public.parasut_shipment_documents for each row execute function public.parasut_set_updated_at();
create trigger parasut_stock_movements_updated_at before update on public.parasut_stock_movements for each row execute function public.parasut_set_updated_at();
create trigger parasut_stock_updates_updated_at before update on public.parasut_stock_updates for each row execute function public.parasut_set_updated_at();
create trigger parasut_stock_update_details_updated_at before update on public.parasut_stock_update_details for each row execute function public.parasut_set_updated_at();
create trigger parasut_payments_updated_at before update on public.parasut_payments for each row execute function public.parasut_set_updated_at();
create trigger parasut_transactions_updated_at before update on public.parasut_transactions for each row execute function public.parasut_set_updated_at();
create trigger parasut_e_invoices_updated_at before update on public.parasut_e_invoices for each row execute function public.parasut_set_updated_at();
create trigger parasut_e_archives_updated_at before update on public.parasut_e_archives for each row execute function public.parasut_set_updated_at();
create trigger parasut_e_smms_updated_at before update on public.parasut_e_smms for each row execute function public.parasut_set_updated_at();
create trigger parasut_e_invoice_inboxes_updated_at before update on public.parasut_e_invoice_inboxes for each row execute function public.parasut_set_updated_at();
create trigger parasut_trackable_jobs_updated_at before update on public.parasut_trackable_jobs for each row execute function public.parasut_set_updated_at();

-- Row level security (service_role only; no policies = no anon/authenticated access)
alter table public.parasut_companies enable row level security;
alter table public.parasut_item_categories enable row level security;
alter table public.parasut_tags enable row level security;
alter table public.parasut_taxes enable row level security;
alter table public.parasut_accounts enable row level security;
alter table public.parasut_contacts enable row level security;
alter table public.parasut_contact_people enable row level security;
alter table public.parasut_addresses enable row level security;
alter table public.parasut_employees enable row level security;
alter table public.parasut_salaries enable row level security;
alter table public.parasut_bank_fees enable row level security;
alter table public.parasut_warehouses enable row level security;
alter table public.parasut_products enable row level security;
alter table public.parasut_inventory_levels enable row level security;
alter table public.parasut_purchase_bills enable row level security;
alter table public.parasut_purchase_bill_details enable row level security;
alter table public.parasut_sales_invoices enable row level security;
alter table public.parasut_sales_invoice_details enable row level security;
alter table public.parasut_sales_offers enable row level security;
alter table public.parasut_sales_offer_details enable row level security;
alter table public.parasut_shipment_documents enable row level security;
alter table public.parasut_stock_movements enable row level security;
alter table public.parasut_stock_updates enable row level security;
alter table public.parasut_stock_update_details enable row level security;
alter table public.parasut_payments enable row level security;
alter table public.parasut_transactions enable row level security;
alter table public.parasut_e_invoices enable row level security;
alter table public.parasut_e_archives enable row level security;
alter table public.parasut_e_smms enable row level security;
alter table public.parasut_e_invoice_inboxes enable row level security;
alter table public.parasut_trackable_jobs enable row level security;

