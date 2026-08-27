-- Phase 11: Müşteri Yetkili Kişileri (contact_people)
--
-- parasut.contact_people already exists (created in an earlier phase) with
-- the exact columns the real Parasut API returns for a contact_people
-- resource: parasut_id, name, email, phone, notes, contact_parasut_id (the
-- real parent contact relationship id, resolved only via the genuine
-- relationships.contact.data / included-resource context -- never by name
-- matching), raw jsonb (full resource object), parasut_created_at/updated_at,
-- synced_at. No column is missing per the live API discovery in Phase 11, so
-- this migration only adds the safe public demo view (mirroring the existing
-- parasut_contacts_demo pattern) -- it never drops/recreates the base table
-- or its existing rows.
--
-- The view exposes every real+safe attribute and the real parent contact
-- id/type -- nothing the API did not return, no fabricated fields (no
-- title/department/role/"primary" flag -- Parasut's contact_people resource
-- has never returned any of those).

create or replace view public.parasut_contact_people_demo as
select
  cp.parasut_id,
  cp.name,
  cp.email,
  cp.phone,
  cp.notes,
  cp.contact_parasut_id,
  cp.parasut_created_at,
  cp.parasut_updated_at,
  cp.synced_at
from parasut.contact_people cp;

grant select on public.parasut_contact_people_demo to authenticated, anon;
