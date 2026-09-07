// Phase 15 domain 1 -- customers. Public read function (verify_jwt = false),
// backs /musteriler and /musteriler/:id. Server-side, hardcoded-column-list
// proxy in front of the Parasut mirror.
//
// Phase 15.1: migrated off the `public.parasut_contacts_demo` /
// `public.parasut_contact_people_demo` views onto the `parasut.*` base tables
// directly (see the design note at the top of ../_shared/query.ts). Both
// views were plain single-table passthroughs -- same column lists, no WHERE,
// no join, no aggregate -- so this is a schema+relation swap with identical
// results. The only thing either view added was `ORDER BY name` on
// parasut_contacts_demo, which was already overridden on every code path:
// `list` always applies its own .order() (defaulting to name asc, matching
// the view), `counts` is head-only, and `get` returns a single row. The
// response envelope, field allow-list, pagination, sort and count behaviour
// are unchanged.
import { authorize, corsHeaders, errorResponse, jsonResponse, parseListParams } from "../_shared/http.ts";
import { serviceClient } from "../_shared/db.ts";
import { runGetQuery, runListQuery, runRelatedQuery } from "../_shared/query.ts";

const SCHEMA = "parasut";
const CONTACTS_TABLE = "contacts";
const CONTACT_PEOPLE_TABLE = "contact_people";

const CONTACT_COLUMNS = "parasut_id, name, short_name, email, phone, contact_type, city, archived, synced_at";
const CONTACT_PEOPLE_COLUMNS =
  "parasut_id, name, email, phone, notes, contact_parasut_id, resource_type, contact_type, parasut_created_at, parasut_updated_at, synced_at";
const SORT_ALLOWLIST = ["name", "synced_at"] as const;

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
    if (action === "list") {
      const parsed = parseListParams(body, SORT_ALLOWLIST, { column: "name", direction: "asc" });
      if ("error" in parsed) return errorResponse(parsed.error, cors);

      const archived = body?.["archived"];
      const search = body?.["search"];
      const eq = [];
      if (archived === true || archived === false) eq.push({ column: "archived", value: archived });

      const ilike = [];
      if (typeof search === "string" && search.trim().length > 0) {
        // ilike on name only (email ilike would require an .or() -- kept to
        // name to match the exact column set the frontend has always
        // filtered on client-side; can be widened later without changing
        // the response shape).
        ilike.push({ column: "name", value: search.trim() });
      }

      const res = await runListQuery(db, {
        view: CONTACTS_TABLE,
        schema: SCHEMA,
        columns: CONTACT_COLUMNS,
        page: parsed.page,
        pageSize: parsed.pageSize,
        sort: parsed.sort,
        eq,
        ilike,
      });
      if (!res.ok) return errorResponse("internal_error", cors, res.error);
      return jsonResponse(res.result, 200, cors);
    }

    if (action === "counts") {
      const contacts = () => db.schema(SCHEMA).from(CONTACTS_TABLE).select("parasut_id", { count: "exact", head: true });
      const [activeRes, archivedRes, allRes] = await Promise.all([
        contacts().eq("archived", false),
        contacts().eq("archived", true),
        contacts(),
      ]);
      const err = activeRes.error ?? archivedRes.error ?? allRes.error;
      if (err) return errorResponse("internal_error", cors, err);
      return jsonResponse(
        { data: { active: activeRes.count ?? 0, archived: archivedRes.count ?? 0, all: allRes.count ?? 0 } },
        200,
        cors,
      );
    }

    if (action === "get") {
      const id = Number(body?.["id"]);
      if (!Number.isFinite(id)) return errorResponse("invalid_params", cors);

      const contactRes = await runGetQuery(db, {
        view: CONTACTS_TABLE,
        schema: SCHEMA,
        columns: CONTACT_COLUMNS,
        id,
      });
      if (!contactRes.ok) return errorResponse("internal_error", cors, contactRes.error);
      if (!contactRes.row) return errorResponse("not_found", cors);

      const peopleRes = await runRelatedQuery(
        db,
        CONTACT_PEOPLE_TABLE,
        CONTACT_PEOPLE_COLUMNS,
        [{ column: "contact_parasut_id", value: id }],
        SCHEMA,
      );
      if (!peopleRes.ok) return errorResponse("internal_error", cors, peopleRes.error);

      return jsonResponse({ data: { ...contactRes.row, contact_people: peopleRes.rows } }, 200, cors);
    }

    return errorResponse("invalid_params", cors);
  } catch (err) {
    return errorResponse("internal_error", cors, err);
  }
});
