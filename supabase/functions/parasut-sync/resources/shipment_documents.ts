// Maps Parasut JSON:API "shipment_documents" ("sevkiyat irsaliyeleri") and
// its real related resources -- verified directly against the live API
// (full pagination, both archived streams, 15 real records total).
//
// filter[archived] works (verified: =false -> 14, =true -> 1). Verified
// acceptable list-endpoint includes (via a real 400 error message): contact,
// tags, warehouse_transfer(.details/.inflow_warehouse/.outflow_warehouse),
// inbound_e_despatch, e_despatch_response, custom_requirement_infos,
// stock_movements(.product/.custom_requirement_infos). "activities" is real
// and populated but -- same as sales_offers.activities (Phase 7.1/7.2) --
// only resolves via the single-record endpoint; the list endpoint 400s on
// it. stock_movements is already fully represented by the existing
// parasut.stock_movements table's own source_type/source_parasut_id
// columns (verified: all 20 real (document, stock_movement) pairs already
// match exactly) -- not remapped here.

import type { JsonApiResource } from "../parasut_client.ts";

function attr<T>(attributes: Record<string, unknown>, key: string): T | null {
  const value = attributes[key];
  return value === undefined ? null : (value as T);
}

function relatedRef(item: JsonApiResource, key: string): { id: number | null; type: string | null } {
  const rel = item.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return { id: null, type: null };
  const id = Number(rel.id);
  return { id: Number.isFinite(id) ? id : null, type: rel.type ?? null };
}

export interface ShipmentDocumentRow {
  parasut_id: number;
  invoice_no: string | null;
  print_note: string | null;
  printed_at: string | null;
  inflow: boolean | null;
  description: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  issue_date: string | null;
  shipment_date: string | null;
  procurement_number: string | null;
  archived: boolean | null;
  contact_parasut_id: number | null;
  uuid: string | null;
  despatch_no: string | null;
  order_no: string | null;
  order_date: string | null;
  status: string | null;
  status_message: string | null;
  status_changed_at: string | null;
  carrier_legal_name: string | null;
  carrier_tax_number: string | null;
  carrier_license_plate: string | null;
  drivers_info: unknown;
  postal_code: string | null;
  company_address: string | null;
  company_city: string | null;
  company_district: string | null;
  company_postal_code: string | null;
  has_invoice: boolean | null;
  shipment_document_type: string | null;
  is_commercial: boolean | null;
  issue_datetime: string | null;
  printed_issue_date: string | null;
  legalized_at: string | null;
  sharings_count: number | null;
  warehouse_transfer_parasut_id: number | null;
  e_despatch_response_type: string | null;
  e_despatch_response_parasut_id: number | null;
  inbound_e_despatch_parasut_id: number | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapShipmentDocument(item: JsonApiResource): ShipmentDocumentRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`ShipmentDocument resource has a non-numeric id: ${item.id}`);
  }

  const warehouseTransfer = relatedRef(item, "warehouse_transfer");
  const eDespatchResponse = relatedRef(item, "e_despatch_response");
  const inboundEDespatch = relatedRef(item, "inbound_e_despatch");
  const contact = relatedRef(item, "contact");

  return {
    parasut_id: parasutId,
    invoice_no: attr(a, "invoice_no"),
    print_note: attr(a, "print_note"),
    printed_at: attr(a, "printed_at"),
    inflow: attr(a, "inflow"),
    description: attr(a, "description"),
    city: attr(a, "city"),
    district: attr(a, "district"),
    address: attr(a, "address"),
    issue_date: attr(a, "issue_date"),
    shipment_date: attr(a, "shipment_date"),
    procurement_number: attr(a, "procurement_number"),
    archived: attr(a, "archived"),
    contact_parasut_id: contact.id,
    uuid: attr(a, "uuid"),
    despatch_no: attr(a, "despatch_no"),
    order_no: attr(a, "order_no"),
    order_date: attr(a, "order_date"),
    status: attr(a, "status"),
    status_message: attr(a, "status_message"),
    status_changed_at: attr(a, "status_changed_at"),
    carrier_legal_name: attr(a, "carrier_legal_name"),
    carrier_tax_number: attr(a, "carrier_tax_number"),
    carrier_license_plate: attr(a, "carrier_license_plate"),
    drivers_info: attr(a, "drivers_info"),
    postal_code: attr(a, "postal_code"),
    company_address: attr(a, "company_address"),
    company_city: attr(a, "company_city"),
    company_district: attr(a, "company_district"),
    company_postal_code: attr(a, "company_postal_code"),
    has_invoice: attr(a, "has_invoice"),
    shipment_document_type: attr(a, "shipment_document_type"),
    is_commercial: attr(a, "is_commercial"),
    issue_datetime: attr(a, "issue_datetime"),
    printed_issue_date: attr(a, "printed_issue_date"),
    legalized_at: attr(a, "legalized_at"),
    sharings_count: attr(a, "sharings_count"),
    warehouse_transfer_parasut_id: warehouseTransfer.id,
    e_despatch_response_type: eDespatchResponse.type,
    e_despatch_response_parasut_id: eDespatchResponse.id,
    inbound_e_despatch_parasut_id: inboundEDespatch.id,
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export interface InboundEDespatchRow {
  parasut_id: number;
  shipment_document_parasut_id: number;
  uuid: string | null;
  despatch_no: string | null;
  contact_name: string | null;
  issue_date: string | null;
  from_tax_number: string | null;
  response_status: string | null;
  response_type: string | null;
  expires_at: string | null;
  is_expired: boolean | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapInboundEDespatch(item: JsonApiResource, shipmentDocumentParasutId: number): InboundEDespatchRow {
  const a = item.attributes ?? {};
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`InboundEDespatch resource has a non-numeric id: ${item.id}`);
  }

  return {
    parasut_id: parasutId,
    shipment_document_parasut_id: shipmentDocumentParasutId,
    uuid: attr(a, "uuid"),
    despatch_no: attr(a, "despatch_no"),
    contact_name: attr(a, "contact_name"),
    issue_date: attr(a, "issue_date"),
    from_tax_number: attr(a, "from_tax_number"),
    response_status: attr(a, "response_status"),
    response_type: attr(a, "response_type"),
    expires_at: attr(a, "expires_at"),
    is_expired: attr(a, "is_expired"),
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}

export interface ShipmentDocumentActivityRow {
  parasut_id: number;
  shipment_document_parasut_id: number;
  activity_type: string | null;
  date: string | null;
  data_description: string | null;
  data_issue_date: string | null;
  done_by_email: string | null;
  done_by_parasut_id: number | null;
  done_by_type: string | null;
  done_by_name: string | null;
  done_by_user_email: string | null;
  item_parasut_id: number | null;
  item_type: string | null;
  raw: JsonApiResource;
  parasut_created_at: string | null;
  parasut_updated_at: string | null;
  synced_at: string;
}

export function mapShipmentDocumentActivity(
  item: JsonApiResource,
  shipmentDocumentParasutId: number,
  doneByUser: JsonApiResource | null,
): ShipmentDocumentActivityRow {
  const a = item.attributes ?? {};
  const d = (a.data ?? {}) as Record<string, unknown>;
  const parasutId = Number(item.id);
  if (!Number.isFinite(parasutId)) {
    throw new Error(`ShipmentDocumentActivity resource has a non-numeric id: ${item.id}`);
  }

  const doneBy = relatedRef(item, "done_by");
  const itemRef = relatedRef(item, "item");
  const userAttrs = doneByUser?.attributes ?? {};

  return {
    parasut_id: parasutId,
    shipment_document_parasut_id: shipmentDocumentParasutId,
    activity_type: attr(a, "activity_type"),
    date: attr(a, "date"),
    data_description: attr(d, "description"),
    data_issue_date: attr(d, "issue_date"),
    done_by_email: attr(a, "done_by_email"),
    done_by_parasut_id: doneBy.id,
    done_by_type: doneBy.type,
    done_by_name: doneByUser ? attr(userAttrs, "name") : null,
    done_by_user_email: doneByUser ? attr(userAttrs, "email") : null,
    item_parasut_id: itemRef.id,
    item_type: itemRef.type,
    raw: item,
    parasut_created_at: attr(a, "created_at"),
    parasut_updated_at: attr(a, "updated_at"),
    synced_at: new Date().toISOString(),
  };
}
