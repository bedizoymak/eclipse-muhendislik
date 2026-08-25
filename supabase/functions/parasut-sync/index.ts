// parasut-sync: server-side Parasut -> Supabase mirror sync.
//
// POST body: { "resource": "contacts", "dry_run"?: boolean }
//
// Phase 1 supports only the "contacts" resource. Every page of the Parasut
// list endpoint is fetched before anything is written; a failure on any
// page aborts the run as an error, never a silent partial success. A
// partial unique index on parasut.sync_runs(resource) where status='running'
// prevents two concurrent syncs of the same resource.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { fetchAllPages, getAccessToken } from "./parasut_client.ts";
import { mapContact } from "./resources/contacts.ts";

const SUPPORTED_RESOURCES = ["contacts"] as const;
type Resource = (typeof SUPPORTED_RESOURCES)[number];

const RESOURCE_CONFIG: Record<Resource, { path: string; table: string }> = {
  contacts: { path: "contacts", table: "contacts" },
};

const BATCH_SIZE = 200;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { resource?: string; dry_run?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const resource = body.resource as Resource;
  if (!resource || !SUPPORTED_RESOURCES.includes(resource)) {
    return jsonResponse(
      { error: `resource must be one of: ${SUPPORTED_RESOURCES.join(", ")}` },
      400,
    );
  }
  const dryRun = body.dry_run === true;
  const config = RESOURCE_CONFIG[resource];

  const db = serviceClient();

  // Acquire the per-resource lock by inserting the running row. The partial
  // unique index rejects a second concurrent run for the same resource.
  const { data: runRow, error: lockError } = await db
    .schema("parasut")
    .from("sync_runs")
    .insert({ resource, status: "running", dry_run: dryRun })
    .select("id")
    .single();

  if (lockError) {
    if (lockError.code === "23505") {
      return jsonResponse({ error: `A sync for "${resource}" is already running` }, 409);
    }
    return jsonResponse({ error: `Failed to start sync run: ${lockError.message}` }, 500);
  }

  const runId = runRow.id as string;

  const finishRun = async (patch: Record<string, unknown>) => {
    await db
      .schema("parasut")
      .from("sync_runs")
      .update({ finished_at: new Date().toISOString(), ...patch })
      .eq("id", runId);
  };

  try {
    const accessToken = await getAccessToken(db);
    const { items, totalCountReported } = await fetchAllPages(accessToken, config.path);

    const fetchedCount = items.length;
    let upsertedCount = 0;
    let errorCount = 0;
    const errorMessages: string[] = [];

    if (!dryRun) {
      const rows = items.map(mapContact);

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error, count } = await db
          .schema("parasut")
          .from(config.table)
          .upsert(batch, { onConflict: "parasut_id", count: "exact" })
          .select("parasut_id", { count: "exact", head: true });

        if (error) {
          errorCount += batch.length;
          errorMessages.push(error.message);
        } else {
          upsertedCount += count ?? batch.length;
        }
      }
    }

    if (errorCount > 0) {
      await finishRun({
        status: "error",
        fetched_count: fetchedCount,
        upserted_count: upsertedCount,
        error_count: errorCount,
        error_message: errorMessages.join(" | ").slice(0, 2000),
        total_count_reported: totalCountReported,
      });
      return jsonResponse(
        {
          resource,
          dry_run: dryRun,
          status: "error",
          fetched_count: fetchedCount,
          upserted_count: upsertedCount,
          error_count: errorCount,
          error_message: errorMessages.join(" | "),
        },
        502,
      );
    }

    await finishRun({
      status: dryRun ? "dry_run" : "success",
      fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      error_count: 0,
      total_count_reported: totalCountReported,
    });

    return jsonResponse({
      resource,
      dry_run: dryRun,
      status: dryRun ? "dry_run" : "success",
      fetched_count: fetchedCount,
      upserted_count: dryRun ? 0 : upsertedCount,
      error_count: 0,
      total_count_reported: totalCountReported,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun({
      status: "error",
      error_message: message.slice(0, 2000),
    });
    return jsonResponse({ resource, dry_run: dryRun, status: "error", error_message: message }, 502);
  }
});
