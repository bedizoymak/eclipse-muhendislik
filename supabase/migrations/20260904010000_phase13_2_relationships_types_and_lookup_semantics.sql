-- Phase 13.2: root resource type preservation, real relationship id+type
-- columns, tags junction tables (salaries/taxes), item_categories
-- subcategories relationship preservation, and e_invoice_inboxes
-- query-result-cache semantics (never a global-resource count).
--
-- All ALTERs are additive (add column if not exists) -- no existing column
-- is dropped or repurposed. All views recreated here are recreated in
-- full (drop + create) so their column sets can grow; this is a new
-- migration file, no prior migration file is edited.

-- ---------------------------------------------------------------------
-- 1. Root resource type (`item.type`) -- verbatim runtime value, never
--    hardcoded, never discarded. Nullable because there are 0 real rows
--    in any of these resources today.
-- ---------------------------------------------------------------------
alter table parasut.salaries            add column if not exists parasut_type text;
alter table parasut.taxes               add column if not exists parasut_type text;
alter table parasut.tags                add column if not exists parasut_type text;
alter table parasut.e_invoice_inboxes   add column if not exists parasut_type text;
alter table parasut.item_categories     add column if not exists parasut_type text;

comment on column parasut.salaries.parasut_type is
  'Phase 13.2: verbatim runtime JSON:API item.type for this resource. Never hardcoded; if it disagrees with the Swagger-documented enum the sync run reports a type_mismatch in sync_runs.metadata.';
comment on column parasut.taxes.parasut_type is
  'Phase 13.2: verbatim runtime JSON:API item.type. Swagger documents TaxAttributes.type enum as ["bank_fees"], which is a known documentation bug -- this column always stores the real runtime value regardless, never the Swagger enum.';
comment on column parasut.tags.parasut_type is 'Phase 13.2: verbatim runtime JSON:API item.type.';
comment on column parasut.e_invoice_inboxes.parasut_type is 'Phase 13.2: verbatim runtime JSON:API item.type.';
comment on column parasut.item_categories.parasut_type is 'Phase 13.2: verbatim runtime JSON:API item.type.';

-- ---------------------------------------------------------------------
-- 2. Real relationship id+type (not just id) for to-one relationships
--    that already have an id column, so type is not lost.
-- ---------------------------------------------------------------------
alter table parasut.salaries add column if not exists employee_parasut_type text;
alter table parasut.salaries add column if not exists category_parasut_type text;
alter table parasut.taxes    add column if not exists category_parasut_type text;
alter table parasut.item_categories add column if not exists parent_category_parasut_type text;

-- Real to-many relationship (`subcategories`) preserved verbatim as the
-- JSON:API relationship data array (list of {id,type}) exactly as
-- returned -- never recomputed from parent_category_parasut_id, never
-- fabricated. Null until a real item_category with subcategories exists.
alter table parasut.item_categories add column if not exists subcategories jsonb;
comment on column parasut.item_categories.subcategories is
  'Phase 13.2: verbatim relationships.subcategories.data array ([{id,type},...]) as returned by the API. Never derived from parent_category_parasut_id.';

-- ---------------------------------------------------------------------
-- 3. Tags junction tables (salaries.tags / taxes.tags are real to-many
--    relationships per Swagger, not yet normalized before this phase).
-- ---------------------------------------------------------------------
create table if not exists parasut.salary_tags (
  salary_parasut_id bigint not null references parasut.salaries(parasut_id) on delete cascade,
  tag_parasut_id bigint not null,
  tag_type text not null,
  synced_at timestamptz not null default now(),
  constraint salary_tags_unique unique (salary_parasut_id, tag_parasut_id, tag_type)
);
comment on table parasut.salary_tags is
  'Phase 13.2: junction for the real Salary.relationships.tags to-many relationship. tag_type is the real relationships.tags.data[].type value, never a hardcoded "tags" constant. Refreshed (diffed against the current source list) on every sync of the parent salary; rows for tags removed at the source are deleted, not left stale.';

create table if not exists parasut.tax_tags (
  tax_parasut_id bigint not null references parasut.taxes(parasut_id) on delete cascade,
  tag_parasut_id bigint not null,
  tag_type text not null,
  synced_at timestamptz not null default now(),
  constraint tax_tags_unique unique (tax_parasut_id, tag_parasut_id, tag_type)
);
comment on table parasut.tax_tags is
  'Phase 13.2: junction for the real Tax.relationships.tags to-many relationship. Same rules as parasut.salary_tags.';

grant select on parasut.salary_tags to authenticated, anon;
grant select on parasut.tax_tags to authenticated, anon;

-- ---------------------------------------------------------------------
-- 4. e_invoice_inboxes: query-context columns. This resource is a
--    filter[vkn]-driven lookup, not a durable global collection --
--    query_vkn/queried_at distinguish "which VKN was queried, when" from
--    the resource's own attributes (which are Parasut's authoritative
--    query result, a different data class than the user-entered VKN).
-- ---------------------------------------------------------------------
alter table parasut.e_invoice_inboxes add column if not exists query_vkn text;
alter table parasut.e_invoice_inboxes add column if not exists queried_at timestamptz;
comment on column parasut.e_invoice_inboxes.query_vkn is
  'Phase 13.2: the VKN that was submitted as filter[vkn] to produce this row (ERP_USER_ENTERED class). Distinct from attributes.vkn, which is Parasut''s own authoritative echo of the queried taxpayer (PARASUT_AUTHORITATIVE class) -- kept as two columns on purpose, never collapsed into one.';
comment on column parasut.e_invoice_inboxes.queried_at is
  'Phase 13.2: when this VKN lookup was actually performed against the live Parasut API. Only ever populated by a secure, authenticated backend call -- never by the public demo sync, which never triggers a live filter[vkn] query today (see EFaturaMukellefSorgulama BLOCKED note).';

-- ---------------------------------------------------------------------
-- 5. Recreate the empty-resource demo views (Phase 13) with the new
--    columns, real relationship id+type, and query-result-cache naming
--    for e_invoice_inboxes (never a global resource counter).
-- ---------------------------------------------------------------------
drop view if exists public.parasut_salaries_demo;
create view public.parasut_salaries_demo
as
select
  parasut_id,
  parasut_type,
  description,
  currency,
  issue_date,
  due_date,
  exchange_rate,
  net_total,
  total_paid,
  remaining,
  remaining_in_trl,
  archived,
  employee_parasut_id,
  employee_parasut_type,
  category_parasut_id,
  category_parasut_type,
  parasut_created_at,
  parasut_updated_at,
  synced_at
from parasut.salaries
order by issue_date desc nulls last, parasut_id desc;

grant select on public.parasut_salaries_demo to authenticated, anon;

drop view if exists public.parasut_taxes_demo;
create view public.parasut_taxes_demo
as
select
  parasut_id,
  parasut_type,
  description,
  issue_date,
  due_date,
  net_total,
  total_paid,
  remaining,
  remaining_in_trl,
  archived,
  category_parasut_id,
  category_parasut_type,
  parasut_created_at,
  parasut_updated_at,
  synced_at
from parasut.taxes
order by issue_date desc nulls last, parasut_id desc;

grant select on public.parasut_taxes_demo to authenticated, anon;

drop view if exists public.parasut_tags_demo;
create view public.parasut_tags_demo
as
select
  parasut_id,
  parasut_type,
  name,
  parasut_created_at,
  parasut_updated_at,
  synced_at
from parasut.tags
order by name nulls last;

grant select on public.parasut_tags_demo to authenticated, anon;

-- Real junction -> tag-name join views (0 rows today, plumbing is real).
create or replace view public.parasut_salary_tags_demo
as
select
  st.salary_parasut_id,
  st.tag_parasut_id,
  st.tag_type,
  t.name as tag_name,
  st.synced_at
from parasut.salary_tags st
left join parasut.tags t on t.parasut_id = st.tag_parasut_id;

grant select on public.parasut_salary_tags_demo to authenticated, anon;

create or replace view public.parasut_tax_tags_demo
as
select
  tt.tax_parasut_id,
  tt.tag_parasut_id,
  tt.tag_type,
  t.name as tag_name,
  tt.synced_at
from parasut.tax_tags tt
left join parasut.tags t on t.parasut_id = tt.tag_parasut_id;

grant select on public.parasut_tax_tags_demo to authenticated, anon;

-- item_categories: expose parasut_type/parent type/real subcategories
-- relationship alongside the existing Phase 5 columns.
drop view if exists public.parasut_item_categories_demo;
create view public.parasut_item_categories_demo
as
select
  parasut_id,
  parasut_type,
  name,
  full_path,
  bg_color,
  text_color,
  category_type,
  parent_category_parasut_id,
  parent_category_parasut_type,
  subcategories,
  parasut_created_at,
  parasut_updated_at,
  synced_at
from parasut.item_categories
order by full_path nulls last, parasut_id desc;

grant select on public.parasut_item_categories_demo to authenticated, anon;

-- e_invoice_inboxes: renamed to make clear this is a cached lookup
-- result set, never a global inbox collection. Old view name dropped
-- (Phase 13's parasut_e_invoice_inboxes_demo) and replaced.
drop view if exists public.parasut_e_invoice_inboxes_demo;
create view public.parasut_e_invoice_lookup_results_demo
as
select
  parasut_id,
  parasut_type,
  query_vkn,
  vkn,
  e_invoice_address,
  name,
  inbox_type,
  address_registered_at,
  registered_at,
  parasut_created_at,
  parasut_updated_at,
  queried_at,
  synced_at
from parasut.e_invoice_inboxes
order by queried_at desc nulls last, parasut_id desc;

grant select on public.parasut_e_invoice_lookup_results_demo to authenticated, anon;

-- Query-result cache count, explicitly NOT a global e-invoice-inbox
-- total: this resource has no "list all inboxes" semantics at all.
drop view if exists public.parasut_e_invoice_inbox_counts_demo;
create view public.parasut_e_invoice_lookup_result_counts_demo
as
select count(*) as cached_query_result_count
from parasut.e_invoice_inboxes;

comment on view public.parasut_e_invoice_lookup_result_counts_demo is
  'Phase 13.2: count of locally cached e-invoice-taxpayer LOOKUP results (rows previously queried and stored by a secure backend), never the count of "all e-invoice inboxes in the company" -- no such global collection exists for this resource.';

grant select on public.parasut_e_invoice_lookup_result_counts_demo to authenticated, anon;
