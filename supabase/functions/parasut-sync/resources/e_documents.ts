// Maps Parasut JSON:API "e_invoices"/"e_archives" resources -- reached only
// via the real `active_e_document` relationship on sales_invoices and
// purchase_bills (verified: no standalone /e_invoices list endpoint exists,
// it 500s; /e_archives 404s; the polymorphic relationship is the only real
// access path).
//
// e_invoices is a genuinely polymorphic child: verified against the full
// live account, 427 belong to sales_invoices and 811 belong to
// purchase_bills. Its own `relationships.invoice` always comes back empty
// (`{"meta":{}}`), so the parent link is never read from the child -- it is
// always backfilled from the PARENT's own `relationships.active_e_document`,
// which is the only place Parasut actually states it.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

export interface EInvoiceRow {
  parasut_id: number;
  external_id: string | null;
  uuid: string | null;
  env_uuid: string | null;
  from_address: string | null;
  from_vkn: string | null;
  to_address: string | null;
  to_vkn: string | null;
  direction: string | null;
  note: string | null;
  response_type: string | null;
  contact_name: string | null;
  scenario: string | null;
  status: string | null;
  status_code: string | null;
  status_message: string | null;
  issue_date: string | null;
  expires_at: string | null;
  is_expired: boolean | null;
  is_answerable: boolean | null;
  is_seen: boolean | null;
  net_total: number | null;
  total_vat: number | null;
  currency: string | null;
  item_type: string | null;
  invoice_type_code: string | null;
  non_standard_e_invoice: boolean | null;
  archived: boolean | null;
  migration_source: string | null;
  profile_id: string | null;
  refund_of_id: number | null;
  vat_exemption_reason_code: string | null;
  pdf_url: string | null;
  signed_ubl_url: string | null;
  html_url: string | null;
  rendered_ubl_path: string | null;
  ubl_remote_id: string | null;
  signed_ubl_remote_id: string | null;
  parent_type: "sales_invoices" | "purchase_bills";
  parent_parasut_id: number;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapEInvoice(
  item: JsonApiResource,
  parentType: "sales_invoices" | "purchase_bills",
  parentParasutId: number,
): EInvoiceRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`EInvoice resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    external_id: attr(a, "external_id"),
    uuid: attr(a, "uuid"),
    env_uuid: attr(a, "env_uuid"),
    from_address: attr(a, "from_address"),
    from_vkn: attr(a, "from_vkn"),
    to_address: attr(a, "to_address"),
    to_vkn: attr(a, "to_vkn"),
    direction: attr(a, "direction"),
    note: attr(a, "note"),
    response_type: attr(a, "response_type"),
    contact_name: attr(a, "contact_name"),
    scenario: attr(a, "scenario"),
    status: attr(a, "status"),
    status_code: attr(a, "status_code"),
    status_message: attr(a, "status_message"),
    issue_date: attr(a, "issue_date"),
    expires_at: attr(a, "expires_at"),
    is_expired: attr(a, "is_expired"),
    is_answerable: attr(a, "is_answerable"),
    is_seen: attr(a, "is_seen"),
    net_total: attr(a, "net_total"),
    total_vat: attr(a, "total_vat"),
    currency: attr(a, "currency"),
    item_type: attr(a, "item_type"),
    invoice_type_code: attr(a, "invoice_type_code"),
    non_standard_e_invoice: attr(a, "non_standard_e_invoice"),
    archived: attr(a, "archived"),
    migration_source: attr(a, "migration_source"),
    profile_id: attr(a, "profile_id"),
    refund_of_id: attr(a, "refund_of_id"),
    vat_exemption_reason_code: attr(a, "vat_exemption_reason_code"),
    pdf_url: attr(a, "pdf_url"),
    signed_ubl_url: attr(a, "signed_ubl_url"),
    html_url: attr(a, "html_url"),
    rendered_ubl_path: attr(a, "__rendered_ubl_path"),
    ubl_remote_id: attr(a, "__ubl_remote_id"),
    signed_ubl_remote_id: attr(a, "__signed_ubl_remote_id"),
    parent_type: parentType,
    parent_parasut_id: parentParasutId,
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export interface EArchiveRow {
  parasut_id: number;
  uuid: string | null;
  vkn: string | null;
  invoice_number: string | null;
  note: string | null;
  is_printed: boolean | null;
  status: string | null;
  printed_at: string | null;
  cancellable_until: string | null;
  is_signed: boolean | null;
  email_status: string | null;
  pdf_url: string | null;
  signed_ubl_url: string | null;
  html_url: string | null;
  migration_source: string | null;
  sales_invoice_parasut_id: number;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapEArchive(item: JsonApiResource, salesInvoiceParasutId: number): EArchiveRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`EArchive resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    uuid: attr(a, "uuid"),
    vkn: attr(a, "vkn"),
    invoice_number: attr(a, "invoice_number"),
    note: attr(a, "note"),
    is_printed: attr(a, "is_printed"),
    status: attr(a, "status"),
    printed_at: attr(a, "printed_at"),
    cancellable_until: attr(a, "cancellable_until"),
    is_signed: attr(a, "is_signed"),
    email_status: attr(a, "email_status"),
    pdf_url: attr(a, "pdf_url"),
    signed_ubl_url: attr(a, "signed_ubl_url"),
    html_url: attr(a, "html_url"),
    migration_source: attr(a, "migration_source"),
    sales_invoice_parasut_id: salesInvoiceParasutId,
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
