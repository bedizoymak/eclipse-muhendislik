-- Phase 10: Çalışanlar (Employees).
--
-- Real API verification (GET /employees, GET /employees/{id}, live account,
-- this migration's authoring session):
--   * 6 real records (total_count:6), filter[archived] real
--     (=false -> 6, =true -> 0), pagination meta real.
--   * Real attributes not yet in parasut.employees: tckn,
--     employment_start_date, employment_end_date, phone. All 4 are real
--     null on all 6 current records (never fabricated -- added because the
--     API genuinely returns them as attribute keys, not because any record
--     currently has a value).
--   * Real list-endpoint includes (via a real 400 body): category,
--     managed_by_user, managed_by_user_role, tags. activities/comments 400
--     on the list endpoint ("Acceptable: category, managed_by_user,
--     managed_by_user_role, tags") but resolve as real, genuinely empty
--     `data:[]` via GET /employees/{id}?include=activities,comments -- same
--     list/single inconsistency already documented for
--     shipment_documents.activities (Phase 9).
--   * All 6 real employees, checked individually with every relationship
--     included: category/managed_by_user/managed_by_user_role are real
--     `data:null`; activities/comments/tags are real `data:[]`. Zero
--     categories, zero managed-by users, zero activities, zero comments,
--     zero tags exist anywhere in this account's employee data today --
--     no table/junction is created for any of them (an empty {"meta":{}}
--     or {"data":[]} is never treated as "needs a table").
--   * GET /salaries -> 200, real `data:[]` -- 0 real salary records in this
--     account (parasut.salaries already exists from the Phase 0 schema and
--     stays untouched/unsynced; no salary UI section is built).
--
-- category_parasut_id/managed_by_user_parasut_id/managed_by_user_role_*
-- columns are kept (they already existed or are added below) purely so a
-- real link is representable the moment this account ever gets one --
-- never populated with anything but a genuine relationships.*.data id/type.

alter table parasut.employees
  add column if not exists tckn text,
  add column if not exists employment_start_date date,
  add column if not exists employment_end_date date,
  add column if not exists phone text,
  add column if not exists managed_by_user_parasut_id bigint,
  add column if not exists managed_by_user_role_parasut_id bigint,
  add column if not exists managed_by_user_role_type text,
  add column if not exists tags_resolved boolean,
  add column if not exists activities_resolved boolean,
  add column if not exists comments_resolved boolean;

create index if not exists employees_archived_idx on parasut.employees(archived);

-- Safe upsert only (established convention) -- do not drop/recreate rows.

create or replace view public.parasut_employees_demo
as
select
  e.parasut_id,
  e.name,
  e.email,
  e.phone,
  e.iban,
  e.tckn,
  e.archived,
  e.employment_start_date,
  e.employment_end_date,
  e.balance,
  e.trl_balance,
  e.usd_balance,
  e.eur_balance,
  e.gbp_balance,
  e.category_parasut_id,
  e.managed_by_user_parasut_id,
  e.managed_by_user_role_parasut_id,
  e.managed_by_user_role_type,
  e.tags_resolved,
  e.activities_resolved,
  e.comments_resolved,
  e.parasut_created_at,
  e.parasut_updated_at,
  e.synced_at
from parasut.employees e
order by e.name nulls last;

grant select on public.parasut_employees_demo to authenticated, anon;

-- Durable, row-limit-proof counter (same aggregate-count-view pattern as
-- Phase 8.3). The real API has an `archived` attribute on employees
-- (verified: real boolean, always false today) so the active/archived
-- split is genuine, not invented.
create view public.parasut_employee_counts_demo
as
select
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) filter (where archived is null) as null_archived_count,
  count(*) as total_count
from parasut.employees;

grant select on public.parasut_employee_counts_demo to authenticated, anon;
