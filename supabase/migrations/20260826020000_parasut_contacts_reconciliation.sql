-- Phase 1.2: active/archived contact reconciliation.
--
-- Parasut's /contacts list endpoint does not document a filter[archived]
-- parameter in its swagger spec, but it was verified directly against the
-- live API to be real and supported: filter[archived]=false and
-- filter[archived]=true return disjoint, complete result sets whose sizes
-- sum to the account's total contact count. parasut-sync now fetches both
-- streams and reports them separately; these columns and view changes
-- surface that split without altering any existing migration.

alter table parasut.sync_runs
  add column active_fetched_count integer,
  add column archived_fetched_count integer;

-- Recreate (not alter) the demo views: add the real `phone` column that
-- already exists on parasut.contacts (no new/fake column), and surface the
-- active/archived split on the sync status view. CREATE OR REPLACE VIEW
-- requires every pre-existing output column to keep its name AND position,
-- so new columns are appended at the end, never inserted mid-list
-- (existing grants on the view are preserved across the replace).
create or replace view public.parasut_contacts_demo
as
select
  parasut_id,
  name,
  short_name,
  email,
  contact_type,
  city,
  archived,
  synced_at,
  phone
from parasut.contacts
order by name nulls last;

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
  archived_fetched_count
from parasut.sync_runs
order by resource, started_at desc;
