-- Phase 4: purchase bills (expenses), expense payments, suppliers.
--
-- parasut.purchase_bills, parasut.purchase_bill_details, and parasut.payments
-- already exist and already have every column this phase needs
-- (supplier_parasut_id, spender_parasut_id, pay_to_parasut_id,
-- category_parasut_id, recurrence_plan_parasut_id, active_e_document_type/
-- parasut_id on purchase_bills; product/warehouse on purchase_bill_details;
-- payable_type/payable_parasut_id/transaction_parasut_id on payments,
-- already used by Phase 1.2's sales_invoices payments). No table or
-- sync_runs column changes are needed -- only new read-only demo views.

-- Suppliers: real API-defined suppliers only (parasut.contacts.account_type
-- = 'supplier', mapped directly from the API's own account_type attribute
-- since Phase 1 -- never inferred from name or balance).
create view public.parasut_suppliers_demo
as
select
  parasut_id,
  name,
  short_name,
  email,
  phone,
  city,
  archived,
  synced_at
from parasut.contacts
where account_type = 'supplier'
order by name nulls last;

-- Purchase bills ("giderler"). supplier/spender/pay_to names are resolved
-- via real left joins; pay_to is polymorphic (contacts or employees, per
-- the live API) so both sides are joined and only the matching type's name
-- is non-null. spender/pay_to-as-employee names stay null until a future
-- phase syncs parasut.employees (table already exists, empty) -- never
-- fabricated.
create view public.parasut_purchase_bills_demo
as
select
  pb.parasut_id,
  pb.invoice_no,
  pb.item_type,
  pb.description,
  pb.issue_date,
  pb.due_date,
  pb.currency,
  pb.exchange_rate,
  pb.net_total,
  pb.gross_total,
  pb.total_vat,
  pb.total_discount,
  pb.total_paid,
  pb.remaining,
  pb.remaining_in_trl,
  pb.payment_status,
  pb.archived,
  pb.supplier_parasut_id,
  sup.name as supplier_name,
  pb.spender_parasut_id,
  spd.name as spender_name,
  pb.pay_to_parasut_id,
  coalesce(pay_to_contact.name, pay_to_employee.name) as pay_to_name,
  pb.synced_at
from parasut.purchase_bills pb
left join parasut.contacts sup on sup.parasut_id = pb.supplier_parasut_id
left join parasut.employees spd on spd.parasut_id = pb.spender_parasut_id
left join parasut.contacts pay_to_contact on pay_to_contact.parasut_id = pb.pay_to_parasut_id
left join parasut.employees pay_to_employee on pay_to_employee.parasut_id = pb.pay_to_parasut_id
order by pb.issue_date desc nulls last;

-- Purchase bill line items.
create view public.parasut_purchase_bill_details_demo
as
select
  d.parasut_id,
  d.purchase_bill_parasut_id,
  d.description,
  d.quantity,
  d.unit_price,
  d.vat_rate,
  d.discount_type,
  d.discount_value,
  d.net_total,
  d.product_parasut_id,
  p.name as product_name,
  d.synced_at
from parasut.purchase_bill_details d
left join parasut.products p on p.parasut_id = d.product_parasut_id
order by d.purchase_bill_parasut_id, d.parasut_id;

-- Expense payments ("gider ödemeleri"), published separately from
-- public.parasut_payments_demo (which is scoped to sales_invoices only --
-- see Phase 3's scope-fix migration). Same real-join pattern: linked bill,
-- supplier, transaction, and debit/credit account are all resolved from
-- already-stored parasut_id relationships.
create view public.parasut_expense_payments_demo
as
select
  p.parasut_id,
  p.date,
  p.amount,
  p.currency,
  p.notes,
  p.payable_type,
  p.payable_parasut_id,
  pb.invoice_no,
  pb.supplier_parasut_id,
  sup.name as supplier_name,
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
left join parasut.purchase_bills pb on p.payable_type = 'purchase_bills' and pb.parasut_id = p.payable_parasut_id
left join parasut.contacts sup on sup.parasut_id = pb.supplier_parasut_id
left join parasut.transactions t on t.parasut_id = p.transaction_parasut_id
left join parasut.accounts da on t.debit_account_type = 'accounts' and da.parasut_id = t.debit_account_parasut_id
left join parasut.accounts ca on t.credit_account_type = 'accounts' and ca.parasut_id = t.credit_account_parasut_id
where p.payable_type = 'purchase_bills'
order by p.date desc nulls last;

grant select on public.parasut_suppliers_demo to authenticated, anon;
grant select on public.parasut_purchase_bills_demo to authenticated, anon;
grant select on public.parasut_purchase_bill_details_demo to authenticated, anon;
grant select on public.parasut_expense_payments_demo to authenticated, anon;
