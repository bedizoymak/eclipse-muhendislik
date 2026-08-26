// Maps a Parasut JSON:API "stock_movement" resource to a
// parasut.stock_movements row.
//
// `source` is polymorphic (shipment_documents, sales_invoice_details,
// purchase_bill_details -- per the schema); both id and type are stored.

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
  return rel.type ?? null;
}

export interface StockMovementRow {
  parasut_id: number;
  detail_no: number | null;
  date: string | null;
  quantity: number | null;
  warehouse_parasut_id: number | null;
  product_parasut_id: number | null;
  source_type: string | null;
  source_parasut_id: number | null;
  contact_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapStockMovement(item: JsonApiResource): StockMovementRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`StockMovement resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    detail_no: attr(a, "detail_no"),
    date: attr(a, "date"),
    quantity: attr(a, "quantity"),
    warehouse_parasut_id: relatedId(item, "warehouse"),
    product_parasut_id: relatedId(item, "product"),
    source_type: relatedType(item, "source"),
    source_parasut_id: relatedId(item, "source"),
    contact_parasut_id: relatedId(item, "contact"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
