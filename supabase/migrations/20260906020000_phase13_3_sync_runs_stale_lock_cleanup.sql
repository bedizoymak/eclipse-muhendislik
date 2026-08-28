-- Phase 13.3 operational fix: a sync_runs row left in status='running' by a
-- pre-fix deployment of syncEInvoiceInboxes (concurrent verification calls
-- from two sessions during this phase's rollout) is still holding the
-- partial-unique-index lock for resource='e_invoice_inboxes', blocking all
-- further real verification calls. This is a one-time data cleanup of
-- already-abandoned lock rows (started more than 10 minutes ago, never
-- finished) -- it never touches parasut.* mirror data, only the sync
-- bookkeeping table, and is safe to run repeatedly (idempotent: a second
-- run finds no more stale rows).
update parasut.sync_runs
set status = 'error',
    finished_at = now(),
    error_message = 'Phase 13.3: stale running lock cleared (superseded by fixed deploy, never reached finishRun)'
where status = 'running'
  and started_at < now() - interval '10 minutes';
