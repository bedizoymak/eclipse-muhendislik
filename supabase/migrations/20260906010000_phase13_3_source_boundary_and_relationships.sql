-- Phase 13.3: fixes the Phase 13.2 ERP/Parasut schema-boundary violation
-- (ERP_USER_ENTERED query_vkn was added directly to the parasut mirror
-- table parasut.e_invoice_inboxes), separates e-invoice lookup from the
-- global sync semantics, and adds the remaining known salary/tax
-- relationships (payments junctions). New migration file only -- no prior
-- migration file is edited.

-- ---------------------------------------------------------------------
-- 1. New `erp` schema for ERP-owned, user-input data. This schema NEVER
--    mirrors Parasut API data -- only data that originates inside this
--    ERP (a user's own request/action). Physically separate from the
--    `parasut` schema, which mirrors ONLY data that came from Parasut.
-- ---------------------------------------------------------------------
create schema if not exists erp;
comment on schema erp is
  'Phase 13.3: ERP-owned data (user-entered requests, audit trail). Never contains a Parasut API mirror column. See parasut schema for API-mirrored data.';

create table if not exists erp.e_invoice_lookup_requests (
  id uuid primary key default gen_random_uuid(),
  company_id text not null default '',
  query_vkn text not null,
  requested_by text,
  requested_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'error', 'blocked')),
  completed_at timestamptz,
  error_class text,
  error_message text,
  created_at timestamptz not null default now()
);
comment on table erp.e_invoice_lookup_requests is
  'Phase 13.3: ERP_USER_ENTERED audit row for a taxpayer e-invoice-inbox lookup request. query_vkn here is the ONLY place a caller-supplied VKN is stored -- it must never be written into any parasut.* mirror table. Not exposed to anon/public; RLS/tenant scoping is a prerequisite of the future secure-auth phase before this table is ever written to by a live public form (still BLOCKED today).';

create table if not exists erp.e_invoice_lookup_request_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references erp.e_invoice_lookup_requests(id) on delete cascade,
  result_parasut_id bigint not null,
  result_type text not null,
  created_at timestamptz not null default now(),
  constraint e_invoice_lookup_request_results_unique unique (request_id, result_parasut_id, result_type)
);
comment on table erp.e_invoice_lookup_request_results is
  'Phase 13.3: safe mapping from an ERP lookup request to the real Parasut e_invoice_inboxes row(s) it produced. Links by parasut_id/type only -- no user-entered field is duplicated here.';

revoke all on erp.e_invoice_lookup_requests from anon, authenticated;
revoke all on erp.e_invoice_lookup_request_results from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. parasut.e_invoice_inboxes: query_vkn is deprecated/untrusted. The
--    column is NOT dropped (existing 0 rows, no data loss risk either
--    way) but is documented as deprecated and the mapper (edited in this
--    phase's code commit) stops writing to it. The public view is
--    recreated without exposing it.
-- ---------------------------------------------------------------------
comment on column parasut.e_invoice_inboxes.query_vkn is
  'DEPRECATED as of Phase 13.3 -- this column violated the ERP/Parasut schema boundary (ERP_USER_ENTERED data must never live in a parasut.* mirror table). The mapper no longer writes to it. The caller-supplied VKN for a lookup now lives only in erp.e_invoice_lookup_requests.query_vkn. Column kept (not dropped) only because dropping is out of scope for this migration; it must be treated as untrusted/ignored by all new code and is not exposed by public.parasut_e_invoice_lookup_results_demo.';

drop view if exists public.parasut_e_invoice_lookup_results_demo;
create view public.parasut_e_invoice_lookup_results_demo
as
select
  parasut_id,
  parasut_type,
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

comment on view public.parasut_e_invoice_lookup_results_demo is
  'Phase 13.3: deliberately does NOT expose query_vkn (deprecated/untrusted ERP_USER_ENTERED column) or any lookup-history-by-VKN grouping -- never usable to enumerate "who queried what" without RLS/tenant boundaries, which are out of scope until a future secure-auth phase.';

grant select on public.parasut_e_invoice_lookup_results_demo to authenticated, anon;

-- Query-result cache count -- unchanged semantics from Phase 13.2, kept
-- here only to guarantee it still only counts real safely-stored lookup
-- results, never a global inbox total.
drop view if exists public.parasut_e_invoice_lookup_result_counts_demo;
create view public.parasut_e_invoice_lookup_result_counts_demo
as
select count(*) as cached_query_result_count
from parasut.e_invoice_inboxes
where queried_at is not null;

comment on view public.parasut_e_invoice_lookup_result_counts_demo is
  'Phase 13.3: counts ONLY rows genuinely produced by a real, authenticated filter[vkn] lookup (queried_at is not null) -- rows from an unfiltered/global call are never counted here, and no unfiltered global sync is ever run for this resource as of Phase 13.3 (see e_invoice_inboxes sync: BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH).';

grant select on public.parasut_e_invoice_lookup_result_counts_demo to authenticated, anon;

-- ---------------------------------------------------------------------
-- 3. Salary/Tax payments relationship junctions (Swagger: Salary.payments,
--    Tax.payments are real to-many relationships). Preserves the real
--    relationship id+type list; never copies parasut.payments rows in.
-- ---------------------------------------------------------------------
create table if not exists parasut.salary_payments (
  salary_parasut_id bigint not null references parasut.salaries(parasut_id) on delete cascade,
  payment_parasut_id bigint not null,
  payment_type text not null,
  synced_at timestamptz not null default now(),
  constraint salary_payments_unique unique (salary_parasut_id, payment_parasut_id, payment_type)
);
comment on table parasut.salary_payments is
  'Phase 13.3: junction for the real Salary.relationships.payments to-many relationship. payment_type is the real relationships.payments.data[].type value, never hardcoded. Refreshed (diffed) on every sync of the parent salary; stale links deleted. Links by id/type only -- never fabricates a payment amount/name; a safe UI join to parasut.payments (if a matching real row exists there) may resolve amount/date.';

create table if not exists parasut.tax_payments (
  tax_parasut_id bigint not null references parasut.taxes(parasut_id) on delete cascade,
  payment_parasut_id bigint not null,
  payment_type text not null,
  synced_at timestamptz not null default now(),
  constraint tax_payments_unique unique (tax_parasut_id, payment_parasut_id, payment_type)
);
comment on table parasut.tax_payments is
  'Phase 13.3: junction for the real Tax.relationships.payments to-many relationship. Same rules as parasut.salary_payments.';

grant select on parasut.salary_payments to authenticated, anon;
grant select on parasut.tax_payments to authenticated, anon;

-- Safe join views: real junction rows joined to parasut.payments only
-- when a matching real payment row already exists there (0 rows today,
-- genuinely -- never fabricated).
create or replace view public.parasut_salary_payments_demo
as
select
  sp.salary_parasut_id,
  sp.payment_parasut_id,
  sp.payment_type,
  p.amount as payment_amount,
  p.currency as payment_currency,
  p.date as payment_date,
  sp.synced_at
from parasut.salary_payments sp
left join parasut.payments p on p.parasut_id = sp.payment_parasut_id;

grant select on public.parasut_salary_payments_demo to authenticated, anon;

create or replace view public.parasut_tax_payments_demo
as
select
  tp.tax_parasut_id,
  tp.payment_parasut_id,
  tp.payment_type,
  p.amount as payment_amount,
  p.currency as payment_currency,
  p.date as payment_date,
  tp.synced_at
from parasut.tax_payments tp
left join parasut.payments p on p.parasut_id = tp.payment_parasut_id;

grant select on public.parasut_tax_payments_demo to authenticated, anon;

-- ---------------------------------------------------------------------
-- 4. Salary/Tax activities: Swagger cardinality for this relationship on
--    these two resource types could not be verified against a real
--    runtime example (0 records exist for either resource today, and the
--    generic `activities` relationship on other resource types returns
--    `{meta:{}}` with no `data`, per the existing sales_offer_activities
--    precedent in this codebase). Left SCHEMA_BLOCKED: no table created,
--    no synthetic record ever written, but the real relationships.activities
--    raw block IS preserved verbatim inside salaries.raw / taxes.raw (the
--    mapper never drops it), so nothing is lost once cardinality can be
--    verified against a real record in the future.
-- ---------------------------------------------------------------------
comment on column parasut.salaries.raw is
  'Full JSON:API resource object as returned by Parasut, verbatim. Phase 13.3: this is also the only place relationships.activities is currently preserved (SCHEMA_BLOCKED -- cardinality unverified against a real record) and relationships.payments before the salary_payments junction resolves it structurally.';
comment on column parasut.taxes.raw is
  'Full JSON:API resource object as returned by Parasut, verbatim. Phase 13.3: relationships.activities has no verified real-record schema for this resource type yet (SCHEMA_BLOCKED) -- preserved verbatim here, never synthesized into a fake row.';

-- ---------------------------------------------------------------------
-- 5. Known/unknown relationship manifest, statically audited against the
--    real Swagger schema (not just empty runtime detection, which alone
--    cannot prove completeness with 0 records). One row per (resource,
--    relationship_key) pair for salaries/taxes/tags/item_categories/
--    e_invoice_inboxes.
-- ---------------------------------------------------------------------
create table if not exists parasut.relationship_manifest (
  resource text not null,
  relationship_key text not null,
  state text not null check (state in (
    'known_and_mapped', 'known_but_schema_blocked', 'known_but_unmapped', 'genuinely_unknown'
  )),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (resource, relationship_key)
);
comment on table parasut.relationship_manifest is
  'Phase 13.3: static audit manifest of every Swagger-documented relationship key per resource, cross-checked by hand against the live Swagger schema (not runtime-inferred) -- see reports/PHASE_13_3_SOURCE_BOUNDARY_AND_ALL_RELATIONSHIPS_REPORT.md section 5 for the audit method.';

insert into parasut.relationship_manifest (resource, relationship_key, state, notes) values
  ('salaries', 'employee', 'known_and_mapped', 'parasut.salaries.employee_parasut_id/employee_parasut_type'),
  ('salaries', 'category', 'known_and_mapped', 'parasut.salaries.category_parasut_id/category_parasut_type'),
  ('salaries', 'tags', 'known_and_mapped', 'parasut.salary_tags junction (Phase 13.2)'),
  ('salaries', 'payments', 'known_and_mapped', 'parasut.salary_payments junction (Phase 13.3)'),
  ('salaries', 'activities', 'known_but_schema_blocked', 'cardinality unverified, 0 real records; preserved verbatim in raw'),
  ('taxes', 'category', 'known_and_mapped', 'parasut.taxes.category_parasut_id/category_parasut_type'),
  ('taxes', 'tags', 'known_and_mapped', 'parasut.tax_tags junction (Phase 13.2)'),
  ('taxes', 'payments', 'known_and_mapped', 'parasut.tax_payments junction (Phase 13.3)'),
  ('taxes', 'activities', 'known_but_schema_blocked', 'cardinality unverified, 0 real records; preserved verbatim in raw'),
  ('tags', '(none documented)', 'genuinely_unknown', 'Swagger Tag resource documents no relationships'),
  ('item_categories', 'parent_category', 'known_and_mapped', 'parasut.item_categories.parent_category_parasut_id/type'),
  ('item_categories', 'subcategories', 'known_and_mapped', 'parasut.item_categories.subcategories jsonb (verbatim data[])'),
  ('e_invoice_inboxes', '(none documented)', 'genuinely_unknown', 'Swagger EInvoiceInbox resource documents no relationships')
on conflict (resource, relationship_key) do update set state = excluded.state, notes = excluded.notes, updated_at = now();

grant select on parasut.relationship_manifest to authenticated, anon;
create or replace view public.parasut_relationship_manifest_demo as select * from parasut.relationship_manifest;
grant select on public.parasut_relationship_manifest_demo to authenticated, anon;

-- ---------------------------------------------------------------------
-- 6. item_categories: first-ever UI route for this resource (Phase 5
--    created the mirror table/view, Phase 13.2 added parasut_type/
--    parent type/subcategories, but no count view and no page/route ever
--    existed). This is a real count aggregate (count(*)), never hardcoded.
-- ---------------------------------------------------------------------
drop view if exists public.parasut_item_category_counts_demo;
create view public.parasut_item_category_counts_demo
as
select count(*) as total_count
from parasut.item_categories;

grant select on public.parasut_item_category_counts_demo to authenticated, anon;
