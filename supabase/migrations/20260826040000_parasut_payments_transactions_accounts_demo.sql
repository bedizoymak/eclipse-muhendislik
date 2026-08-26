-- Phase 3: payments, transactions, accounts sync surface.
--
-- parasut.payments, parasut.transactions, parasut.accounts already exist
-- (from the very first schema migration) but have been empty until now.
-- This migration only:
--   1) adds two nullable columns to parasut.transactions -- Parasut's
--      debit_account/credit_account relationship is polymorphic in
--      practice (verified against the live API: it can point to either an
--      "accounts" or a "contacts" resource, though the swagger spec only
--      documents "accounts" for both). Storing the type alongside the id
--      means neither side is ever mis-labeled as an account it isn't.
--   2) adds one nullable bookkeeping column to parasut.sync_runs, shared by
--      the payments/transactions resources to report relationships Parasut
--      itself didn't supply (never fabricated -- just counted and surfaced).
--   3) adds a curated, real-data-only read surface for the demo frontend.

alter table parasut.transactions
  add column debit_account_type text,
  add column credit_account_type text;

alter table parasut.sync_runs
  add column unresolved_count integer;

-- Recreate (not alter) the sync status view: CREATE OR REPLACE VIEW
-- requires every existing output column to keep its name and position, so
-- the new column is appended at the end (same constraint as Phase 1.2/2).
create or replace view public.parasut_sync_status_demo
as
select distinct on (resource)
  resource,
  status,
  dry_run,
  started_at,
  finished_at,
  fetched_count,
  upserted_count,
  error_count,
  error_message,
  active_fetched_count,
  archived_fetched_count,
  detail_fetched_count,
  detail_upserted_count,
  unresolved_count
from parasut.sync_runs
order by resource, started_at desc;

-- Accounts: real API fields only. `balance` is exactly what Parasut
-- reports -- never recomputed from transaction history.
create view public.parasut_accounts_demo
as
select
  parasut_id,
  name,
  account_type,
  currency,
  bank_name,
  bank_branch,
  bank_account_no,
  iban,
  balance,
  archived,
  synced_at
from parasut.accounts
order by name nulls last;

-- Account transactions ("hesap hareketleri"). debit/credit account name is
-- resolved via a real left join, split across parasut.accounts and
-- parasut.contacts depending on the real, stored relationship type -- never
-- guessed when the type is unknown or the referenced row hasn't been
-- synced (name stays null in that case, not fabricated).
create view public.parasut_transactions_demo
as
select
  t.parasut_id,
  t.description,
  t.transaction_type,
  t.date,
  t.amount_in_trl,
  t.debit_amount,
  t.debit_currency,
  t.debit_account_parasut_id,
  t.debit_account_type,
  da.name as debit_account_name,
  dc.name as debit_contact_name,
  t.credit_amount,
  t.credit_currency,
  t.credit_account_parasut_id,
  t.credit_account_type,
  ca.name as credit_account_name,
  cc.name as credit_contact_name,
  t.synced_at
from parasut.transactions t
left join parasut.accounts da on t.debit_account_type = 'accounts' and da.parasut_id = t.debit_account_parasut_id
left join parasut.contacts dc on t.debit_account_type = 'contacts' and dc.parasut_id = t.debit_account_parasut_id
left join parasut.accounts ca on t.credit_account_type = 'accounts' and ca.parasut_id = t.credit_account_parasut_id
left join parasut.contacts cc on t.credit_account_type = 'contacts' and cc.parasut_id = t.credit_account_parasut_id
order by t.date desc nulls last;

-- Payments ("tahsilatlar"). This phase covers only payments on
-- sales_invoices (see resources/payments.ts for why). The linked invoice,
-- its customer, and the linked transaction/account are all resolved via
-- real left joins on already-stored parasut_id relationships.
create view public.parasut_payments_demo
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
order by p.date desc nulls last;

grant select on public.parasut_accounts_demo to authenticated, anon;
grant select on public.parasut_transactions_demo to authenticated, anon;
grant select on public.parasut_payments_demo to authenticated, anon;
