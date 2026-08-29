-- Phase 14.3: expose real parent-resolution status without ever fabricating
-- a parent. `parent_type`/`parent_parasut_id` are now only ever SET (never
-- blindly cleared) by syncActiveEDocuments/syncEInvoicesStandalone (see
-- code comment in supabase/functions/parasut-sync/index.ts,
-- syncActiveEDocuments), so a real relationship id/type surviving here with
-- no matching local parent row means "relationship exists, parent not yet
-- resolved locally" -- not "no relationship". This view computes that
-- distinction from real evidence (a join, not a flag anyone can drift):
--   'no_relationship'   parent_type is null (API invoice.data was null)
--   'resolved'          parent_type set AND the parent row exists locally
--   'unresolved'        parent_type set AND the parent row is NOT local yet
create or replace view parasut.e_invoices_with_resolution as
select
  e.*,
  case
    when e.parent_type is null then 'no_relationship'
    when e.parent_type = 'sales_invoices' and si.parasut_id is not null then 'resolved'
    when e.parent_type = 'purchase_bills' and pb.parasut_id is not null then 'resolved'
    else 'unresolved'
  end as parent_resolution_status
from parasut.e_invoices e
left join parasut.sales_invoices si
  on e.parent_type = 'sales_invoices' and si.parasut_id = e.parent_parasut_id
left join parasut.purchase_bills pb
  on e.parent_type = 'purchase_bills' and pb.parasut_id = e.parent_parasut_id;

grant select on parasut.e_invoices_with_resolution to authenticated, anon, service_role;
