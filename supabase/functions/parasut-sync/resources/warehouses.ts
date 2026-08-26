// Maps a Parasut JSON:API "warehouse" resource to a parasut.warehouses row.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

export interface WarehouseRow {
  parasut_id: number;
  name: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  is_abroad: boolean | null;
  archived: boolean | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapWarehouse(item: JsonApiResource): WarehouseRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Warehouse resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    name: attr(a, "name"),
    address: attr(a, "address"),
    city: attr(a, "city"),
    district: attr(a, "district"),
    is_abroad: attr(a, "is_abroad"),
    archived: attr(a, "archived"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
