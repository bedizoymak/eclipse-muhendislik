-- Phase 9: sevkiyat irsaliyeleri (shipment_documents) -- full real attribute
-- set, contact, inbound_e_despatch, and activities.
--
-- Verified directly against the live API (full pagination, both archived
-- streams, 15 real records total -- 14 active + 1 archived):
--   * parasut.shipment_documents already existed (Phase 0 schema, populated
--     once by scripts/sync_parasut.py) but was missing 24 real attributes.
--   * contact is a real, always-populated to-one relationship (15/15).
--   * tags and custom_requirement_infos are real, always-empty arrays
--     (15/15) -- not missing data, genuinely empty.
--   * warehouse_transfer and e_despatch_response are real to-one
--     relationships that are always null in this account (15/15) -- stored
--     as nullable FK columns for completeness, never fabricated.
--   * inbound_e_despatch is a real to-one relationship, populated on 6/15
--     documents, with real included attributes (despatch_no, contact_name,
--     issue_date, response_status, response_type, is_expired, uuid,
--     from_tax_number) -- a genuine, separate resource type with no
--     existing table, added here.
--   * activities is real and populated (verified: 2 real activity records
--     on document 1000391168) but -- same pattern as sales_offers.activities
--     (Phase 7.1/7.2) -- only resolves via the single-record endpoint;
--     the list endpoint's own 400 error message never lists it as
--     acceptable. Modeled identically to parasut.sales_offer_activities.
--   * stock_movements is a real to-many relationship (max 3 per document,
--     20 total refs across the 15 documents) -- but parasut.stock_movements
--     ALREADY carries this exact link via its own polymorphic
--     source_type='shipment_documents' / source_parasut_id columns
--     (populated by the existing stock_movements sync, verified: all 20
--     API-reported (document, stock_movement) pairs match the 20 real rows
--     already in the table exactly). No junction table is created --
--     public.parasut_stock_movements_demo (already exposing source_type/
--     source_parasut_id/product_name/warehouse_name/contact_name) is
--     queried directly by parasut_id, per this project's "don't invent a
--     new structure the response doesn't need" rule.

alter table parasut.shipment_documents
  add column uuid text,
  add column despatch_no text,
  add column order_no text,
  add column order_date date,
  add column status text,
  add column status_message text,
  add column status_changed_at timestamptz,
  add column carrier_legal_name text,
  add column carrier_tax_number text,
  add column carrier_license_plate text,
  add column drivers_info jsonb,
  add column postal_code text,
  add column company_address text,
  add column company_city text,
  add column company_district text,
  add column company_postal_code text,
  add column has_invoice boolean,
  add column shipment_document_type text,
  add column is_commercial boolean,
  add column issue_datetime timestamptz,
  add column printed_issue_date date,
  add column legalized_at timestamptz,
  add column sharings_count integer,
  add column warehouse_transfer_parasut_id bigint,
  add column e_despatch_response_type text,
  add column e_despatch_response_parasut_id bigint,
  add column inbound_e_despatch_parasut_id bigint;

-- print_note/printed_at/invoice_no/description/city/district/address/
-- issue_date/shipment_date/procurement_number/archived/contact_parasut_id
-- already existed and are already real attributes -- unchanged.

create table parasut.inbound_e_despatches (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  shipment_document_parasut_id bigint,
  uuid text,
  despatch_no text,
  contact_name text,
  issue_date timestamptz,
  from_tax_number text,
  response_status text,
  response_type text,
  expires_at timestamptz,
  is_expired boolean,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbound_e_despatches_parasut_id_key unique (parasut_id)
);

create index inbound_e_despatches_shipment_document_parasut_id_idx
  on parasut.inbound_e_despatches(shipment_document_parasut_id);

create trigger inbound_e_despatches_updated_at
  before update on parasut.inbound_e_despatches
  for each row execute function parasut.set_updated_at();

alter table parasut.inbound_e_despatches enable row level security;
grant all on parasut.inbound_e_despatches to service_role;

create table parasut.shipment_document_activities (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  shipment_document_parasut_id bigint not null,
  activity_type text,
  date timestamptz,
  data_description text,
  data_issue_date date,
  done_by_email text,
  done_by_parasut_id bigint,
  done_by_type text,
  done_by_name text,
  done_by_user_email text,
  item_parasut_id bigint,
  item_type text,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipment_document_activities_parasut_id_key unique (parasut_id)
);

create index shipment_document_activities_shipment_document_parasut_id_idx
  on parasut.shipment_document_activities(shipment_document_parasut_id);

create trigger shipment_document_activities_updated_at
  before update on parasut.shipment_document_activities
  for each row execute function parasut.set_updated_at();

alter table parasut.shipment_document_activities enable row level security;
grant all on parasut.shipment_document_activities to service_role;

-- Public demo views. Raw/private fields never exposed.
create view public.parasut_shipment_documents_demo
as
select
  s.parasut_id,
  s.description,
  s.uuid,
  s.despatch_no,
  s.order_no,
  s.order_date,
  s.status,
  s.status_message,
  s.status_changed_at,
  s.shipment_document_type,
  s.inflow,
  s.is_commercial,
  s.issue_date,
  s.issue_datetime,
  s.shipment_date,
  s.printed_issue_date,
  s.printed_at,
  s.print_note,
  s.legalized_at,
  s.sharings_count,
  s.has_invoice,
  s.invoice_no,
  s.procurement_number,
  s.carrier_legal_name,
  s.carrier_tax_number,
  s.carrier_license_plate,
  s.drivers_info,
  s.address,
  s.city,
  s.district,
  s.postal_code,
  s.company_address,
  s.company_city,
  s.company_district,
  s.company_postal_code,
  s.archived,
  s.contact_parasut_id,
  c.name as contact_name,
  s.warehouse_transfer_parasut_id,
  s.e_despatch_response_type,
  s.e_despatch_response_parasut_id,
  s.inbound_e_despatch_parasut_id,
  s.parasut_created_at,
  s.parasut_updated_at,
  s.synced_at
from parasut.shipment_documents s
left join parasut.contacts c on c.parasut_id = s.contact_parasut_id
order by s.issue_date desc nulls last;

create view public.parasut_inbound_e_despatches_demo
as
select
  d.parasut_id,
  d.shipment_document_parasut_id,
  d.uuid,
  d.despatch_no,
  d.contact_name,
  d.issue_date,
  d.from_tax_number,
  d.response_status,
  d.response_type,
  d.expires_at,
  d.is_expired,
  d.parasut_created_at,
  d.parasut_updated_at,
  d.synced_at
from parasut.inbound_e_despatches d
order by d.shipment_document_parasut_id, d.issue_date desc nulls last;

create view public.parasut_shipment_document_activities_demo
as
select
  a.parasut_id,
  a.shipment_document_parasut_id,
  a.activity_type,
  a.date,
  a.data_description,
  a.data_issue_date,
  a.done_by_email,
  a.done_by_parasut_id,
  a.done_by_type,
  a.done_by_name,
  a.done_by_user_email,
  a.item_parasut_id,
  a.item_type,
  a.parasut_created_at,
  a.parasut_updated_at,
  a.synced_at
from parasut.shipment_document_activities a
order by a.shipment_document_parasut_id, a.date desc nulls last;

-- Durable, row-limit-proof tab counters (same pattern as Phase 8.3).
create view public.parasut_shipment_document_counts_demo
as
select
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) filter (where archived is null) as null_archived_count,
  count(*) as total_count
from parasut.shipment_documents;

grant select on public.parasut_shipment_documents_demo to authenticated, anon;
grant select on public.parasut_inbound_e_despatches_demo to authenticated, anon;
grant select on public.parasut_shipment_document_activities_demo to authenticated, anon;
grant select on public.parasut_shipment_document_counts_demo to authenticated, anon;
