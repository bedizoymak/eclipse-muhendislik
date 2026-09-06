-- Urgent privacy fix, found while auditing public.parasut_*_demo views
-- ahead of the parasut data-layer refactor.
--
-- public.parasut_accounts_demo exposed `iban` and `bank_account_no`, and
-- public.parasut_employees_demo exposed `iban` AND `tckn` (Turkish
-- national ID number) to any caller holding only the public anon key --
-- no login required. Both views are queried directly from the browser
-- (src/pages/Hesaplar.tsx, src/pages/Calisanlar.tsx,
-- src/pages/CalisanDetay.tsx), which also render tckn/iban in full in the
-- UI. This is real people's bank account and national ID data, live on
-- the public internet.
--
-- These two columns are dropped from both views as an immediate stopgap.
-- The corresponding frontend .select() calls and UI fields are updated in
-- the same change (see the accompanying commit) so the pages keep working
-- with every other field intact -- only IBAN/TCKN/bank_account_no stop
-- being served. A future, authorized Edge Function (per the parasut
-- data-layer refactor) can reintroduce these fields behind real
-- authorization if a legitimate authenticated use case needs them.

-- Postgres does not allow CREATE OR REPLACE VIEW to drop columns, so the
-- views are dropped and recreated instead.
drop view public.parasut_accounts_demo;

create view public.parasut_accounts_demo as
select
  parasut_id,
  name,
  account_type,
  currency,
  bank_name,
  bank_branch,
  balance,
  archived,
  synced_at
from parasut.accounts
order by name;

drop view public.parasut_employees_demo;

create view public.parasut_employees_demo as
select
  parasut_id,
  name,
  email,
  phone,
  archived,
  employment_start_date,
  employment_end_date,
  balance,
  trl_balance,
  usd_balance,
  eur_balance,
  gbp_balance,
  category_parasut_id,
  managed_by_user_parasut_id,
  managed_by_user_role_parasut_id,
  managed_by_user_role_type,
  tags_resolved,
  activities_resolved,
  comments_resolved,
  parasut_created_at,
  parasut_updated_at,
  synced_at
from parasut.employees e
order by name;

-- create or replace view drops the previous privilege grants in Postgres
-- for views recreated this way in some versions; re-assert SELECT-only
-- (matching the emergency grant-revoke migration applied earlier today)
-- to be safe regardless.
grant select on public.parasut_accounts_demo to anon, authenticated;
grant select on public.parasut_employees_demo to anon, authenticated;
