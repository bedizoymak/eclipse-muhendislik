-- Parasut sync infrastructure: run bookkeeping, OAuth token storage, and a
-- minimal read-only surface for the demo frontend.
--
-- These are additive to the 20260825010000 migration and do not alter any
-- existing table.

-- ---------------------------------------------------------------------------
-- sync_runs: one row per parasut-sync invocation, used both as an audit log
-- and as the concurrency lock (a partial unique index rejects a second
-- concurrent "running" row for the same resource).
-- ---------------------------------------------------------------------------
create table parasut.sync_runs (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  status text not null check (status in ('running', 'success', 'error', 'dry_run')),
  dry_run boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched_count integer not null default 0,
  upserted_count integer not null default 0,
  error_count integer not null default 0,
  error_message text,
  total_count_reported integer,
  created_at timestamptz not null default now()
);

create unique index sync_runs_one_running_per_resource_idx
  on parasut.sync_runs (resource)
  where status = 'running';

create index sync_runs_resource_started_at_idx
  on parasut.sync_runs (resource, started_at desc);

alter table parasut.sync_runs enable row level security;

-- ---------------------------------------------------------------------------
-- oauth_tokens: single-row-per-connection storage for the Parasut OAuth2
-- access/refresh token pair, written only by the parasut-sync Edge Function
-- using the service_role key. Never exposed to anon/authenticated.
-- ---------------------------------------------------------------------------
create table parasut.oauth_tokens (
  connection text primary key,
  access_token text not null,
  refresh_token text,
  token_type text,
  expires_at timestamptz not null,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger oauth_tokens_updated_at
  before update on parasut.oauth_tokens
  for each row execute function parasut.set_updated_at();

alter table parasut.oauth_tokens enable row level security;

grant all on parasut.sync_runs to service_role;
grant all on parasut.oauth_tokens to service_role;

-- ---------------------------------------------------------------------------
-- Read-only demo surface: curated public views instead of exposing the
-- `parasut` schema itself through PostgREST. Only non-monetary contact
-- identity fields are exposed; balances, tax numbers and the raw payload
-- stay service_role-only. Phase 1 uses this only for temporary verification
-- in DemoHome, not a real dashboard.
--
-- These views intentionally run with the view owner's (postgres) privileges,
-- not the querying role's, so anon/authenticated never need a direct grant
-- on the parasut.* tables -- the view's column list is the entire exposed
-- surface.
-- ---------------------------------------------------------------------------
create view public.parasut_contacts_demo
as
select
  parasut_id,
  name,
  short_name,
  email,
  contact_type,
  city,
  archived,
  synced_at
from parasut.contacts
order by name nulls last;

create view public.parasut_sync_status_demo
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
  error_message
from parasut.sync_runs
order by resource, started_at desc;

grant select on public.parasut_contacts_demo to authenticated, anon;
grant select on public.parasut_sync_status_demo to authenticated, anon;
