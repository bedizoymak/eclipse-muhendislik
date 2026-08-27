-- Phase 11.1: contact_people root type + parent relationship type
--
-- Phase 11 linked contact_people rows to their real parent contact id but
-- never captured two real API type values:
--   1. the contact_person resource's own root `type` (real value:
--      "contact_people", read from the included resource's own `type`
--      field -- never a table-name/route-derived constant).
--   2. the parent contact's real relationship type, which only appears on
--      the nested-include child's own `relationships.contact.data.type`
--      (real value: "contacts", requires include=contact_people.contact).
--
-- This migration ONLY adds these two columns to the existing
-- parasut.contact_people table (created in an earlier phase, extended by
-- the Phase 11 migration for the view) -- it never edits or recreates the
-- Phase 11 migration file, never drops the table, never blind-fills old
-- rows with a SQL constant default (both columns are added nullable, with
-- no DEFAULT, so existing rows stay NULL until the next real sync
-- populates them from the live API -- per the "null source value must
-- never be preserved as an old non-null value" / "never derive a type from
-- an id/table/route" rules).

alter table parasut.contact_people
  add column if not exists resource_type text,
  add column if not exists contact_type text;

comment on column parasut.contact_people.resource_type is
  'Real API root type of this contact_people resource itself (included resource''s own "type" field). Never derived/fabricated.';
comment on column parasut.contact_people.contact_type is
  'Real API type of the PARENT contact relationship, taken only from the nested include=contact_people.contact child''s own relationships.contact.data.type. Never a "contacts" string constant.';

-- Recreate the public demo view (Phase 11's 20260829020000 migration) with
-- the two new safe type columns added; raw stays private/unchanged. Dropped
-- first because Postgres cannot CREATE OR REPLACE a view when a new column
-- is inserted in the middle of the existing column list.
drop view if exists public.parasut_contact_people_demo;

create view public.parasut_contact_people_demo as
select
  cp.parasut_id,
  cp.name,
  cp.email,
  cp.phone,
  cp.notes,
  cp.contact_parasut_id,
  cp.resource_type,
  cp.contact_type,
  cp.parasut_created_at,
  cp.parasut_updated_at,
  cp.synced_at
from parasut.contact_people cp;

grant select on public.parasut_contact_people_demo to authenticated, anon;
