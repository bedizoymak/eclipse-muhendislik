// Phase 13.1: generic, reusable unknown-field detection.
//
// For any Parasut JSON:API resource, compares the actual keys present on
// each fetched item's `attributes`, `relationships`, and root object
// against the known key set the mapper actually reads. This never blocks
// or fails a sync -- raw is always stored in full regardless of what this
// finds -- it exists purely so that once real records appear for a
// resource that is empty today, an unmapped field is *reported*
// (sync_runs.metadata + the HTTP response), never silently dropped and
// never silently absorbed into the UI without review.
//
// Root keys are compared against the real JSON:API resource-object
// envelope (id/type/attributes/relationships/links/meta) -- anything else
// at the root is itself an anomaly worth flagging, not just unmapped
// attributes/relationships.

import type { JsonApiResource } from "./parasut_client.ts";

const KNOWN_ROOT_KEYS = new Set(["id", "type", "attributes", "relationships", "links", "meta"]);

export interface UnknownKeysReport {
  // A. genuinely new API keys, unknown to BOTH the real Swagger schema AND
  // the mapper manifest -- the only category that means "the API added
  // something nobody has looked at yet".
  unknown_attribute_keys: string[];
  unknown_relationship_keys: string[];
  unknown_root_keys: string[];
  // B. known in Swagger, but not yet moved to a named column by the
  // mapper -- e.g. Salary/Tax.tags before junction-table normalization.
  known_unmapped_attribute_keys: string[];
  known_unmapped_relationship_keys: string[];
  inspected_resource_count: number;
}

/**
 * `knownAttributeKeys` / `knownRelationshipKeys` must list exactly the keys
 * the resource's mapper function reads (kept next to each mapper's own
 * `attr()`/`relatedId()` calls, not derived by reflection, so a reviewer
 * can see at a glance that the manifest and the mapper agree).
 *
 * `swaggerAttributeKeys` / `swaggerRelationshipKeys` (Phase 13.2) must list
 * every key the real, live-downloaded swagger.json documents for this
 * resource's Attributes/Relationships, regardless of whether the mapper
 * has moved it into a column yet. A key present in the Swagger set but
 * absent from the mapper's known set is reported as
 * known_unmapped_*_keys, never as unknown_*_keys -- a genuinely
 * documented field must never be reported as if the API invented it.
 */
export function detectUnknownKeys(
  items: JsonApiResource[],
  knownAttributeKeys: readonly string[],
  knownRelationshipKeys: readonly string[],
  swaggerAttributeKeys: readonly string[] = [],
  swaggerRelationshipKeys: readonly string[] = [],
): UnknownKeysReport {
  const knownAttrs = new Set(knownAttributeKeys);
  const knownRels = new Set(knownRelationshipKeys);
  const swaggerAttrs = new Set([...swaggerAttributeKeys, ...knownAttributeKeys]);
  const swaggerRels = new Set([...swaggerRelationshipKeys, ...knownRelationshipKeys]);

  const unknownAttributeKeys = new Set<string>();
  const unknownRelationshipKeys = new Set<string>();
  const unknownRootKeys = new Set<string>();
  const knownUnmappedAttributeKeys = new Set<string>();
  const knownUnmappedRelationshipKeys = new Set<string>();

  for (const item of items) {
    for (const key of Object.keys(item as unknown as Record<string, unknown>)) {
      if (!KNOWN_ROOT_KEYS.has(key)) unknownRootKeys.add(key);
    }
    const attrs = item.attributes ?? {};
    for (const key of Object.keys(attrs)) {
      if (knownAttrs.has(key)) continue;
      if (swaggerAttrs.has(key)) knownUnmappedAttributeKeys.add(key);
      else unknownAttributeKeys.add(key);
    }
    const rels = item.relationships ?? {};
    for (const key of Object.keys(rels)) {
      if (knownRels.has(key)) continue;
      if (swaggerRels.has(key)) knownUnmappedRelationshipKeys.add(key);
      else unknownRelationshipKeys.add(key);
    }
  }

  return {
    unknown_attribute_keys: [...unknownAttributeKeys].sort(),
    unknown_relationship_keys: [...unknownRelationshipKeys].sort(),
    unknown_root_keys: [...unknownRootKeys].sort(),
    known_unmapped_attribute_keys: [...knownUnmappedAttributeKeys].sort(),
    known_unmapped_relationship_keys: [...knownUnmappedRelationshipKeys].sort(),
    inspected_resource_count: items.length,
  };
}

/**
 * Phase 13.2: compares the real runtime `item.type` against the
 * Swagger-documented enum for this resource. Returns null when they
 * agree (or when there is no runtime item to check). Never used to
 * coerce or replace the stored value -- the raw runtime type is always
 * what gets persisted; this is purely a diagnostic flag.
 */
export function detectTypeMismatch(
  items: JsonApiResource[],
  expectedSwaggerTypes: readonly string[],
): { runtime_type: string; expected_swagger_types: string[] }[] {
  const expected = new Set(expectedSwaggerTypes);
  const mismatches: { runtime_type: string; expected_swagger_types: string[] }[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const runtimeType = (item as unknown as { type?: string }).type;
    if (!runtimeType || seen.has(runtimeType)) continue;
    seen.add(runtimeType);
    if (!expected.has(runtimeType)) {
      mismatches.push({ runtime_type: runtimeType, expected_swagger_types: [...expected] });
    }
  }
  return mismatches;
}
