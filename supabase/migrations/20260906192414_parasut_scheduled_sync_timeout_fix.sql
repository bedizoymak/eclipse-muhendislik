-- Phase 14.6 follow-up fix: net.http_post() defaults to a 5 second request
-- timeout when timeout_milliseconds is not passed explicitly. The Phase
-- 14.6 timing measurement (see report) showed several real resources
-- taking far longer than that in a single Edge Function invocation:
--   products ~108s, transactions ~61s, sales_invoices ~56s, payments ~46s,
--   purchase_bills ~38s, expense_payments ~32s, e_invoices ~24s.
-- Every one of those would have silently failed as a pg_net-level timeout
-- (never reaching the Edge Function's own response) under the previous
-- migration's un-timed net.http_post() call. This redefines the function
-- with an explicit 200s pg_net timeout, just under the ~150s wall-clock
-- limit the hosted Edge Function runtime itself enforces (see
-- stock_movements below), so a real HTTP response (including a real
-- platform-level timeout) reaches net._http_response instead of pg_net
-- giving up first.
--
-- Known separate issue, NOT fixed here (out of scope: this phase must not
-- change sync mapping/resource logic): stock_movements itself returned a
-- 504 from the Edge Function platform after ~150s in this measurement,
-- i.e. it does not fit in a single invocation at its current data volume.
-- The scheduled job below will now correctly record that resource's real
-- failure (previously mis-recorded as a 5s pg_net timeout no more
-- informative than this one) instead of masking it. Fixing stock_movements
-- itself requires paginating/chunking its own sync across multiple
-- invocations and is tracked as a follow-up phase.

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
  v_pg_net_timeout_ms constant int := 200000;
  v_max_wait_seconds constant int := 210;
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
      body := jsonb_build_object('resource', v_resource, 'dry_run', false),
      timeout_milliseconds := v_pg_net_timeout_ms
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
