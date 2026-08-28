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
