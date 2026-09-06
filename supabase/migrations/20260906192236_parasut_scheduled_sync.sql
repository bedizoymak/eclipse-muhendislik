-- Phase 14.6: server-side scheduled Parasut sync.
--
-- The public sync button was removed from the browser entirely (it now only
-- re-reads existing public demo views -- see src/pages/DemoHome.tsx). The
-- real Parasut -> Supabase sync runs here instead, on a schedule, driven by
-- pg_cron + pg_net. The service_role key it authenticates with is read at
-- call time from Supabase Vault (parasut_sync_service_role_key, inserted
-- out-of-band via `supabase db query`, never via a migration file) -- it is
-- never written to this file, never shipped to any client bundle.
--
-- Resources are synced sequentially, one net.http_post per resource,
-- polling net._http_response for that request's completion before moving
-- to the next -- mirroring the fail-safe, non-parallel behavior the removed
-- browser button used to have. Real measured Phase 14.6 dry-run durations
-- ranged from under 1s (accounts, warehouses) to 100s+ (products) to
-- several minutes (stock_movements); see the Phase 14.6 report for the
-- full measured table used to size PARASUT_SYNC_STEP_TIMEOUT_SECONDS and
-- the cron cadence below.
--
-- The existing partial unique index on parasut.sync_runs(resource) where
-- status='running' still provides the actual concurrency guarantee: if a
-- scheduled run is still in flight for a resource when this job's next
-- invocation reaches that resource, the Edge Function returns 409 and this
-- function simply records it and moves on -- it never blocks or retries in
-- a loop.

create schema if not exists parasut_ops;

create table if not exists parasut_ops.scheduled_sync_log (
  id bigint generated always as identity primary key,
  run_started_at timestamptz not null default now(),
  resource text not null,
  http_status int,
  waited_seconds int,
  request_id bigint
);

comment on table parasut_ops.scheduled_sync_log is
  'Phase 14.6: one row per resource per scheduled sync cron tick. Audit trail for the server-side pg_cron + pg_net Parasut sync; parasut.sync_runs remains the source of truth for per-resource fetch/upsert results.';

revoke all on parasut_ops.scheduled_sync_log from anon, authenticated;

create or replace function parasut_ops.run_scheduled_parasut_sync()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_secret text;
  v_resource text;
  v_resources text[] := array[
    'contacts', 'sales_invoices', 'accounts', 'payments', 'transactions',
    'purchase_bills', 'expense_payments', 'products', 'warehouses',
    'stock_movements', 'item_categories', 'checks', 'sales_offers',
    'shipment_documents', 'employees', 'salaries', 'taxes', 'tags',
    'e_invoices'
  ];
  v_request_id bigint;
  v_status int;
  v_waited int;
  v_run_started_at timestamptz := now();
  -- Generous per-resource ceiling: the slowest resource measured during
  -- Phase 14.6 sizing (stock_movements) ran well past 2 minutes. This is a
  -- safety cap on *this function's* polling loop only, not on the Edge
  -- Function call itself -- if a resource legitimately needs longer, the
  -- Edge Function keeps running and finishes/fails on its own; this
  -- function just stops waiting and moves to the next resource so one slow
  -- resource can never stall the whole scheduled run indefinitely.
  v_max_wait_seconds constant int := 600;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'parasut_sync_service_role_key';

  if v_secret is null then
    raise exception 'parasut_sync_service_role_key not found in Supabase Vault';
  end if;

  foreach v_resource in array v_resources loop
    v_request_id := net.http_post(
      url := 'https://yzuxdrknidveptvnwthf.supabase.co/functions/v1/parasut-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := jsonb_build_object('resource', v_resource, 'dry_run', false)
    );

    v_waited := 0;
    v_status := null;
    while v_status is null and v_waited < v_max_wait_seconds loop
      perform pg_sleep(3);
      v_waited := v_waited + 3;
      select status_code into v_status
      from net._http_response
      where id = v_request_id;
    end loop;

    insert into parasut_ops.scheduled_sync_log (run_started_at, resource, http_status, waited_seconds, request_id)
    values (v_run_started_at, v_resource, v_status, v_waited, v_request_id);
  end loop;
end;
$$;

comment on function parasut_ops.run_scheduled_parasut_sync() is
  'Phase 14.6: sequential (non-parallel) server-side Parasut sync of every SUPPORTED_RESOURCES entry, run by pg_cron. Never called from the client.';

-- Cadence is set to 60 minutes: Phase 14.6 dry-run timing showed several
-- resources (products, stock_movements) individually running past 100s-
-- several minutes, making a full 19-resource sequential cycle comfortably
-- exceed the 30-minute cadence the task requested as a default -- see the
-- Phase 14.6 report for the measured total. 60 minutes leaves real margin
-- even on a slow cycle, and the per-resource sync_runs lock means an
-- occasional overrun degrades to a few skipped (409) resources for that
-- tick rather than a corrupt or double-run sync.
select cron.schedule(
  'parasut-sync-hourly',
  '0 * * * *',
  $$select parasut_ops.run_scheduled_parasut_sync();$$
);
