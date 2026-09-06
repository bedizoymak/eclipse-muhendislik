-- Phase 14.7 (step 1 of the split plan): durable, transaction-safe scheduler.
--
-- The Phase 14.6 `parasut_ops.run_scheduled_parasut_sync()` function was
-- fundamentally broken: it called net.http_post() and then polled
-- net._http_response() for the result INSIDE THE SAME transaction. Per
-- Supabase's documented pg_net behavior, the actual HTTP request is not
-- dispatched until the transaction that queued it commits -- so that
-- polling loop could never see a real response and would just burn its
-- whole wait budget doing nothing, every tick, forever. It never fired in
-- production (unscheduled before its first tick -- see git history), so no
-- wasted runs occurred, but the design itself had to be replaced rather
-- than patched.
--
-- This migration replaces it with a durable cycle/step state machine:
--   - parasut_ops.scheduled_sync_cycles: one row per full 19-resource pass.
--   - parasut_ops.scheduled_sync_steps: one row per resource per cycle.
--   - parasut_ops.dispatch_next_step(): called every minute by pg_cron.
--     Each invocation is ONE short transaction that does exactly one of:
--       (a) start a new cycle (insert cycle + all pending steps) if none is
--           running and the last cycle finished over an hour ago,
--       (b) enqueue the next pending step (single net.http_post call,
--           request_id recorded, function returns immediately -- it never
--           waits for or reads net._http_response in this same
--           transaction),
--       (c) check whether the currently-enqueued step's response has
--           landed in net._http_response by now (a plain SELECT against
--           data a *previous* transaction already committed -- not a
--           poll-and-wait), and record success/failed/blocked accordingly,
--           or time the step out if no response has landed after a
--           generous ceiling,
--       (d) finalize the cycle once every step is terminal.
-- No step of any tick blocks waiting on an HTTP call. A stuck response
-- (e.g. stock_movements exceeding the Edge Function's own ~150s wall-clock
-- limit) times out after PARASUT_STEP_TIMEOUT_SECONDS and is recorded as a
-- real failure -- it never masks a failure as success, and it never blocks
-- the rest of the cycle from proceeding.
--
-- Explicitly deferred to a later phase (per the current, narrowed scope):
-- chunking stock_movements across multiple invocations, the 5-minute
-- fast-sync path for sales invoices, and the public freshness/status view.
-- stock_movements stays in this cycle's resource list as a normal step and
-- is expected to fail/timeout honestly until that follow-up chunking work
-- lands -- this migration does not claim it succeeds.

create table if not exists parasut_ops.scheduled_sync_cycles (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  total_steps int not null,
  completed_steps int not null default 0
);

comment on table parasut_ops.scheduled_sync_cycles is
  'Phase 14.7: one row per full scheduled Parasut sync pass across all resources. status=success only when every step succeeded or was cleanly blocked (409); any real step failure finalizes as error.';

-- At most one cycle may be 'running' at a time -- the actual overlap guard,
-- enforced at the database level rather than relying on application logic.
create unique index if not exists scheduled_sync_cycles_one_running
  on parasut_ops.scheduled_sync_cycles ((1))
  where status = 'running';

revoke all on parasut_ops.scheduled_sync_cycles from anon, authenticated, public;

create table if not exists parasut_ops.scheduled_sync_steps (
  id bigint generated always as identity primary key,
  cycle_id bigint not null references parasut_ops.scheduled_sync_cycles(id) on delete cascade,
  resource text not null,
  ordinal int not null,
  status text not null default 'pending' check (status in ('pending', 'enqueued', 'success', 'failed', 'blocked')),
  request_id bigint,
  enqueued_at timestamptz,
  finished_at timestamptz,
  http_status int,
  error_summary text,
  fetched_count int,
  upserted_count int,
  error_count int,
  unique (cycle_id, resource)
);

comment on table parasut_ops.scheduled_sync_steps is
  'Phase 14.7: one row per resource per scheduled_sync_cycles row. error_summary is a truncated, credential-free message only (never a raw response body or header).';

revoke all on parasut_ops.scheduled_sync_steps from anon, authenticated, public;

-- Phase 14.6's function is left in place (undropped -- non-destructive) but
-- is no longer scheduled anywhere. Superseded by dispatch_next_step below.
comment on function parasut_ops.run_scheduled_parasut_sync() is
  'DEPRECATED as of Phase 14.7: polled net._http_response inside the same transaction that created the request, which pg_net never resolves. Not scheduled. Superseded by parasut_ops.dispatch_next_step().';

create or replace function parasut_ops.dispatch_next_step()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_cycle parasut_ops.scheduled_sync_cycles%rowtype;
  v_step parasut_ops.scheduled_sync_steps%rowtype;
  v_secret text;
  v_now timestamptz := now();
  v_resources constant text[] := array[
    'contacts', 'sales_invoices', 'accounts', 'payments', 'transactions',
    'purchase_bills', 'expense_payments', 'products', 'warehouses',
    'stock_movements', 'item_categories', 'checks', 'sales_offers',
    'shipment_documents', 'employees', 'salaries', 'taxes', 'tags',
    'e_invoices'
  ];
  v_cycle_min_interval constant interval := '60 minutes';
  -- Generous ceiling for a step stuck at 'enqueued' with no response yet.
  -- Measured Phase 14.6 durations topped out at ~150s (stock_movements,
  -- itself an Edge Function platform timeout) and ~108s (products); 240s
  -- leaves real margin without letting one bad step stall a cycle forever.
  v_step_timeout constant interval := '240 seconds';
  v_status_code int;
  v_body jsonb;
  v_i int;
begin
  select * into v_cycle from parasut_ops.scheduled_sync_cycles where status = 'running' limit 1;

  if not found then
    -- No cycle running. Start a new one only if enough time has passed
    -- since the last cycle finished (or none has ever run).
    if exists (
      select 1 from parasut_ops.scheduled_sync_cycles
      where finished_at is not null and finished_at > v_now - v_cycle_min_interval
    ) then
      return;
    end if;

    insert into parasut_ops.scheduled_sync_cycles (started_at, status, total_steps)
    values (v_now, 'running', array_length(v_resources, 1))
    returning * into v_cycle;

    for v_i in 1 .. array_length(v_resources, 1) loop
      insert into parasut_ops.scheduled_sync_steps (cycle_id, resource, ordinal, status)
      values (v_cycle.id, v_resources[v_i], v_i, 'pending');
    end loop;

    return;
  end if;

  -- A cycle is running. Find the earliest step that isn't terminal yet.
  select * into v_step
  from parasut_ops.scheduled_sync_steps
  where cycle_id = v_cycle.id and status in ('pending', 'enqueued')
  order by ordinal
  limit 1;

  if not found then
    -- Every step is terminal -- finalize the cycle. A real per-resource
    -- failure (not a clean 409 "already running elsewhere") means the
    -- cycle is reported as error, never as a false success.
    update parasut_ops.scheduled_sync_cycles
    set status = case
          when exists (select 1 from parasut_ops.scheduled_sync_steps where cycle_id = v_cycle.id and status = 'failed')
            then 'error'
          else 'success'
        end,
        finished_at = v_now,
        completed_steps = (
          select count(*) from parasut_ops.scheduled_sync_steps
          where cycle_id = v_cycle.id and status in ('success', 'blocked')
        )
    where id = v_cycle.id;
    return;
  end if;

  if v_step.status = 'enqueued' then
    select status_code into v_status_code from net._http_response where id = v_step.request_id;

    if v_status_code is not null then
      select content::jsonb into v_body from net._http_response where id = v_step.request_id;
      update parasut_ops.scheduled_sync_steps
      set http_status = v_status_code,
          finished_at = v_now,
          status = case
            when v_status_code = 409 then 'blocked'
            when v_status_code = 200 and coalesce(v_body ->> 'status', '') <> 'error' then 'success'
            else 'failed'
          end,
          error_summary = left(coalesce(v_body ->> 'error_message', v_body ->> 'error', 'HTTP ' || v_status_code::text), 500),
          fetched_count = nullif(v_body ->> 'total_fetched_count', '')::int,
          upserted_count = nullif(v_body ->> 'upserted_count', '')::int,
          error_count = nullif(v_body ->> 'error_count', '')::int
      where id = v_step.id;
    elsif v_now - v_step.enqueued_at > v_step_timeout then
      update parasut_ops.scheduled_sync_steps
      set status = 'failed',
          finished_at = v_now,
          error_summary = 'dispatcher timeout: no response after ' || extract(epoch from v_step_timeout)::int || 's'
      where id = v_step.id;
    end if;

    return;
  end if;

  -- v_step.status = 'pending': enqueue it. The request is created here but
  -- does not actually start until THIS transaction commits -- its response
  -- is checked on a later tick, never in this one.
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'parasut_sync_service_role_key';

  if v_secret is null then
    update parasut_ops.scheduled_sync_steps
    set status = 'failed', finished_at = v_now, error_summary = 'parasut_sync_service_role_key not found in Vault'
    where id = v_step.id;
    update parasut_ops.scheduled_sync_cycles
    set status = 'error', finished_at = v_now
    where id = v_cycle.id;
    return;
  end if;

  update parasut_ops.scheduled_sync_steps
  set status = 'enqueued',
      enqueued_at = v_now,
      request_id = net.http_post(
        url := 'https://yzuxdrknidveptvnwthf.supabase.co/functions/v1/parasut-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_secret
        ),
        body := jsonb_build_object('resource', v_step.resource, 'dry_run', false),
        timeout_milliseconds := 200000
      )
  where id = v_step.id;
end;
$$;

comment on function parasut_ops.dispatch_next_step() is
  'Phase 14.7: transaction-safe cycle/step dispatcher. Each call is one short transaction; never polls net._http_response in the same transaction that created the request. Scheduled every minute by pg_cron.';

revoke execute on function parasut_ops.dispatch_next_step() from public, anon, authenticated;
revoke execute on function parasut_ops.run_scheduled_parasut_sync() from public, anon, authenticated;

select cron.schedule(
  'parasut-sync-dispatcher',
  '* * * * *',
  $$select parasut_ops.dispatch_next_step();$$
);
