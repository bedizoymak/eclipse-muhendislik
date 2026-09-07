-- Phase 15.1 final step: remove the now fully-unused public.parasut_*_demo
-- views (48 total). These were the frontend's original read path before
-- Phase 15 moved every page onto Edge Functions, and were kept alive as the
-- Edge Functions' own read source until Phase 15.1 migrated all 11 read
-- functions to query parasut.* directly (commits 2ce5a9f, 76cdc76, 656621a,
-- ff7bdc1, 55997a8).
--
-- Fresh dependency check performed immediately before writing this
-- migration, against the live remote database:
--   - Zero `.from("parasut_*_demo")` calls anywhere in src/ (frontend has
--     had zero dependency since Phase 15).
--   - Zero `.from("parasut_*_demo")` calls anywhere in supabase/functions/
--     (all 11 read Edge Functions now query parasut.* directly).
--   - Zero other views/matviews depend on any of these 48 views (checked
--     via pg_depend/pg_rewrite).
--   - Zero RLS policies reference any of these views.
--   - Zero triggers exist on any of these views.
--   - Zero functions in public reference "parasut_*_demo" in their body or
--     name.
--   - pg_class confirms exactly 48 objects matching parasut_%_demo in
--     public, all relkind 'v' (view) -- no tables, sequences, or functions.
--
-- Not touched by this migration (explicitly out of scope, verified
-- untouched):
--   - parasut.* mirror tables, parasut.e_invoices_with_resolution,
--     parasut_ops.* scheduler tables, parasut.oauth_tokens/sync_runs and
--     all other sync infrastructure.
--   - Non-Paraşüt public objects: contact_messages, profiles, projects,
--     services, site_settings, user_roles, and their functions
--     (handle_new_user, has_role, rls_auto_enable,
--     update_updated_at_column) -- the unrelated admin-CMS feature.
--
-- Plain DROP VIEW (no CASCADE): if any dependency was missed by the checks
-- above, this migration fails loudly on that statement instead of silently
-- cascading a deletion into something unexpected.
--
-- ROLLBACK: re-run the CREATE VIEW statements from
-- backups/schema_snapshot_20260906_230119.sql (or migration
-- 20260930090000_restore_wiped_parasut_and_public_schema_objects.sql,
-- which has the same verbatim view bodies) for any view listed below.
-- Since the underlying parasut.* tables are untouched, recreating a view
-- restores it with no data loss.

DROP VIEW IF EXISTS "public"."parasut_accounts_demo";
DROP VIEW IF EXISTS "public"."parasut_checks_demo";
DROP VIEW IF EXISTS "public"."parasut_company_profile_demo";
DROP VIEW IF EXISTS "public"."parasut_contact_people_demo";
DROP VIEW IF EXISTS "public"."parasut_contacts_demo";
DROP VIEW IF EXISTS "public"."parasut_e_archives_demo";
DROP VIEW IF EXISTS "public"."parasut_e_invoice_lookup_result_counts_demo";
DROP VIEW IF EXISTS "public"."parasut_e_invoice_lookup_results_demo";
DROP VIEW IF EXISTS "public"."parasut_e_invoices_counts_demo";
DROP VIEW IF EXISTS "public"."parasut_e_invoices_demo";
DROP VIEW IF EXISTS "public"."parasut_employee_counts_demo";
DROP VIEW IF EXISTS "public"."parasut_employee_meta_demo";
DROP VIEW IF EXISTS "public"."parasut_employees_demo";
DROP VIEW IF EXISTS "public"."parasut_expense_payments_demo";
DROP VIEW IF EXISTS "public"."parasut_inbound_e_despatches_demo";
DROP VIEW IF EXISTS "public"."parasut_inventory_levels_demo";
DROP VIEW IF EXISTS "public"."parasut_item_categories_demo";
DROP VIEW IF EXISTS "public"."parasut_item_category_counts_demo";
DROP VIEW IF EXISTS "public"."parasut_payments_demo";
DROP VIEW IF EXISTS "public"."parasut_products_demo";
DROP VIEW IF EXISTS "public"."parasut_purchase_bill_counts_demo";
DROP VIEW IF EXISTS "public"."parasut_purchase_bill_details_demo";
DROP VIEW IF EXISTS "public"."parasut_purchase_bills_demo";
DROP VIEW IF EXISTS "public"."parasut_relationship_manifest_demo";
DROP VIEW IF EXISTS "public"."parasut_salaries_demo";
DROP VIEW IF EXISTS "public"."parasut_salary_counts_demo";
DROP VIEW IF EXISTS "public"."parasut_salary_tags_demo";
DROP VIEW IF EXISTS "public"."parasut_sales_invoice_counts_demo";
DROP VIEW IF EXISTS "public"."parasut_sales_invoice_details_demo";
DROP VIEW IF EXISTS "public"."parasut_sales_invoices_demo";
DROP VIEW IF EXISTS "public"."parasut_sales_offer_activities_demo";
DROP VIEW IF EXISTS "public"."parasut_sales_offer_details_demo";
DROP VIEW IF EXISTS "public"."parasut_sales_offers_demo";
DROP VIEW IF EXISTS "public"."parasut_shipment_document_activities_demo";
DROP VIEW IF EXISTS "public"."parasut_shipment_document_counts_demo";
DROP VIEW IF EXISTS "public"."parasut_shipment_document_invoices_demo";
DROP VIEW IF EXISTS "public"."parasut_shipment_documents_demo";
DROP VIEW IF EXISTS "public"."parasut_stock_movements_demo";
DROP VIEW IF EXISTS "public"."parasut_suppliers_demo";
DROP VIEW IF EXISTS "public"."parasut_sync_status_demo";
DROP VIEW IF EXISTS "public"."parasut_tag_counts_demo";
DROP VIEW IF EXISTS "public"."parasut_tags_demo";
DROP VIEW IF EXISTS "public"."parasut_tax_counts_demo";
DROP VIEW IF EXISTS "public"."parasut_tax_tags_demo";
DROP VIEW IF EXISTS "public"."parasut_taxes_demo";
DROP VIEW IF EXISTS "public"."parasut_transactions_demo";
DROP VIEW IF EXISTS "public"."parasut_user_company_relation_demo";
DROP VIEW IF EXISTS "public"."parasut_warehouses_demo";
