// Maps a Parasut JSON:API "tag" resource to a parasut.tags row.
// Phase 13: this account has 0 real tags today (GET /tags -> 200,
// meta.total_count:0). Columns match the schema already created in the
// Phase 0 bulk migration -- tags has no archived concept in the official
// schema (verified: filter[archived] rejected as invalid on this
// endpoint), so there is no active/archived split for this resource.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

export interface TagRow {
  parasut_id: number;
  name: string | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapTag(item: JsonApiResource): TagRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Tag resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    name: attr(a, "name"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
