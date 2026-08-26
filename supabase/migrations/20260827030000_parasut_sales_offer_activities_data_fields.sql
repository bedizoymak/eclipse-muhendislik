-- Phase 7.2: normalize sales_offer_activities.data and fix the done_by/item
-- relationship gap found by re-querying the real API.
--
-- Both real activities on offer 1001300304 (1347475910 "new_sales_offer",
-- 1427639960 "sales_offer_status_updated") have the exact same `data`
-- schema -- description, issue_date, due_date, net_total, currency,
-- content, status, contact_id, contact_name -- a fixed, not variable,
-- structure, so real columns are added rather than leaving it opaque jsonb.
-- The existing `data` jsonb column is kept as-is (raw preservation); these
-- are additive, normalized projections of the same real values.
--
-- Also verified: include=activities alone (used by the original Phase 7.1
-- sync) returns relationships.done_by / relationships.item as empty
-- {"meta":{}} on the activity resource itself -- the reference id is not
-- exposed without each relationship's own explicit include, same
-- established pattern as every other Parasut relationship in this project.
-- With include=activities,activities.item,activities.done_by, both resolve
-- to real data: done_by -> {id:800086,type:"users"} (a real Parasut user,
-- name "Hayrettin Dayan", email "hayridayan58@gmail.com"), item ->
-- {id:1001300304,type:"sales_offers"} (the offer itself). This project has
-- no parasut.users table to join against, so the actor's real name/email
-- are captured directly from the included user resource at sync time
-- (denormalized, same as every other *_name column resolved via a real
-- relationship elsewhere in this schema) -- never guessed or left blank
-- when real data exists.

alter table parasut.sales_offer_activities
  add column data_description text,
  add column data_issue_date date,
  add column data_due_date date,
  add column data_net_total numeric,
  add column data_currency text,
  add column data_content text,
  add column data_status text,
  add column data_contact_id bigint,
  add column data_contact_name text,
  add column done_by_name text,
  add column done_by_user_email text;

-- CREATE OR REPLACE VIEW cannot drop/rename an existing output column (the
-- prior view's 5th column was named "data"); this view intentionally
-- replaces the opaque `data` column with its normalized data_* fields, so
-- the view is dropped and recreated instead.
drop view public.parasut_sales_offer_activities_demo;

create view public.parasut_sales_offer_activities_demo
as
select
  a.parasut_id,
  a.sales_offer_parasut_id,
  a.activity_type,
  a.date,
  a.data_description,
  a.data_issue_date,
  a.data_due_date,
  a.data_net_total,
  a.data_currency,
  a.data_content,
  a.data_status,
  a.data_contact_id,
  a.data_contact_name,
  a.done_by_email,
  a.done_by_parasut_id,
  a.done_by_type,
  a.done_by_name,
  a.done_by_user_email,
  a.item_parasut_id,
  a.item_type,
  a.parasut_created_at,
  a.parasut_updated_at,
  a.synced_at
from parasut.sales_offer_activities a
order by a.sales_offer_parasut_id, a.date desc nulls last;

grant select on public.parasut_sales_offer_activities_demo to authenticated, anon;
