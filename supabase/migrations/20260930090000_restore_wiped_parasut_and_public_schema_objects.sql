-- Incident recovery migration (same-day, 2026-09-07 / project ref
-- yzuxdrknidveptvnwthf). An unidentified third party pushed schema
-- changes directly to the live database outside this repo's migration
-- history, deleting the entire public schema (all ~45
-- public.parasut_*_demo views plus other public.parasut_* views) and 11
-- parasut.* tables (oauth_tokens, sync_runs, employee_sync_meta,
-- inbound_e_despatches, relationship_manifest, salary_tags,
-- sales_offer_activities, shipment_document_activities,
-- shipment_document_invoices, tax_tags, write_capability_manifest), plus
-- one parasut.* view (e_invoices_with_resolution). This migration is a
-- byte-for-byte restore of those objects (tables, the one view, RLS
-- enable flags, and grants) sourced verbatim from the pre-incident
-- schema-only backup at backups/schema_snapshot_20260906_230119.sql. It
-- is NOT a design change -- no new columns, types, or behavior are
-- introduced. It intentionally does NOT touch the unidentified party's
-- extra (empty) parasut.* tables (activities, contact_portals,
-- e_document_commons, e_document_pdfs, e_smm_commons, recurrence_plans,
-- sales_offers_details, sales_offers_pdfs, sharings), which are left
-- alone pending a separate investigation/decision. It also does NOT
-- apply the already-authored lock-down migration
-- 20260930010000_lock_down_demo_views_after_edge_function_cutover.sql
-- (renamed to a later timestamp separately so it isn't silently skipped
-- by the version-number collision with the unidentified party's own
-- migration recorded under 20260930010000) -- that lock-down revokes
-- public view access and must only be applied after service is verified
-- restored and re-approved.

-- =====================================================================
-- Section A: restore the 11 parasut.* tables and 1 parasut.* view that
-- were deleted from the live database by the unidentified party, plus
-- their RLS enablement / grants -- all verbatim from
-- backups/schema_snapshot_20260906_230119.sql (pre-incident dump).
-- =====================================================================

CREATE TABLE IF NOT EXISTS "parasut"."employee_sync_meta" (
    "resource" "text" NOT NULL,
    "filter_scope" "text" NOT NULL,
    "payable_total" numeric,
    "advance_total" numeric,
    "export_url" "text",
    "source_total_count" integer,
    "source_current_page" integer,
    "source_total_pages" integer,
    "source_per_page" integer,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw_meta" "jsonb" NOT NULL
);

ALTER TABLE "parasut"."employee_sync_meta" OWNER TO "postgres";

COMMENT ON TABLE "parasut"."employee_sync_meta" IS 'One row per (resource, filter_scope) snapshot of the real Parasut employee LIST response links/meta block. Overwritten every real (non dry-run) sync with the current authoritative API value; never merged with per-employee rows. raw_meta is the full verbatim links+meta object and is never exposed to a public view.';


CREATE TABLE IF NOT EXISTS "parasut"."inbound_e_despatches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "shipment_document_parasut_id" bigint,
    "uuid" "text",
    "despatch_no" "text",
    "contact_name" "text",
    "issue_date" timestamp with time zone,
    "from_tax_number" "text",
    "response_status" "text",
    "response_type" "text",
    "expires_at" timestamp with time zone,
    "is_expired" boolean,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."inbound_e_despatches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "parasut"."oauth_tokens" (
    "connection" "text" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "token_type" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."oauth_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "parasut"."relationship_manifest" (
    "resource" "text" NOT NULL,
    "relationship_key" "text" NOT NULL,
    "state" "text" NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "relationship_manifest_state_check" CHECK (("state" = ANY (ARRAY['known_and_mapped'::"text", 'known_but_schema_blocked'::"text", 'known_but_unmapped'::"text", 'genuinely_unknown'::"text"])))
);

ALTER TABLE "parasut"."relationship_manifest" OWNER TO "postgres";

COMMENT ON TABLE "parasut"."relationship_manifest" IS 'Phase 13.3/13.4: static audit manifest of every Swagger-documented relationship key per resource, cross-checked by hand against the live Swagger schema (not runtime-inferred). Phase 13.4 removed salaries.activities/taxes.activities: re-verified against the real swagger.json in this phase, neither relationships object documents an activities key and no /{id}/activities path exists for either resource -- see reports/PHASE_13_4_FINAL_SOURCE_BOUNDARY_AND_UI_REPORT.md section 3.';


CREATE TABLE IF NOT EXISTS "parasut"."salary_tags" (
    "salary_parasut_id" bigint NOT NULL,
    "tag_parasut_id" bigint NOT NULL,
    "tag_type" "text" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."salary_tags" OWNER TO "postgres";

COMMENT ON TABLE "parasut"."salary_tags" IS 'Phase 13.2: junction for the real Salary.relationships.tags to-many relationship. tag_type is the real relationships.tags.data[].type value, never a hardcoded "tags" constant. Refreshed (diffed against the current source list) on every sync of the parent salary; rows for tags removed at the source are deleted, not left stale.';


CREATE TABLE IF NOT EXISTS "parasut"."sales_offer_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "sales_offer_parasut_id" bigint NOT NULL,
    "activity_type" "text",
    "date" timestamp with time zone,
    "data" "jsonb",
    "done_by_email" "text",
    "done_by_parasut_id" bigint,
    "done_by_type" "text",
    "item_parasut_id" bigint,
    "item_type" "text",
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data_description" "text",
    "data_issue_date" "date",
    "data_due_date" "date",
    "data_net_total" numeric,
    "data_currency" "text",
    "data_content" "text",
    "data_status" "text",
    "data_contact_id" bigint,
    "data_contact_name" "text",
    "done_by_name" "text",
    "done_by_user_email" "text"
);

ALTER TABLE "parasut"."sales_offer_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "parasut"."shipment_document_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "shipment_document_parasut_id" bigint NOT NULL,
    "activity_type" "text",
    "date" timestamp with time zone,
    "data_description" "text",
    "data_issue_date" "date",
    "done_by_email" "text",
    "done_by_parasut_id" bigint,
    "done_by_type" "text",
    "done_by_name" "text",
    "done_by_user_email" "text",
    "item_parasut_id" bigint,
    "item_type" "text",
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."shipment_document_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "parasut"."shipment_document_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_document_parasut_id" bigint NOT NULL,
    "sales_invoice_parasut_id" bigint NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."shipment_document_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "parasut"."sync_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resource" "text" NOT NULL,
    "status" "text" NOT NULL,
    "dry_run" boolean DEFAULT false NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "fetched_count" integer DEFAULT 0 NOT NULL,
    "upserted_count" integer DEFAULT 0 NOT NULL,
    "error_count" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "total_count_reported" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "active_fetched_count" integer,
    "archived_fetched_count" integer,
    "detail_fetched_count" integer,
    "detail_upserted_count" integer,
    "unresolved_count" integer,
    "metadata" "jsonb",
    CONSTRAINT "sync_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'error'::"text", 'dry_run'::"text", 'lookup_required'::"text"])))
);

ALTER TABLE "parasut"."sync_runs" OWNER TO "postgres";

COMMENT ON COLUMN "parasut"."sync_runs"."status" IS 'Phase 13.3: ''lookup_required'' added for e_invoice_inboxes -- a resource with no global-sync semantics whose sync call is always blocked (BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH) pending a future secure-auth phase. This status must never be confused with ''success'' -- see index.ts Deno.serve handler''s runStatus logic, which lets a syncer''s own dbFields.status win over the generic success/dry_run default.';

COMMENT ON COLUMN "parasut"."sync_runs"."metadata" IS 'Phase 13.1: structured, per-run diagnostic metadata (currently: unknown-field-detection report for salaries/taxes/tags/e_invoice_inboxes). Response-and-audit only, never read by sync logic itself.';


CREATE TABLE IF NOT EXISTS "parasut"."tax_tags" (
    "tax_parasut_id" bigint NOT NULL,
    "tag_parasut_id" bigint NOT NULL,
    "tag_type" "text" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."tax_tags" OWNER TO "postgres";

COMMENT ON TABLE "parasut"."tax_tags" IS 'Phase 13.2: junction for the real Tax.relationships.tags to-many relationship. Same rules as parasut.salary_tags.';


CREATE TABLE IF NOT EXISTS "parasut"."write_capability_manifest" (
    "resource" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "method" "text" NOT NULL,
    "path" "text" NOT NULL,
    "read_write" "text" DEFAULT 'write_only'::"text" NOT NULL,
    "auth_status" "text" DEFAULT 'requires_write_scope'::"text" NOT NULL,
    "ui_decision" "text" DEFAULT 'not_exposed'::"text" NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."write_capability_manifest" OWNER TO "postgres";

COMMENT ON TABLE "parasut"."write_capability_manifest" IS 'Phase 13.5: technical capability manifest for real write-action-only API paths (e.g. POST /salaries/{id}/payments). Never a source of GET relationship data -- see parasut.relationship_manifest for that. A row existing here means the capability is real and documented in swagger.json, not that any UI is allowed to use it.';


-- =====================================================================
-- PHASE: Restore the 34 parasut.* base tables that were silently
-- reshaped by the unidentified party into a generic JSON:API envelope
-- (id, type, attributes, relationships, links, meta), discarding their
-- real flattened columns. Confirmed empty (0 rows) on live via a fresh
-- row-count check immediately before this migration was authored, and
-- re-verified immediately before apply per the incident safety protocol
-- -- see reports for the wider-reshaping discovery. Recreated verbatim
-- from backups/schema_snapshot_20260906_230119.sql (CREATE TABLE, OWNER,
-- COMMENT, indexes, PK/UNIQUE, cross-junction FKs onto salary_tags/
-- tax_tags already restored above, RLS enable, GRANTs). DROP ... CASCADE
-- is used so any dependent view (e.g. e_invoices_with_resolution and the
-- public.parasut_*_demo views below) is cleanly removed and recreated
-- fresh later in this same migration file.
-- =====================================================================

-- ============ parasut.accounts ============
DROP TABLE IF EXISTS "parasut"."accounts" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "name" "text",
    "account_type" "text",
    "currency" "text",
    "bank_name" "text",
    "bank_branch" "text",
    "bank_account_no" "text",
    "iban" "text",
    "balance" numeric,
    "used_for" "text",
    "last_used_at" timestamp with time zone,
    "last_adjustment_date" "date",
    "bank_integration_type" "text",
    "associate_email" "text",
    "archived" boolean,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."accounts" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."accounts"
    ADD CONSTRAINT "accounts_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");

ALTER TABLE "parasut"."accounts" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."accounts" TO "service_role";

-- ============ parasut.addresses ============
DROP TABLE IF EXISTS "parasut"."addresses" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "name" "text",
    "address" "text",
    "phone" "text",
    "fax" "text",
    "addressable_type" "text",
    "addressable_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parasut_type" "text"
);

ALTER TABLE "parasut"."addresses" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."addresses"
    ADD CONSTRAINT "addresses_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");

CREATE INDEX "addresses_addressable_parasut_id_idx" ON "parasut"."addresses" USING "btree" ("addressable_parasut_id");

ALTER TABLE "parasut"."addresses" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."addresses" TO "service_role";

-- ============ parasut.bank_fees ============
DROP TABLE IF EXISTS "parasut"."bank_fees" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."bank_fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "description" "text",
    "currency" "text",
    "issue_date" "date",
    "due_date" "date",
    "exchange_rate" numeric,
    "net_total" numeric,
    "total_paid" numeric,
    "remaining" numeric,
    "remaining_in_trl" numeric,
    "archived" boolean,
    "category_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."bank_fees" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."bank_fees"
    ADD CONSTRAINT "bank_fees_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."bank_fees"
    ADD CONSTRAINT "bank_fees_pkey" PRIMARY KEY ("id");

CREATE INDEX "bank_fees_category_parasut_id_idx" ON "parasut"."bank_fees" USING "btree" ("category_parasut_id");

ALTER TABLE "parasut"."bank_fees" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."bank_fees" TO "service_role";

-- ============ parasut.checks ============
DROP TABLE IF EXISTS "parasut"."checks" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "currency" "text",
    "description" "text",
    "due_date" "date",
    "issue_date" "date",
    "net_total" numeric,
    "remaining" numeric,
    "remaining_in_trl" numeric,
    "payment_status" "text",
    "is_cashed" boolean,
    "is_in" boolean,
    "is_out" boolean,
    "is_transferred" boolean,
    "days_overdue" numeric,
    "days_till_due_date" numeric,
    "bank_identifier" "text",
    "bank_name" "text",
    "serial_number" "text",
    "issued_by_parasut_id" bigint,
    "issued_by_type" "text",
    "given_to_parasut_id" bigint,
    "given_to_type" "text",
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."checks" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."checks"
    ADD CONSTRAINT "checks_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."checks"
    ADD CONSTRAINT "checks_pkey" PRIMARY KEY ("id");

CREATE INDEX "checks_given_to_parasut_id_idx" ON "parasut"."checks" USING "btree" ("given_to_parasut_id");

CREATE INDEX "checks_issued_by_parasut_id_idx" ON "parasut"."checks" USING "btree" ("issued_by_parasut_id");

ALTER TABLE "parasut"."checks" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."checks" TO "service_role";

-- ============ parasut.companies ============
DROP TABLE IF EXISTS "parasut"."companies" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "name" "text",
    "legal_name" "text",
    "tax_office" "text",
    "tax_number" "text",
    "mersis_no" "text",
    "district" "text",
    "city" "text",
    "occupation_field" "text",
    "primary_job" "text",
    "app_url" "text",
    "subscription_status" "text",
    "subscription_status_for_analytics" "text",
    "subscription_started_at" timestamp with time zone,
    "subscription_renewed_at" timestamp with time zone,
    "subscription_value" numeric,
    "valid_until" timestamp with time zone,
    "trial_expiration_at" timestamp with time zone,
    "is_in_trial_period" boolean,
    "end_of_grace_period_at" timestamp with time zone,
    "is_in_grace_period" boolean,
    "total_unused_bonus_months" numeric,
    "is_active" boolean,
    "accessible" boolean,
    "inspectable" boolean,
    "inventory_enabled" boolean,
    "has_iyzico_integration" boolean,
    "has_active_subscription" boolean,
    "allowed_inspection_at" timestamp with time zone,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trade_registry_number" "text",
    "owner_parasut_id" bigint,
    "address_parasut_id" bigint,
    "default_warehouse_parasut_id" bigint,
    "logo_url" "text",
    "credit_balance" numeric,
    "last_consumption_date" timestamp with time zone,
    "new_subscription_status" "text",
    "e_invoicing_enabled" boolean,
    "e_archiving_enabled" boolean,
    "e_despatch_enabled" boolean,
    "e_commerce_enabled" boolean,
    "e_invoicing_activated_at" "date",
    "e_archiving_activated_at" "date",
    "e_despatch_activated_at" "date",
    "sales_offer_enabled" boolean,
    "export_invoice_enabled" boolean,
    "using_multiple_warehouses" boolean,
    "using_variant" boolean,
    "uses_credit_service" boolean,
    "credit_service_enabled" boolean,
    "can_use_ai_reporting" boolean,
    "can_use_ai_support" boolean,
    "extra_flags" "jsonb",
    "e_invoice_vkn" "text",
    "display_exchange_rate_in_offer_pdf" boolean,
    "payment_with_akbank_enabled" boolean,
    "can_upload_signature" boolean,
    "invoicing_preferences" "jsonb",
    "e_smm_enabled" boolean,
    "e_smm_activated_at" "date",
    "e_archiving_only_enabled" boolean,
    "e_archiving_only_activated_at" "date",
    "e_archiving_only_waiting" boolean,
    "using_sales_receipt" boolean,
    "using_emikro_einvoice" boolean,
    "using_emikro_services" boolean,
    "e_invoicing_waiting" boolean,
    "e_invoicing_order_details_enabled" boolean,
    "email_tx_import_enabled" boolean,
    "bank_sync_setup_is_bankasi_enabled" boolean,
    "bank_sync_setup_ing_bank_enabled" boolean,
    "bank_sync_setup_akbank_enabled" boolean,
    "bank_sync_setup_denizbank_enabled" boolean,
    "bank_sync_setup_kuveytturk_enabled" boolean,
    "bank_sync_setup_teb_enabled" boolean,
    "bank_sync_setup_finansbank_enabled" boolean,
    "bank_sync_setup_fibabanka_enabled" boolean,
    "bank_sync_setup_albaraka_enabled" boolean,
    "bank_sync_setup_ornekbank_enabled" boolean,
    "bank_sync_setup_yapikredi_enabled" boolean,
    "bank_sync_setup_vakifbank_enabled" boolean,
    "bank_sync_setup_enpara_enabled" boolean,
    "bank_sync_setup_garanti_enabled" boolean,
    "bank_sync_setup_ziraat_bankasi_enabled" boolean,
    "bank_sync_setup_halkbank_enabled" boolean,
    "multiple_bank_integration_enabled" boolean,
    "e_commerce_integration_enabled" boolean,
    "fibabanka_credit_application_enabled" boolean,
    "inbound_edocument_page_enabled" boolean,
    "batch_updated_vat_rates" boolean,
    "invoice_note_enabled" boolean,
    "has_odeal_integration" boolean,
    "has_507_and_509" boolean,
    "footer_aggregate_enabled" boolean,
    "contact_transfer_enabled" boolean,
    "pending_qr_code_migration" boolean,
    "ai_support_rag" boolean,
    "ai_features_enabled" boolean,
    "operator_id" bigint,
    "employee_id" bigint,
    "used_app" "text",
    "signature" "jsonb",
    "raw_company_list" "jsonb",
    "logo_is_processing" boolean,
    "parasut_type" "text",
    "owner_parasut_type" "text",
    "address_parasut_type" "text"
);

ALTER TABLE "parasut"."companies" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."companies"
    ADD CONSTRAINT "companies_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");

ALTER TABLE "parasut"."companies" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."companies" TO "service_role";

-- ============ parasut.contact_people ============
DROP TABLE IF EXISTS "parasut"."contact_people" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."contact_people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "name" "text",
    "email" "text",
    "phone" "text",
    "notes" "text",
    "contact_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resource_type" "text",
    "contact_type" "text"
);

ALTER TABLE "parasut"."contact_people" OWNER TO "postgres";

COMMENT ON COLUMN "parasut"."contact_people"."resource_type" IS 'Real API root type of this contact_people resource itself (included resource''s own "type" field). Never derived/fabricated.';

COMMENT ON COLUMN "parasut"."contact_people"."contact_type" IS 'Real API type of the PARENT contact relationship, taken only from the nested include=contact_people.contact child''s own relationships.contact.data.type. Never a "contacts" string constant.';

ALTER TABLE ONLY "parasut"."contact_people"
    ADD CONSTRAINT "contact_people_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."contact_people"
    ADD CONSTRAINT "contact_people_pkey" PRIMARY KEY ("id");

CREATE INDEX "contact_people_contact_parasut_id_idx" ON "parasut"."contact_people" USING "btree" ("contact_parasut_id");

ALTER TABLE "parasut"."contact_people" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."contact_people" TO "service_role";

-- ============ parasut.contacts ============
DROP TABLE IF EXISTS "parasut"."contacts" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "name" "text",
    "short_name" "text",
    "email" "text",
    "contact_type" "text",
    "tax_office" "text",
    "tax_number" "text",
    "district" "text",
    "postal_code" "text",
    "city" "text",
    "country" "text",
    "address" "text",
    "phone" "text",
    "fax" "text",
    "is_abroad" boolean,
    "archived" boolean,
    "iban" "text",
    "account_type" "text",
    "untrackable" boolean,
    "invoicing_preferences" "jsonb",
    "balance" numeric,
    "trl_balance" numeric,
    "usd_balance" numeric,
    "eur_balance" numeric,
    "gbp_balance" numeric,
    "category_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."contacts" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."contacts"
    ADD CONSTRAINT "contacts_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");

CREATE INDEX "contacts_category_parasut_id_idx" ON "parasut"."contacts" USING "btree" ("category_parasut_id");

ALTER TABLE "parasut"."contacts" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."contacts" TO "service_role";

-- ============ parasut.e_archives ============
DROP TABLE IF EXISTS "parasut"."e_archives" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."e_archives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "uuid" "text",
    "vkn" "text",
    "invoice_number" "text",
    "note" "text",
    "is_printed" boolean,
    "status" "text",
    "printed_at" timestamp with time zone,
    "cancellable_until" timestamp with time zone,
    "is_signed" boolean,
    "sales_invoice_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_status" "text",
    "html_url" "text",
    "migration_source" "text",
    "pdf_url" "text",
    "signed_ubl_url" "text"
);

ALTER TABLE "parasut"."e_archives" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."e_archives"
    ADD CONSTRAINT "e_archives_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."e_archives"
    ADD CONSTRAINT "e_archives_pkey" PRIMARY KEY ("id");

CREATE INDEX "e_archives_sales_invoice_parasut_id_idx" ON "parasut"."e_archives" USING "btree" ("sales_invoice_parasut_id");

ALTER TABLE "parasut"."e_archives" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."e_archives" TO "service_role";

-- ============ parasut.e_invoice_inboxes ============
DROP TABLE IF EXISTS "parasut"."e_invoice_inboxes" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."e_invoice_inboxes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "vkn" "text",
    "e_invoice_address" "text",
    "name" "text",
    "inbox_type" "text",
    "address_registered_at" timestamp with time zone,
    "registered_at" timestamp with time zone,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parasut_type" "text"
);

ALTER TABLE "parasut"."e_invoice_inboxes" OWNER TO "postgres";

COMMENT ON COLUMN "parasut"."e_invoice_inboxes"."parasut_type" IS 'Phase 13.2: verbatim runtime JSON:API item.type.';

ALTER TABLE ONLY "parasut"."e_invoice_inboxes"
    ADD CONSTRAINT "e_invoice_inboxes_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."e_invoice_inboxes"
    ADD CONSTRAINT "e_invoice_inboxes_pkey" PRIMARY KEY ("id");

ALTER TABLE "parasut"."e_invoice_inboxes" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."e_invoice_inboxes" TO "service_role";

-- ============ parasut.e_invoices ============
DROP TABLE IF EXISTS "parasut"."e_invoices" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."e_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "external_id" "text",
    "uuid" "text",
    "env_uuid" "text",
    "from_address" "text",
    "from_vkn" "text",
    "to_address" "text",
    "to_vkn" "text",
    "direction" "text",
    "note" "text",
    "response_type" "text",
    "contact_name" "text",
    "scenario" "text",
    "status" "text",
    "gtb_ref_no" "text",
    "gtb_registration_no" "text",
    "gtb_export_date" "date",
    "response_note" "text",
    "issue_date" "date",
    "is_expired" boolean,
    "is_answerable" boolean,
    "net_total" numeric,
    "currency" "text",
    "item_type" "text",
    "invoice_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean,
    "expires_at" "date",
    "html_url" "text",
    "invoice_type_code" "text",
    "is_seen" boolean,
    "migration_source" "text",
    "non_standard_e_invoice" boolean,
    "pdf_url" "text",
    "profile_id" "text",
    "refund_of_id" bigint,
    "signed_ubl_url" "text",
    "status_code" "text",
    "status_message" "text",
    "total_vat" numeric,
    "vat_exemption_reason_code" "text",
    "rendered_ubl_path" "text",
    "ubl_remote_id" "text",
    "signed_ubl_remote_id" "text",
    "parent_type" "text",
    "parent_parasut_id" bigint,
    "last_seen_at" timestamp with time zone
);

ALTER TABLE "parasut"."e_invoices" OWNER TO "postgres";

COMMENT ON COLUMN "parasut"."e_invoices"."last_seen_at" IS 'Timestamp of the most recent real standalone e_invoices sync run (resource=e_invoices) that observed this record in the Parasut API response. Null for rows only ever written by the active-parent e-document sync before Phase 14.2. Never used to drive a physical delete -- see Phase 14.2 report for the stale-semantics decision.';

ALTER TABLE ONLY "parasut"."e_invoices"
    ADD CONSTRAINT "e_invoices_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."e_invoices"
    ADD CONSTRAINT "e_invoices_pkey" PRIMARY KEY ("id");

CREATE INDEX "e_invoices_invoice_parasut_id_idx" ON "parasut"."e_invoices" USING "btree" ("invoice_parasut_id");

CREATE INDEX "e_invoices_parent_idx" ON "parasut"."e_invoices" USING "btree" ("parent_type", "parent_parasut_id");

ALTER TABLE "parasut"."e_invoices" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."e_invoices" TO "service_role";

-- ============ parasut.e_smms ============
DROP TABLE IF EXISTS "parasut"."e_smms" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."e_smms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "uuid" "text",
    "vkn" "text",
    "invoice_number" numeric,
    "is_printed" boolean,
    "pdf_url" "text",
    "printed_at" timestamp with time zone,
    "sales_invoice_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."e_smms" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."e_smms"
    ADD CONSTRAINT "e_smms_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."e_smms"
    ADD CONSTRAINT "e_smms_pkey" PRIMARY KEY ("id");

CREATE INDEX "e_smms_sales_invoice_parasut_id_idx" ON "parasut"."e_smms" USING "btree" ("sales_invoice_parasut_id");

ALTER TABLE "parasut"."e_smms" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."e_smms" TO "service_role";

-- ============ parasut.employees ============
DROP TABLE IF EXISTS "parasut"."employees" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "name" "text",
    "email" "text",
    "iban" "text",
    "archived" boolean,
    "balance" numeric,
    "trl_balance" numeric,
    "usd_balance" numeric,
    "eur_balance" numeric,
    "gbp_balance" numeric,
    "category_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tckn" "text",
    "employment_start_date" "date",
    "employment_end_date" "date",
    "phone" "text",
    "managed_by_user_parasut_id" bigint,
    "managed_by_user_role_parasut_id" bigint,
    "managed_by_user_role_type" "text",
    "tags_resolved" boolean,
    "activities_resolved" boolean,
    "comments_resolved" boolean
);

ALTER TABLE "parasut"."employees" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."employees"
    ADD CONSTRAINT "employees_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");

CREATE INDEX "employees_archived_idx" ON "parasut"."employees" USING "btree" ("archived");

CREATE INDEX "employees_category_parasut_id_idx" ON "parasut"."employees" USING "btree" ("category_parasut_id");

ALTER TABLE "parasut"."employees" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."employees" TO "service_role";

-- ============ parasut.inventory_levels ============
DROP TABLE IF EXISTS "parasut"."inventory_levels" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."inventory_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "stock_count" numeric,
    "initial_stock_count" numeric,
    "critical_stock_count" numeric,
    "product_parasut_id" bigint,
    "warehouse_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."inventory_levels" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."inventory_levels"
    ADD CONSTRAINT "inventory_levels_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."inventory_levels"
    ADD CONSTRAINT "inventory_levels_pkey" PRIMARY KEY ("id");

CREATE INDEX "inventory_levels_product_parasut_id_idx" ON "parasut"."inventory_levels" USING "btree" ("product_parasut_id");

CREATE INDEX "inventory_levels_warehouse_parasut_id_idx" ON "parasut"."inventory_levels" USING "btree" ("warehouse_parasut_id");

ALTER TABLE "parasut"."inventory_levels" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."inventory_levels" TO "service_role";

-- ============ parasut.item_categories ============
DROP TABLE IF EXISTS "parasut"."item_categories" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."item_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "name" "text",
    "full_path" "text",
    "bg_color" "text",
    "text_color" "text",
    "category_type" "text",
    "parent_category_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parasut_type" "text",
    "parent_category_parasut_type" "text",
    "subcategories" "jsonb"
);

ALTER TABLE "parasut"."item_categories" OWNER TO "postgres";

COMMENT ON COLUMN "parasut"."item_categories"."parasut_type" IS 'Phase 13.2: verbatim runtime JSON:API item.type.';

COMMENT ON COLUMN "parasut"."item_categories"."subcategories" IS 'Phase 13.2: verbatim relationships.subcategories.data array ([{id,type},...]) as returned by the API. Never derived from parent_category_parasut_id.';

ALTER TABLE ONLY "parasut"."item_categories"
    ADD CONSTRAINT "item_categories_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."item_categories"
    ADD CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id");

CREATE INDEX "item_categories_parent_category_parasut_id_idx" ON "parasut"."item_categories" USING "btree" ("parent_category_parasut_id");

ALTER TABLE "parasut"."item_categories" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."item_categories" TO "service_role";

-- ============ parasut.payments ============
DROP TABLE IF EXISTS "parasut"."payments" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "date" "date",
    "amount" numeric,
    "currency" "text",
    "notes" "text",
    "payable_type" "text",
    "payable_parasut_id" bigint,
    "transaction_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "due_date" "date",
    "matched_amount" numeric,
    "amount_in_trl" numeric,
    "paid_in_currency" "text"
);

ALTER TABLE "parasut"."payments" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."payments"
    ADD CONSTRAINT "payments_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");

CREATE INDEX "payments_payable_parasut_id_idx" ON "parasut"."payments" USING "btree" ("payable_parasut_id");

CREATE INDEX "payments_transaction_parasut_id_idx" ON "parasut"."payments" USING "btree" ("transaction_parasut_id");

ALTER TABLE "parasut"."payments" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."payments" TO "service_role";

-- ============ parasut.products ============
DROP TABLE IF EXISTS "parasut"."products" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "code" "text",
    "name" "text",
    "vat_rate" numeric,
    "sales_excise_duty" numeric,
    "sales_excise_duty_type" "text",
    "sales_excise_duty_code" "text",
    "purchase_excise_duty" numeric,
    "purchase_excise_duty_type" "text",
    "unit" "text",
    "communications_tax_rate" numeric,
    "archived" boolean,
    "list_price" numeric,
    "currency" "text",
    "buying_price" numeric,
    "buying_currency" "text",
    "list_price_in_trl" numeric,
    "buying_price_in_trl" numeric,
    "inventory_tracking" boolean,
    "initial_stock_count" numeric,
    "stock_count" numeric,
    "gtip" "text",
    "barcode" "text",
    "sales_invoice_details_count" bigint,
    "purchase_invoice_details_count" bigint,
    "category_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."products" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."products"
    ADD CONSTRAINT "products_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");

CREATE INDEX "products_category_parasut_id_idx" ON "parasut"."products" USING "btree" ("category_parasut_id");

ALTER TABLE "parasut"."products" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."products" TO "service_role";

-- ============ parasut.profiles ============
DROP TABLE IF EXISTS "parasut"."profiles" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "user_parasut_id" bigint,
    "phone" "text",
    "job_title" "text",
    "settings" "jsonb",
    "avatar" "jsonb",
    "raw" "jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parasut_type" "text"
);

ALTER TABLE "parasut"."profiles" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."profiles"
    ADD CONSTRAINT "profiles_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

CREATE INDEX "profiles_user_idx" ON "parasut"."profiles" USING "btree" ("user_parasut_id");

GRANT ALL ON TABLE "parasut"."profiles" TO "service_role";

-- ============ parasut.purchase_bill_details ============
DROP TABLE IF EXISTS "parasut"."purchase_bill_details" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."purchase_bill_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "quantity" numeric,
    "unit_price" numeric,
    "vat_rate" numeric,
    "vat_withholding_rate" numeric,
    "vat_withholding" numeric,
    "discount_type" "text",
    "discount_value" numeric,
    "excise_duty_type" "text",
    "excise_duty_value" numeric,
    "communications_tax_rate" numeric,
    "description" "text",
    "net_total" numeric,
    "purchase_bill_parasut_id" bigint,
    "warehouse_parasut_id" bigint,
    "product_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."purchase_bill_details" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."purchase_bill_details"
    ADD CONSTRAINT "purchase_bill_details_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."purchase_bill_details"
    ADD CONSTRAINT "purchase_bill_details_pkey" PRIMARY KEY ("id");

CREATE INDEX "purchase_bill_details_product_parasut_id_idx" ON "parasut"."purchase_bill_details" USING "btree" ("product_parasut_id");

CREATE INDEX "purchase_bill_details_purchase_bill_parasut_id_idx" ON "parasut"."purchase_bill_details" USING "btree" ("purchase_bill_parasut_id");

CREATE INDEX "purchase_bill_details_warehouse_parasut_id_idx" ON "parasut"."purchase_bill_details" USING "btree" ("warehouse_parasut_id");

ALTER TABLE "parasut"."purchase_bill_details" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."purchase_bill_details" TO "service_role";

-- ============ parasut.purchase_bills ============
DROP TABLE IF EXISTS "parasut"."purchase_bills" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."purchase_bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "item_type" "text",
    "description" "text",
    "issue_date" "date",
    "due_date" "date",
    "invoice_no" "text",
    "currency" "text",
    "exchange_rate" numeric,
    "net_total" numeric,
    "withholding_rate" numeric,
    "invoice_discount_type" "text",
    "invoice_discount" numeric,
    "gross_total" numeric,
    "total_excise_duty" numeric,
    "total_communications_tax" numeric,
    "total_vat" numeric,
    "total_vat_withholding" numeric,
    "total_discount" numeric,
    "total_invoice_discount" numeric,
    "remaining" numeric,
    "remaining_in_trl" numeric,
    "payment_status" "text",
    "is_detailed" boolean,
    "sharings_count" bigint,
    "e_invoices_count" bigint,
    "remaining_reimbursement" numeric,
    "remaining_reimbursement_in_trl" numeric,
    "total_paid" numeric,
    "archived" boolean,
    "category_parasut_id" bigint,
    "spender_parasut_id" bigint,
    "supplier_parasut_id" bigint,
    "pay_to_parasut_id" bigint,
    "recurrence_plan_parasut_id" bigint,
    "active_e_document_type" "text",
    "active_e_document_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."purchase_bills" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."purchase_bills"
    ADD CONSTRAINT "purchase_bills_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."purchase_bills"
    ADD CONSTRAINT "purchase_bills_pkey" PRIMARY KEY ("id");

CREATE INDEX "purchase_bills_active_e_document_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("active_e_document_parasut_id");

CREATE INDEX "purchase_bills_category_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("category_parasut_id");

CREATE INDEX "purchase_bills_pay_to_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("pay_to_parasut_id");

CREATE INDEX "purchase_bills_recurrence_plan_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("recurrence_plan_parasut_id");

CREATE INDEX "purchase_bills_spender_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("spender_parasut_id");

CREATE INDEX "purchase_bills_supplier_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("supplier_parasut_id");

ALTER TABLE "parasut"."purchase_bills" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."purchase_bills" TO "service_role";

-- ============ parasut.salaries ============
DROP TABLE IF EXISTS "parasut"."salaries" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."salaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "description" "text",
    "currency" "text",
    "issue_date" "date",
    "due_date" "date",
    "exchange_rate" numeric,
    "net_total" numeric,
    "total_paid" numeric,
    "remaining" numeric,
    "remaining_in_trl" numeric,
    "archived" boolean,
    "employee_parasut_id" bigint,
    "category_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parasut_type" "text",
    "employee_parasut_type" "text",
    "category_parasut_type" "text"
);

ALTER TABLE "parasut"."salaries" OWNER TO "postgres";

COMMENT ON COLUMN "parasut"."salaries"."raw" IS 'Full JSON:API resource object as returned by Parasut, verbatim. Phase 13.3: this is also the only place relationships.activities is currently preserved (SCHEMA_BLOCKED -- cardinality unverified against a real record) and relationships.payments before the salary_payments junction resolves it structurally.';

COMMENT ON COLUMN "parasut"."salaries"."parasut_type" IS 'Phase 13.2: verbatim runtime JSON:API item.type for this resource. Never hardcoded; if it disagrees with the Swagger-documented enum the sync run reports a type_mismatch in sync_runs.metadata.';

ALTER TABLE ONLY "parasut"."salaries"
    ADD CONSTRAINT "salaries_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."salaries"
    ADD CONSTRAINT "salaries_pkey" PRIMARY KEY ("id");

CREATE INDEX "salaries_category_parasut_id_idx" ON "parasut"."salaries" USING "btree" ("category_parasut_id");

CREATE INDEX "salaries_employee_parasut_id_idx" ON "parasut"."salaries" USING "btree" ("employee_parasut_id");

ALTER TABLE ONLY "parasut"."salary_tags"
    ADD CONSTRAINT "salary_tags_salary_parasut_id_fkey" FOREIGN KEY ("salary_parasut_id") REFERENCES "parasut"."salaries"("parasut_id") ON DELETE CASCADE;

ALTER TABLE "parasut"."salaries" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."salaries" TO "service_role";

-- ============ parasut.sales_invoice_details ============
DROP TABLE IF EXISTS "parasut"."sales_invoice_details" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."sales_invoice_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "quantity" numeric,
    "unit_price" numeric,
    "vat_rate" numeric,
    "vat_withholding_rate" numeric,
    "vat_withholding" numeric,
    "discount_type" "text",
    "discount_value" numeric,
    "excise_duty_type" "text",
    "excise_duty_value" numeric,
    "communications_tax_rate" numeric,
    "description" "text",
    "delivery_method" "text",
    "shipping_method" "text",
    "net_total" numeric,
    "sales_invoice_parasut_id" bigint,
    "warehouse_parasut_id" bigint,
    "product_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."sales_invoice_details" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."sales_invoice_details"
    ADD CONSTRAINT "sales_invoice_details_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."sales_invoice_details"
    ADD CONSTRAINT "sales_invoice_details_pkey" PRIMARY KEY ("id");

CREATE INDEX "sales_invoice_details_product_parasut_id_idx" ON "parasut"."sales_invoice_details" USING "btree" ("product_parasut_id");

CREATE INDEX "sales_invoice_details_sales_invoice_parasut_id_idx" ON "parasut"."sales_invoice_details" USING "btree" ("sales_invoice_parasut_id");

CREATE INDEX "sales_invoice_details_warehouse_parasut_id_idx" ON "parasut"."sales_invoice_details" USING "btree" ("warehouse_parasut_id");

ALTER TABLE "parasut"."sales_invoice_details" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."sales_invoice_details" TO "service_role";

-- ============ parasut.sales_invoices ============
DROP TABLE IF EXISTS "parasut"."sales_invoices" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."sales_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "invoice_no" "text",
    "invoice_series" "text",
    "invoice_id" bigint,
    "item_type" "text",
    "description" "text",
    "issue_date" "date",
    "due_date" "date",
    "currency" "text",
    "exchange_rate" numeric,
    "net_total" numeric,
    "gross_total" numeric,
    "withholding" numeric,
    "withholding_rate" numeric,
    "total_excise_duty" numeric,
    "total_communications_tax" numeric,
    "total_vat" numeric,
    "total_vat_withholding" numeric,
    "total_discount" numeric,
    "total_invoice_discount" numeric,
    "before_taxes_total" numeric,
    "remaining" numeric,
    "remaining_in_trl" numeric,
    "payment_status" "text",
    "invoice_discount_type" "text",
    "invoice_discount" numeric,
    "billing_address" "text",
    "billing_postal_code" "text",
    "billing_phone" "text",
    "billing_fax" "text",
    "tax_office" "text",
    "tax_number" "text",
    "country" "text",
    "city" "text",
    "district" "text",
    "is_abroad" boolean,
    "order_no" "text",
    "order_date" "date",
    "shipment_addres" "text",
    "shipment_included" boolean,
    "cash_sale" boolean,
    "payer_tax_numbers" "jsonb",
    "invoice_note" "text",
    "append_contact_balance" boolean,
    "e_document_accounts" "jsonb",
    "archived" boolean,
    "category_parasut_id" bigint,
    "contact_parasut_id" bigint,
    "sales_offer_parasut_id" bigint,
    "recurrence_plan_parasut_id" bigint,
    "active_e_document_type" "text",
    "active_e_document_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."sales_invoices" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id");

CREATE INDEX "sales_invoices_active_e_document_parasut_id_idx" ON "parasut"."sales_invoices" USING "btree" ("active_e_document_parasut_id");

CREATE INDEX "sales_invoices_category_parasut_id_idx" ON "parasut"."sales_invoices" USING "btree" ("category_parasut_id");

CREATE INDEX "sales_invoices_contact_parasut_id_idx" ON "parasut"."sales_invoices" USING "btree" ("contact_parasut_id");

CREATE INDEX "sales_invoices_recurrence_plan_parasut_id_idx" ON "parasut"."sales_invoices" USING "btree" ("recurrence_plan_parasut_id");

CREATE INDEX "sales_invoices_sales_offer_parasut_id_idx" ON "parasut"."sales_invoices" USING "btree" ("sales_offer_parasut_id");

ALTER TABLE "parasut"."sales_invoices" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."sales_invoices" TO "service_role";

-- ============ parasut.sales_offer_details ============
DROP TABLE IF EXISTS "parasut"."sales_offer_details" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."sales_offer_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "description" "text",
    "net_total" numeric,
    "unit_price" numeric,
    "vat_rate" numeric,
    "quantity" numeric,
    "discount_type" "text",
    "discount_value" numeric,
    "communications_tax_rate" numeric,
    "excise_duty_type" "text",
    "excise_duty" numeric,
    "excise_duty_rate" numeric,
    "discount" numeric,
    "communications_tax" numeric,
    "detail_no" bigint,
    "net_total_without_invoice_discount" numeric,
    "vat_withholding" numeric,
    "vat_withholding_rate" numeric,
    "accommodation_tax_rate" numeric,
    "accommodation_tax" numeric,
    "accommodation_tax_exempt" boolean,
    "excise_duty_value" numeric,
    "sales_offer_parasut_id" bigint,
    "product_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invoice_discount" numeric
);

ALTER TABLE "parasut"."sales_offer_details" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."sales_offer_details"
    ADD CONSTRAINT "sales_offer_details_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."sales_offer_details"
    ADD CONSTRAINT "sales_offer_details_pkey" PRIMARY KEY ("id");

CREATE INDEX "sales_offer_details_product_parasut_id_idx" ON "parasut"."sales_offer_details" USING "btree" ("product_parasut_id");

CREATE INDEX "sales_offer_details_sales_offer_parasut_id_idx" ON "parasut"."sales_offer_details" USING "btree" ("sales_offer_parasut_id");

ALTER TABLE "parasut"."sales_offer_details" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."sales_offer_details" TO "service_role";

-- ============ parasut.sales_offers ============
DROP TABLE IF EXISTS "parasut"."sales_offers" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."sales_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "content" "text",
    "contact_type" "text",
    "status" "text",
    "display_exchange_rate_in_pdf" boolean,
    "net_total" numeric,
    "gross_total" numeric,
    "withholding" numeric,
    "withholding_rate" numeric,
    "total_excise_duty" numeric,
    "total_communications_tax" numeric,
    "total_accommodation_tax" numeric,
    "total_vat" numeric,
    "total_vat_withholding" numeric,
    "vat_withholding" numeric,
    "total_discount" numeric,
    "total_invoice_discount" numeric,
    "description" "text",
    "issue_date" "date",
    "due_date" "date",
    "currency" "text",
    "exchange_rate" numeric,
    "invoice_discount_type" "text",
    "invoice_discount" numeric,
    "billing_address" "text",
    "billing_phone" "text",
    "billing_fax" "text",
    "tax_office" "text",
    "tax_number" "text",
    "city" "text",
    "district" "text",
    "is_abroad" boolean,
    "order_no" "text",
    "order_date" "date",
    "sharings_count" bigint,
    "archived" boolean,
    "contact_parasut_id" bigint,
    "sales_invoice_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "net_total_in_trl" numeric,
    "vat_withholding_rate" numeric
);

ALTER TABLE "parasut"."sales_offers" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."sales_offers"
    ADD CONSTRAINT "sales_offers_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."sales_offers"
    ADD CONSTRAINT "sales_offers_pkey" PRIMARY KEY ("id");

CREATE INDEX "sales_offers_contact_parasut_id_idx" ON "parasut"."sales_offers" USING "btree" ("contact_parasut_id");

CREATE INDEX "sales_offers_sales_invoice_parasut_id_idx" ON "parasut"."sales_offers" USING "btree" ("sales_invoice_parasut_id");

ALTER TABLE "parasut"."sales_offers" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."sales_offers" TO "service_role";

-- ============ parasut.shipment_documents ============
DROP TABLE IF EXISTS "parasut"."shipment_documents" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."shipment_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "invoice_no" "text",
    "print_note" "text",
    "printed_at" timestamp with time zone,
    "inflow" boolean,
    "description" "text",
    "city" "text",
    "district" "text",
    "address" "text",
    "issue_date" "date",
    "shipment_date" "date",
    "procurement_number" "text",
    "archived" boolean,
    "contact_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "uuid" "text",
    "despatch_no" "text",
    "order_no" "text",
    "order_date" "date",
    "status" "text",
    "status_message" "text",
    "status_changed_at" timestamp with time zone,
    "carrier_legal_name" "text",
    "carrier_tax_number" "text",
    "carrier_license_plate" "text",
    "drivers_info" "jsonb",
    "postal_code" "text",
    "company_address" "text",
    "company_city" "text",
    "company_district" "text",
    "company_postal_code" "text",
    "has_invoice" boolean,
    "shipment_document_type" "text",
    "is_commercial" boolean,
    "issue_datetime" timestamp with time zone,
    "printed_issue_date" "date",
    "legalized_at" timestamp with time zone,
    "sharings_count" integer,
    "warehouse_transfer_parasut_id" bigint,
    "e_despatch_response_type" "text",
    "e_despatch_response_parasut_id" bigint,
    "inbound_e_despatch_parasut_id" bigint,
    "print_url" "text"
);

ALTER TABLE "parasut"."shipment_documents" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."shipment_documents"
    ADD CONSTRAINT "shipment_documents_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."shipment_documents"
    ADD CONSTRAINT "shipment_documents_pkey" PRIMARY KEY ("id");

CREATE INDEX "shipment_documents_contact_parasut_id_idx" ON "parasut"."shipment_documents" USING "btree" ("contact_parasut_id");

ALTER TABLE "parasut"."shipment_documents" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."shipment_documents" TO "service_role";

-- ============ parasut.stock_movements ============
DROP TABLE IF EXISTS "parasut"."stock_movements" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "detail_no" bigint,
    "date" "date",
    "quantity" numeric,
    "warehouse_parasut_id" bigint,
    "product_parasut_id" bigint,
    "source_type" "text",
    "source_parasut_id" bigint,
    "contact_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."stock_movements" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."stock_movements"
    ADD CONSTRAINT "stock_movements_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");

CREATE INDEX "stock_movements_contact_parasut_id_idx" ON "parasut"."stock_movements" USING "btree" ("contact_parasut_id");

CREATE INDEX "stock_movements_product_parasut_id_idx" ON "parasut"."stock_movements" USING "btree" ("product_parasut_id");

CREATE INDEX "stock_movements_source_parasut_id_idx" ON "parasut"."stock_movements" USING "btree" ("source_parasut_id");

CREATE INDEX "stock_movements_warehouse_parasut_id_idx" ON "parasut"."stock_movements" USING "btree" ("warehouse_parasut_id");

ALTER TABLE "parasut"."stock_movements" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."stock_movements" TO "service_role";

-- ============ parasut.stock_update_details ============
DROP TABLE IF EXISTS "parasut"."stock_update_details" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."stock_update_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "old_total_inventory" numeric,
    "new_total_inventory" numeric,
    "stock_update_parasut_id" bigint,
    "warehouse_parasut_id" bigint,
    "product_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."stock_update_details" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."stock_update_details"
    ADD CONSTRAINT "stock_update_details_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."stock_update_details"
    ADD CONSTRAINT "stock_update_details_pkey" PRIMARY KEY ("id");

CREATE INDEX "stock_update_details_product_parasut_id_idx" ON "parasut"."stock_update_details" USING "btree" ("product_parasut_id");

CREATE INDEX "stock_update_details_stock_update_parasut_id_idx" ON "parasut"."stock_update_details" USING "btree" ("stock_update_parasut_id");

CREATE INDEX "stock_update_details_warehouse_parasut_id_idx" ON "parasut"."stock_update_details" USING "btree" ("warehouse_parasut_id");

ALTER TABLE "parasut"."stock_update_details" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."stock_update_details" TO "service_role";

-- ============ parasut.stock_updates ============
DROP TABLE IF EXISTS "parasut"."stock_updates" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."stock_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."stock_updates" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."stock_updates"
    ADD CONSTRAINT "stock_updates_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."stock_updates"
    ADD CONSTRAINT "stock_updates_pkey" PRIMARY KEY ("id");

ALTER TABLE "parasut"."stock_updates" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."stock_updates" TO "service_role";

-- ============ parasut.tags ============
DROP TABLE IF EXISTS "parasut"."tags" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "name" "text",
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parasut_type" "text"
);

ALTER TABLE "parasut"."tags" OWNER TO "postgres";

COMMENT ON COLUMN "parasut"."tags"."parasut_type" IS 'Phase 13.2: verbatim runtime JSON:API item.type.';

ALTER TABLE ONLY "parasut"."tags"
    ADD CONSTRAINT "tags_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");

ALTER TABLE "parasut"."tags" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."tags" TO "service_role";

-- ============ parasut.taxes ============
DROP TABLE IF EXISTS "parasut"."taxes" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."taxes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "description" "text",
    "issue_date" "date",
    "due_date" "date",
    "net_total" numeric,
    "total_paid" numeric,
    "remaining" numeric,
    "remaining_in_trl" numeric,
    "archived" boolean,
    "category_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parasut_type" "text",
    "category_parasut_type" "text"
);

ALTER TABLE "parasut"."taxes" OWNER TO "postgres";

COMMENT ON COLUMN "parasut"."taxes"."raw" IS 'Full JSON:API resource object as returned by Parasut, verbatim. Phase 13.3: relationships.activities has no verified real-record schema for this resource type yet (SCHEMA_BLOCKED) -- preserved verbatim here, never synthesized into a fake row.';

COMMENT ON COLUMN "parasut"."taxes"."parasut_type" IS 'Phase 13.2: verbatim runtime JSON:API item.type. Swagger documents TaxAttributes.type enum as ["bank_fees"], which is a known documentation bug -- this column always stores the real runtime value regardless, never the Swagger enum.';

ALTER TABLE ONLY "parasut"."taxes"
    ADD CONSTRAINT "taxes_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."taxes"
    ADD CONSTRAINT "taxes_pkey" PRIMARY KEY ("id");

CREATE INDEX "taxes_category_parasut_id_idx" ON "parasut"."taxes" USING "btree" ("category_parasut_id");

ALTER TABLE ONLY "parasut"."tax_tags"
    ADD CONSTRAINT "tax_tags_tax_parasut_id_fkey" FOREIGN KEY ("tax_parasut_id") REFERENCES "parasut"."taxes"("parasut_id") ON DELETE CASCADE;

ALTER TABLE "parasut"."taxes" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."taxes" TO "service_role";

-- ============ parasut.trackable_jobs ============
DROP TABLE IF EXISTS "parasut"."trackable_jobs" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."trackable_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" "text" NOT NULL,
    "status" "text",
    "errors" "jsonb",
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."trackable_jobs" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."trackable_jobs"
    ADD CONSTRAINT "trackable_jobs_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."trackable_jobs"
    ADD CONSTRAINT "trackable_jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE "parasut"."trackable_jobs" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."trackable_jobs" TO "service_role";

-- ============ parasut.transactions ============
DROP TABLE IF EXISTS "parasut"."transactions" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "description" "text",
    "transaction_type" "text",
    "date" "date",
    "amount_in_trl" numeric,
    "debit_amount" numeric,
    "debit_currency" "text",
    "credit_amount" numeric,
    "credit_currency" "text",
    "debit_account_parasut_id" bigint,
    "credit_account_parasut_id" bigint,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "debit_account_type" "text",
    "credit_account_type" "text"
);

ALTER TABLE "parasut"."transactions" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."transactions"
    ADD CONSTRAINT "transactions_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");

CREATE INDEX "transactions_credit_account_parasut_id_idx" ON "parasut"."transactions" USING "btree" ("credit_account_parasut_id");

CREATE INDEX "transactions_debit_account_parasut_id_idx" ON "parasut"."transactions" USING "btree" ("debit_account_parasut_id");

ALTER TABLE "parasut"."transactions" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."transactions" TO "service_role";

-- ============ parasut.user_roles ============
DROP TABLE IF EXISTS "parasut"."user_roles" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "user_parasut_id" bigint,
    "company_parasut_id" bigint,
    "sales_invoices" "text",
    "expenditures" "text",
    "own_expenditures" "text",
    "employees" "text",
    "accounts" "text",
    "settings" "text",
    "user_role_type" "text",
    "raw" "jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parasut_type" "text",
    "company_parasut_type" "text"
);

ALTER TABLE "parasut"."user_roles" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."user_roles"
    ADD CONSTRAINT "user_roles_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");

CREATE INDEX "user_roles_company_idx" ON "parasut"."user_roles" USING "btree" ("company_parasut_id");

CREATE INDEX "user_roles_user_idx" ON "parasut"."user_roles" USING "btree" ("user_parasut_id");

GRANT ALL ON TABLE "parasut"."user_roles" TO "service_role";

-- ============ parasut.users ============
DROP TABLE IF EXISTS "parasut"."users" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "name" "text",
    "email" "text",
    "unconfirmed_email" "text",
    "is_confirmed" boolean,
    "approved_contracts" boolean,
    "approved_new_contracts" boolean,
    "integration_contract_statuses" "jsonb",
    "keycloak_tfa_enabled" boolean,
    "keycloak_email_otp_enabled" boolean,
    "raw" "jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parasut_type" "text"
);

ALTER TABLE "parasut"."users" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."users"
    ADD CONSTRAINT "users_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

GRANT ALL ON TABLE "parasut"."users" TO "service_role";

-- ============ parasut.warehouses ============
DROP TABLE IF EXISTS "parasut"."warehouses" CASCADE;

CREATE TABLE IF NOT EXISTS "parasut"."warehouses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parasut_id" bigint NOT NULL,
    "name" "text",
    "address" "text",
    "city" "text",
    "district" "text",
    "is_abroad" boolean,
    "archived" boolean,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "parasut_created_at" timestamp with time zone,
    "parasut_updated_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "parasut"."warehouses" OWNER TO "postgres";

ALTER TABLE ONLY "parasut"."warehouses"
    ADD CONSTRAINT "warehouses_parasut_id_key" UNIQUE ("parasut_id");

ALTER TABLE ONLY "parasut"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");

ALTER TABLE "parasut"."warehouses" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "parasut"."warehouses" TO "service_role";



-- This view is also a casualty: it is not one of the 11 dropped base
-- tables, but it depends on parasut.e_invoices (which survived) and was
-- also wiped. public.parasut_e_invoices_demo / _counts_demo depend on it.
CREATE OR REPLACE VIEW "parasut"."e_invoices_with_resolution" AS
 SELECT "e"."id",
    "e"."parasut_id",
    "e"."external_id",
    "e"."uuid",
    "e"."env_uuid",
    "e"."from_address",
    "e"."from_vkn",
    "e"."to_address",
    "e"."to_vkn",
    "e"."direction",
    "e"."note",
    "e"."response_type",
    "e"."contact_name",
    "e"."scenario",
    "e"."status",
    "e"."gtb_ref_no",
    "e"."gtb_registration_no",
    "e"."gtb_export_date",
    "e"."response_note",
    "e"."issue_date",
    "e"."is_expired",
    "e"."is_answerable",
    "e"."net_total",
    "e"."currency",
    "e"."item_type",
    "e"."invoice_parasut_id",
    "e"."raw",
    "e"."parasut_created_at",
    "e"."parasut_updated_at",
    "e"."synced_at",
    "e"."created_at",
    "e"."updated_at",
    "e"."archived",
    "e"."expires_at",
    "e"."html_url",
    "e"."invoice_type_code",
    "e"."is_seen",
    "e"."migration_source",
    "e"."non_standard_e_invoice",
    "e"."pdf_url",
    "e"."profile_id",
    "e"."refund_of_id",
    "e"."signed_ubl_url",
    "e"."status_code",
    "e"."status_message",
    "e"."total_vat",
    "e"."vat_exemption_reason_code",
    "e"."rendered_ubl_path",
    "e"."ubl_remote_id",
    "e"."signed_ubl_remote_id",
    "e"."parent_type",
    "e"."parent_parasut_id",
    "e"."last_seen_at",
        CASE
            WHEN ("e"."parent_type" IS NULL) THEN 'no_relationship'::"text"
            WHEN (("e"."parent_type" = 'sales_invoices'::"text") AND ("si"."parasut_id" IS NOT NULL)) THEN 'resolved'::"text"
            WHEN (("e"."parent_type" = 'purchase_bills'::"text") AND ("pb"."parasut_id" IS NOT NULL)) THEN 'resolved'::"text"
            ELSE 'unresolved'::"text"
        END AS "parent_resolution_status"
   FROM (("parasut"."e_invoices" "e"
     LEFT JOIN "parasut"."sales_invoices" "si" ON ((("e"."parent_type" = 'sales_invoices'::"text") AND ("si"."parasut_id" = "e"."parent_parasut_id"))))
     LEFT JOIN "parasut"."purchase_bills" "pb" ON ((("e"."parent_type" = 'purchase_bills'::"text") AND ("pb"."parasut_id" = "e"."parent_parasut_id"))));

ALTER VIEW "parasut"."e_invoices_with_resolution" OWNER TO "postgres";


-- RLS: restore exactly the same enable/no-enable split as the pre-incident
-- backup. Tables without an ENABLE ROW LEVEL SECURITY line here also had
-- none in the backup (they carry no anon/authenticated grants either, or
-- are audit/manifest tables read only via SELECT grants below with no
-- policies -- matching pre-incident production, not a new design choice).
ALTER TABLE "parasut"."inbound_e_despatches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parasut"."oauth_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parasut"."sales_offer_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parasut"."shipment_document_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parasut"."shipment_document_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parasut"."sync_runs" ENABLE ROW LEVEL SECURITY;

-- Grants: verbatim from the backup's own GRANT statements for these objects.
GRANT ALL ON TABLE "parasut"."employee_sync_meta" TO "service_role";
GRANT ALL ON TABLE "parasut"."inbound_e_despatches" TO "service_role";
GRANT ALL ON TABLE "parasut"."oauth_tokens" TO "service_role";
GRANT ALL ON TABLE "parasut"."relationship_manifest" TO "service_role";
GRANT SELECT ON TABLE "parasut"."relationship_manifest" TO "authenticated";
GRANT SELECT ON TABLE "parasut"."relationship_manifest" TO "anon";
GRANT ALL ON TABLE "parasut"."salary_tags" TO "service_role";
GRANT SELECT ON TABLE "parasut"."salary_tags" TO "authenticated";
GRANT SELECT ON TABLE "parasut"."salary_tags" TO "anon";
GRANT ALL ON TABLE "parasut"."sales_offer_activities" TO "service_role";
GRANT ALL ON TABLE "parasut"."shipment_document_activities" TO "service_role";
GRANT ALL ON TABLE "parasut"."shipment_document_invoices" TO "service_role";
GRANT ALL ON TABLE "parasut"."sync_runs" TO "service_role";
GRANT ALL ON TABLE "parasut"."tax_tags" TO "service_role";
GRANT SELECT ON TABLE "parasut"."tax_tags" TO "authenticated";
GRANT SELECT ON TABLE "parasut"."tax_tags" TO "anon";
GRANT ALL ON TABLE "parasut"."write_capability_manifest" TO "service_role";
GRANT ALL ON TABLE "parasut"."e_invoices_with_resolution" TO "service_role";
GRANT SELECT ON TABLE "parasut"."e_invoices_with_resolution" TO "authenticated";
GRANT SELECT ON TABLE "parasut"."e_invoices_with_resolution" TO "anon";


-- =====================================================================
-- Section B: restore all public.parasut_*_demo views (48 views), verbatim
-- from the same pre-incident backup. The entire public schema was wiped;
-- these are recreated with CREATE OR REPLACE VIEW exactly as authored.
-- =====================================================================

CREATE OR REPLACE VIEW "public"."parasut_accounts_demo" AS
 SELECT "parasut_id",
    "name",
    "account_type",
    "currency",
    "bank_name",
    "bank_branch",
    "bank_account_no",
    "iban",
    "balance",
    "archived",
    "synced_at"
   FROM "parasut"."accounts"
  ORDER BY "name";


ALTER VIEW "public"."parasut_accounts_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_checks_demo" AS
 SELECT "c"."parasut_id",
    "c"."currency",
    "c"."description",
    "c"."due_date",
    "c"."issue_date",
    "c"."net_total",
    "c"."remaining",
    "c"."remaining_in_trl",
    "c"."payment_status",
    "c"."is_cashed",
    "c"."is_in",
    "c"."is_out",
    "c"."is_transferred",
    "c"."days_overdue",
    "c"."bank_identifier",
    "c"."bank_name",
    "c"."serial_number",
    "c"."issued_by_parasut_id",
    "c"."issued_by_type",
    "issuer"."name" AS "issued_by_name",
    "c"."given_to_parasut_id",
    "c"."given_to_type",
    "recipient"."name" AS "given_to_name",
    "c"."synced_at",
    "c"."days_till_due_date",
    "c"."parasut_created_at",
    "c"."parasut_updated_at"
   FROM (("parasut"."checks" "c"
     LEFT JOIN "parasut"."contacts" "issuer" ON ((("c"."issued_by_type" = 'contacts'::"text") AND ("issuer"."parasut_id" = "c"."issued_by_parasut_id"))))
     LEFT JOIN "parasut"."contacts" "recipient" ON ((("c"."given_to_type" = 'contacts'::"text") AND ("recipient"."parasut_id" = "c"."given_to_parasut_id"))))
  ORDER BY "c"."due_date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_checks_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_company_profile_demo" AS
 SELECT "c"."parasut_id",
    "c"."parasut_type",
    "c"."name",
    "c"."legal_name",
    "c"."tax_office",
    "c"."tax_number",
    "c"."e_invoice_vkn",
    "c"."mersis_no",
    "c"."trade_registry_number",
    "c"."district",
    "c"."city",
    "c"."occupation_field",
    "c"."primary_job",
    "c"."app_url",
    "c"."logo_url",
    "c"."logo_is_processing",
    "c"."credit_balance",
    "c"."last_consumption_date",
    "c"."new_subscription_status",
    "c"."valid_until",
    "c"."e_invoicing_enabled",
    "c"."e_archiving_enabled",
    "c"."e_despatch_enabled",
    "c"."e_commerce_enabled",
    "c"."e_invoicing_activated_at",
    "c"."e_archiving_activated_at",
    "c"."e_despatch_activated_at",
    "c"."sales_offer_enabled",
    "c"."export_invoice_enabled",
    "c"."using_multiple_warehouses",
    "c"."using_variant",
    "c"."uses_credit_service",
    "c"."credit_service_enabled",
    "c"."can_use_ai_reporting",
    "c"."can_use_ai_support",
    "c"."accessible",
    "c"."inventory_enabled",
    "c"."has_iyzico_integration",
    "c"."display_exchange_rate_in_offer_pdf",
    "c"."payment_with_akbank_enabled",
    "c"."can_upload_signature",
    "c"."invoicing_preferences",
    "c"."e_smm_enabled",
    "c"."e_smm_activated_at",
    "c"."e_archiving_only_enabled",
    "c"."e_archiving_only_activated_at",
    "c"."e_archiving_only_waiting",
    "c"."using_sales_receipt",
    "c"."using_emikro_einvoice",
    "c"."using_emikro_services",
    "c"."e_invoicing_waiting",
    "c"."e_invoicing_order_details_enabled",
    "c"."email_tx_import_enabled",
    "c"."bank_sync_setup_is_bankasi_enabled",
    "c"."bank_sync_setup_ing_bank_enabled",
    "c"."bank_sync_setup_akbank_enabled",
    "c"."bank_sync_setup_denizbank_enabled",
    "c"."bank_sync_setup_kuveytturk_enabled",
    "c"."bank_sync_setup_teb_enabled",
    "c"."bank_sync_setup_finansbank_enabled",
    "c"."bank_sync_setup_fibabanka_enabled",
    "c"."bank_sync_setup_albaraka_enabled",
    "c"."bank_sync_setup_ornekbank_enabled",
    "c"."bank_sync_setup_yapikredi_enabled",
    "c"."bank_sync_setup_vakifbank_enabled",
    "c"."bank_sync_setup_enpara_enabled",
    "c"."e_commerce_integration_enabled",
    "c"."fibabanka_credit_application_enabled",
    "c"."inbound_edocument_page_enabled",
    "c"."batch_updated_vat_rates",
    "c"."invoice_note_enabled",
    "c"."has_odeal_integration",
    "c"."has_507_and_509",
    "c"."footer_aggregate_enabled",
    "c"."contact_transfer_enabled",
    "c"."pending_qr_code_migration",
    "c"."ai_support_rag",
    "c"."ai_features_enabled",
    "c"."owner_parasut_id",
    "c"."owner_parasut_type",
    "c"."default_warehouse_parasut_id",
    NULL::"text" AS "default_warehouse_parasut_type",
    "w"."name" AS "default_warehouse_name",
    "w"."archived" AS "default_warehouse_archived",
    "w"."resource_type" AS "default_warehouse_resource_type",
    "c"."address_parasut_id",
    "c"."address_parasut_type",
    "a"."name" AS "address_name",
    "a"."address" AS "address_text",
    "a"."phone" AS "address_phone",
    "a"."fax" AS "address_fax",
    "a"."parasut_type" AS "address_own_parasut_type",
    "a"."addressable_type" AS "address_addressable_type",
    "a"."addressable_parasut_id" AS "address_addressable_parasut_id",
    "a"."parasut_created_at" AS "address_created_at",
    "a"."parasut_updated_at" AS "address_updated_at",
    "c"."parasut_created_at",
    "c"."parasut_updated_at",
    "c"."synced_at"
   FROM (("parasut"."companies" "c"
     LEFT JOIN "parasut"."addresses" "a" ON (("a"."parasut_id" = "c"."address_parasut_id")))
     LEFT JOIN ( SELECT "warehouses"."parasut_id",
            "warehouses"."name",
            "warehouses"."archived",
            ("warehouses"."raw" ->> 'type'::"text") AS "resource_type"
           FROM "parasut"."warehouses") "w" ON (("w"."parasut_id" = "c"."default_warehouse_parasut_id")))
  ORDER BY "c"."parasut_id";


ALTER VIEW "public"."parasut_company_profile_demo" OWNER TO "postgres";


COMMENT ON VIEW "public"."parasut_company_profile_demo" IS 'Phase 12.4: default_warehouse_parasut_id resolved against the independent parasut.warehouses sync (join on parasut_id, which is PK+UNIQUE, so at most one match). default_warehouse_name/_archived/_resource_type come from that real warehouse record when matched, NULL otherwise -- never guessed from the id, never a SQL literal. default_warehouse_parasut_type stays NULL/BLOCKED: it represents the /me relationships.default_warehouse.data.type, which the API genuinely never returns ({"meta":{}}); default_warehouse_resource_type (the independent warehouse resources own root .type) must never be used in its place. parasut_type/owner_parasut_type/address_parasut_type unchanged from 20260901020000 (real stored columns).';



CREATE OR REPLACE VIEW "public"."parasut_contact_people_demo" AS
 SELECT "parasut_id",
    "name",
    "email",
    "phone",
    "notes",
    "contact_parasut_id",
    "resource_type",
    "contact_type",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at"
   FROM "parasut"."contact_people" "cp";


ALTER VIEW "public"."parasut_contact_people_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_contacts_demo" AS
 SELECT "parasut_id",
    "name",
    "short_name",
    "email",
    "contact_type",
    "city",
    "archived",
    "synced_at",
    "phone"
   FROM "parasut"."contacts"
  ORDER BY "name";


ALTER VIEW "public"."parasut_contacts_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_e_archives_demo" AS
 SELECT "parasut_id",
    "sales_invoice_parasut_id",
    "uuid",
    "vkn",
    "invoice_number",
    "status",
    "is_printed",
    "is_signed",
    "printed_at",
    "cancellable_until",
    "email_status",
    "note",
    "pdf_url",
    "signed_ubl_url",
    "html_url",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at",
    "migration_source"
   FROM "parasut"."e_archives" "a"
  ORDER BY "parasut_created_at" DESC NULLS LAST;


ALTER VIEW "public"."parasut_e_archives_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_e_invoice_lookup_result_counts_demo" AS
 SELECT "count"(*) AS "cached_query_result_count"
   FROM "parasut"."e_invoice_inboxes";


ALTER VIEW "public"."parasut_e_invoice_lookup_result_counts_demo" OWNER TO "postgres";


COMMENT ON VIEW "public"."parasut_e_invoice_lookup_result_counts_demo" IS 'Phase 13.4: with queried_at dropped, every row in parasut.e_invoice_inboxes by definition only ever exists because of a real per-VKN lookup (Phase 13.3 removed all unfiltered/global population of this table) -- count(*) is therefore already exactly the cached-query-result count, with no separate flag column needed.';



CREATE OR REPLACE VIEW "public"."parasut_e_invoice_lookup_results_demo" AS
 SELECT "parasut_id",
    "parasut_type",
    "vkn",
    "e_invoice_address",
    "name",
    "inbox_type",
    "address_registered_at",
    "registered_at",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at"
   FROM "parasut"."e_invoice_inboxes"
  ORDER BY "synced_at" DESC NULLS LAST, "parasut_id" DESC;


ALTER VIEW "public"."parasut_e_invoice_lookup_results_demo" OWNER TO "postgres";


COMMENT ON VIEW "public"."parasut_e_invoice_lookup_results_demo" IS 'Phase 13.4: query_vkn and queried_at no longer exist as physical columns on parasut.e_invoice_inboxes (dropped this phase) -- this view exposes only genuine Parasut-authoritative query-result fields, all 10 real swagger.json EInvoiceInboxAttributes fields (parasut_id, parasut_type, vkn, e_invoice_address, name, inbox_type, address_registered_at, registered_at, parasut_created_at/updated_at). No ERP request/audit history (erp.e_invoice_lookup_requests/_results) is ever exposed here.';



CREATE OR REPLACE VIEW "public"."parasut_e_invoices_counts_demo" AS
 SELECT "count"(*) AS "total_e_invoices",
    "count"(*) FILTER (WHERE ("parent_type" = 'sales_invoices'::"text")) AS "linked_sales_invoice_count",
    "count"(*) FILTER (WHERE ("parent_type" = 'purchase_bills'::"text")) AS "linked_purchase_bill_count",
    "count"(*) FILTER (WHERE ("parent_type" IS NULL)) AS "unlinked_count",
    "count"(*) FILTER (WHERE ("direction" = 'inbound'::"text")) AS "inbound_count",
    "count"(*) FILTER (WHERE ("direction" = 'outbound'::"text")) AS "outbound_count",
    "count"(*) FILTER (WHERE ("direction" IS NULL)) AS "unknown_direction_count",
    "count"(*) FILTER (WHERE ("archived" = true)) AS "archived_count",
    "count"(*) FILTER (WHERE ("archived" = false)) AS "active_count",
    "count"(*) FILTER (WHERE ("archived" IS NULL)) AS "null_archived_count",
    "count"(*) FILTER (WHERE (("parent_type" IS NOT NULL) AND ("parent_type" <> ALL (ARRAY['sales_invoices'::"text", 'purchase_bills'::"text"])))) AS "unresolved_relationship_count",
    "count"(*) FILTER (WHERE (("parent_resolution_status" = 'resolved'::"text") AND ("parent_type" = 'sales_invoices'::"text"))) AS "resolved_sales_relationship",
    "count"(*) FILTER (WHERE (("parent_resolution_status" = 'unresolved'::"text") AND ("parent_type" = 'sales_invoices'::"text"))) AS "unresolved_sales_relationship",
    "count"(*) FILTER (WHERE (("parent_resolution_status" = 'resolved'::"text") AND ("parent_type" = 'purchase_bills'::"text"))) AS "resolved_purchase_relationship",
    "count"(*) FILTER (WHERE (("parent_resolution_status" = 'unresolved'::"text") AND ("parent_type" = 'purchase_bills'::"text"))) AS "unresolved_purchase_relationship",
    "count"(*) FILTER (WHERE ("parent_resolution_status" = 'no_relationship'::"text")) AS "no_invoice_relationship",
    "count"(*) FILTER (WHERE ("parent_type" IS NOT NULL)) AS "total_with_relationship"
   FROM "parasut"."e_invoices_with_resolution";


ALTER VIEW "public"."parasut_e_invoices_counts_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_e_invoices_demo" AS
 SELECT "parasut_id",
    "parent_type",
    "parent_parasut_id",
    "external_id",
    "uuid",
    "direction",
    "scenario",
    "status",
    "status_code",
    "status_message",
    "item_type",
    "invoice_type_code",
    "issue_date",
    "expires_at",
    "is_expired",
    "is_answerable",
    "is_seen",
    "non_standard_e_invoice",
    "archived",
    "currency",
    "net_total",
    "total_vat",
    "contact_name",
    "from_address",
    "from_vkn",
    "to_address",
    "to_vkn",
    "note",
    "response_type",
    "env_uuid",
    "profile_id",
    "refund_of_id",
    "vat_exemption_reason_code",
    "pdf_url",
    "signed_ubl_url",
    "html_url",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at",
    "gtb_ref_no",
    "migration_source",
    "parent_resolution_status"
   FROM "parasut"."e_invoices_with_resolution" "e"
  ORDER BY "issue_date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_e_invoices_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_employee_counts_demo" AS
 SELECT "count"(*) FILTER (WHERE ("archived" = false)) AS "active_count",
    "count"(*) FILTER (WHERE ("archived" = true)) AS "archived_count",
    "count"(*) FILTER (WHERE ("archived" IS NULL)) AS "null_archived_count",
    "count"(*) AS "total_count"
   FROM "parasut"."employees";


ALTER VIEW "public"."parasut_employee_counts_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_employee_meta_demo" AS
 SELECT "resource",
    "filter_scope",
    "payable_total",
    "advance_total",
    "export_url",
    "source_total_count",
    "fetched_at"
   FROM "parasut"."employee_sync_meta"
  ORDER BY "filter_scope";


ALTER VIEW "public"."parasut_employee_meta_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_employees_demo" AS
 SELECT "parasut_id",
    "name",
    "email",
    "phone",
    "iban",
    "tckn",
    "archived",
    "employment_start_date",
    "employment_end_date",
    "balance",
    "trl_balance",
    "usd_balance",
    "eur_balance",
    "gbp_balance",
    "category_parasut_id",
    "managed_by_user_parasut_id",
    "managed_by_user_role_parasut_id",
    "managed_by_user_role_type",
    "tags_resolved",
    "activities_resolved",
    "comments_resolved",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at"
   FROM "parasut"."employees" "e"
  ORDER BY "name";


ALTER VIEW "public"."parasut_employees_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_expense_payments_demo" AS
 SELECT "p"."parasut_id",
    "p"."date",
    "p"."amount",
    "p"."currency",
    "p"."notes",
    "p"."payable_type",
    "p"."payable_parasut_id",
    "pb"."invoice_no",
    "pb"."supplier_parasut_id",
    "sup"."name" AS "supplier_name",
    "p"."transaction_parasut_id",
    "t"."description" AS "transaction_description",
    "t"."transaction_type",
    "t"."debit_account_parasut_id",
    "t"."debit_account_type",
    "da"."name" AS "debit_account_name",
    "t"."credit_account_parasut_id",
    "t"."credit_account_type",
    "ca"."name" AS "credit_account_name",
    "p"."synced_at"
   FROM ((((("parasut"."payments" "p"
     LEFT JOIN "parasut"."purchase_bills" "pb" ON ((("p"."payable_type" = 'purchase_bills'::"text") AND ("pb"."parasut_id" = "p"."payable_parasut_id"))))
     LEFT JOIN "parasut"."contacts" "sup" ON (("sup"."parasut_id" = "pb"."supplier_parasut_id")))
     LEFT JOIN "parasut"."transactions" "t" ON (("t"."parasut_id" = "p"."transaction_parasut_id")))
     LEFT JOIN "parasut"."accounts" "da" ON ((("t"."debit_account_type" = 'accounts'::"text") AND ("da"."parasut_id" = "t"."debit_account_parasut_id"))))
     LEFT JOIN "parasut"."accounts" "ca" ON ((("t"."credit_account_type" = 'accounts'::"text") AND ("ca"."parasut_id" = "t"."credit_account_parasut_id"))))
  WHERE ("p"."payable_type" = 'purchase_bills'::"text")
  ORDER BY "p"."date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_expense_payments_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_inbound_e_despatches_demo" AS
 SELECT "parasut_id",
    "shipment_document_parasut_id",
    "uuid",
    "despatch_no",
    "contact_name",
    "issue_date",
    "from_tax_number",
    "response_status",
    "response_type",
    "expires_at",
    "is_expired",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at"
   FROM "parasut"."inbound_e_despatches" "d"
  ORDER BY "shipment_document_parasut_id", "issue_date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_inbound_e_despatches_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_inventory_levels_demo" AS
 SELECT "il"."parasut_id",
    "il"."product_parasut_id",
    "p"."name" AS "product_name",
    "p"."code" AS "product_code",
    "il"."warehouse_parasut_id",
    "w"."name" AS "warehouse_name",
    "il"."stock_count",
    "il"."initial_stock_count",
    "il"."critical_stock_count",
    "il"."synced_at"
   FROM (("parasut"."inventory_levels" "il"
     LEFT JOIN "parasut"."products" "p" ON (("p"."parasut_id" = "il"."product_parasut_id")))
     LEFT JOIN "parasut"."warehouses" "w" ON (("w"."parasut_id" = "il"."warehouse_parasut_id")))
  ORDER BY "p"."name", "w"."name";


ALTER VIEW "public"."parasut_inventory_levels_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_item_categories_demo" AS
 SELECT "parasut_id",
    "parasut_type",
    "name",
    "full_path",
    "bg_color",
    "text_color",
    "category_type",
    "parent_category_parasut_id",
    "parent_category_parasut_type",
    "subcategories",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at"
   FROM "parasut"."item_categories"
  ORDER BY "full_path", "parasut_id" DESC;


ALTER VIEW "public"."parasut_item_categories_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_item_category_counts_demo" AS
 SELECT "count"(*) AS "total_count"
   FROM "parasut"."item_categories";


ALTER VIEW "public"."parasut_item_category_counts_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_payments_demo" AS
 SELECT "p"."parasut_id",
    "p"."date",
    "p"."amount",
    "p"."currency",
    "p"."notes",
    "p"."payable_type",
    "p"."payable_parasut_id",
    "si"."invoice_no",
    "si"."contact_parasut_id",
    "c"."name" AS "contact_name",
    "p"."transaction_parasut_id",
    "t"."description" AS "transaction_description",
    "t"."transaction_type",
    "t"."debit_account_parasut_id",
    "t"."debit_account_type",
    "da"."name" AS "debit_account_name",
    "t"."credit_account_parasut_id",
    "t"."credit_account_type",
    "ca"."name" AS "credit_account_name",
    "p"."synced_at",
    "p"."due_date",
    "p"."matched_amount",
    "p"."amount_in_trl",
    "p"."paid_in_currency"
   FROM ((((("parasut"."payments" "p"
     LEFT JOIN "parasut"."sales_invoices" "si" ON ((("p"."payable_type" = 'sales_invoices'::"text") AND ("si"."parasut_id" = "p"."payable_parasut_id"))))
     LEFT JOIN "parasut"."contacts" "c" ON (("c"."parasut_id" = "si"."contact_parasut_id")))
     LEFT JOIN "parasut"."transactions" "t" ON (("t"."parasut_id" = "p"."transaction_parasut_id")))
     LEFT JOIN "parasut"."accounts" "da" ON ((("t"."debit_account_type" = 'accounts'::"text") AND ("da"."parasut_id" = "t"."debit_account_parasut_id"))))
     LEFT JOIN "parasut"."accounts" "ca" ON ((("t"."credit_account_type" = 'accounts'::"text") AND ("ca"."parasut_id" = "t"."credit_account_parasut_id"))))
  ORDER BY "p"."date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_payments_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_products_demo" AS
 SELECT "p"."parasut_id",
    "p"."code",
    "p"."name",
    "p"."unit",
    "p"."barcode",
    "p"."vat_rate",
    "p"."list_price",
    "p"."currency",
    "p"."buying_price",
    "p"."buying_currency",
    "p"."inventory_tracking",
    "p"."initial_stock_count",
    "p"."stock_count",
    "p"."archived",
    "p"."category_parasut_id",
    "c"."name" AS "category_name",
    "p"."synced_at"
   FROM ("parasut"."products" "p"
     LEFT JOIN "parasut"."item_categories" "c" ON (("c"."parasut_id" = "p"."category_parasut_id")))
  ORDER BY "p"."name";


ALTER VIEW "public"."parasut_products_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_purchase_bill_counts_demo" AS
 SELECT "count"(*) FILTER (WHERE ("archived" = false)) AS "active_count",
    "count"(*) FILTER (WHERE ("archived" = true)) AS "archived_count",
    "count"(*) FILTER (WHERE ("archived" IS NULL)) AS "null_archived_count",
    "count"(*) AS "total_count"
   FROM "parasut"."purchase_bills";


ALTER VIEW "public"."parasut_purchase_bill_counts_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_purchase_bill_details_demo" AS
 SELECT "d"."parasut_id",
    "d"."purchase_bill_parasut_id",
    "d"."description",
    "d"."quantity",
    "d"."unit_price",
    "d"."vat_rate",
    "d"."discount_type",
    "d"."discount_value",
    "d"."net_total",
    "d"."product_parasut_id",
    "p"."name" AS "product_name",
    "d"."synced_at"
   FROM ("parasut"."purchase_bill_details" "d"
     LEFT JOIN "parasut"."products" "p" ON (("p"."parasut_id" = "d"."product_parasut_id")))
  ORDER BY "d"."purchase_bill_parasut_id", "d"."parasut_id";


ALTER VIEW "public"."parasut_purchase_bill_details_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_purchase_bills_demo" AS
 SELECT "pb"."parasut_id",
    "pb"."invoice_no",
    "pb"."item_type",
    "pb"."description",
    "pb"."issue_date",
    "pb"."due_date",
    "pb"."currency",
    "pb"."exchange_rate",
    "pb"."net_total",
    "pb"."gross_total",
    "pb"."total_vat",
    "pb"."total_discount",
    "pb"."total_paid",
    "pb"."remaining",
    "pb"."remaining_in_trl",
    "pb"."payment_status",
    "pb"."archived",
    "pb"."supplier_parasut_id",
    "sup"."name" AS "supplier_name",
    "pb"."spender_parasut_id",
    "spd"."name" AS "spender_name",
    "pb"."pay_to_parasut_id",
    COALESCE("pay_to_contact"."name", "pay_to_employee"."name") AS "pay_to_name",
    "pb"."synced_at",
    "pb"."active_e_document_type",
    "pb"."active_e_document_parasut_id"
   FROM (((("parasut"."purchase_bills" "pb"
     LEFT JOIN "parasut"."contacts" "sup" ON (("sup"."parasut_id" = "pb"."supplier_parasut_id")))
     LEFT JOIN "parasut"."employees" "spd" ON (("spd"."parasut_id" = "pb"."spender_parasut_id")))
     LEFT JOIN "parasut"."contacts" "pay_to_contact" ON (("pay_to_contact"."parasut_id" = "pb"."pay_to_parasut_id")))
     LEFT JOIN "parasut"."employees" "pay_to_employee" ON (("pay_to_employee"."parasut_id" = "pb"."pay_to_parasut_id")))
  ORDER BY "pb"."issue_date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_purchase_bills_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_relationship_manifest_demo" AS
 SELECT "resource",
    "relationship_key",
    "state",
    "notes",
    "updated_at"
   FROM "parasut"."relationship_manifest";


ALTER VIEW "public"."parasut_relationship_manifest_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_salaries_demo" AS
 SELECT "parasut_id",
    "parasut_type",
    "description",
    "currency",
    "issue_date",
    "due_date",
    "exchange_rate",
    "net_total",
    "total_paid",
    "remaining",
    "remaining_in_trl",
    "archived",
    "employee_parasut_id",
    "employee_parasut_type",
    "category_parasut_id",
    "category_parasut_type",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at"
   FROM "parasut"."salaries"
  ORDER BY "issue_date" DESC NULLS LAST, "parasut_id" DESC;


ALTER VIEW "public"."parasut_salaries_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_salary_counts_demo" AS
 SELECT "count"(*) FILTER (WHERE ("archived" = false)) AS "active_count",
    "count"(*) FILTER (WHERE ("archived" = true)) AS "archived_count",
    "count"(*) AS "total_count"
   FROM "parasut"."salaries";


ALTER VIEW "public"."parasut_salary_counts_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_salary_tags_demo" AS
 SELECT "st"."salary_parasut_id",
    "st"."tag_parasut_id",
    "st"."tag_type",
    "t"."name" AS "tag_name",
    "st"."synced_at"
   FROM ("parasut"."salary_tags" "st"
     LEFT JOIN "parasut"."tags" "t" ON (("t"."parasut_id" = "st"."tag_parasut_id")));


ALTER VIEW "public"."parasut_salary_tags_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_sales_invoice_counts_demo" AS
 SELECT "count"(*) FILTER (WHERE (("archived" = false) AND ("item_type" IS DISTINCT FROM 'cancelled'::"text"))) AS "list_active_count",
    "count"(*) FILTER (WHERE ("archived" = true)) AS "archived_count",
    "count"(*) FILTER (WHERE ("archived" IS NULL)) AS "null_archived_count",
    "count"(*) FILTER (WHERE ("item_type" = 'cancelled'::"text")) AS "cancelled_count",
    "count"(*) FILTER (WHERE (("archived" = true) AND ("item_type" = 'cancelled'::"text"))) AS "archived_cancelled_count",
    "count"(*) FILTER (WHERE (("archived" = true) AND ("item_type" IS DISTINCT FROM 'cancelled'::"text"))) AS "non_cancelled_archived_count",
    "count"(*) FILTER (WHERE ("item_type" = 'invoice'::"text")) AS "invoice_item_type_count",
    "count"(*) FILTER (WHERE (("item_type" IS NOT NULL) AND ("item_type" <> ALL (ARRAY['invoice'::"text", 'cancelled'::"text"])))) AS "other_item_type_count",
    "count"(*) FILTER (WHERE ("item_type" IS NULL)) AS "null_item_type_count",
    "count"(DISTINCT "parasut_id") AS "total_unique_count",
    "count"(*) AS "total_count"
   FROM "parasut"."sales_invoices";


ALTER VIEW "public"."parasut_sales_invoice_counts_demo" OWNER TO "postgres";


COMMENT ON VIEW "public"."parasut_sales_invoice_counts_demo" IS 'Phase 14.5: every real dimension/overlap (archived, item_type, and their intersections) is its own named counter computed directly by this view. The frontend must read a counter by name and never derive one by subtracting another or by summing dimensions that can overlap (e.g. total is never active+archived+cancelled).';



CREATE OR REPLACE VIEW "public"."parasut_sales_invoice_details_demo" AS
 SELECT "d"."parasut_id",
    "d"."sales_invoice_parasut_id",
    "d"."description",
    "d"."quantity",
    "d"."unit_price",
    "d"."vat_rate",
    "d"."discount_type",
    "d"."discount_value",
    "d"."net_total",
    "d"."product_parasut_id",
    "p"."name" AS "product_name",
    "d"."synced_at"
   FROM ("parasut"."sales_invoice_details" "d"
     LEFT JOIN "parasut"."products" "p" ON (("p"."parasut_id" = "d"."product_parasut_id")))
  ORDER BY "d"."sales_invoice_parasut_id", "d"."parasut_id";


ALTER VIEW "public"."parasut_sales_invoice_details_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_sales_invoices_demo" AS
 SELECT "si"."parasut_id",
    "si"."invoice_no",
    "si"."item_type",
    "si"."description",
    "si"."issue_date",
    "si"."due_date",
    "si"."currency",
    "si"."exchange_rate",
    "si"."net_total",
    "si"."gross_total",
    "si"."total_vat",
    "si"."total_discount",
    "si"."before_taxes_total",
    "si"."remaining",
    "si"."remaining_in_trl",
    "si"."payment_status",
    "si"."billing_address",
    "si"."billing_postal_code",
    "si"."billing_phone",
    "si"."tax_office",
    "si"."tax_number",
    "si"."country",
    "si"."city",
    "si"."district",
    "si"."is_abroad",
    "si"."order_no",
    "si"."order_date",
    "si"."invoice_note",
    "si"."archived",
    "si"."contact_parasut_id",
    "c"."name" AS "contact_name",
    "si"."synced_at",
    "si"."active_e_document_type",
    "si"."active_e_document_parasut_id"
   FROM ("parasut"."sales_invoices" "si"
     LEFT JOIN "parasut"."contacts" "c" ON (("c"."parasut_id" = "si"."contact_parasut_id")))
  ORDER BY "si"."issue_date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_sales_invoices_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_sales_offer_activities_demo" AS
 SELECT "parasut_id",
    "sales_offer_parasut_id",
    "activity_type",
    "date",
    "data_description",
    "data_issue_date",
    "data_due_date",
    "data_net_total",
    "data_currency",
    "data_content",
    "data_status",
    "data_contact_id",
    "data_contact_name",
    "done_by_email",
    "done_by_parasut_id",
    "done_by_type",
    "done_by_name",
    "done_by_user_email",
    "item_parasut_id",
    "item_type",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at"
   FROM "parasut"."sales_offer_activities" "a"
  ORDER BY "sales_offer_parasut_id", "date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_sales_offer_activities_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_sales_offer_details_demo" AS
 SELECT "d"."parasut_id",
    "d"."sales_offer_parasut_id",
    "d"."description",
    "d"."detail_no",
    "d"."quantity",
    "d"."unit_price",
    "d"."vat_rate",
    "d"."vat_withholding",
    "d"."vat_withholding_rate",
    "d"."discount_type",
    "d"."discount_value",
    "d"."discount",
    "d"."invoice_discount",
    "d"."excise_duty_type",
    "d"."excise_duty",
    "d"."excise_duty_rate",
    "d"."excise_duty_value",
    "d"."communications_tax_rate",
    "d"."communications_tax",
    "d"."accommodation_tax_rate",
    "d"."accommodation_tax",
    "d"."accommodation_tax_exempt",
    "d"."net_total",
    "d"."net_total_without_invoice_discount",
    "d"."product_parasut_id",
    "p"."name" AS "product_name",
    "d"."parasut_created_at",
    "d"."parasut_updated_at",
    "d"."synced_at"
   FROM ("parasut"."sales_offer_details" "d"
     LEFT JOIN "parasut"."products" "p" ON (("p"."parasut_id" = "d"."product_parasut_id")))
  ORDER BY "d"."sales_offer_parasut_id", "d"."detail_no", "d"."parasut_id";


ALTER VIEW "public"."parasut_sales_offer_details_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_sales_offers_demo" AS
 SELECT "o"."parasut_id",
    "o"."description",
    "o"."content",
    "o"."status",
    "o"."issue_date",
    "o"."due_date",
    "o"."currency",
    "o"."exchange_rate",
    "o"."net_total",
    "o"."net_total_in_trl",
    "o"."gross_total",
    "o"."total_vat",
    "o"."total_discount",
    "o"."total_invoice_discount",
    "o"."invoice_discount_type",
    "o"."invoice_discount",
    "o"."withholding",
    "o"."withholding_rate",
    "o"."vat_withholding",
    "o"."vat_withholding_rate",
    "o"."total_vat_withholding",
    "o"."total_excise_duty",
    "o"."total_communications_tax",
    "o"."total_accommodation_tax",
    "o"."billing_address",
    "o"."billing_phone",
    "o"."billing_fax",
    "o"."tax_office",
    "o"."tax_number",
    "o"."city",
    "o"."district",
    "o"."is_abroad",
    "o"."order_no",
    "o"."order_date",
    "o"."sharings_count",
    "o"."display_exchange_rate_in_pdf",
    "o"."contact_type",
    "o"."archived",
    "o"."contact_parasut_id",
    "c"."name" AS "contact_name",
    "o"."sales_invoice_parasut_id",
    "si"."invoice_no" AS "sales_invoice_no",
    "o"."parasut_created_at",
    "o"."parasut_updated_at",
    "o"."synced_at"
   FROM (("parasut"."sales_offers" "o"
     LEFT JOIN "parasut"."contacts" "c" ON (("c"."parasut_id" = "o"."contact_parasut_id")))
     LEFT JOIN "parasut"."sales_invoices" "si" ON (("si"."parasut_id" = "o"."sales_invoice_parasut_id")))
  ORDER BY "o"."issue_date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_sales_offers_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_shipment_document_activities_demo" AS
 SELECT "parasut_id",
    "shipment_document_parasut_id",
    "activity_type",
    "date",
    "data_description",
    "data_issue_date",
    "done_by_email",
    "done_by_parasut_id",
    "done_by_type",
    "done_by_name",
    "done_by_user_email",
    "item_parasut_id",
    "item_type",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at"
   FROM "parasut"."shipment_document_activities" "a"
  ORDER BY "shipment_document_parasut_id", "date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_shipment_document_activities_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_shipment_document_counts_demo" AS
 SELECT "count"(*) FILTER (WHERE ("archived" = false)) AS "active_count",
    "count"(*) FILTER (WHERE ("archived" = true)) AS "archived_count",
    "count"(*) FILTER (WHERE ("archived" IS NULL)) AS "null_archived_count",
    "count"(*) AS "total_count"
   FROM "parasut"."shipment_documents";


ALTER VIEW "public"."parasut_shipment_document_counts_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_shipment_document_invoices_demo" AS
 SELECT "i"."shipment_document_parasut_id",
    "i"."sales_invoice_parasut_id",
    "si"."invoice_no" AS "sales_invoice_no",
    "i"."synced_at"
   FROM ("parasut"."shipment_document_invoices" "i"
     LEFT JOIN "parasut"."sales_invoices" "si" ON (("si"."parasut_id" = "i"."sales_invoice_parasut_id")))
  ORDER BY "i"."shipment_document_parasut_id";


ALTER VIEW "public"."parasut_shipment_document_invoices_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_shipment_documents_demo" AS
 SELECT "s"."parasut_id",
    "s"."description",
    "s"."uuid",
    "s"."despatch_no",
    "s"."order_no",
    "s"."order_date",
    "s"."status",
    "s"."status_message",
    "s"."status_changed_at",
    "s"."shipment_document_type",
    "s"."inflow",
    "s"."is_commercial",
    "s"."issue_date",
    "s"."issue_datetime",
    "s"."shipment_date",
    "s"."printed_issue_date",
    "s"."printed_at",
    "s"."print_note",
    "s"."legalized_at",
    "s"."sharings_count",
    "s"."has_invoice",
    "s"."invoice_no",
    "s"."procurement_number",
    "s"."carrier_legal_name",
    "s"."carrier_tax_number",
    "s"."carrier_license_plate",
    "s"."drivers_info",
    "s"."address",
    "s"."city",
    "s"."district",
    "s"."postal_code",
    "s"."company_address",
    "s"."company_city",
    "s"."company_district",
    "s"."company_postal_code",
    "s"."archived",
    "s"."contact_parasut_id",
    "c"."name" AS "contact_name",
    "s"."warehouse_transfer_parasut_id",
    "s"."e_despatch_response_type",
    "s"."e_despatch_response_parasut_id",
    "s"."inbound_e_despatch_parasut_id",
    "s"."parasut_created_at",
    "s"."parasut_updated_at",
    "s"."synced_at",
    "s"."print_url"
   FROM ("parasut"."shipment_documents" "s"
     LEFT JOIN "parasut"."contacts" "c" ON (("c"."parasut_id" = "s"."contact_parasut_id")))
  ORDER BY "s"."issue_date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_shipment_documents_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_stock_movements_demo" AS
 SELECT "sm"."parasut_id",
    "sm"."date",
    "sm"."quantity",
    "sm"."product_parasut_id",
    "p"."name" AS "product_name",
    "sm"."warehouse_parasut_id",
    "w"."name" AS "warehouse_name",
    "sm"."source_type",
    "sm"."source_parasut_id",
    "sm"."contact_parasut_id",
    "ct"."name" AS "contact_name",
    "sm"."synced_at"
   FROM ((("parasut"."stock_movements" "sm"
     LEFT JOIN "parasut"."products" "p" ON (("p"."parasut_id" = "sm"."product_parasut_id")))
     LEFT JOIN "parasut"."warehouses" "w" ON (("w"."parasut_id" = "sm"."warehouse_parasut_id")))
     LEFT JOIN "parasut"."contacts" "ct" ON (("ct"."parasut_id" = "sm"."contact_parasut_id")))
  ORDER BY "sm"."date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_stock_movements_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_suppliers_demo" AS
 SELECT "parasut_id",
    "name",
    "short_name",
    "email",
    "phone",
    "city",
    "archived",
    "synced_at",
    "account_type"
   FROM "parasut"."contacts"
  WHERE ("account_type" = 'supplier'::"text")
  ORDER BY "name";


ALTER VIEW "public"."parasut_suppliers_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_sync_status_demo" AS
 SELECT DISTINCT ON ("resource") "resource",
    "status",
    "dry_run",
    "started_at",
    "finished_at",
    "fetched_count",
    "upserted_count",
    "error_count",
    "error_message",
    "active_fetched_count",
    "archived_fetched_count",
    "detail_fetched_count",
    "detail_upserted_count",
    "unresolved_count"
   FROM "parasut"."sync_runs"
  ORDER BY "resource", "started_at" DESC;


ALTER VIEW "public"."parasut_sync_status_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_tag_counts_demo" AS
 SELECT "count"(*) AS "total_count"
   FROM "parasut"."tags";


ALTER VIEW "public"."parasut_tag_counts_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_tags_demo" AS
 SELECT "parasut_id",
    "parasut_type",
    "name",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at"
   FROM "parasut"."tags"
  ORDER BY "name";


ALTER VIEW "public"."parasut_tags_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_tax_counts_demo" AS
 SELECT "count"(*) FILTER (WHERE ("archived" = false)) AS "active_count",
    "count"(*) FILTER (WHERE ("archived" = true)) AS "archived_count",
    "count"(*) AS "total_count"
   FROM "parasut"."taxes";


ALTER VIEW "public"."parasut_tax_counts_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_tax_tags_demo" AS
 SELECT "tt"."tax_parasut_id",
    "tt"."tag_parasut_id",
    "tt"."tag_type",
    "t"."name" AS "tag_name",
    "tt"."synced_at"
   FROM ("parasut"."tax_tags" "tt"
     LEFT JOIN "parasut"."tags" "t" ON (("t"."parasut_id" = "tt"."tag_parasut_id")));


ALTER VIEW "public"."parasut_tax_tags_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_taxes_demo" AS
 SELECT "parasut_id",
    "parasut_type",
    "description",
    "issue_date",
    "due_date",
    "net_total",
    "total_paid",
    "remaining",
    "remaining_in_trl",
    "archived",
    "category_parasut_id",
    "category_parasut_type",
    "parasut_created_at",
    "parasut_updated_at",
    "synced_at"
   FROM "parasut"."taxes"
  ORDER BY "issue_date" DESC NULLS LAST, "parasut_id" DESC;


ALTER VIEW "public"."parasut_taxes_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_transactions_demo" AS
 SELECT "t"."parasut_id",
    "t"."description",
    "t"."transaction_type",
    "t"."date",
    "t"."amount_in_trl",
    "t"."debit_amount",
    "t"."debit_currency",
    "t"."debit_account_parasut_id",
    "t"."debit_account_type",
    "da"."name" AS "debit_account_name",
    "dc"."name" AS "debit_contact_name",
    "t"."credit_amount",
    "t"."credit_currency",
    "t"."credit_account_parasut_id",
    "t"."credit_account_type",
    "ca"."name" AS "credit_account_name",
    "cc"."name" AS "credit_contact_name",
    "t"."synced_at"
   FROM (((("parasut"."transactions" "t"
     LEFT JOIN "parasut"."accounts" "da" ON ((("t"."debit_account_type" = 'accounts'::"text") AND ("da"."parasut_id" = "t"."debit_account_parasut_id"))))
     LEFT JOIN "parasut"."contacts" "dc" ON ((("t"."debit_account_type" = 'contacts'::"text") AND ("dc"."parasut_id" = "t"."debit_account_parasut_id"))))
     LEFT JOIN "parasut"."accounts" "ca" ON ((("t"."credit_account_type" = 'accounts'::"text") AND ("ca"."parasut_id" = "t"."credit_account_parasut_id"))))
     LEFT JOIN "parasut"."contacts" "cc" ON ((("t"."credit_account_type" = 'contacts'::"text") AND ("cc"."parasut_id" = "t"."credit_account_parasut_id"))))
  ORDER BY "t"."date" DESC NULLS LAST;


ALTER VIEW "public"."parasut_transactions_demo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parasut_user_company_relation_demo" AS
 SELECT "u"."parasut_id" AS "user_parasut_id",
    "u"."parasut_type" AS "user_parasut_type",
    "u"."name" AS "user_name",
    "u"."email" AS "user_email",
    "u"."parasut_created_at" AS "user_created_at",
    "u"."parasut_updated_at" AS "user_updated_at",
    "p"."parasut_id" AS "profile_parasut_id",
    "p"."parasut_type" AS "profile_parasut_type",
    "p"."phone" AS "user_phone",
    "ur"."parasut_id" AS "relation_parasut_id",
    "ur"."parasut_type" AS "relation_parasut_type",
    "ur"."company_parasut_id",
    "ur"."company_parasut_type"
   FROM (("parasut"."user_roles" "ur"
     JOIN "parasut"."users" "u" ON (("u"."parasut_id" = "ur"."user_parasut_id")))
     LEFT JOIN "parasut"."profiles" "p" ON (("p"."user_parasut_id" = "ur"."user_parasut_id")))
  ORDER BY "ur"."parasut_id";


ALTER VIEW "public"."parasut_user_company_relation_demo" OWNER TO "postgres";


COMMENT ON VIEW "public"."parasut_user_company_relation_demo" IS 'Post-Phase-12.2 audit fix: company_parasut_type now read from the real stored column (relationships.company.data.type) instead of a SQL literal. See migration 20260901010000 header.';



CREATE OR REPLACE VIEW "public"."parasut_warehouses_demo" AS
 SELECT "parasut_id",
    "name",
    "address",
    "city",
    "district",
    "archived",
    "synced_at"
   FROM "parasut"."warehouses"
  ORDER BY "name";


ALTER VIEW "public"."parasut_warehouses_demo" OWNER TO "postgres";


-- =====================================================================
-- Section C: grants for the 48 restored public.parasut_*_demo views,
-- verbatim from the backup (GRANT ALL to anon/authenticated/service_role,
-- matching production as it stood after the 20260906200539 /
-- 20260906200827 grant-tightening migrations already applied before this
-- backup was taken).
-- =====================================================================

GRANT ALL ON TABLE "public"."parasut_accounts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_accounts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_accounts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_checks_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_checks_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_checks_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_company_profile_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_company_profile_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_company_profile_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_contact_people_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_contact_people_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_contact_people_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_contacts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_contacts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_contacts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_e_archives_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_e_archives_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_e_archives_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_e_invoice_lookup_result_counts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_e_invoice_lookup_result_counts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_e_invoice_lookup_result_counts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_e_invoice_lookup_results_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_e_invoice_lookup_results_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_e_invoice_lookup_results_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_e_invoices_counts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_e_invoices_counts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_e_invoices_counts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_e_invoices_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_e_invoices_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_e_invoices_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_employee_counts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_employee_counts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_employee_counts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_employee_meta_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_employee_meta_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_employee_meta_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_employees_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_employees_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_employees_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_expense_payments_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_expense_payments_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_expense_payments_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_inbound_e_despatches_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_inbound_e_despatches_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_inbound_e_despatches_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_inventory_levels_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_inventory_levels_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_inventory_levels_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_item_categories_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_item_categories_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_item_categories_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_item_category_counts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_item_category_counts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_item_category_counts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_payments_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_payments_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_payments_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_products_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_products_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_products_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_purchase_bill_counts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_purchase_bill_counts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_purchase_bill_counts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_purchase_bill_details_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_purchase_bill_details_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_purchase_bill_details_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_purchase_bills_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_purchase_bills_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_purchase_bills_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_relationship_manifest_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_relationship_manifest_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_relationship_manifest_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_salaries_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_salaries_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_salaries_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_salary_counts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_salary_counts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_salary_counts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_salary_tags_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_salary_tags_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_salary_tags_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_sales_invoice_counts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_sales_invoice_counts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_sales_invoice_counts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_sales_invoice_details_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_sales_invoice_details_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_sales_invoice_details_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_sales_invoices_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_sales_invoices_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_sales_invoices_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_sales_offer_activities_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_sales_offer_activities_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_sales_offer_activities_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_sales_offer_details_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_sales_offer_details_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_sales_offer_details_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_sales_offers_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_sales_offers_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_sales_offers_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_shipment_document_activities_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_shipment_document_activities_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_shipment_document_activities_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_shipment_document_counts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_shipment_document_counts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_shipment_document_counts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_shipment_document_invoices_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_shipment_document_invoices_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_shipment_document_invoices_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_shipment_documents_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_shipment_documents_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_shipment_documents_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_stock_movements_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_stock_movements_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_stock_movements_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_suppliers_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_suppliers_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_suppliers_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_sync_status_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_sync_status_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_sync_status_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_tag_counts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_tag_counts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_tag_counts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_tags_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_tags_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_tags_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_tax_counts_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_tax_counts_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_tax_counts_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_tax_tags_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_tax_tags_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_tax_tags_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_taxes_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_taxes_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_taxes_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_transactions_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_transactions_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_transactions_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_user_company_relation_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_user_company_relation_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_user_company_relation_demo" TO "service_role";
GRANT ALL ON TABLE "public"."parasut_warehouses_demo" TO "anon";
GRANT ALL ON TABLE "public"."parasut_warehouses_demo" TO "authenticated";
GRANT ALL ON TABLE "public"."parasut_warehouses_demo" TO "service_role";
