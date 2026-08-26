-- Phase 6.2: preserve every real attribute/relationship the live /checks
-- API returns, none of which may be treated as "out of scope" and dropped.
--
-- Confirmed by a fresh full-pagination probe of all 40 real check records
-- (see reports/PHASE_06_2_CHECKS_COMPLETE_API_DATA_REPORT.md for the full
-- inventory):
--
--   * remaining_in_trl, created_at, updated_at were already stored in
--     parasut.checks (as remaining_in_trl/parasut_created_at/
--     parasut_updated_at) but never exposed through the demo view or UI.
--   * relationships.payments is a real to-many relationship (JSON:API
--     array) -- 35 of 40 checks have exactly one linked payment, 5 have a
--     genuinely empty array (no payment yet). The full payment objects
--     resolve via include=payments on the checks list endpoint (verified:
--     list-level "included" does return them, even though a standalone
--     /payments/{id} route 404s and .transaction sub-include on top of
--     payments is rejected). These payments are stored in the *existing*
--     parasut.payments table with payable_type='checks' and
--     payable_parasut_id=<check parasut_id> -- the same payable_type/
--     payable_parasut_id design already used for sales_invoices and
--     purchase_bills payments -- so no new junction table is needed: a
--     payment already points at exactly one payable, and multiple payments
--     can already share the same payable_parasut_id if a check is ever
--     linked to more than one.
--   * The payment resource itself also has real attributes
--     (due_date/matched_amount/amount_in_trl/paid_in_currency) that the
--     payments mapper never captured for any payable type -- added here
--     for all payments, not just checks', since it's the same resource
--     shape and omitting them would repeat the exact defect this phase
--     exists to fix.
--   * relationships.histories was checked on all 40 records: every single
--     one is `{"meta":{}}` with no data/links and no other keys -- genuinely
--     empty, not lost data. No table/UI is added for it.
--   * issued_by/given_to were already fully preserved (Phase 6/6.1); no
--     issue found there in this audit.
--   * The `category`, `details`, `tags`, `refund_of`, `sharings`, and
--     `recurrence_plan` includes that the API itself lists as "Acceptable"
--     in its own 400 error message all return a real HTTP 500 from the live
--     API when actually requested -- a genuine upstream server bug, not a
--     gap in this codebase. None of these relationship keys ever appear on
--     an unincluded check resource either. Documented, not worked around.

alter table parasut.payments
  add column due_date date,
  add column matched_amount numeric,
  add column amount_in_trl numeric,
  add column paid_in_currency text;

create or replace view public.parasut_payments_demo
as
select
  p.parasut_id,
  p.date,
  p.amount,
  p.currency,
  p.notes,
  p.payable_type,
  p.payable_parasut_id,
  si.invoice_no as invoice_no,
  si.contact_parasut_id,
  c.name as contact_name,
  p.transaction_parasut_id,
  t.description as transaction_description,
  t.transaction_type,
  t.debit_account_parasut_id,
  t.debit_account_type,
  da.name as debit_account_name,
  t.credit_account_parasut_id,
  t.credit_account_type,
  ca.name as credit_account_name,
  p.synced_at,
  p.due_date,
  p.matched_amount,
  p.amount_in_trl,
  p.paid_in_currency
from parasut.payments p
left join parasut.sales_invoices si on p.payable_type = 'sales_invoices' and si.parasut_id = p.payable_parasut_id
left join parasut.contacts c on c.parasut_id = si.contact_parasut_id
left join parasut.transactions t on t.parasut_id = p.transaction_parasut_id
left join parasut.accounts da on t.debit_account_type = 'accounts' and da.parasut_id = t.debit_account_parasut_id
left join parasut.accounts ca on t.credit_account_type = 'accounts' and ca.parasut_id = t.credit_account_parasut_id
order by p.date desc nulls last;

grant select on public.parasut_payments_demo to authenticated, anon;

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
  c.days_till_due_date,
  c.parasut_created_at,
  c.parasut_updated_at
from parasut.checks c
left join parasut.contacts issuer on c.issued_by_type = 'contacts' and issuer.parasut_id = c.issued_by_parasut_id
left join parasut.contacts recipient on c.given_to_type = 'contacts' and recipient.parasut_id = c.given_to_parasut_id
order by c.due_date desc nulls last;

grant select on public.parasut_checks_demo to authenticated, anon;
