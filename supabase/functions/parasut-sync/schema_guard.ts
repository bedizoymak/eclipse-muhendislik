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
  unknown_attribute_keys: string[];
  unknown_relationship_keys: string[];
  unknown_root_keys: string[];
  inspected_resource_count: number;
}

/**
 * `knownAttributeKeys` / `knownRelationshipKeys` must list exactly the keys
 * the resource's mapper function reads (kept next to each mapper's own
 * `attr()`/`relatedId()` calls, not derived by reflection, so a reviewer
 * can see at a glance that the manifest and the mapper agree).
 */
export function detectUnknownKeys(
  items: JsonApiResource[],
  knownAttributeKeys: readonly string[],
  knownRelationshipKeys: readonly string[],
): UnknownKeysReport {
  const knownAttrs = new Set(knownAttributeKeys);
  const knownRels = new Set(knownRelationshipKeys);

  const unknownAttributeKeys = new Set<string>();
  const unknownRelationshipKeys = new Set<string>();
  const unknownRootKeys = new Set<string>();

  for (const item of items) {
    for (const key of Object.keys(item as unknown as Record<string, unknown>)) {
      if (!KNOWN_ROOT_KEYS.has(key)) unknownRootKeys.add(key);
    }
    const attrs = item.attributes ?? {};
    for (const key of Object.keys(attrs)) {
      if (!knownAttrs.has(key)) unknownAttributeKeys.add(key);
    }
    const rels = item.relationships ?? {};
    for (const key of Object.keys(rels)) {
      if (!knownRels.has(key)) unknownRelationshipKeys.add(key);
    }
  }

  return {
    unknown_attribute_keys: [...unknownAttributeKeys].sort(),
    unknown_relationship_keys: [...unknownRelationshipKeys].sort(),
    unknown_root_keys: [...unknownRootKeys].sort(),
    inspected_resource_count: items.length,
  };
}
