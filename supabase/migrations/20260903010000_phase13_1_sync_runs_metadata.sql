-- Phase 13.1: adds a genuine JSON metadata column to parasut.sync_runs so
-- the new unknown-field-detection mechanism (schema_guard.ts) has a real
-- place to persist unknown_attribute_keys/unknown_relationship_keys/
-- unknown_root_keys/inspected_resource_count per run, instead of either
-- (a) writing into a column that doesn't exist, or (b) silently dropping
-- the finding after it's computed. No existing column is reused or
-- overloaded for this.

alter table parasut.sync_runs
  add column if not exists metadata jsonb;

comment on column parasut.sync_runs.metadata is
  'Phase 13.1: structured, per-run diagnostic metadata (currently: unknown-field-detection report for salaries/taxes/tags/e_invoice_inboxes). Response-and-audit only, never read by sync logic itself.';
