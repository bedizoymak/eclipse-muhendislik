-- Phase 14.5: the frontend (src/pages/Faturalar.tsx) was computing its
-- "active" tab count as `active_count - cancelled_count` -- a subtractive
-- formula layered on top of the Phase 14.4 view. The task requires the
-- aggregate view itself to return every real dimension/overlap as its own
-- named counter, so the UI never subtracts one counter from another or
-- uses `.length` on a client-side fetched array.
drop view if exists public.parasut_sales_invoice_counts_demo;

create view public.parasut_sales_invoice_counts_demo
as
select
  -- the real filter the "Aktif" list view/tab uses: archived=false AND
  -- item_type IS DISTINCT FROM 'cancelled' -- computed directly here, not
  -- derived by the client from other counters.
  count(*) filter (
    where archived = false and item_type is distinct from 'cancelled'
  ) as list_active_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) filter (where archived is null) as null_archived_count,
  count(*) filter (where item_type = 'cancelled') as cancelled_count,
  count(*) filter (where archived = true and item_type = 'cancelled') as archived_cancelled_count,
  count(*) filter (where archived = true and item_type is distinct from 'cancelled') as non_cancelled_archived_count,
  count(*) filter (where item_type = 'invoice') as invoice_item_type_count,
  count(*) filter (where item_type is not null and item_type not in ('invoice', 'cancelled')) as other_item_type_count,
  count(*) filter (where item_type is null) as null_item_type_count,
  count(distinct parasut_id) as total_unique_count,
  count(*) as total_count
from parasut.sales_invoices;

comment on view public.parasut_sales_invoice_counts_demo is
  'Phase 14.5: every real dimension/overlap (archived, item_type, and their intersections) is its own named counter computed directly by this view. The frontend must read a counter by name and never derive one by subtracting another or by summing dimensions that can overlap (e.g. total is never active+archived+cancelled).';

grant select on public.parasut_sales_invoice_counts_demo to authenticated, anon;
