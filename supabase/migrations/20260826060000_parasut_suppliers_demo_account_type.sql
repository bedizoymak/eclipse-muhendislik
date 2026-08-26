-- Phase 4.1: expose the real account_type column on public.parasut_suppliers_demo
-- so the supplier definition (account_type = 'supplier') is directly
-- verifiable through the view itself, not just asserted in code/reports.
--
-- CREATE OR REPLACE VIEW requires every existing output column to keep its
-- name and position, so the new column is appended at the end (same
-- constraint hit in the Phase 1.2/2/3 migrations). The view's WHERE filter
-- is unchanged: still account_type = 'supplier', the API's own field --
-- never inferred from name or balance.
create or replace view public.parasut_suppliers_demo
as
select
  parasut_id,
  name,
  short_name,
  email,
  phone,
  city,
  archived,
  synced_at,
  account_type
from parasut.contacts
where account_type = 'supplier'
order by name nulls last;
