// Phase 15: shared HTTP/response helpers for the public read Edge Functions
// (customers, sales, expenses, payroll, cash, products, inventory,
// shipments, e-documents, tags-and-settings, sync-status). Mirrors the CORS
// allowlist + JSON response conventions already established by
// parasut-sync (Phase 14.6), but these functions are read-only, public
// (verify_jwt = false), and GET-shaped despite being invoked as POST (the
// supabase-js `functions.invoke` client always sends POST; there is no
// mutation here, only a `select` against public.parasut_*_demo views).

// Phase 14.6 CORS allowlist, duplicated here (not imported cross-function --
// each Edge Function is deployed and bundled independently) so every read
// function gets the exact same browser-facing behavior as parasut-sync.
const ALLOWED_ORIGINS = new Set([
  "https://demo.eclipsemuhendislik.com",
  "https://www.demo.eclipsemuhendislik.com",
  "https://eclipsemuhendislik.com",
  "https://www.eclipsemuhendislik.com",
  "http://localhost:5173",
  "http://localhost:8080",
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function jsonResponse(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

/** Small, typed, safe-to-expose error codes. Never forward raw
 * Postgres/PostgREST error text to the client -- full detail is logged
 * server-side only (console.error), the client only ever sees one of these
 * codes plus a generic, non-leaky message. */
export type ErrorCode = "invalid_params" | "not_found" | "unauthorized" | "internal_error";

const ERROR_STATUS: Record<ErrorCode, number> = {
  invalid_params: 400,
  not_found: 404,
  unauthorized: 401,
  internal_error: 500,
};

export function errorResponse(code: ErrorCode, cors: Record<string, string>, detail?: unknown): Response {
  if (detail !== undefined) {
    // server-side only -- never included in the response body.
    console.error(`[${code}]`, detail);
  }
  return jsonResponse({ error: code }, ERROR_STATUS[code], cors);
}

/**
 * authorize(): centralized auth hook for every read function. Phase 15
 * decision (per the design doc): reads stay PUBLIC, matching the site's
 * existing behavior -- no login gate on any list/detail route today. This
 * function is intentionally still called from every handler, as a single
 * reviewable choke point, so tightening to a real session/role check later
 * touches one file, not every function. Today it always returns
 * { ok: true }.
 */
export function authorize(_req: Request): { ok: true } | { ok: false; code: ErrorCode } {
  return { ok: true };
}

export interface ParsedListParams {
  page: number;
  pageSize: number;
  sort?: { column: string; direction: "asc" | "desc" };
}

/** Parses and clamps the common list envelope request params. `sortAllowlist`
 * is the set of columns this particular list action allows sorting on --
 * never a client-supplied raw column name. */
export function parseListParams(
  body: Record<string, unknown> | null,
  sortAllowlist: readonly string[],
  defaultSort?: { column: string; direction: "asc" | "desc" },
): ParsedListParams | { error: ErrorCode } {
  const rawPage = body?.["page"];
  const rawPageSize = body?.["pageSize"];
  const rawSort = body?.["sort"] as { column?: unknown; direction?: unknown } | undefined;

  let page = 1;
  if (rawPage !== undefined) {
    const n = Number(rawPage);
    if (!Number.isInteger(n) || n < 1) return { error: "invalid_params" };
    page = n;
  }

  let pageSize = 50;
  if (rawPageSize !== undefined) {
    const n = Number(rawPageSize);
    if (!Number.isInteger(n) || n < 1) return { error: "invalid_params" };
    pageSize = Math.min(n, 200);
  }

  let sort = defaultSort;
  if (rawSort && typeof rawSort === "object") {
    const column = rawSort.column;
    const direction = rawSort.direction;
    if (typeof column !== "string" || !sortAllowlist.includes(column)) return { error: "invalid_params" };
    if (direction !== "asc" && direction !== "desc") return { error: "invalid_params" };
    sort = { column, direction };
  }

  return { page, pageSize, sort };
}
