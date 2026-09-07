// Keeps the mirror fresh when a demo domain is visited without putting
// Paraşüt API work on the browser-facing request path. The existing
// parasut-sync function remains the only writer and its per-resource lock
// remains the concurrency guard.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Supabase injects EdgeRuntime into deployed function isolates. Deno's
// standalone type checker does not include that platform declaration.
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

type Domain =
  | "cash"
  | "customers"
  | "e-documents"
  | "expenses"
  | "inventory"
  | "payroll"
  | "products"
  | "sales"
  | "shipments"
  | "tags-and-settings";

type Resource =
  | "accounts"
  | "checks"
  | "contacts"
  | "e_invoice_inboxes"
  | "e_invoices"
  | "employees"
  | "expense_payments"
  | "item_categories"
  | "me"
  | "payments"
  | "products"
  | "purchase_bills"
  | "salaries"
  | "sales_invoices"
  | "sales_offers"
  | "shipment_documents"
  | "stock_movements"
  | "tags"
  | "taxes"
  | "transactions"
  | "warehouses";

const DOMAIN_RESOURCES: Record<Domain, readonly Resource[]> = {
  cash: ["accounts", "transactions", "checks"],
  customers: ["contacts"],
  "e-documents": ["e_invoices", "e_invoice_inboxes"],
  expenses: ["purchase_bills", "expense_payments", "contacts", "payments"],
  inventory: ["products", "warehouses", "stock_movements"],
  payroll: ["employees", "salaries", "taxes", "tags"],
  products: ["products", "item_categories", "warehouses"],
  sales: ["sales_invoices", "sales_offers", "payments"],
  shipments: ["shipment_documents", "stock_movements"],
  "tags-and-settings": ["me", "tags", "taxes", "warehouses"],
};

// A visit can request freshness at most once per resource per minute. This is
// deliberately short enough for operational use but prevents every reload
// becoming a Paraşüt API call. It can be tuned with a non-secret project
// setting without a redeploy.
const DEFAULT_MAX_AGE_MS = 60_000;

function maxAgeMs(): number {
  const configured = Number(Deno.env.get("PARASUT_FRESHNESS_MAX_AGE_SECONDS"));
  if (!Number.isFinite(configured)) return DEFAULT_MAX_AGE_MS;
  return Math.max(15, Math.min(300, configured)) * 1_000;
}

async function latestRun(db: SupabaseClient, resource: Resource) {
  const { data, error } = await db
    .schema("parasut")
    .from("sync_runs")
    .select("status, started_at, finished_at")
    .eq("resource", resource)
    // dry_run runs log status/finished_at identically to a real run but
    // upsert nothing (see parasut-sync/index.ts's `if (!dryRun)` guards
    // around every write) -- excluding them here is required, not
    // cosmetic: without it, a dry run would mark genuinely stale data as
    // fresh for up to `maxAgeMs()`, with no data having actually moved.
    .eq("dry_run", false)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`freshness lookup failed for ${resource}: ${error.message}`);
  return data;
}

function isFreshOrRunning(run: { status: string; started_at: string | null; finished_at: string | null } | null, now: number): boolean {
  if (!run) return false;
  if (run.status === "running") return true;
  const completedAt = Date.parse(run.finished_at ?? run.started_at ?? "");
  return Number.isFinite(completedAt) && now - completedAt < maxAgeMs();
}

async function requestSync(resource: Resource): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  // NOT Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"): on this project that
  // platform-injected value is the new sb_secret_... key format (a single
  // opaque token, not a JWT), and parasut-sync's own auth check decodes its
  // bearer token as a JWT to read a `role` claim -- it 401s
  // ("Malformed authorization token") on anything else. The pg_cron
  // dispatcher already had this exact problem and solved it by keeping a
  // legacy-format JWT service_role key in Supabase Vault
  // (`parasut_sync_service_role_key`, see
  // supabase/migrations/20260906194321_parasut_durable_scheduler.sql).
  // PARASUT_SYNC_INTERNAL_KEY is that same legacy JWT, stored as an Edge
  // Function secret instead of in Vault since this call is made from an
  // Edge Function, not from SQL -- same credential, same purpose, just
  // accessible from where this code actually runs.
  const key = Deno.env.get("PARASUT_SYNC_INTERNAL_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL / PARASUT_SYNC_INTERNAL_KEY");

  const response = await fetch(`${url}/functions/v1/parasut-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resource, dry_run: false }),
  });

  // A 409 is the expected outcome when a parallel request already acquired
  // parasut-sync's unique per-resource lock. It is not an error or retry.
  if (!response.ok && response.status !== 409) {
    const body = await response.text();
    throw new Error(`freshness sync failed for ${resource}: HTTP ${response.status} ${body.slice(0, 300)}`);
  }
}

async function refreshStaleResources(db: SupabaseClient, resources: readonly Resource[]): Promise<void> {
  try {
    const now = Date.now();
    const runs = await Promise.all(resources.map(async (resource) => ({ resource, run: await latestRun(db, resource) })));
    const stale = runs.filter(({ run }) => !isFreshOrRunning(run, now)).map(({ resource }) => resource);

    // Start at most one resource per page request. Paraşüt rate limits are
    // shared across resources, and this prevents a single reload from
    // turning into a fan-out of long-running syncs. Later reloads naturally
    // request the next stale dependency in this domain's priority order.
    if (stale[0]) await requestSync(stale[0]);
  } catch (error) {
    // Freshness is best-effort: mirror reads must stay available if the
    // scheduler, Paraşüt, or an individual resource is temporarily unhealthy.
    console.error("[freshness]", error);
  }
}

export function scheduleDomainFreshness(db: SupabaseClient, domain: Domain): void {
  // Defensive: EdgeRuntime is a Supabase-injected platform global, not a
  // language guarantee. Freshness is explicitly best-effort everywhere else
  // in this file (see the catch in refreshStaleResources) -- an unguarded
  // reference here would be the one path where a freshness problem could
  // take the whole read endpoint down with it instead of degrading quietly.
  if (typeof EdgeRuntime === "undefined") {
    console.error("[freshness] EdgeRuntime.waitUntil unavailable; skipping background refresh");
    return;
  }
  EdgeRuntime.waitUntil(refreshStaleResources(db, DOMAIN_RESOURCES[domain]));
}
