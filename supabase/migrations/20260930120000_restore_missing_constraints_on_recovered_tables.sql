-- Incident recovery follow-up (same incident as
-- 20260930090000_restore_wiped_parasut_and_public_schema_objects.sql).
-- That migration recreated the 11 parasut.* tables deleted by the
-- unidentified third party, but its CREATE TABLE bodies did not carry
-- over the separate ALTER TABLE ... ADD CONSTRAINT statements that
-- pg_dump emits after the table body in
-- backups/schema_snapshot_20260906_230119.sql (primary keys, and the
-- UNIQUE constraints on parasut_id / composite keys that parasut-sync's
-- upsert(..., { onConflict: ... }) calls depend on). Discovered live:
-- the pg_cron sync dispatcher successfully obtained a fresh Parasut
-- OAuth token after the schema restore, then failed to persist it with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" on parasut.oauth_tokens (missing oauth_tokens_pkey).
-- This migration adds exactly the 15 constraints that were missed,
-- verbatim from the same pre-incident backup, on the same 11 tables.
-- No new design, no other objects touched.

ALTER TABLE ONLY "parasut"."employee_sync_meta"
    ADD CONSTRAINT "employee_sync_meta_pkey" PRIMARY KEY ("resource", "filter_scope");

ALTER TABLE ONLY "parasut"."inbound_e_despatches"
    ADD CONSTRAINT "inbound_e_despatches_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."inbound_e_despatches"
    ADD CONSTRAINT "inbound_e_despatches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "parasut"."oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("connection");

ALTER TABLE ONLY "parasut"."relationship_manifest"
    ADD CONSTRAINT "relationship_manifest_pkey" PRIMARY KEY ("resource", "relationship_key");

ALTER TABLE ONLY "parasut"."salary_tags"
    ADD CONSTRAINT "salary_tags_unique" UNIQUE ("salary_parasut_id", "tag_parasut_id", "tag_type");

ALTER TABLE ONLY "parasut"."sales_offer_activities"
    ADD CONSTRAINT "sales_offer_activities_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."sales_offer_activities"
    ADD CONSTRAINT "sales_offer_activities_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "parasut"."shipment_document_activities"
    ADD CONSTRAINT "shipment_document_activities_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."shipment_document_activities"
    ADD CONSTRAINT "shipment_document_activities_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "parasut"."shipment_document_invoices"
    ADD CONSTRAINT "shipment_document_invoices_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "parasut"."shipment_document_invoices"
    ADD CONSTRAINT "shipment_document_invoices_unique" UNIQUE ("shipment_document_parasut_id", "sales_invoice_parasut_id");

ALTER TABLE ONLY "parasut"."sync_runs"
    ADD CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "parasut"."tax_tags"
    ADD CONSTRAINT "tax_tags_unique" UNIQUE ("tax_parasut_id", "tag_parasut_id", "tag_type");

ALTER TABLE ONLY "parasut"."write_capability_manifest"
    ADD CONSTRAINT "write_capability_manifest_pkey" PRIMARY KEY ("resource", "operation");
