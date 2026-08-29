-- Phase 14.4: the sales-invoice counter view previously only split by
-- `archived` (true/false/null). Since Phase 14.4 now mirrors real
-- item_type="cancelled" invoices (archived=false, same as a normal active
-- invoice), the old active_count silently folded cancelled invoices into
-- "active" -- a cancelled record must never be shown as if it were active.
-- This view now reports item_type as an explicit, separate dimension from
-- archived, per the real API's own item_type field (never derived from
-- archived/active status).
drop view if exists public.parasut_sales_invoice_counts_demo;

create view public.parasut_sales_invoice_counts_demo
as
select
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) filter (where archived is null) as null_archived_count,
  count(*) filter (where item_type = 'cancelled') as cancelled_count,
  count(*) filter (where item_type = 'invoice') as invoice_item_type_count,
  count(*) filter (where item_type is not null and item_type not in ('invoice', 'cancelled')) as other_item_type_count,
  count(*) filter (where item_type is null) as null_item_type_count,
  count(*) as total_count
from parasut.sales_invoices;

comment on view public.parasut_sales_invoice_counts_demo is
  'Phase 14.4: archived and item_type are reported as two separate real dimensions (a cancelled invoice can have archived=false, same as an active one) -- never a single derived "status" bucket.';

grant select on public.parasut_sales_invoice_counts_demo to authenticated, anon;
