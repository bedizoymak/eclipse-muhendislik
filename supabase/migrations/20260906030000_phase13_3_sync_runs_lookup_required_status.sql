-- Phase 13.3 bug fix: parasut.sync_runs.status had a CHECK constraint
-- limited to ('running','success','error','dry_run'). syncEInvoiceInboxes
-- (this phase) writes status='lookup_required' for a blocked lookup call --
-- the constraint silently rejected that UPDATE (the Edge Function's
-- finishRun() does not inspect the update's error), leaving the row stuck
-- at status='running' forever and permanently holding the
-- one-run-per-resource lock for e_invoice_inboxes. Confirmed live: rows
-- stayed 'running' across repeated real calls until this fix.
--
-- Fix: widen the CHECK constraint to also allow 'lookup_required'. New
-- migration file only -- the original constraint definition in
-- 20260826000000_parasut_sync_infrastructure.sql is left untouched.
alter table parasut.sync_runs drop constraint if exists sync_runs_status_check;
alter table parasut.sync_runs add constraint sync_runs_status_check
  check (status in ('running', 'success', 'error', 'dry_run', 'lookup_required'));

comment on column parasut.sync_runs.status is
  'Phase 13.3: ''lookup_required'' added for e_invoice_inboxes -- a resource with no global-sync semantics whose sync call is always blocked (BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH) pending a future secure-auth phase. This status must never be confused with ''success'' -- see index.ts Deno.serve handler''s runStatus logic, which lets a syncer''s own dbFields.status win over the generic success/dry_run default.';

-- One-time cleanup of rows that got stuck at status='running' because of
-- the bug above (any age, not just >10 minutes -- this specific cause is
-- now understood and fully fixed by the constraint change above, so it is
-- safe to clear all of them, not just old ones).
update parasut.sync_runs
set status = 'error',
    finished_at = now(),
    error_message = 'Phase 13.3: stale lock cleared -- caused by CHECK constraint silently rejecting status=lookup_required before this migration'
where status = 'running'
  and resource = 'e_invoice_inboxes';
