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
  parasut_type: string | null;
  // Phase 13.2: the VKN this row was queried FOR (ERP_USER_ENTERED /
  // caller-supplied input), kept separate from attributes.vkn below
  // (Parasut's own PARASUT_AUTHORITATIVE echo of the queried taxpayer).
  // Only ever set when the caller actually ran a filter[vkn] query --
  // this mapper never invents one.
  query_vkn: string | null;
  vkn: string | null;
  e_invoice_address: string | null;
  name: string | null;
  inbox_type: string | null;
  address_registered_at: string | null;
  registered_at: string | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  queried_at: string | null;
  synced_at: string;
}

/**
 * `queriedVkn` is the real filter[vkn] value used for the request that
 * produced `item`, when known (passed by the caller, never guessed by
 * this mapper). Today's bulk sync calls this resource unfiltered (no
 * `filter[vkn]` at all -- see index.ts syncEInvoiceInboxes), so callers
 * of the unfiltered sync path pass `null`.
 */
export function mapEInvoiceInbox(item: JsonApiResource, queriedVkn: string | null = null): EInvoiceInboxRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`EInvoiceInbox resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    parasut_type: (item as unknown as { type?: string }).type ?? null,
    query_vkn: queriedVkn,
    vkn: attr(a, "vkn"),
    e_invoice_address: attr(a, "e_invoice_address"),
    name: attr(a, "name"),
    inbox_type: attr(a, "inbox_type"),
    address_registered_at: attr(a, "address_registered_at"),
    registered_at: attr(a, "registered_at"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    queried_at: queriedVkn ? new Date().toISOString() : null,
    synced_at: new Date().toISOString(),
  };
}
