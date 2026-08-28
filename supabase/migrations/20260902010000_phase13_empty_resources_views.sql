-- Phase 13: future-ready infrastructure for empty-but-real resources.
--
-- Live verification (this session, real GET requests against the live
-- Parasut account, page[size]=3):
--   * item_categories -> 200, data:[], meta.total_count:0 (already fully
--     implemented since Phase 5 -- base/view/sync/UI all exist; untouched
--     here, only re-verified).
--   * salaries        -> 200, data:[] (no meta.total_count key present,
--     but data is a real empty array).
--   * taxes            -> 200, data:[] (same shape as salaries).
--   * tags              -> 200, data:[], meta.total_count:0.
--   * e_invoice_inboxes -> 200, data:[], meta.total_count:0.
--   * trackable_jobs, bank_fees, stock_updates, e_smms -> all real 404
--     "No route matches." -- BLOCKED, not touched by this migration, no
--     view/sync/UI created for any of them.
--
-- filter[archived] real behavior (page[size]=1, filter[archived]=true):
--   * salaries/taxes -> real 400 "'archived' is not a valid filter.
--     Acceptable: due_date, issue_date, currency, remaining" -- the
--     `archived` column stays in the base table (real documented
--     attribute) but no active/archived *fetch* scoping is attempted by
--     the sync (see index.ts syncSalaries/syncTaxes comments). The count
--     view below still reports active/archived counts as real column
--     aggregates (both genuinely 0 today) since the column itself is real.
--   * tags -> real 400 "'archived' is not a valid filter. Acceptable: "
--     (empty list) -- tags has no archived column in the base table at
--     all, so its count view exposes total_count only.
--   * e_invoice_inboxes -> base table has no archived column either ->
--     total_count only.
--
-- parasut.salaries, parasut.taxes, parasut.tags, parasut.e_invoice_inboxes
-- already exist (Phase 0 bulk schema migration) with exactly the columns
-- this phase needs -- no ALTER TABLE required, no column guessed here.

create view public.parasut_salaries_demo
as
select
  parasut_id,
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
  category_parasut_id,
  parasut_created_at,
  parasut_updated_at,
  synced_at
from parasut.salaries
order by issue_date desc nulls last, parasut_id desc;

grant select on public.parasut_salaries_demo to authenticated, anon;

create view public.parasut_salary_counts_demo
as
select
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) as total_count
from parasut.salaries;

grant select on public.parasut_salary_counts_demo to authenticated, anon;

create view public.parasut_taxes_demo
as
select
  parasut_id,
  description,
  issue_date,
  due_date,
  net_total,
  total_paid,
  remaining,
  remaining_in_trl,
  archived,
  category_parasut_id,
  parasut_created_at,
  parasut_updated_at,
  synced_at
from parasut.taxes
order by issue_date desc nulls last, parasut_id desc;

grant select on public.parasut_taxes_demo to authenticated, anon;

create view public.parasut_tax_counts_demo
as
select
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) as total_count
from parasut.taxes;

grant select on public.parasut_tax_counts_demo to authenticated, anon;

create view public.parasut_tags_demo
as
select
  parasut_id,
  name,
  parasut_created_at,
  parasut_updated_at,
  synced_at
from parasut.tags
order by name nulls last;

grant select on public.parasut_tags_demo to authenticated, anon;

-- tags has no archived attribute in the real API schema -- total_count
-- only, never a fabricated active/archived split.
create view public.parasut_tag_counts_demo
as
select count(*) as total_count
from parasut.tags;

grant select on public.parasut_tag_counts_demo to authenticated, anon;

create view public.parasut_e_invoice_inboxes_demo
as
select
  parasut_id,
  vkn,
  e_invoice_address,
  name,
  inbox_type,
  address_registered_at,
  registered_at,
  parasut_created_at,
  parasut_updated_at,
  synced_at
from parasut.e_invoice_inboxes
order by name nulls last;

grant select on public.parasut_e_invoice_inboxes_demo to authenticated, anon;

-- e_invoice_inboxes has no archived attribute in the real API schema --
-- total_count only.
create view public.parasut_e_invoice_inbox_counts_demo
as
select count(*) as total_count
from parasut.e_invoice_inboxes;

grant select on public.parasut_e_invoice_inbox_counts_demo to authenticated, anon;
