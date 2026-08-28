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
  // Phase 13.3: query_vkn is INTENTIONALLY never written by this mapper.
  // The Phase 13.2 approach (storing the caller-supplied VKN on this
  // parasut.* mirror row) violated the ERP/Parasut schema boundary --
  // ERP_USER_ENTERED data must never live in a parasut.* mirror table.
  // The caller-supplied VKN now lives only in
  // erp.e_invoice_lookup_requests.query_vkn (see index.ts syncEInvoiceInboxes),
  // which this mapper has no access to and never touches.
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

/**
 * Phase 13.3: as of this phase, this resource is a lookup-only endpoint --
 * a real fetch only ever happens with a real filter[vkn] behind
 * secure-auth (still BLOCKED today, see index.ts syncEInvoiceInboxes /
 * BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH). The VKN value itself is never
 * accepted by or stored in this mapper -- it lives only in
 * erp.e_invoice_lookup_requests.
 *
 * Phase 13.4: `queried_at` was dropped as a physical column on
 * parasut.e_invoice_inboxes (it was lookup-operation metadata, not a real
 * swagger.json EInvoiceInboxAttributes field, so it could not live on the
 * Parasut mirror table). Since Phase 13.3 already made this table
 * lookup-only (never populated by an unfiltered/global sync), the
 * pre-existing `synced_at` field already carries equivalent provenance --
 * the `wasQueried` parameter is kept only as a historical/defensive no-op
 * signature for callers, it no longer changes the shape of the row.
 */
export function mapEInvoiceInbox(item: JsonApiResource, _wasQueried = false): EInvoiceInboxRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`EInvoiceInbox resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    parasut_type: (item as unknown as { type?: string }).type ?? null,
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
