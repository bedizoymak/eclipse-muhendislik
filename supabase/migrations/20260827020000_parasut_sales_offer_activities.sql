-- Phase 7.1: sales_offers.activities.
--
-- Verified directly against the live API: GET /sales_offers/{id} (the
-- single-record endpoint) accepts include=activities and resolves real
-- activity records (status-change history) -- the exact same include on the
-- LIST endpoint (GET /sales_offers?include=activities) returns a genuine
-- HTTP 400 ("activities is not a valid relation. Acceptable: contact,
-- details, details.product, sales_invoice"). This is a real, confirmed
-- endpoint-level inconsistency in the live API, not a defect in this
-- codebase's list-based sync. No table for activities existed before this
-- migration; this adds one from scratch, following the same shape
-- (parasut_id unique, mapped columns + raw jsonb, service_role-only RLS) as
-- every other parasut.* table.
--
-- The activity's own `data` attribute is a real, API-provided JSON object
-- (a point-in-time snapshot of a subset of the offer's own fields at the
-- moment of that activity) -- stored as-is in a jsonb column, never
-- reshaped or partially extracted into separate columns, since its internal
-- shape is not itself a documented/stable schema.

create table parasut.sales_offer_activities (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  sales_offer_parasut_id bigint not null,
  activity_type text,
  date timestamptz,
  data jsonb,
  done_by_email text,
  done_by_parasut_id bigint,
  done_by_type text,
  item_parasut_id bigint,
  item_type text,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_offer_activities_parasut_id_key unique (parasut_id)
);

create index sales_offer_activities_sales_offer_parasut_id_idx
  on parasut.sales_offer_activities(sales_offer_parasut_id);

create trigger sales_offer_activities_updated_at
  before update on parasut.sales_offer_activities
  for each row execute function parasut.set_updated_at();

alter table parasut.sales_offer_activities enable row level security;

grant all on parasut.sales_offer_activities to service_role;

create view public.parasut_sales_offer_activities_demo
as
select
  a.parasut_id,
  a.sales_offer_parasut_id,
  a.activity_type,
  a.date,
  a.data,
  a.done_by_email,
  a.done_by_parasut_id,
  a.done_by_type,
  a.item_parasut_id,
  a.item_type,
  a.synced_at
from parasut.sales_offer_activities a
order by a.sales_offer_parasut_id, a.date desc nulls last;

grant select on public.parasut_sales_offer_activities_demo to authenticated, anon;
