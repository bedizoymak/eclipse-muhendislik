


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "parasut";


ALTER SCHEMA "parasut" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "parasut_ops";


ALTER SCHEMA "parasut_ops" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "parasut"."cleanup_stale_sync_locks"() RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'parasut', 'pg_temp'
    AS $$
  with cleared as (
    update parasut.sync_runs
    set status = 'error',
        finished_at = now(),
        error_message = 'Phase 13.4: stale running lock auto-cleared by cleanup_stale_sync_locks() (started > 10 minutes ago, never reached finishRun)'
    where status = 'running'
      and started_at < now() - interval '10 minutes'
    returning id
  )
  select count(*)::integer from cleared;
$$;


ALTER FUNCTION "parasut"."cleanup_stale_sync_locks"() OWNER TO "postgres";


COMMENT ON FUNCTION "parasut"."cleanup_stale_sync_locks"() IS 'Phase 13.4: reusable, idempotent stale-lock self-heal -- replaces Phase 13.3''s one-off manual UPDATE migration. Called defensively by the Edge Function before acquiring a new run''s lock.';



CREATE OR REPLACE FUNCTION "parasut"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'parasut'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "parasut"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "parasut"."upsert_e_invoices_standalone"("payload" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'parasut', 'public'
    AS $$
declare
  affected integer;
begin
  with incoming as (
    select
      (r->>'parasut_id')::bigint as parasut_id,
      r->>'external_id' as external_id,
      r->>'uuid' as uuid,
      r->>'env_uuid' as env_uuid,
      r->>'from_address' as from_address,
      r->>'from_vkn' as from_vkn,
      r->>'to_address' as to_address,
      r->>'to_vkn' as to_vkn,
      r->>'direction' as direction,
      r->>'note' as note,
      r->>'response_type' as response_type,
      r->>'contact_name' as contact_name,
      r->>'scenario' as scenario,
      r->>'status' as status,
      r->>'status_code' as status_code,
      r->>'status_message' as status_message,
      (r->>'issue_date')::date as issue_date,
      (r->>'expires_at')::date as expires_at,
      (r->>'is_expired')::boolean as is_expired,
      (r->>'is_answerable')::boolean as is_answerable,
      (r->>'is_seen')::boolean as is_seen,
      (r->>'net_total')::numeric as net_total,
      (r->>'total_vat')::numeric as total_vat,
      r->>'currency' as currency,
      r->>'item_type' as item_type,
      r->>'invoice_type_code' as invoice_type_code,
      (r->>'non_standard_e_invoice')::boolean as non_standard_e_invoice,
      (r->>'archived')::boolean as archived,
      r->>'migration_source' as migration_source,
      r->>'profile_id' as profile_id,
      (r->>'refund_of_id')::bigint as refund_of_id,
      r->>'vat_exemption_reason_code' as vat_exemption_reason_code,
      r->>'pdf_url' as pdf_url,
      r->>'signed_ubl_url' as signed_ubl_url,
      r->>'html_url' as html_url,
      r->>'rendered_ubl_path' as rendered_ubl_path,
      r->>'ubl_remote_id' as ubl_remote_id,
      r->>'signed_ubl_remote_id' as signed_ubl_remote_id,
      r->>'parent_type' as parent_type,
      (r->>'parent_parasut_id')::bigint as parent_parasut_id,
      coalesce((r->>'relationship_carried')::boolean, false) as relationship_carried,
      (r->'raw')::jsonb as raw,
      (r->>'parasut_created_at')::timestamptz as parasut_created_at,
      (r->>'parasut_updated_at')::timestamptz as parasut_updated_at
    from jsonb_array_elements(payload) as r
  ),
  -- ON CONFLICT DO UPDATE can only see `excluded.<real insert column>`, so
  -- relationship_carried (not a table column) cannot be read there directly.
  -- Resolve the final parent_type/parent_parasut_id HERE instead, using the
  -- existing stored row (left-joined by parasut_id) when relationship_carried
  -- is false, and the fresh incoming value (including a real null) when true.
  resolved as (
    select
      i.*,
      case when i.relationship_carried then i.parent_type else coalesce(i.parent_type, e.parent_type) end as final_parent_type,
      case when i.relationship_carried then i.parent_parasut_id else coalesce(i.parent_parasut_id, e.parent_parasut_id) end as final_parent_parasut_id
    from incoming i
    left join parasut.e_invoices e on e.parasut_id = i.parasut_id
  ),
  upserted as (
    insert into parasut.e_invoices as e (
      parasut_id, external_id, uuid, env_uuid, from_address, from_vkn, to_address, to_vkn,
      direction, note, response_type, contact_name, scenario, status, status_code, status_message,
      issue_date, expires_at, is_expired, is_answerable, is_seen, net_total, total_vat, currency,
      item_type, invoice_type_code, non_standard_e_invoice, archived, migration_source, profile_id,
      refund_of_id, vat_exemption_reason_code, pdf_url, signed_ubl_url, html_url, rendered_ubl_path,
      ubl_remote_id, signed_ubl_remote_id, parent_type, parent_parasut_id, raw,
      parasut_created_at, parasut_updated_at, synced_at, last_seen_at
    )
    select
      parasut_id, external_id, uuid, env_uuid, from_address, from_vkn, to_address, to_vkn,
      direction, note, response_type, contact_name, scenario, status, status_code, status_message,
      issue_date, expires_at, is_expired, is_answerable, is_seen, net_total, total_vat, currency,
      item_type, invoice_type_code, non_standard_e_invoice, archived, migration_source, profile_id,
      refund_of_id, vat_exemption_reason_code, pdf_url, signed_ubl_url, html_url, rendered_ubl_path,
      ubl_remote_id, signed_ubl_remote_id, final_parent_type, final_parent_parasut_id, raw,
      parasut_created_at, parasut_updated_at, now(), now()
    from resolved
    on conflict (parasut_id) do update set
      external_id = excluded.external_id,
      uuid = excluded.uuid,
      env_uuid = excluded.env_uuid,
      from_address = excluded.from_address,
      from_vkn = excluded.from_vkn,
      to_address = excluded.to_address,
      to_vkn = excluded.to_vkn,
      direction = excluded.direction,
      note = excluded.note,
      response_type = excluded.response_type,
      contact_name = excluded.contact_name,
      scenario = excluded.scenario,
      status = excluded.status,
      status_code = excluded.status_code,
      status_message = excluded.status_message,
      issue_date = excluded.issue_date,
      expires_at = excluded.expires_at,
      is_expired = excluded.is_expired,
      is_answerable = excluded.is_answerable,
      is_seen = excluded.is_seen,
      net_total = excluded.net_total,
      total_vat = excluded.total_vat,
      currency = excluded.currency,
      item_type = excluded.item_type,
      invoice_type_code = excluded.invoice_type_code,
      non_standard_e_invoice = excluded.non_standard_e_invoice,
      archived = excluded.archived,
      migration_source = excluded.migration_source,
      profile_id = excluded.profile_id,
      refund_of_id = excluded.refund_of_id,
      vat_exemption_reason_code = excluded.vat_exemption_reason_code,
      pdf_url = excluded.pdf_url,
      signed_ubl_url = excluded.signed_ubl_url,
      html_url = excluded.html_url,
      rendered_ubl_path = excluded.rendered_ubl_path,
      ubl_remote_id = excluded.ubl_remote_id,
      signed_ubl_remote_id = excluded.signed_ubl_remote_id,
      -- Phase 14.4 fix: `excluded.parent_type`/`excluded.parent_parasut_id`
      -- here are already the fully-resolved `final_parent_type`/
      -- `final_parent_parasut_id` values computed in the `resolved` CTE
      -- above (relationship_carried can't be read here -- it isn't a real
      -- table column, so ON CONFLICT can't see it via `excluded`). That
      -- resolution already applied the real rule: when this call's own
      -- read genuinely carried the relationship (always true for
      -- syncEInvoicesStandalone, since it always requests include=invoice),
      -- the fresh value wins outright -- INCLUDING writing a real null over
      -- a previously stored non-null value, because that null is itself
      -- real, current API evidence, not a gap. So a plain overwrite here is
      -- correct and never re-introduces the old blanket COALESCE bug.
      parent_type = excluded.parent_type,
      parent_parasut_id = excluded.parent_parasut_id,
      raw = excluded.raw,
      parasut_created_at = excluded.parasut_created_at,
      parasut_updated_at = excluded.parasut_updated_at,
      synced_at = now(),
      last_seen_at = now()
    returning 1
  )
  select count(*) into affected from upserted;
  return affected;
end;
$$;


ALTER FUNCTION "parasut"."upsert_e_invoices_standalone"("payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "parasut"."upsert_e_invoices_standalone"("payload" "jsonb") IS 'Phase 14.4: parent_type/parent_parasut_id are overwritten unconditionally (including to null) when the payload row carries relationship_carried=true, since syncEInvoicesStandalone always requests include=invoice and therefore always has genuine relationship evidence. Falls back to Phase 14.2 COALESCE-preserve only when relationship_carried=false.';



CREATE OR REPLACE FUNCTION "parasut_ops"."dispatch_next_step"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
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


ALTER FUNCTION "parasut_ops"."dispatch_next_step"() OWNER TO "postgres";


COMMENT ON FUNCTION "parasut_ops"."dispatch_next_step"() IS 'Phase 14.7: transaction-safe cycle/step dispatcher. Each call is one short transaction; never polls net._http_response in the same transaction that created the request. Scheduled every minute by pg_cron.';



CREATE OR REPLACE FUNCTION "parasut_ops"."run_scheduled_parasut_sync"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
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


ALTER FUNCTION "parasut_ops"."run_scheduled_parasut_sync"() OWNER TO "postgres";


COMMENT ON FUNCTION "parasut_ops"."run_scheduled_parasut_sync"() IS 'DEPRECATED as of Phase 14.7: polled net._http_response inside the same transaction that created the request, which pg_net never resolves. Not scheduled. Superseded by parasut_ops.dispatch_next_step().';



CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


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



CREATE TABLE IF NOT EXISTS "parasut"."salary_tags" (
    "salary_parasut_id" bigint NOT NULL,
    "tag_parasut_id" bigint NOT NULL,
    "tag_type" "text" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "parasut"."salary_tags" OWNER TO "postgres";


COMMENT ON TABLE "parasut"."salary_tags" IS 'Phase 13.2: junction for the real Salary.relationships.tags to-many relationship. tag_type is the real relationships.tags.data[].type value, never a hardcoded "tags" constant. Refreshed (diffed against the current source list) on every sync of the parent salary; rows for tags removed at the source are deleted, not left stale.';



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



CREATE TABLE IF NOT EXISTS "parasut"."tax_tags" (
    "tax_parasut_id" bigint NOT NULL,
    "tag_parasut_id" bigint NOT NULL,
    "tag_type" "text" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "parasut"."tax_tags" OWNER TO "postgres";


COMMENT ON TABLE "parasut"."tax_tags" IS 'Phase 13.2: junction for the real Tax.relationships.tags to-many relationship. Same rules as parasut.salary_tags.';



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



CREATE TABLE IF NOT EXISTS "parasut_ops"."scheduled_sync_cycles" (
    "id" bigint NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "total_steps" integer NOT NULL,
    "completed_steps" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "scheduled_sync_cycles_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'error'::"text"])))
);


ALTER TABLE "parasut_ops"."scheduled_sync_cycles" OWNER TO "postgres";


COMMENT ON TABLE "parasut_ops"."scheduled_sync_cycles" IS 'Phase 14.7: one row per full scheduled Parasut sync pass across all resources. status=success only when every step succeeded or was cleanly blocked (409); any real step failure finalizes as error.';



ALTER TABLE "parasut_ops"."scheduled_sync_cycles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "parasut_ops"."scheduled_sync_cycles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "parasut_ops"."scheduled_sync_log" (
    "id" bigint NOT NULL,
    "run_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resource" "text" NOT NULL,
    "http_status" integer,
    "waited_seconds" integer,
    "request_id" bigint
);


ALTER TABLE "parasut_ops"."scheduled_sync_log" OWNER TO "postgres";


COMMENT ON TABLE "parasut_ops"."scheduled_sync_log" IS 'Phase 14.6: one row per resource per scheduled sync cron tick. Audit trail for the server-side pg_cron + pg_net Parasut sync; parasut.sync_runs remains the source of truth for per-resource fetch/upsert results.';



ALTER TABLE "parasut_ops"."scheduled_sync_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "parasut_ops"."scheduled_sync_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "parasut_ops"."scheduled_sync_steps" (
    "id" bigint NOT NULL,
    "cycle_id" bigint NOT NULL,
    "resource" "text" NOT NULL,
    "ordinal" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "request_id" bigint,
    "enqueued_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "http_status" integer,
    "error_summary" "text",
    "fetched_count" integer,
    "upserted_count" integer,
    "error_count" integer,
    CONSTRAINT "scheduled_sync_steps_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'enqueued'::"text", 'success'::"text", 'failed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "parasut_ops"."scheduled_sync_steps" OWNER TO "postgres";


COMMENT ON TABLE "parasut_ops"."scheduled_sync_steps" IS 'Phase 14.7: one row per resource per scheduled_sync_cycles row. error_summary is a truncated, credential-free message only (never a raw response body or header).';



ALTER TABLE "parasut_ops"."scheduled_sync_steps" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "parasut_ops"."scheduled_sync_steps_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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


ALTER TABLE ONLY "parasut"."accounts"
    ADD CONSTRAINT "accounts_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."addresses"
    ADD CONSTRAINT "addresses_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."bank_fees"
    ADD CONSTRAINT "bank_fees_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."bank_fees"
    ADD CONSTRAINT "bank_fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."checks"
    ADD CONSTRAINT "checks_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."checks"
    ADD CONSTRAINT "checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."companies"
    ADD CONSTRAINT "companies_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."contact_people"
    ADD CONSTRAINT "contact_people_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."contact_people"
    ADD CONSTRAINT "contact_people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."contacts"
    ADD CONSTRAINT "contacts_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."e_archives"
    ADD CONSTRAINT "e_archives_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."e_archives"
    ADD CONSTRAINT "e_archives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."e_invoice_inboxes"
    ADD CONSTRAINT "e_invoice_inboxes_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."e_invoice_inboxes"
    ADD CONSTRAINT "e_invoice_inboxes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."e_invoices"
    ADD CONSTRAINT "e_invoices_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."e_invoices"
    ADD CONSTRAINT "e_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."e_smms"
    ADD CONSTRAINT "e_smms_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."e_smms"
    ADD CONSTRAINT "e_smms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."employee_sync_meta"
    ADD CONSTRAINT "employee_sync_meta_pkey" PRIMARY KEY ("resource", "filter_scope");



ALTER TABLE ONLY "parasut"."employees"
    ADD CONSTRAINT "employees_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."inbound_e_despatches"
    ADD CONSTRAINT "inbound_e_despatches_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."inbound_e_despatches"
    ADD CONSTRAINT "inbound_e_despatches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."inventory_levels"
    ADD CONSTRAINT "inventory_levels_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."inventory_levels"
    ADD CONSTRAINT "inventory_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."item_categories"
    ADD CONSTRAINT "item_categories_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."item_categories"
    ADD CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("connection");



ALTER TABLE ONLY "parasut"."payments"
    ADD CONSTRAINT "payments_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."products"
    ADD CONSTRAINT "products_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."profiles"
    ADD CONSTRAINT "profiles_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."purchase_bill_details"
    ADD CONSTRAINT "purchase_bill_details_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."purchase_bill_details"
    ADD CONSTRAINT "purchase_bill_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."purchase_bills"
    ADD CONSTRAINT "purchase_bills_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."purchase_bills"
    ADD CONSTRAINT "purchase_bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."relationship_manifest"
    ADD CONSTRAINT "relationship_manifest_pkey" PRIMARY KEY ("resource", "relationship_key");



ALTER TABLE ONLY "parasut"."salaries"
    ADD CONSTRAINT "salaries_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."salaries"
    ADD CONSTRAINT "salaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."salary_tags"
    ADD CONSTRAINT "salary_tags_unique" UNIQUE ("salary_parasut_id", "tag_parasut_id", "tag_type");



ALTER TABLE ONLY "parasut"."sales_invoice_details"
    ADD CONSTRAINT "sales_invoice_details_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."sales_invoice_details"
    ADD CONSTRAINT "sales_invoice_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."sales_offer_activities"
    ADD CONSTRAINT "sales_offer_activities_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."sales_offer_activities"
    ADD CONSTRAINT "sales_offer_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."sales_offer_details"
    ADD CONSTRAINT "sales_offer_details_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."sales_offer_details"
    ADD CONSTRAINT "sales_offer_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."sales_offers"
    ADD CONSTRAINT "sales_offers_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."sales_offers"
    ADD CONSTRAINT "sales_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."shipment_document_activities"
    ADD CONSTRAINT "shipment_document_activities_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."shipment_document_activities"
    ADD CONSTRAINT "shipment_document_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."shipment_document_invoices"
    ADD CONSTRAINT "shipment_document_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."shipment_document_invoices"
    ADD CONSTRAINT "shipment_document_invoices_unique" UNIQUE ("shipment_document_parasut_id", "sales_invoice_parasut_id");



ALTER TABLE ONLY "parasut"."shipment_documents"
    ADD CONSTRAINT "shipment_documents_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."shipment_documents"
    ADD CONSTRAINT "shipment_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."stock_movements"
    ADD CONSTRAINT "stock_movements_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."stock_update_details"
    ADD CONSTRAINT "stock_update_details_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."stock_update_details"
    ADD CONSTRAINT "stock_update_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."stock_updates"
    ADD CONSTRAINT "stock_updates_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."stock_updates"
    ADD CONSTRAINT "stock_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."sync_runs"
    ADD CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."tags"
    ADD CONSTRAINT "tags_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."tax_tags"
    ADD CONSTRAINT "tax_tags_unique" UNIQUE ("tax_parasut_id", "tag_parasut_id", "tag_type");



ALTER TABLE ONLY "parasut"."taxes"
    ADD CONSTRAINT "taxes_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."taxes"
    ADD CONSTRAINT "taxes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."trackable_jobs"
    ADD CONSTRAINT "trackable_jobs_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."trackable_jobs"
    ADD CONSTRAINT "trackable_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."transactions"
    ADD CONSTRAINT "transactions_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."user_roles"
    ADD CONSTRAINT "user_roles_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."users"
    ADD CONSTRAINT "users_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."warehouses"
    ADD CONSTRAINT "warehouses_parasut_id_key" UNIQUE ("parasut_id");



ALTER TABLE ONLY "parasut"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut"."write_capability_manifest"
    ADD CONSTRAINT "write_capability_manifest_pkey" PRIMARY KEY ("resource", "operation");



ALTER TABLE ONLY "parasut_ops"."scheduled_sync_cycles"
    ADD CONSTRAINT "scheduled_sync_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut_ops"."scheduled_sync_log"
    ADD CONSTRAINT "scheduled_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "parasut_ops"."scheduled_sync_steps"
    ADD CONSTRAINT "scheduled_sync_steps_cycle_id_resource_key" UNIQUE ("cycle_id", "resource");



ALTER TABLE ONLY "parasut_ops"."scheduled_sync_steps"
    ADD CONSTRAINT "scheduled_sync_steps_pkey" PRIMARY KEY ("id");



CREATE INDEX "addresses_addressable_parasut_id_idx" ON "parasut"."addresses" USING "btree" ("addressable_parasut_id");



CREATE INDEX "bank_fees_category_parasut_id_idx" ON "parasut"."bank_fees" USING "btree" ("category_parasut_id");



CREATE INDEX "checks_given_to_parasut_id_idx" ON "parasut"."checks" USING "btree" ("given_to_parasut_id");



CREATE INDEX "checks_issued_by_parasut_id_idx" ON "parasut"."checks" USING "btree" ("issued_by_parasut_id");



CREATE INDEX "contact_people_contact_parasut_id_idx" ON "parasut"."contact_people" USING "btree" ("contact_parasut_id");



CREATE INDEX "contacts_category_parasut_id_idx" ON "parasut"."contacts" USING "btree" ("category_parasut_id");



CREATE INDEX "e_archives_sales_invoice_parasut_id_idx" ON "parasut"."e_archives" USING "btree" ("sales_invoice_parasut_id");



CREATE INDEX "e_invoices_invoice_parasut_id_idx" ON "parasut"."e_invoices" USING "btree" ("invoice_parasut_id");



CREATE INDEX "e_invoices_parent_idx" ON "parasut"."e_invoices" USING "btree" ("parent_type", "parent_parasut_id");



CREATE INDEX "e_smms_sales_invoice_parasut_id_idx" ON "parasut"."e_smms" USING "btree" ("sales_invoice_parasut_id");



CREATE INDEX "employees_archived_idx" ON "parasut"."employees" USING "btree" ("archived");



CREATE INDEX "employees_category_parasut_id_idx" ON "parasut"."employees" USING "btree" ("category_parasut_id");



CREATE INDEX "inbound_e_despatches_shipment_document_parasut_id_idx" ON "parasut"."inbound_e_despatches" USING "btree" ("shipment_document_parasut_id");



CREATE INDEX "inventory_levels_product_parasut_id_idx" ON "parasut"."inventory_levels" USING "btree" ("product_parasut_id");



CREATE INDEX "inventory_levels_warehouse_parasut_id_idx" ON "parasut"."inventory_levels" USING "btree" ("warehouse_parasut_id");



CREATE INDEX "item_categories_parent_category_parasut_id_idx" ON "parasut"."item_categories" USING "btree" ("parent_category_parasut_id");



CREATE INDEX "payments_payable_parasut_id_idx" ON "parasut"."payments" USING "btree" ("payable_parasut_id");



CREATE INDEX "payments_transaction_parasut_id_idx" ON "parasut"."payments" USING "btree" ("transaction_parasut_id");



CREATE INDEX "products_category_parasut_id_idx" ON "parasut"."products" USING "btree" ("category_parasut_id");



CREATE INDEX "profiles_user_idx" ON "parasut"."profiles" USING "btree" ("user_parasut_id");



CREATE INDEX "purchase_bill_details_product_parasut_id_idx" ON "parasut"."purchase_bill_details" USING "btree" ("product_parasut_id");



CREATE INDEX "purchase_bill_details_purchase_bill_parasut_id_idx" ON "parasut"."purchase_bill_details" USING "btree" ("purchase_bill_parasut_id");



CREATE INDEX "purchase_bill_details_warehouse_parasut_id_idx" ON "parasut"."purchase_bill_details" USING "btree" ("warehouse_parasut_id");



CREATE INDEX "purchase_bills_active_e_document_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("active_e_document_parasut_id");



CREATE INDEX "purchase_bills_category_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("category_parasut_id");



CREATE INDEX "purchase_bills_pay_to_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("pay_to_parasut_id");



CREATE INDEX "purchase_bills_recurrence_plan_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("recurrence_plan_parasut_id");



CREATE INDEX "purchase_bills_spender_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("spender_parasut_id");



CREATE INDEX "purchase_bills_supplier_parasut_id_idx" ON "parasut"."purchase_bills" USING "btree" ("supplier_parasut_id");



CREATE INDEX "salaries_category_parasut_id_idx" ON "parasut"."salaries" USING "btree" ("category_parasut_id");



CREATE INDEX "salaries_employee_parasut_id_idx" ON "parasut"."salaries" USING "btree" ("employee_parasut_id");



CREATE INDEX "sales_invoice_details_product_parasut_id_idx" ON "parasut"."sales_invoice_details" USING "btree" ("product_parasut_id");



CREATE INDEX "sales_invoice_details_sales_invoice_parasut_id_idx" ON "parasut"."sales_invoice_details" USING "btree" ("sales_invoice_parasut_id");



CREATE INDEX "sales_invoice_details_warehouse_parasut_id_idx" ON "parasut"."sales_invoice_details" USING "btree" ("warehouse_parasut_id");



CREATE INDEX "sales_invoices_active_e_document_parasut_id_idx" ON "parasut"."sales_invoices" USING "btree" ("active_e_document_parasut_id");



CREATE INDEX "sales_invoices_category_parasut_id_idx" ON "parasut"."sales_invoices" USING "btree" ("category_parasut_id");



CREATE INDEX "sales_invoices_contact_parasut_id_idx" ON "parasut"."sales_invoices" USING "btree" ("contact_parasut_id");



CREATE INDEX "sales_invoices_recurrence_plan_parasut_id_idx" ON "parasut"."sales_invoices" USING "btree" ("recurrence_plan_parasut_id");



CREATE INDEX "sales_invoices_sales_offer_parasut_id_idx" ON "parasut"."sales_invoices" USING "btree" ("sales_offer_parasut_id");



CREATE INDEX "sales_offer_activities_sales_offer_parasut_id_idx" ON "parasut"."sales_offer_activities" USING "btree" ("sales_offer_parasut_id");



CREATE INDEX "sales_offer_details_product_parasut_id_idx" ON "parasut"."sales_offer_details" USING "btree" ("product_parasut_id");



CREATE INDEX "sales_offer_details_sales_offer_parasut_id_idx" ON "parasut"."sales_offer_details" USING "btree" ("sales_offer_parasut_id");



CREATE INDEX "sales_offers_contact_parasut_id_idx" ON "parasut"."sales_offers" USING "btree" ("contact_parasut_id");



CREATE INDEX "sales_offers_sales_invoice_parasut_id_idx" ON "parasut"."sales_offers" USING "btree" ("sales_invoice_parasut_id");



CREATE INDEX "shipment_document_activities_shipment_document_parasut_id_idx" ON "parasut"."shipment_document_activities" USING "btree" ("shipment_document_parasut_id");



CREATE INDEX "shipment_document_invoices_shipment_document_idx" ON "parasut"."shipment_document_invoices" USING "btree" ("shipment_document_parasut_id");



CREATE INDEX "shipment_documents_contact_parasut_id_idx" ON "parasut"."shipment_documents" USING "btree" ("contact_parasut_id");



CREATE INDEX "stock_movements_contact_parasut_id_idx" ON "parasut"."stock_movements" USING "btree" ("contact_parasut_id");



CREATE INDEX "stock_movements_product_parasut_id_idx" ON "parasut"."stock_movements" USING "btree" ("product_parasut_id");



CREATE INDEX "stock_movements_source_parasut_id_idx" ON "parasut"."stock_movements" USING "btree" ("source_parasut_id");



CREATE INDEX "stock_movements_warehouse_parasut_id_idx" ON "parasut"."stock_movements" USING "btree" ("warehouse_parasut_id");



CREATE INDEX "stock_update_details_product_parasut_id_idx" ON "parasut"."stock_update_details" USING "btree" ("product_parasut_id");



CREATE INDEX "stock_update_details_stock_update_parasut_id_idx" ON "parasut"."stock_update_details" USING "btree" ("stock_update_parasut_id");



CREATE INDEX "stock_update_details_warehouse_parasut_id_idx" ON "parasut"."stock_update_details" USING "btree" ("warehouse_parasut_id");



CREATE UNIQUE INDEX "sync_runs_one_running_per_resource_idx" ON "parasut"."sync_runs" USING "btree" ("resource") WHERE ("status" = 'running'::"text");



CREATE INDEX "sync_runs_resource_started_at_idx" ON "parasut"."sync_runs" USING "btree" ("resource", "started_at" DESC);



CREATE INDEX "taxes_category_parasut_id_idx" ON "parasut"."taxes" USING "btree" ("category_parasut_id");



CREATE INDEX "transactions_credit_account_parasut_id_idx" ON "parasut"."transactions" USING "btree" ("credit_account_parasut_id");



CREATE INDEX "transactions_debit_account_parasut_id_idx" ON "parasut"."transactions" USING "btree" ("debit_account_parasut_id");



CREATE INDEX "user_roles_company_idx" ON "parasut"."user_roles" USING "btree" ("company_parasut_id");



CREATE INDEX "user_roles_user_idx" ON "parasut"."user_roles" USING "btree" ("user_parasut_id");



CREATE UNIQUE INDEX "scheduled_sync_cycles_one_running" ON "parasut_ops"."scheduled_sync_cycles" USING "btree" ((1)) WHERE ("status" = 'running'::"text");



CREATE OR REPLACE TRIGGER "accounts_updated_at" BEFORE UPDATE ON "parasut"."accounts" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "addresses_updated_at" BEFORE UPDATE ON "parasut"."addresses" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "bank_fees_updated_at" BEFORE UPDATE ON "parasut"."bank_fees" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "checks_updated_at" BEFORE UPDATE ON "parasut"."checks" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "companies_updated_at" BEFORE UPDATE ON "parasut"."companies" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "contact_people_updated_at" BEFORE UPDATE ON "parasut"."contact_people" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "contacts_updated_at" BEFORE UPDATE ON "parasut"."contacts" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "e_archives_updated_at" BEFORE UPDATE ON "parasut"."e_archives" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "e_invoice_inboxes_updated_at" BEFORE UPDATE ON "parasut"."e_invoice_inboxes" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "e_invoices_updated_at" BEFORE UPDATE ON "parasut"."e_invoices" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "e_smms_updated_at" BEFORE UPDATE ON "parasut"."e_smms" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "employees_updated_at" BEFORE UPDATE ON "parasut"."employees" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "inbound_e_despatches_updated_at" BEFORE UPDATE ON "parasut"."inbound_e_despatches" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "inventory_levels_updated_at" BEFORE UPDATE ON "parasut"."inventory_levels" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "item_categories_updated_at" BEFORE UPDATE ON "parasut"."item_categories" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "oauth_tokens_updated_at" BEFORE UPDATE ON "parasut"."oauth_tokens" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payments_updated_at" BEFORE UPDATE ON "parasut"."payments" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "products_updated_at" BEFORE UPDATE ON "parasut"."products" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "purchase_bill_details_updated_at" BEFORE UPDATE ON "parasut"."purchase_bill_details" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "purchase_bills_updated_at" BEFORE UPDATE ON "parasut"."purchase_bills" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "salaries_updated_at" BEFORE UPDATE ON "parasut"."salaries" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sales_invoice_details_updated_at" BEFORE UPDATE ON "parasut"."sales_invoice_details" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sales_invoices_updated_at" BEFORE UPDATE ON "parasut"."sales_invoices" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sales_offer_activities_updated_at" BEFORE UPDATE ON "parasut"."sales_offer_activities" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sales_offer_details_updated_at" BEFORE UPDATE ON "parasut"."sales_offer_details" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sales_offers_updated_at" BEFORE UPDATE ON "parasut"."sales_offers" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "shipment_document_activities_updated_at" BEFORE UPDATE ON "parasut"."shipment_document_activities" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "shipment_documents_updated_at" BEFORE UPDATE ON "parasut"."shipment_documents" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "stock_movements_updated_at" BEFORE UPDATE ON "parasut"."stock_movements" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "stock_update_details_updated_at" BEFORE UPDATE ON "parasut"."stock_update_details" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "stock_updates_updated_at" BEFORE UPDATE ON "parasut"."stock_updates" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tags_updated_at" BEFORE UPDATE ON "parasut"."tags" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "taxes_updated_at" BEFORE UPDATE ON "parasut"."taxes" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trackable_jobs_updated_at" BEFORE UPDATE ON "parasut"."trackable_jobs" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "transactions_updated_at" BEFORE UPDATE ON "parasut"."transactions" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



CREATE OR REPLACE TRIGGER "warehouses_updated_at" BEFORE UPDATE ON "parasut"."warehouses" FOR EACH ROW EXECUTE FUNCTION "parasut"."set_updated_at"();



ALTER TABLE ONLY "parasut"."salary_tags"
    ADD CONSTRAINT "salary_tags_salary_parasut_id_fkey" FOREIGN KEY ("salary_parasut_id") REFERENCES "parasut"."salaries"("parasut_id") ON DELETE CASCADE;



ALTER TABLE ONLY "parasut"."tax_tags"
    ADD CONSTRAINT "tax_tags_tax_parasut_id_fkey" FOREIGN KEY ("tax_parasut_id") REFERENCES "parasut"."taxes"("parasut_id") ON DELETE CASCADE;



ALTER TABLE ONLY "parasut_ops"."scheduled_sync_steps"
    ADD CONSTRAINT "scheduled_sync_steps_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "parasut_ops"."scheduled_sync_cycles"("id") ON DELETE CASCADE;



ALTER TABLE "parasut"."accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."bank_fees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."contact_people" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."e_archives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."e_invoice_inboxes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."e_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."e_smms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."inbound_e_despatches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."inventory_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."item_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."oauth_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."purchase_bill_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."purchase_bills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."salaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."sales_invoice_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."sales_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."sales_offer_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."sales_offer_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."sales_offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."shipment_document_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."shipment_document_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."shipment_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."stock_update_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."stock_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."sync_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."taxes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."trackable_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "parasut"."warehouses" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "parasut" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "parasut"."cleanup_stale_sync_locks"() TO "service_role";



REVOKE ALL ON FUNCTION "parasut"."upsert_e_invoices_standalone"("payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "parasut"."upsert_e_invoices_standalone"("payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "parasut_ops"."dispatch_next_step"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "parasut_ops"."run_scheduled_parasut_sync"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON TABLE "parasut"."accounts" TO "service_role";



GRANT ALL ON TABLE "parasut"."addresses" TO "service_role";



GRANT ALL ON TABLE "parasut"."bank_fees" TO "service_role";



GRANT ALL ON TABLE "parasut"."checks" TO "service_role";



GRANT ALL ON TABLE "parasut"."companies" TO "service_role";



GRANT ALL ON TABLE "parasut"."contact_people" TO "service_role";



GRANT ALL ON TABLE "parasut"."contacts" TO "service_role";



GRANT ALL ON TABLE "parasut"."e_archives" TO "service_role";



GRANT ALL ON TABLE "parasut"."e_invoice_inboxes" TO "service_role";



GRANT ALL ON TABLE "parasut"."e_invoices" TO "service_role";



GRANT ALL ON TABLE "parasut"."purchase_bills" TO "service_role";



GRANT ALL ON TABLE "parasut"."sales_invoices" TO "service_role";



GRANT ALL ON TABLE "parasut"."e_invoices_with_resolution" TO "service_role";
GRANT SELECT ON TABLE "parasut"."e_invoices_with_resolution" TO "authenticated";
GRANT SELECT ON TABLE "parasut"."e_invoices_with_resolution" TO "anon";



GRANT ALL ON TABLE "parasut"."e_smms" TO "service_role";



GRANT ALL ON TABLE "parasut"."employee_sync_meta" TO "service_role";



GRANT ALL ON TABLE "parasut"."employees" TO "service_role";



GRANT ALL ON TABLE "parasut"."inbound_e_despatches" TO "service_role";



GRANT ALL ON TABLE "parasut"."inventory_levels" TO "service_role";



GRANT ALL ON TABLE "parasut"."item_categories" TO "service_role";



GRANT ALL ON TABLE "parasut"."oauth_tokens" TO "service_role";



GRANT ALL ON TABLE "parasut"."payments" TO "service_role";



GRANT ALL ON TABLE "parasut"."products" TO "service_role";



GRANT ALL ON TABLE "parasut"."profiles" TO "service_role";



GRANT ALL ON TABLE "parasut"."purchase_bill_details" TO "service_role";



GRANT ALL ON TABLE "parasut"."relationship_manifest" TO "service_role";
GRANT SELECT ON TABLE "parasut"."relationship_manifest" TO "authenticated";
GRANT SELECT ON TABLE "parasut"."relationship_manifest" TO "anon";



GRANT ALL ON TABLE "parasut"."salaries" TO "service_role";



GRANT ALL ON TABLE "parasut"."salary_tags" TO "service_role";
GRANT SELECT ON TABLE "parasut"."salary_tags" TO "authenticated";
GRANT SELECT ON TABLE "parasut"."salary_tags" TO "anon";



GRANT ALL ON TABLE "parasut"."sales_invoice_details" TO "service_role";



GRANT ALL ON TABLE "parasut"."sales_offer_activities" TO "service_role";



GRANT ALL ON TABLE "parasut"."sales_offer_details" TO "service_role";



GRANT ALL ON TABLE "parasut"."sales_offers" TO "service_role";



GRANT ALL ON TABLE "parasut"."shipment_document_activities" TO "service_role";



GRANT ALL ON TABLE "parasut"."shipment_document_invoices" TO "service_role";



GRANT ALL ON TABLE "parasut"."shipment_documents" TO "service_role";



GRANT ALL ON TABLE "parasut"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "parasut"."stock_update_details" TO "service_role";



GRANT ALL ON TABLE "parasut"."stock_updates" TO "service_role";



GRANT ALL ON TABLE "parasut"."sync_runs" TO "service_role";



GRANT ALL ON TABLE "parasut"."tags" TO "service_role";



GRANT ALL ON TABLE "parasut"."tax_tags" TO "service_role";
GRANT SELECT ON TABLE "parasut"."tax_tags" TO "authenticated";
GRANT SELECT ON TABLE "parasut"."tax_tags" TO "anon";



GRANT ALL ON TABLE "parasut"."taxes" TO "service_role";



GRANT ALL ON TABLE "parasut"."trackable_jobs" TO "service_role";



GRANT ALL ON TABLE "parasut"."transactions" TO "service_role";



GRANT ALL ON TABLE "parasut"."user_roles" TO "service_role";



GRANT ALL ON TABLE "parasut"."users" TO "service_role";



GRANT ALL ON TABLE "parasut"."warehouses" TO "service_role";



GRANT ALL ON TABLE "parasut"."write_capability_manifest" TO "service_role";



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



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "parasut" GRANT ALL ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







