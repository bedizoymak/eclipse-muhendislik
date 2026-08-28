// Maps a Parasut JSON:API "item_category" resource to a parasut.item_categories row.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

function relatedId(item: JsonApiResource, key: string): number | null {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return null;
  const id = Number(rel.id);
  return Number.isFinite(id) ? id : null;
}

function relatedType(item: JsonApiResource, key: string): string | null {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return null;
  return (rel as { type?: string }).type ?? null;
}

/**
 * Phase 13.2: preserves the real relationships.subcategories.data array
 * verbatim ([{id,type},...]) exactly as returned -- never recomputed
 * from parent_category_parasut_id, never fabricated when absent.
 */
function relatedManyRaw(item: JsonApiResource, key: string): { id: string; type: string }[] | null {
  const rel = item.relationships?.[key]?.data;
  if (!Array.isArray(rel)) return null;
  return rel.map((r) => ({ id: String((r as { id?: unknown }).id), type: (r as { type?: string }).type ?? "" }));
}

export interface ItemCategoryRow {
  parasut_id: number;
  parasut_type: string | null;
  name: string | null;
  full_path: string | null;
  bg_color: string | null;
  text_color: string | null;
  category_type: string | null;
  parent_category_parasut_id: number | null;
  parent_category_parasut_type: string | null;
  subcategories: { id: string; type: string }[] | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapItemCategory(item: JsonApiResource): ItemCategoryRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`ItemCategory resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    parasut_type: (item as unknown as { type?: string }).type ?? null,
    name: attr(a, "name"),
    full_path: attr(a, "full_path"),
    bg_color: attr(a, "bg_color"),
    text_color: attr(a, "text_color"),
    category_type: attr(a, "category_type"),
    parent_category_parasut_id: relatedId(item, "parent_category"),
    parent_category_parasut_type: relatedType(item, "parent_category"),
    subcategories: relatedManyRaw(item, "subcategories"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
