import { supabase } from "@/integrations/supabase/client";

// Shared by FaturaDetay.tsx (sales_invoices) and GiderDetay.tsx
// (purchase_bills) -- both parent types resolve their real
// active_e_document (e_invoices or e_archives) the same way: via the
// parent's own active_e_document_type/active_e_document_parasut_id
// columns, which are populated only from the real Parasut relationship,
// never guessed. A parent with no real active_e_document simply has both
// columns null, and no e-document row is fetched or shown.

export interface EInvoiceRow {
  parasut_id: number;
  parent_type: string | null;
  parent_parasut_id: number | null;
  // Phase 14.3: only present on rows read from parasut_e_invoices_demo
  // (the standalone e-invoices universe). Computed by
  // parasut.e_invoices_with_resolution -- 'resolved' means the parent row
  // exists locally and a route link is safe to render; 'unresolved' means
  // a real API relationship exists but the parent isn't stored locally
  // (must show the real id/type as plain text, never a fabricated link);
  // 'no_relationship' means the API's own invoice.data was null. Absent
  // (undefined) on rows read via the active-document path (FaturaDetay/
  // GiderDetay), where the parent is always resolved by construction.
  parent_resolution_status?: "resolved" | "unresolved" | "no_relationship";
  external_id: string | null;
  uuid: string | null;
  direction: string | null;
  scenario: string | null;
  status: string | null;
  status_code: string | null;
  status_message: string | null;
  item_type: string | null;
  invoice_type_code: string | null;
  issue_date: string | null;
  expires_at: string | null;
  is_expired: boolean | null;
  is_answerable: boolean | null;
  is_seen: boolean | null;
  non_standard_e_invoice: boolean | null;
  archived: boolean | null;
  currency: string | null;
  net_total: number | null;
  total_vat: number | null;
  contact_name: string | null;
  from_address: string | null;
  from_vkn: string | null;
  to_address: string | null;
  to_vkn: string | null;
  note: string | null;
  response_type: string | null;
  env_uuid: string | null;
  profile_id: string | null;
  refund_of_id: number | null;
  vat_exemption_reason_code: string | null;
  pdf_url: string | null;
  signed_ubl_url: string | null;
  html_url: string | null;
  gtb_ref_no: string | null;
  migration_source: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export interface EArchiveRow {
  parasut_id: number;
  sales_invoice_parasut_id: number | null;
  uuid: string | null;
  vkn: string | null;
  invoice_number: string | null;
  status: string | null;
  is_printed: boolean | null;
  is_signed: boolean | null;
  printed_at: string | null;
  cancellable_until: string | null;
  email_status: string | null;
  note: string | null;
  pdf_url: string | null;
  signed_ubl_url: string | null;
  html_url: string | null;
  migration_source: string | null;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export type EDocument = { kind: "e_invoices"; row: EInvoiceRow } | { kind: "e_archives"; row: EArchiveRow };

/**
 * Fetches the parent's real active e-document, using exactly the type/id
 * the parent's own active_e_document_type/active_e_document_parasut_id
 * columns state. Returns null when the parent genuinely has no document
 * (both columns null) -- never fabricated, never guessed from another
 * type when the stated type isn't one of the two real types this account
 * has ever shown.
 */
export async function fetchActiveEDocument(
  activeEDocumentType: string | null,
  activeEDocumentParasutId: number | null,
): Promise<{ doc: EDocument | null; error: string | null }> {
  if (!supabase || !activeEDocumentType || !activeEDocumentParasutId) {
    return { doc: null, error: null };
  }

  // A real but previously-unseen active_e_document type is filtered
  // server-side too (the "resolve" action only ever recognizes these two
  // real types) -- not guessed or rendered as one of the two known kinds.
  if (activeEDocumentType !== "e_invoices" && activeEDocumentType !== "e_archives") {
    return { doc: null, error: null };
  }

  const { data, error } = await supabase.functions.invoke("e-documents", {
    body: { action: "resolve", docType: activeEDocumentType, id: activeEDocumentParasutId },
  });
  if (error) return { doc: null, error: error.message };
  if (data?.error) return { doc: null, error: data.error };
  return { doc: (data?.data as EDocument | null) ?? null, error: null };
}

export const E_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  e_invoices: "e-Fatura",
  e_archives: "e-Arşiv",
};

// Distinguishes real null from real false/0/"" -- never collapses a real
// falsy value into the same "--" shown for null/undefined.
export function formatEDocValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "string" && value.trim() === "") return "—";
  return String(value);
}

// Parasut's own API returns pdf_url/html_url as a relative path (e.g.
// "/666034/e_invoices/1055802035/show_original") while signed_ubl_url is
// already absolute (e.g. "https://uygulama.parasut.com/..."). The DB/view
// stores the raw value exactly as the API gave it -- this resolver only
// runs at render time, never touches storage. A relative path is resolved
// against Parasut's own app origin (never anything else); an already-
// absolute http(s) URL passes through unchanged; anything else (null,
// empty, javascript:/data:/protocol-relative, or a value that fails to
// parse as a real URL) returns null so no link is ever rendered for it.
const PARASUT_APP_ORIGIN = "https://uygulama.parasut.com";

export function resolveEDocumentUrl(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  // Reject protocol-relative ("//host/path") explicitly -- resolving it
  // against PARASUT_APP_ORIGIN would silently adopt whatever host it names,
  // not Parasut's.
  if (value.trim().startsWith("//")) return null;
  let resolved: URL;
  try {
    resolved = new URL(value, PARASUT_APP_ORIGIN);
  } catch {
    return null;
  }
  if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return null;
  return resolved.href;
}
