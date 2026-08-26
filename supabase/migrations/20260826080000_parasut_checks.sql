-- Phase 6: checks ("çekler").
--
-- /{company_id}/checks is a real, working Parasut endpoint -- verified
-- directly against the live API -- that is completely absent from the
-- published swagger spec (no path, no schema; "checks" only appears there
-- as an enum value inside polymorphic payable/pay_to type lists on other
-- resources). No table for it existed in any prior migration, so this adds
-- one from scratch, following the same shape (parasut_id unique, mapped
-- columns + raw jsonb, service_role-only RLS) as every other parasut.*
-- table.
--
-- Every column here is a real, verified API attribute -- serial_number,
-- bank_identifier/bank_name, due_date, payment_status, is_in/is_out (the
-- API's own received/issued distinction) are genuine fields Parasut
-- returns, never invented or parsed out of free text.

create table parasut.checks (
  id uuid primary key default gen_random_uuid(),
  parasut_id bigint not null,
  currency text,
  description text,
  due_date date,
  issue_date date,
  net_total numeric,
  remaining numeric,
  remaining_in_trl numeric,
  payment_status text,
  is_cashed boolean,
  is_in boolean,
  is_out boolean,
  is_transferred boolean,
  days_overdue numeric,
  days_till_due_date numeric,
  bank_identifier text,
  bank_name text,
  serial_number text,
  issued_by_parasut_id bigint,
  issued_by_type text,
  given_to_parasut_id bigint,
  given_to_type text,
  raw jsonb not null default '{}'::jsonb,
  parasut_created_at timestamptz,
  parasut_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checks_parasut_id_key unique (parasut_id)
);

create index checks_issued_by_parasut_id_idx on parasut.checks(issued_by_parasut_id);
create index checks_given_to_parasut_id_idx on parasut.checks(given_to_parasut_id);

create trigger checks_updated_at
  before update on parasut.checks
  for each row execute function parasut.set_updated_at();

alter table parasut.checks enable row level security;

grant all on parasut.checks to service_role;

-- Demo view: issued_by/given_to names resolved via real left joins, only
-- when their real relationship type is 'contacts' (the only type verified
-- in this account's data) -- stays null otherwise or when unresolved,
-- never fabricated.
create view public.parasut_checks_demo
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
  c.synced_at
from parasut.checks c
left join parasut.contacts issuer on c.issued_by_type = 'contacts' and issuer.parasut_id = c.issued_by_parasut_id
left join parasut.contacts recipient on c.given_to_type = 'contacts' and recipient.parasut_id = c.given_to_parasut_id
order by c.due_date desc nulls last;

grant select on public.parasut_checks_demo to authenticated, anon;
