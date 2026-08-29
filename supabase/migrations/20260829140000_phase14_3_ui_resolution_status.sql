-- Phase 14.3: fix a real link-fabrication bug in the frontend's data
-- contract. `public.parasut_e_invoices_demo` exposed `parent_type` +
-- `parent_parasut_id` with no way for the frontend to tell "parent
-- resolved locally, safe to link" apart from "relationship exists but the
-- parent row isn't in our local sales_invoices/purchase_bills table" --
-- EFaturaDetay.tsx and EFaturalar.tsx were rendering a React Router
-- <Link> to the parent for BOTH cases, which 404s for the latter. Adds
-- `parent_resolution_status` ('resolved' | 'unresolved' | 'no_relationship',
-- computed by parasut.e_invoices_with_resolution -- see that view's own
-- comment) to the row-level demo view and refreshes the counters view with
-- resolved/unresolved sales+purchase splits.
create or replace view public.parasut_e_invoices_demo
as
select
  e.parasut_id,
  e.parent_type,
  e.parent_parasut_id,
  e.external_id,
  e.uuid,
  e.direction,
  e.scenario,
  e.status,
  e.status_code,
  e.status_message,
  e.item_type,
  e.invoice_type_code,
  e.issue_date,
  e.expires_at,
  e.is_expired,
  e.is_answerable,
  e.is_seen,
  e.non_standard_e_invoice,
  e.archived,
  e.currency,
  e.net_total,
  e.total_vat,
  e.contact_name,
  e.from_address,
  e.from_vkn,
  e.to_address,
  e.to_vkn,
  e.note,
  e.response_type,
  e.env_uuid,
  e.profile_id,
  e.refund_of_id,
  e.vat_exemption_reason_code,
  e.pdf_url,
  e.signed_ubl_url,
  e.html_url,
  e.parasut_created_at,
  e.parasut_updated_at,
  e.synced_at,
  e.gtb_ref_no,
  e.migration_source,
  e.parent_resolution_status
from parasut.e_invoices_with_resolution e
order by e.issue_date desc nulls last;

grant select on public.parasut_e_invoices_demo to authenticated, anon;

create or replace view public.parasut_e_invoices_counts_demo
as
select
  count(*) as total_e_invoices,
  count(*) filter (where parent_type = 'sales_invoices') as linked_sales_invoice_count,
  count(*) filter (where parent_type = 'purchase_bills') as linked_purchase_bill_count,
  count(*) filter (where parent_type is null) as unlinked_count,
  count(*) filter (where direction = 'inbound') as inbound_count,
  count(*) filter (where direction = 'outbound') as outbound_count,
  count(*) filter (where direction is null) as unknown_direction_count,
  count(*) filter (where archived = true) as archived_count,
  count(*) filter (where archived = false) as active_count,
  count(*) filter (where archived is null) as null_archived_count,
  count(*) filter (
    where parent_type is not null
      and parent_type not in ('sales_invoices', 'purchase_bills')
  ) as unresolved_relationship_count,
  count(*) filter (where parent_resolution_status = 'resolved' and parent_type = 'sales_invoices') as resolved_sales_relationship,
  count(*) filter (where parent_resolution_status = 'unresolved' and parent_type = 'sales_invoices') as unresolved_sales_relationship,
  count(*) filter (where parent_resolution_status = 'resolved' and parent_type = 'purchase_bills') as resolved_purchase_relationship,
  count(*) filter (where parent_resolution_status = 'unresolved' and parent_type = 'purchase_bills') as unresolved_purchase_relationship,
  count(*) filter (where parent_resolution_status = 'no_relationship') as no_invoice_relationship,
  count(*) filter (where parent_type is not null) as total_with_relationship
from parasut.e_invoices_with_resolution;

grant select on public.parasut_e_invoices_counts_demo to authenticated, anon;
