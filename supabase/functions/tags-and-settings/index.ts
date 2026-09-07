// Phase 15 domain 10 -- tags-and-settings. Public read function backing
// /ayarlar/etiketler(/:id), /sirket-bilgileri.
//
// Phase 15.1: migrated off the `public.parasut_*_demo` views onto the
// `parasut.*` base tables (see the design note at the top of
// ../_shared/query.ts). Breakdown of the four views this domain used:
//   * parasut_tags_demo            -- plain passthrough of parasut.tags
//                                     (its `ORDER BY name` is already the
//                                     explicit default sort on tags.list, and
//                                     tags.get returns a single row), so it
//                                     goes through the shared helpers with
//                                     `schema: "parasut"`.
//   * parasut_tag_counts_demo      -- `count(*) FROM parasut.tags`; replaced
//                                     by a head-only exact count.
//   * parasut_company_profile_demo -- companies LEFT JOIN addresses LEFT JOIN
//                                     a warehouses subquery; replicated
//                                     explicitly below (fetch + merge).
//   * parasut_user_company_relation_demo -- user_roles INNER JOIN users LEFT
//                                     JOIN profiles; replicated explicitly.
// The response envelope and field allow-lists are unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery } from "../_shared/query.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "parasut";
const TAGS_TABLE = "tags";

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

// --------------------------------------------------------------------------
// company.get -- explicit replication of public.parasut_company_profile_demo
// --------------------------------------------------------------------------
// The view is:
//   parasut.companies c
//     LEFT JOIN parasut.addresses a  ON a.parasut_id = c.address_parasut_id
//     LEFT JOIN (SELECT parasut_id, name, archived, raw->>'type' AS resource_type
//                  FROM parasut.warehouses) w
//                                    ON w.parasut_id = c.default_warehouse_parasut_id
//   ORDER BY c.parasut_id
// Both joins are LEFT joins on a PK/UNIQUE key, so at most one match each and
// the company row is NEVER dropped: when there is no matching address /
// warehouse every derived field of that side stays literally `null`.
//
// COMPANY_COLUMNS is the frontend-facing allow-list. The subset of it that
// actually lives on parasut.companies is everything except the 13 derived
// fields listed in COMPANY_DERIVED_COLUMNS below; that subset is what we
// select, so the allow-list stays the single source of truth and a future
// column can never be silently widened.
const COMPANY_DERIVED_COLUMNS = new Set([
  // BLOCKED -- see the note on default_warehouse_parasut_type below.
  "default_warehouse_parasut_type",
  // from the warehouses subquery
  "default_warehouse_name",
  "default_warehouse_archived",
  "default_warehouse_resource_type",
  // from parasut.addresses
  "address_name",
  "address_text",
  "address_phone",
  "address_fax",
  "address_own_parasut_type",
  "address_addressable_type",
  "address_addressable_parasut_id",
  "address_created_at",
  "address_updated_at",
]);

const COMPANY_BASE_COLUMNS = COMPANY_COLUMNS.split(", ")
  .filter((c) => !COMPANY_DERIVED_COLUMNS.has(c))
  .join(", ");

const ADDRESS_COLUMNS = "parasut_id, name, address, phone, fax, parasut_type, addressable_type, addressable_parasut_id, parasut_created_at, parasut_updated_at";
const WAREHOUSE_COLUMNS = "parasut_id, name, archived, raw";

type Row = Record<string, unknown>;

/** Faithful port of Postgres' `jsonb ->> key`: a JSON string yields its
 * unquoted text, other scalars/containers yield their JSON text, and JSON
 * null / a missing key / a null container yield SQL NULL. */
function jsonbArrowArrow(obj: unknown, key: string): string | null {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return null;
  const v = (obj as Record<string, unknown>)[key];
  if (v === undefined || v === null) return null;
  return typeof v === "string" ? v : JSON.stringify(v);
}

async function fetchCompanyProfile(db: SupabaseClient): Promise<{ ok: true; row: Row | null } | { ok: false; error: unknown }> {
  // `.maybeSingle()` matches the previous call against the view exactly: at
  // most one company row is expected, and more than one is an error rather
  // than a silently-picked row.
  const companyRes = await db.schema(SCHEMA).from("companies").select(COMPANY_BASE_COLUMNS).maybeSingle();
  if (companyRes.error) return { ok: false, error: companyRes.error };
  const c = companyRes.data as Row | null;
  if (!c) return { ok: true, row: null };

  const addressId = c["address_parasut_id"] as number | null;
  const warehouseId = c["default_warehouse_parasut_id"] as number | null;

  const [addrRes, whRes] = await Promise.all([
    addressId == null
      ? Promise.resolve({ data: null, error: null })
      : db.schema(SCHEMA).from("addresses").select(ADDRESS_COLUMNS).eq("parasut_id", addressId).maybeSingle(),
    warehouseId == null
      ? Promise.resolve({ data: null, error: null })
      : db.schema(SCHEMA).from("warehouses").select(WAREHOUSE_COLUMNS).eq("parasut_id", warehouseId).maybeSingle(),
  ]);
  if (addrRes.error) return { ok: false, error: addrRes.error };
  if (whRes.error) return { ok: false, error: whRes.error };

  const a = addrRes.data as Row | null;
  const w = whRes.data as Row | null;
  const wRaw = (w?.["raw"] ?? null) as Record<string, unknown> | null;

  return {
    ok: true,
    row: {
      // LEFT JOIN semantics: the parent row is spread first and every derived
      // field defaults to null when its side did not match.
      ...c,

      // -------------------------------------------------------------------
      // default_warehouse_parasut_type is HARD-BLOCKED to literal null.
      // The view emits `NULL::text AS default_warehouse_parasut_type` and its
      // COMMENT states this is deliberate: the field represents
      // /me relationships.default_warehouse.data.type, which the Parasut API
      // genuinely never returns ({"meta":{}}). It must never be derived,
      // guessed, or back-filled from the warehouse record -- not even from
      // `w.raw->>'type'`, which is a DIFFERENT value (the resource_type
      // below). Always null.
      // -------------------------------------------------------------------
      default_warehouse_parasut_type: null,

      default_warehouse_name: w ? (w["name"] ?? null) : null,
      default_warehouse_archived: w ? (w["archived"] ?? null) : null,
      // mirrors `warehouses.raw ->> 'type'` exactly (see jsonbArrowArrow).
      default_warehouse_resource_type: jsonbArrowArrow(wRaw, "type"),

      address_name: a ? (a["name"] ?? null) : null,
      address_text: a ? (a["address"] ?? null) : null,
      address_phone: a ? (a["phone"] ?? null) : null,
      address_fax: a ? (a["fax"] ?? null) : null,
      address_own_parasut_type: a ? (a["parasut_type"] ?? null) : null,
      address_addressable_type: a ? (a["addressable_type"] ?? null) : null,
      address_addressable_parasut_id: a ? (a["addressable_parasut_id"] ?? null) : null,
      address_created_at: a ? (a["parasut_created_at"] ?? null) : null,
      address_updated_at: a ? (a["parasut_updated_at"] ?? null) : null,
    },
  };
}

// --------------------------------------------------------------------------
// company.get -- explicit replication of parasut_user_company_relation_demo
// --------------------------------------------------------------------------
//   parasut.user_roles ur
//     JOIN      parasut.users u    ON u.parasut_id      = ur.user_parasut_id  (INNER)
//     LEFT JOIN parasut.profiles p ON p.user_parasut_id = ur.user_parasut_id
//   ORDER BY ur.parasut_id
// The users join is genuinely INNER in the view, so a relation row with no
// matching user is dropped here too -- that is the view's own semantics, not
// an accidental filter. The profiles join is LEFT, so its two fields stay
// null when unmatched. Consumed with `.maybeSingle()`, so >1 surviving row is
// an error, exactly as before.
async function fetchUserCompanyRelation(
  db: SupabaseClient,
): Promise<{ ok: true; row: Row | null } | { ok: false; error: unknown }> {
  const rolesRes = await db
    .schema(SCHEMA)
    .from("user_roles")
    .select("parasut_id, parasut_type, user_parasut_id, company_parasut_id, company_parasut_type")
    .order("parasut_id", { ascending: true });
  if (rolesRes.error) return { ok: false, error: rolesRes.error };
  const roles = (rolesRes.data ?? []) as Row[];
  if (roles.length === 0) return { ok: true, row: null };

  const userIds = [...new Set(roles.map((r) => r["user_parasut_id"]).filter((v) => v != null))] as number[];
  if (userIds.length === 0) return { ok: true, row: null }; // INNER JOIN drops all

  const [usersRes, profilesRes] = await Promise.all([
    db
      .schema(SCHEMA)
      .from("users")
      .select("parasut_id, parasut_type, name, email, parasut_created_at, parasut_updated_at")
      .in("parasut_id", userIds),
    db.schema(SCHEMA).from("profiles").select("parasut_id, parasut_type, user_parasut_id, phone").in("user_parasut_id", userIds),
  ]);
  if (usersRes.error) return { ok: false, error: usersRes.error };
  if (profilesRes.error) return { ok: false, error: profilesRes.error };

  const userById = new Map(((usersRes.data ?? []) as Row[]).map((u) => [u["parasut_id"], u]));
  const profileByUserId = new Map(((profilesRes.data ?? []) as Row[]).map((p) => [p["user_parasut_id"], p]));

  const merged = roles
    .filter((r) => userById.has(r["user_parasut_id"])) // INNER JOIN on users
    .map((r) => {
      const u = userById.get(r["user_parasut_id"]) as Row;
      const p = profileByUserId.get(r["user_parasut_id"]) as Row | undefined;
      return {
        user_parasut_id: u["parasut_id"] ?? null,
        user_parasut_type: u["parasut_type"] ?? null,
        user_name: u["name"] ?? null,
        user_email: u["email"] ?? null,
        user_created_at: u["parasut_created_at"] ?? null,
        user_updated_at: u["parasut_updated_at"] ?? null,
        profile_parasut_id: p ? (p["parasut_id"] ?? null) : null,
        profile_parasut_type: p ? (p["parasut_type"] ?? null) : null,
        user_phone: p ? (p["phone"] ?? null) : null,
        relation_parasut_id: r["parasut_id"] ?? null,
        relation_parasut_type: r["parasut_type"] ?? null,
        company_parasut_id: r["company_parasut_id"] ?? null,
        company_parasut_type: r["company_parasut_type"] ?? null,
      } as Row;
    });

  if (merged.length === 0) return { ok: true, row: null };
  // `.maybeSingle()` parity: more than one row was previously a PostgREST
  // error, never a silently-truncated result.
  if (merged.length > 1) {
    return { ok: false, error: new Error("parasut_user_company_relation: expected at most one row, got " + merged.length) };
  }
  return { ok: true, row: merged[0] };
}

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
        // parasut_tag_counts_demo was exactly `SELECT count(*) AS total_count
        // FROM parasut.tags`, i.e. always a single row.
        const { count, error } = await db
          .schema(SCHEMA)
          .from(TAGS_TABLE)
          .select("parasut_id", { count: "exact", head: true });
        if (error) return errorResponse("internal_error", cors, error);
        return jsonResponse({ data: { total_count: count ?? 0 } }, 200, cors);
      }
      case "tags.list": {
        const parsed = parseListParams(body, ["name"] as const, { column: "name", direction: "asc" });
        if ("error" in parsed) return errorResponse(parsed.error, cors);
        const res = await runListQuery(db, {
          view: TAGS_TABLE,
          schema: SCHEMA,
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
        const res = await runGetQuery(db, { view: TAGS_TABLE, schema: SCHEMA, columns: TAG_COLUMNS, id });
        if (!res.ok) return errorResponse("internal_error", cors, res.error);
        if (!res.row) return errorResponse("not_found", cors);
        return jsonResponse({ data: res.row }, 200, cors);
      }

      case "company.get": {
        const [companyRes, relationRes] = await Promise.all([
          fetchCompanyProfile(db),
          fetchUserCompanyRelation(db),
        ]);
        if (!companyRes.ok) return errorResponse("internal_error", cors, companyRes.error);
        if (!relationRes.ok) return errorResponse("internal_error", cors, relationRes.error);
        return jsonResponse({ data: { company: companyRes.row ?? null, userCompanyRelation: relationRes.row ?? null } }, 200, cors);
      }

      default:
        return errorResponse("invalid_params", cors);
    }
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
