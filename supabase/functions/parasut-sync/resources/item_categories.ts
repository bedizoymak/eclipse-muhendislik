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

export interface ItemCategoryRow {
  parasut_id: number;
  name: string | null;
  full_path: string | null;
  bg_color: string | null;
  text_color: string | null;
  category_type: string | null;
  parent_category_parasut_id: number | null;
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
    name: attr(a, "name"),
    full_path: attr(a, "full_path"),
    bg_color: attr(a, "bg_color"),
    text_color: attr(a, "text_color"),
    category_type: attr(a, "category_type"),
    parent_category_parasut_id: relatedId(item, "parent_category"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
