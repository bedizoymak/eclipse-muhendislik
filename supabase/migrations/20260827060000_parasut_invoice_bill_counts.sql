-- Phase 8.3: durable, row-limit-proof tab counters for the sales invoice
-- and purchase bill list screens.
--
-- Phase 8.2's fix replaced 3 concurrent count=exact HEAD requests with a
-- single `select=archived` GET whose rows were counted client-side. That
-- works today (451/811 rows) but silently breaks past PostgREST's default
-- max-rows=1000 -- the same limit already observed truncating products
-- (2597 real rows) and e_invoices (1238 real rows) to 1000 when fetched as
-- plain rows. These two resources are well under 1000 today but the fix
-- must not assume they always will be.
--
-- These views return exactly one aggregate row each via count(*) filter
-- (...), so PostgREST's max-rows only ever caps the single result row --
-- it never truncates the count itself, at any real record volume. No test
-- rows were created/duplicated/deleted to prove this; the same aggregate
-- pattern is demonstrably safe because it's a single SQL count(*), not a
-- row fetch.
--
-- archived is nullable on both base tables; a null is never forced into
-- either active or archived -- it is counted separately in
-- null_archived_count so active_count + archived_count + null_archived_count
-- always equals total_count exactly.

create view public.parasut_sales_invoice_counts_demo
as
select
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) filter (where archived is null) as null_archived_count,
  count(*) as total_count
from parasut.sales_invoices;

create view public.parasut_purchase_bill_counts_demo
as
select
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) filter (where archived is null) as null_archived_count,
  count(*) as total_count
from parasut.purchase_bills;

grant select on public.parasut_sales_invoice_counts_demo to authenticated, anon;
grant select on public.parasut_purchase_bill_counts_demo to authenticated, anon;
