import { describe, expect, it } from "vitest";
import { detectUnknownKeys, detectTypeMismatch } from "../../supabase/functions/parasut-sync/schema_guard";
import type { JsonApiResource } from "../../supabase/functions/parasut-sync/parasut_client";

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
