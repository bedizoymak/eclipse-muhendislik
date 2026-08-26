-- Phase 6.1: fix a real data-loss bug in public.parasut_checks_demo.
--
-- parasut.checks.days_till_due_date and the parasut-sync Edge Function
-- mapper (resources/checks.ts) already store this real Parasut API
-- attribute correctly -- verified against the live API: all 40 current
-- check records return it, non-null (e.g. parasut_id 1000245233 ->
-- days_till_due_date -985). The column was simply never added to the
-- public.parasut_checks_demo view's select list in the original Phase 6
-- migration (20260826080000_parasut_checks.sql), so it never reached the
-- frontend. This migration does not touch the base table (the column
-- already exists there) -- it only re-creates the view, appending the
-- column at the end of the existing select list, since CREATE OR REPLACE
-- VIEW cannot reorder/insert columns among existing ones.

create or replace view public.parasut_checks_demo
as
select
  c.parasut_id,
  c.currency,
  c.description,
  c.due_date,
  c.issue_date,
  c.net_total,
  c.remaining,
  c.remaining_in_trl,
  c.payment_status,
  c.is_cashed,
  c.is_in,
  c.is_out,
  c.is_transferred,
  c.days_overdue,
  c.bank_identifier,
  c.bank_name,
  c.serial_number,
  c.issued_by_parasut_id,
  c.issued_by_type,
  issuer.name as issued_by_name,
  c.given_to_parasut_id,
  c.given_to_type,
  recipient.name as given_to_name,
  c.synced_at,
  c.days_till_due_date
from parasut.checks c
left join parasut.contacts issuer on c.issued_by_type = 'contacts' and issuer.parasut_id = c.issued_by_parasut_id
left join parasut.contacts recipient on c.given_to_type = 'contacts' and recipient.parasut_id = c.given_to_parasut_id
order by c.due_date desc nulls last;

grant select on public.parasut_checks_demo to authenticated, anon;
