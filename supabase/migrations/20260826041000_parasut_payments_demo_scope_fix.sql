-- Phase 3 follow-up: scope public.parasut_payments_demo to this phase's
-- documented coverage.
--
-- parasut.payments already held 874 pre-existing rows from before this
-- phase (payable_type = 'PurchaseBill', synced by the repo's separate,
-- pre-existing scripts/sync_parasut.py -- same situation as the 8
-- pre-existing archived contacts found in Phase 1.2). This phase's sync
-- only covers payments on sales_invoices (payable_type = 'sales_invoices'),
-- documented in resources/payments.ts and the Phase 3 report. Without this
-- filter the view would mix in those legacy purchase-bill payment rows,
-- which have no invoice/contact to join against here -- showing them on
-- /satislar/tahsilatlar (a sales-collections screen) with blank linked
-- fields would misrepresent data this phase never synced or verified.
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
  p.synced_at
from parasut.payments p
left join parasut.sales_invoices si on p.payable_type = 'sales_invoices' and si.parasut_id = p.payable_parasut_id
left join parasut.contacts c on c.parasut_id = si.contact_parasut_id
left join parasut.transactions t on t.parasut_id = p.transaction_parasut_id
left join parasut.accounts da on t.debit_account_type = 'accounts' and da.parasut_id = t.debit_account_parasut_id
left join parasut.accounts ca on t.credit_account_type = 'accounts' and ca.parasut_id = t.credit_account_parasut_id
where p.payable_type = 'sales_invoices'
order by p.date desc nulls last;
