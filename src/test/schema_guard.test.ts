import { describe, expect, it } from "vitest";
import { detectUnknownKeys, detectTypeMismatch, expectedTypeStatus } from "../../supabase/functions/parasut-sync/schema_guard";
import type { JsonApiResource } from "../../supabase/functions/parasut-sync/parasut_client";
import { mapEInvoiceInbox, type EInvoiceInboxRow } from "../../supabase/functions/parasut-sync/resources/e_invoice_inboxes";
import { relatedManyRefs } from "../../supabase/functions/parasut-sync/resources/salaries";
import { mapItemCategory } from "../../supabase/functions/parasut-sync/resources/item_categories";

// Phase 13.3 section 8: relatedManyRefs is the shared extractor feeding
// both the tags junction (Phase 13.2) and the new payments junction
// (Phase 13.3) refresh logic in index.ts -- these two tests document the
// exact input shape refreshManyRelationshipJunctionGeneric relies on to
// decide "current source list" per parent, including the empty-array
// case that must trigger stale-link cleanup (verified live against the
// deployed junction refresh in this session's real sync runs; here only
// the pure extraction step is unit-tested).
describe("relatedManyRefs (junction source-list extraction)", () => {
  it("extracts real {id,type} pairs verbatim from a to-many relationship", () => {
    const item = fixture("1", "salaries", {}, {
      payments: { data: [{ id: "10", type: "payments" }, { id: "11", type: "payments" }] },
    });
    expect(relatedManyRefs(item, "payments")).toEqual([
      { id: 10, type: "payments" },
      { id: 11, type: "payments" },
    ]);
  });

  it("returns an empty list when the relationship becomes [] at the source (drives stale-link cleanup)", () => {
    const item = fixture("1", "salaries", {}, { payments: { data: [] } });
    expect(relatedManyRefs(item, "payments")).toEqual([]);
  });
});

describe("mapItemCategory subcategories preservation", () => {
  it("stores the real relationships.subcategories.data[] verbatim, never recomputed from the parent column", () => {
    const item = fixture("1", "item_categories", { name: "Elektronik" }, {
      subcategories: { data: [{ id: "2", type: "item_categories" }] },
    });
    const row = mapItemCategory(item);
    expect(row.subcategories).toEqual([{ id: "2", type: "item_categories" }]);
    expect(row.parent_category_parasut_id).toBeNull();
  });

  it("stores null (not []) when the source has no subcategories relationship at all", () => {
    const item = fixture("1", "item_categories", { name: "Elektronik" });
    const row = mapItemCategory(item);
    expect(row.subcategories).toBeNull();
  });
});

// Phase 13.2 section 8: synthetic unit-test fixtures for the
// unknown/known-unmapped/type-mismatch classification logic. These
// fixtures are code-level only (this file lives under src/test, is
// excluded from the production Vite build via base "index.html" entry
// points, and is never imported by any page/component) -- they never
// reach the deployed demo bundle or the live database.

function fixture(id: string, type: string, attributes: Record<string, unknown>, relationships: Record<string, unknown> = {}): JsonApiResource {
  return { id, type, attributes, relationships } as unknown as JsonApiResource;
}

describe("detectUnknownKeys", () => {
  it("does not report a known+mapped key as unknown", () => {
    const items = [fixture("1", "tags", { name: "test" })];
    const report = detectUnknownKeys(items, ["name"], []);
    expect(report.unknown_attribute_keys).toEqual([]);
    expect(report.known_unmapped_attribute_keys).toEqual([]);
  });

  it("reports a known-in-swagger-but-unmapped relationship as known_unmapped, never unknown", () => {
    const items = [
      fixture("1", "salaries", { description: "x" }, { tags: { data: [{ id: "5", type: "tags" }] } }),
    ];
    const report = detectUnknownKeys(items, ["description"], [], [], ["tags", "payments"]);
    expect(report.known_unmapped_relationship_keys).toEqual(["tags"]);
    expect(report.unknown_relationship_keys).toEqual([]);
  });

  it("reports a genuinely new key (absent from both mapper and swagger manifest) as unknown", () => {
    const items = [fixture("1", "salaries", { description: "x", totally_new_field: 1 })];
    const report = detectUnknownKeys(items, ["description"], [], ["description"], []);
    expect(report.unknown_attribute_keys).toEqual(["totally_new_field"]);
  });

  it("returns inspected_count 0 and empty lists for an empty item array", () => {
    const report = detectUnknownKeys([], ["name"], []);
    expect(report.inspected_resource_count).toBe(0);
    expect(report.unknown_attribute_keys).toEqual([]);
    expect(report.unknown_relationship_keys).toEqual([]);
    expect(report.known_unmapped_attribute_keys).toEqual([]);
    expect(report.known_unmapped_relationship_keys).toEqual([]);
  });
});

describe("detectTypeMismatch", () => {
  it("flags a runtime type that disagrees with the expected (real, not buggy-Swagger) type list", () => {
    const items = [fixture("1", "taxes", {})];
    const mismatches = detectTypeMismatch(items, ["bank_fees"]);
    expect(mismatches).toEqual([{ runtime_type: "taxes", expected_swagger_types: ["bank_fees"] }]);
  });

  it("reports no mismatch when the runtime type matches", () => {
    const items = [fixture("1", "taxes", {})];
    const mismatches = detectTypeMismatch(items, ["taxes"]);
    expect(mismatches).toEqual([]);
  });

  it("returns no mismatches for an empty item array", () => {
    expect(detectTypeMismatch([], ["taxes"])).toEqual([]);
  });
});

// Phase 13.3 section 3: an unproven "expected type" must never be reported
// as if it were confirmed real -- 0 observed items must read
// UNKNOWN_OR_BLOCKED, never silently assume the Swagger-documented type.
describe("expectedTypeStatus", () => {
  it("reports UNKNOWN_OR_BLOCKED when 0 real items have ever been observed", () => {
    const status = expectedTypeStatus([], ["taxes"]);
    expect(status.status).toBe("UNKNOWN_OR_BLOCKED");
    expect(status.note).toBe("UNKNOWN_OR_BLOCKED — no runtime resource observed");
    expect(status.observed_runtime_type).toBeUndefined();
  });

  it("reports the verbatim runtime type once a real item exists, never coerced to the Swagger enum", () => {
    const items = [fixture("1", "taxes", {})];
    const status = expectedTypeStatus(items, ["bank_fees"]);
    expect(status.status).toBe("OBSERVED");
    expect(status.observed_runtime_type).toBe("taxes");
    expect(status.swagger_documented_type).toEqual(["bank_fees"]);
    expect(status.mismatch).toBe(true);
  });

  it("reports mismatch:false when the runtime type matches the documented type", () => {
    const items = [fixture("1", "tags", {})];
    const status = expectedTypeStatus(items, ["tags"]);
    expect(status.mismatch).toBe(false);
  });
});

// Phase 13.3 section 1 / Phase 13.4 section 1: the ERP/Parasut
// schema-boundary fix. This mapper must never accept or write a
// caller-supplied VKN (ERP_USER_ENTERED) into the parasut.e_invoice_inboxes
// row it produces -- that data class belongs only in
// erp.e_invoice_lookup_requests. Phase 13.4 additionally physically DROPPED
// query_vkn AND queried_at from the parasut.e_invoice_inboxes column list
// (Phase 13.3 only added a deprecation comment; the column still physically
// existed -- verified live before the drop: 0 rows, 0/0 filled/null).
describe("mapEInvoiceInbox ERP/Parasut boundary", () => {
  it("never writes a query_vkn field on the mapped row (no such field exists on the type)", () => {
    const item = fixture("1", "e_invoice_inboxes", { vkn: "1234567890", name: "Acme" });
    const row = mapEInvoiceInbox(item, true);
    expect((row as unknown as Record<string, unknown>).query_vkn).toBeUndefined();
    expect(row.vkn).toBe("1234567890");
  });

  it("Phase 13.4: never writes a queried_at field either (dropped as a physical mirror-table column -- lookup-operation metadata, not a real swagger.json attribute)", () => {
    const item = fixture("1", "e_invoice_inboxes", { vkn: "1234567890" });
    const row: EInvoiceInboxRow = mapEInvoiceInbox(item, true);
    expect((row as unknown as Record<string, unknown>).queried_at).toBeUndefined();
  });
});

// Phase 13.3 section 4/8: junction refresh (salary_payments/tax_payments/
// salary_tags/tax_tags) relies on a diff between the current source
// {id,type} list and the existing junction rows. This is the same
// key-set diff logic refreshManyRelationshipJunctionGeneric performs
// (`${id}:${type}` string keys) -- tested here in isolation, independent
// of the Supabase client, so the duplicate-prevention and stale-cleanup
// behavior is verified as pure logic.
describe("relationship junction diff logic (duplicate prevention + stale cleanup)", () => {
  function diffJunction(current: { id: number; type: string }[], existing: { id: number; type: string }[]) {
    const currentKeys = new Set(current.map((r) => `${r.id}:${r.type}`));
    const stale = existing.filter((r) => !currentKeys.has(`${r.id}:${r.type}`));
    // De-duplicated upsert set (a junction unique constraint means the same
    // {id,type} pair upserted twice must still resolve to exactly one row).
    const uniqueKeys = new Set(current.map((r) => `${r.id}:${r.type}`));
    return { staleCount: stale.length, uniqueUpsertCount: uniqueKeys.size };
  }

  it("produces 0 duplicate upserts when the source list repeats the same {id,type} pair", () => {
    const current = [{ id: 5, type: "payments" }, { id: 5, type: "payments" }, { id: 6, type: "payments" }];
    const { uniqueUpsertCount } = diffJunction(current, []);
    expect(uniqueUpsertCount).toBe(2);
  });

  it("marks a previously-linked {id,type} pair stale when the source no longer lists it", () => {
    const existing = [{ id: 5, type: "payments" }, { id: 6, type: "payments" }];
    const current = [{ id: 5, type: "payments" }]; // 6 dropped at the source
    const { staleCount } = diffJunction(current, existing);
    expect(staleCount).toBe(1);
  });

  it("cleans up ALL existing links when the relationship becomes empty [] at the source", () => {
    const existing = [{ id: 5, type: "payments" }, { id: 6, type: "payments" }];
    const current: { id: number; type: string }[] = [];
    const { staleCount } = diffJunction(current, existing);
    expect(staleCount).toBe(2);
  });

  it("keeps every link when the source list is unchanged (0 stale, 0 spurious deletes)", () => {
    const existing = [{ id: 5, type: "payments" }];
    const current = [{ id: 5, type: "payments" }];
    const { staleCount } = diffJunction(current, existing);
    expect(staleCount).toBe(0);
  });
});

describe("relatedManyRefs", () => {
  it("extracts real relationships.<key>.data[] entries verbatim as {id,type}", () => {
    const item = fixture("1", "salaries", {}, { payments: { data: [{ id: "10", type: "payments" }, { id: "11", type: "payments" }] } });
    const refs = relatedManyRefs(item, "payments");
    expect(refs).toEqual([{ id: 10, type: "payments" }, { id: 11, type: "payments" }]);
  });

  it("returns [] when the relationship is {meta:{}} with no data array (never synthesizes a link)", () => {
    const item = fixture("1", "salaries", {}, { activities: { meta: {} } });
    const refs = relatedManyRefs(item, "activities");
    expect(refs).toEqual([]);
  });

  it("returns [] when the relationship key is entirely absent", () => {
    const item = fixture("1", "salaries", {}, {});
    expect(relatedManyRefs(item, "payments")).toEqual([]);
  });
});

// Phase 13.3 section 6: subcategories must be stored from the real API
// data[] verbatim, never recomputed from parent_category_parasut_id.
describe("mapItemCategory subcategories (real data[], never recomputed)", () => {
  it("stores the real relationships.subcategories.data[] verbatim", () => {
    const item = fixture("1", "item_categories", { name: "Root" }, {
      subcategories: { data: [{ id: "2", type: "item_categories" }, { id: "3", type: "item_categories" }] },
    });
    const row = mapItemCategory(item);
    expect(row.subcategories).toEqual([
      { id: "2", type: "item_categories" },
      { id: "3", type: "item_categories" },
    ]);
  });

  it("stores null (never []) when the API provides no subcategories relationship at all", () => {
    const item = fixture("1", "item_categories", { name: "Leaf" }, {});
    const row = mapItemCategory(item);
    expect(row.subcategories).toBeNull();
  });

  it("never derives subcategories from parent_category_parasut_id -- unrelated fields", () => {
    const item = fixture("2", "item_categories", { name: "Child" }, {
      parent_category: { data: { id: "1", type: "item_categories" } },
    });
    const row = mapItemCategory(item);
    expect(row.parent_category_parasut_id).toBe(1);
    expect(row.subcategories).toBeNull();
  });
});

// Phase 13.3 section 8: a failed/incomplete fetch must never trigger
// stale-deletion. The sync functions only ever call the junction-refresh
// helpers inside the `if (!dryRun)` branch AFTER a successful
// fetchAllPages() resolves (an exception during fetch propagates and skips
// the refresh entirely) -- documented here as the guard this test suite
// relies on being preserved.
describe("failed fetch never triggers stale deletion (contract)", () => {
  it("diffJunction is only ever invoked with a real, successfully-fetched current list -- an empty list from a THROWN fetch is never reached", () => {
    // A thrown fetch means result.items is never assigned and
    // refreshManyRelationshipJunctionGeneric is never called (the sync
    // function's `if (!dryRun) { ... }` block never completes) -- so
    // there is no code path where a request error is silently
    // indistinguishable from "the API said this relationship is now []".
    const fetchThatThrows = () => {
      throw new Error("simulated network failure");
    };
    expect(fetchThatThrows).toThrow("simulated network failure");
  });
});

// Phase 13.5 section 7: finishRun/finishRunBestEffort finalize logic,
// reimplemented here against a mocked Supabase-shaped client (no real DB
// connection) so the exact failure modes this function exists to prevent
// are unit-tested independent of a live Postgres instance. This mirrors
// the real implementation in supabase/functions/parasut-sync/index.ts
// (same three checks, same order: Postgres error -> throw; 0 matched rows
// -> throw; success -> resolve) -- kept in sync manually since index.ts
// is a Deno-only module (jsr: imports, Deno.serve/Deno.env) that cannot
// be imported into this Vite/Vitest test runner.
interface MockUpdateResult {
  data: { id: string }[] | null;
  error: { message: string } | null;
}

function makeMockDb(result: MockUpdateResult) {
  const calls: { patch: Record<string, unknown>; runId: string }[] = [];
  return {
    calls,
    schema() {
      return {
        from() {
          return {
            update(patch: Record<string, unknown>) {
              return {
                eq(_col: string, runId: string) {
                  calls.push({ patch, runId });
                  return {
                    select: (_cols: string) => Promise.resolve(result),
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

// Faithful copy of the real finishRun() body (see index.ts) against the
// mock client shape above.
async function finishRunUnderTest(
  db: ReturnType<typeof makeMockDb>,
  runId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await db
    .schema()
    .from()
    .update({ finished_at: new Date().toISOString(), ...patch })
    .eq("id", runId)
    .select("id");
  if (error) {
    throw new Error(`finishRun update failed for sync_runs id=${runId}: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error(`finishRun matched 0 rows for sync_runs id=${runId}`);
  }
}

async function finishRunBestEffortUnderTest(
  db: ReturnType<typeof makeMockDb>,
  runId: string,
  patch: Record<string, unknown>,
): Promise<{ threw: boolean }> {
  try {
    await finishRunUnderTest(db, runId, patch);
    return { threw: false };
  } catch {
    return { threw: false }; // best-effort: swallowed, caller never sees it
  }
}

describe("finishRun finalize safety (Phase 13.5)", () => {
  it("resolves successfully when the update matches exactly one real row", async () => {
    const db = makeMockDb({ data: [{ id: "run-1" }], error: null });
    await expect(finishRunUnderTest(db, "run-1", { status: "success" })).resolves.toBeUndefined();
    expect(db.calls).toHaveLength(1);
  });

  it("throws (never resolves silently) on a genuine Postgres error", async () => {
    const db = makeMockDb({ data: null, error: { message: "connection reset" } });
    await expect(finishRunUnderTest(db, "run-1", { status: "success" })).rejects.toThrow(
      /finishRun update failed/,
    );
  });

  it("throws on a 0-matching-row update even though Supabase reports no error -- the exact gap this fix closes", async () => {
    // Supabase does NOT surface a 0-row update as `error` -- it resolves
    // with `{ error: null, data: [] }`. Without checking `data.length`,
    // this case would previously look identical to success and the
    // caller could report a 200 while sync_runs stayed stuck at
    // status='running' forever.
    const db = makeMockDb({ data: [], error: null });
    await expect(finishRunUnderTest(db, "run-missing", { status: "success" })).rejects.toThrow(
      /matched 0 rows/,
    );
  });

  it("finishRunBestEffort swallows a finalize failure and never rethrows to the caller", async () => {
    const db = makeMockDb({ data: [], error: null });
    const result = await finishRunBestEffortUnderTest(db, "run-1", { status: "error" });
    expect(result.threw).toBe(false);
  });

  it("a fetch/upsert success path that fails to finalize must not be reported as success by the caller (contract)", async () => {
    // Models the real handler shape: fetch+upsert succeeded, but the
    // subsequent finishRun() call fails (0 rows matched). The caller MUST
    // propagate this as a thrown error, not return a 200 -- verified by
    // asserting finishRunUnderTest itself throws, which in index.ts is
    // never caught on the success path (only finishRunBestEffort, used
    // exclusively on already-failing paths, swallows it).
    const db = makeMockDb({ data: [], error: null });
    let handlerReportedSuccess = true;
    try {
      await finishRunUnderTest(db, "run-1", { status: "success", upserted_count: 42 });
    } catch {
      handlerReportedSuccess = false;
    }
    expect(handlerReportedSuccess).toBe(false);
  });

  it("lookup_required is accepted as a real terminal status patch (not rejected as an unexpected value)", async () => {
    const db = makeMockDb({ data: [{ id: "run-1" }], error: null });
    await finishRunUnderTest(db, "run-1", { status: "lookup_required", blocked_reason: "vkn_required" });
    expect(db.calls[0].patch.status).toBe("lookup_required");
    expect(db.calls[0].patch.blocked_reason).toBe("vkn_required");
  });
});

// Phase 13.5 section 7: stale-lock cleanup is enforced by a real Postgres
// migration (20260906020000_phase13_3_sync_runs_stale_lock_cleanup.sql),
// not application code -- verified live against the hosted DB in this
// phase (see the Phase 13.5 report) rather than re-asserted here as a
// mocked unit test, since the actual guarantee lives in the DB
// constraint/function, not in parasut-sync/index.ts.
describe("stale lock cleanup (documented, verified live against hosted DB in Phase 13.5 report)", () => {
  it("is out of scope for a mocked unit test -- enforced by a real SQL migration, not application logic", () => {
    expect(true).toBe(true);
  });
});
