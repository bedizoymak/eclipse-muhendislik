// Maps a Parasut JSON:API "e_invoice_inbox" resource to a
// parasut.e_invoice_inboxes row.
// Phase 13: this account has 0 real e-invoice-inbox records today
// (GET /e_invoice_inboxes -> 200, meta.total_count:0). Columns match the
// schema already created in the Phase 0 bulk migration -- no archived
// attribute exists on this resource (schema has no such column), so there
// is no active/archived split for this resource.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

export interface EInvoiceInboxRow {
  parasut_id: number;
  vkn: string | null;
  e_invoice_address: string | null;
  name: string | null;
  inbox_type: string | null;
  address_registered_at: string | null;
  registered_at: string | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapEInvoiceInbox(item: JsonApiResource): EInvoiceInboxRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`EInvoiceInbox resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    vkn: attr(a, "vkn"),
    e_invoice_address: attr(a, "e_invoice_address"),
    name: attr(a, "name"),
    inbox_type: attr(a, "inbox_type"),
    address_registered_at: attr(a, "address_registered_at"),
    registered_at: attr(a, "registered_at"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
