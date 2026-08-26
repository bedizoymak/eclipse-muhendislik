// Maps Parasut JSON:API "products" / "inventory_levels" resources to
// parasut.products / parasut.inventory_levels rows.
//
// stock_count is used exactly as the API returns it (both the product's own
// denormalized total and each inventory_level's per-warehouse count) --
// never recomputed from stock_movements. `category` needs an explicit
// `include=category` to populate relationships.category.data (verified --
// without it the relationship comes back as {"meta":{}}, not even a null
// data key); `inventory_levels.warehouse` likewise needs its own explicit
// include to resolve each inventory_level's warehouse id (verified: without
// it, inventory_level.relationships.warehouse comes back empty even though
// the inventory_levels themselves are present via `include=inventory_levels`).

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

export interface ProductRow {
  parasut_id: number;
  code: string | null;
  name: string | null;
  vat_rate: number | null;
  sales_excise_duty: number | null;
  sales_excise_duty_type: string | null;
  sales_excise_duty_code: string | null;
  purchase_excise_duty: number | null;
  purchase_excise_duty_type: string | null;
  unit: string | null;
  communications_tax_rate: number | null;
  archived: boolean | null;
  list_price: number | null;
  currency: string | null;
  buying_price: number | null;
  buying_currency: string | null;
  list_price_in_trl: number | null;
  buying_price_in_trl: number | null;
  inventory_tracking: boolean | null;
  initial_stock_count: number | null;
  stock_count: number | null;
  gtip: string | null;
  barcode: string | null;
  sales_invoice_details_count: number | null;
  purchase_invoice_details_count: number | null;
  category_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapProduct(item: JsonApiResource): ProductRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`Product resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    code: attr(a, "code"),
    name: attr(a, "name"),
    vat_rate: attr(a, "vat_rate"),
    sales_excise_duty: attr(a, "sales_excise_duty"),
    sales_excise_duty_type: attr(a, "sales_excise_duty_type"),
    sales_excise_duty_code: attr(a, "sales_excise_duty_code"),
    purchase_excise_duty: attr(a, "purchase_excise_duty"),
    purchase_excise_duty_type: attr(a, "purchase_excise_duty_type"),
    unit: attr(a, "unit"),
    communications_tax_rate: attr(a, "communications_tax_rate"),
    archived: attr(a, "archived"),
    list_price: attr(a, "list_price"),
    currency: attr(a, "currency"),
    buying_price: attr(a, "buying_price"),
    buying_currency: attr(a, "buying_currency"),
    list_price_in_trl: attr(a, "list_price_in_trl"),
    buying_price_in_trl: attr(a, "buying_price_in_trl"),
    inventory_tracking: attr(a, "inventory_tracking"),
    initial_stock_count: attr(a, "initial_stock_count"),
    stock_count: attr(a, "stock_count"),
    gtip: attr(a, "gtip"),
    barcode: attr(a, "barcode"),
    sales_invoice_details_count: attr(a, "sales_invoice_details_count"),
    purchase_invoice_details_count: attr(a, "purchase_invoice_details_count"),
    category_parasut_id: relatedId(item, "category"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export function inventoryLevelIdsForProduct(product: JsonApiResource): string[] {
  const rel = product.relationships?.inventory_levels?.data;
  if (!rel) return [];
  return Array.isArray(rel) ? rel.map((r) => r.id) : [rel.id];
}

export interface InventoryLevelRow {
  parasut_id: number;
  stock_count: number | null;
  initial_stock_count: number | null;
  critical_stock_count: number | null;
  product_parasut_id: number;
  warehouse_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapInventoryLevel(item: JsonApiResource, productParasutId: number): InventoryLevelRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`InventoryLevel resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    stock_count: attr(a, "stock_count"),
    initial_stock_count: attr(a, "initial_stock_count"),
    critical_stock_count: attr(a, "critical_stock_count"),
    product_parasut_id: productParasutId,
    warehouse_parasut_id: relatedId(item, "warehouse"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
