// Phase 15 domain 10 -- tags-and-settings. Public read function backing
// /ayarlar/etiketler(/:id), /sirket-bilgileri.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery } from "../_shared/query.ts";

const TAG_COLUMNS = "parasut_id, parasut_type, name, parasut_created_at, parasut_updated_at, synced_at";
// Company profile / user-company-relation views are already fully
// column-curated (every column is a real, non-sensitive company/profile
// attribute -- no IBAN/TCKN-equivalent field exists on either) but the
// frontend previously called `.select("*")` directly; this hardcodes the
// exact column set from the view definition so a future column addition to
// the view can never silently widen what this function returns.
const COMPANY_COLUMNS =
  "parasut_id, parasut_type, name, legal_name, tax_office, tax_number, e_invoice_vkn, mersis_no, trade_registry_number, district, city, occupation_field, primary_job, app_url, logo_url, logo_is_processing, credit_balance, last_consumption_date, new_subscription_status, valid_until, e_invoicing_enabled, e_archiving_enabled, e_despatch_enabled, e_commerce_enabled, e_invoicing_activated_at, e_archiving_activated_at, e_despatch_activated_at, sales_offer_enabled, export_invoice_enabled, using_multiple_warehouses, using_variant, uses_credit_service, credit_service_enabled, can_use_ai_reporting, can_use_ai_support, accessible, inventory_enabled, has_iyzico_integration, display_exchange_rate_in_offer_pdf, payment_with_akbank_enabled, can_upload_signature, invoicing_preferences, e_smm_enabled, e_smm_activated_at, e_archiving_only_enabled, e_archiving_only_activated_at, e_archiving_only_waiting, using_sales_receipt, using_emikro_einvoice, using_emikro_services, e_invoicing_waiting, e_invoicing_order_details_enabled, email_tx_import_enabled, bank_sync_setup_is_bankasi_enabled, bank_sync_setup_ing_bank_enabled, bank_sync_setup_akbank_enabled, bank_sync_setup_denizbank_enabled, bank_sync_setup_kuveytturk_enabled, bank_sync_setup_teb_enabled, bank_sync_setup_finansbank_enabled, bank_sync_setup_fibabanka_enabled, bank_sync_setup_albaraka_enabled, bank_sync_setup_ornekbank_enabled, bank_sync_setup_yapikredi_enabled, bank_sync_setup_vakifbank_enabled, bank_sync_setup_enpara_enabled, e_commerce_integration_enabled, fibabanka_credit_application_enabled, inbound_edocument_page_enabled, batch_updated_vat_rates, invoice_note_enabled, has_odeal_integration, has_507_and_509, footer_aggregate_enabled, contact_transfer_enabled, pending_qr_code_migration, ai_support_rag, ai_features_enabled, owner_parasut_id, owner_parasut_type, default_warehouse_parasut_id, default_warehouse_parasut_type, default_warehouse_name, default_warehouse_archived, default_warehouse_resource_type, address_parasut_id, address_parasut_type, address_name, address_text, address_phone, address_fax, address_own_parasut_type, address_addressable_type, address_addressable_parasut_id, address_created_at, address_updated_at, parasut_created_at, parasut_updated_at, synced_at";
const USER_COMPANY_RELATION_COLUMNS =
  "user_parasut_id, user_parasut_type, user_name, user_email, user_created_at, user_updated_at, profile_parasut_id, profile_parasut_type, user_phone, relation_parasut_id, relation_parasut_type, company_parasut_id, company_parasut_type";

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const auth = authorize(req);
  if (!auth.ok) return errorResponse(auth.code, cors);

  let body: Record<string, unknown> | null = null;
  try {
    body = req.method === "POST" ? await req.json() : null;
  } catch {
    return errorResponse("invalid_params", cors);
  }

  const action = body?.["action"];
  const db = serviceClient();

  try {
    switch (action) {
      case "tags.counts": {
        const { data, error } = await db.from("parasut_tag_counts_demo").select("*").maybeSingle();
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: data ?? {} }, 200, cors);
      }
      case "tags.list": {
        const parsed = parseListParams(body, ["name"] as const, { column: "name", direction: "asc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: "parasut_tags_demo",
          columns: TAG_COLUMNS,
          page: parsed.page,
          pageSize: parsed.pageSize,
          sort: parsed.sort,
        });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        return jsonResponse(res.result, 200, cors);
      }
      case "tags.get": {
        const id = Number(body?.["id"]);
        if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);
        const res = await runGetQuery(db, { view: "parasut_tags_demo", columns: TAG_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }

      case "company.get": {
        const [companyRes, relationRes] = await Promise.all([
          db.from("parasut_company_profile_demo").select(COMPANY_COLUMNS).maybeSingle(),
          db.from("parasut_user_company_relation_demo").select(USER_COMPANY_RELATION_COLUMNS).maybeSingle(),
        ]);
        if (companyRes.error) return errorResponse("internal_error", cors, companyRes.error);
        if (relationRes.error) return errorResponse("internal_error", cors, relationRes.error);
        return jsonResponse({ data: { company: companyRes.data ?? null, userCompanyRelation: relationRes.data ?? null } }, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
