-- Phase 13.5: PAYMENT CAPABILITY/RELATIONSHIP AYRIMI
--
-- Corrects a real architectural error introduced in Phase 13.3 and left
-- documented-but-unfixed in Phase 13.4: `parasut.salary_payments` and
-- `parasut.tax_payments` were built to mirror `Salary.relationships.payments`
-- / `Tax.relationships.payments` as if they were readable to-many GET
-- relationships. Re-verified live in this phase against the real,
-- freshly-downloaded https://apidocs.parasut.com/swagger.json:
--
--   * `/{company_id}/salaries/{id}/payments` documents ONLY a `post` method.
--   * `/{company_id}/taxes/{id}/payments` documents ONLY a `post` method.
--   * `definitions.Salary.properties.relationships.properties` = exactly
--     {employee, category, tags} -- no `payments` key.
--   * `definitions.Tax.properties.relationships.properties` = exactly
--     {category, tags} -- no `payments` key.
--   * The `include` parameter on `GET /salaries/{id}` documents
--     "Available: employee, category, tags"; on `GET /taxes/{id}`,
--     "Available: category, tags". Neither ever lists `payments`.
--
-- `payments` on Salary/Tax is a write-only action endpoint (create a
-- payment), never a listable resource relationship. No GET response for
-- either resource (list or detail, with or without `include=`) can ever
-- populate a `relationships.payments` key, so `parasut.salary_payments`
-- and `parasut.tax_payments` were structurally guaranteed to always stay
-- empty -- confirmed live before this migration: 0 rows in both tables,
-- 0 rows in both derived views, and `parasut.payments` (the real payments
-- mirror used elsewhere in the app, sourced from sales_invoices/
-- purchase_bills/checks includes) holds 1651 real rows, none of which
-- originate from a salary/tax payments GET (no such GET exists to source
-- them from). It is therefore safe to drop these two junctions entirely
-- rather than leave dead, permanently-empty infrastructure in place.
--
-- This migration:
--   1. Drops the two derived public views.
--   2. Drops the two parasut-schema junction tables.
--   3. Corrects parasut.relationship_manifest: removes the 'payments' rows
--      for salaries/taxes (never write a write-only capability into the
--      relationship manifest).
--   4. Adds parasut.write_capability_manifest as the explicit, separate
--      PARASUT_WRITE_CAPABILITY class asked for by this phase -- documents
--      real POST-only action endpoints without ever conflating them with
--      readable relationships.
--
-- Never edits the Phase 13.3/13.4 migrations that created this
-- infrastructure -- this is a new, forward-only correction.

drop view if exists public.parasut_salary_payments_demo;
drop view if exists public.parasut_tax_payments_demo;

drop table if exists parasut.salary_payments;
drop table if exists parasut.tax_payments;

delete from parasut.relationship_manifest
where resource in ('salaries', 'taxes') and relationship_key = 'payments';

-- Phase 13.5: PARASUT_WRITE_CAPABILITY class. A real, documented POST/PUT/
-- PATCH/DELETE-only API action -- NOT a mirror relationship. Must never be
-- written to a base/junction table as if it were a read relationship,
-- does not prove "no linked payment" (unknowable -- no GET exists to check
-- it), is not by itself sufficient to justify a create-button in the
-- public demo, and cannot be used without real user input, auth,
-- write-back, and idempotency design (none of which exist in this
-- read-only mirror project). Deliberately kept as a separate table from
-- parasut.relationship_manifest so the two concepts can never be
-- conflated by a query or a UI that reads one and assumes the other.
create table if not exists parasut.write_capability_manifest (
  resource text not null,
  operation text not null,
  method text not null,
  path text not null,
  read_write text not null default 'write_only',
  auth_status text not null default 'requires_write_scope',
  ui_decision text not null default 'not_exposed',
  notes text,
  updated_at timestamptz not null default now(),
  primary key (resource, operation)
);
comment on table parasut.write_capability_manifest is
  'Phase 13.5: technical capability manifest for real write-action-only API paths (e.g. POST /salaries/{id}/payments). Never a source of GET relationship data -- see parasut.relationship_manifest for that. A row existing here means the capability is real and documented in swagger.json, not that any UI is allowed to use it.';

revoke all on parasut.write_capability_manifest from authenticated, anon;

insert into parasut.write_capability_manifest
  (resource, operation, method, path, read_write, auth_status, ui_decision, notes)
values
  ('salaries', 'create_payment', 'POST', '/salaries/{id}/payments', 'write_only', 'requires_write_scope', 'not_exposed',
   'Verified live against swagger.json in Phase 13.5: this path documents only a post method, no get. Salary.relationships never contained a payments key (employee, category, tags only). Formerly mis-modeled as parasut.salary_payments (Phase 13.3/13.4), which is dropped by this migration -- it could never be populated by any real GET response.'),
  ('taxes', 'create_payment', 'POST', '/taxes/{id}/payments', 'write_only', 'requires_write_scope', 'not_exposed',
   'Verified live against swagger.json in Phase 13.5: this path documents only a post method, no get. Tax.relationships never contained a payments key (category, tags only). Formerly mis-modeled as parasut.tax_payments (Phase 13.3/13.4), which is dropped by this migration -- it could never be populated by any real GET response.')
on conflict (resource, operation) do update set
  method = excluded.method,
  path = excluded.path,
  read_write = excluded.read_write,
  auth_status = excluded.auth_status,
  ui_decision = excluded.ui_decision,
  notes = excluded.notes,
  updated_at = now();
