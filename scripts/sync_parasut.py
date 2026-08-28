#!/usr/bin/env python3
"""Sync data from the Parasut API (api.parasut.com) into the Supabase
`parasut` schema.

Credentials are read from environment variables only, never from the
command line or a tracked file:

    PARASUT_USERNAME, PARASUT_PASSWORD    Parasut login (password grant)
    PARASUT_CLIENT_ID, PARASUT_CLIENT_SECRET
    PARASUT_COMPANY_ID                    numeric company id
    SUPABASE_DB_URL                       Postgres connection string
                                           (session pooler recommended --
                                           the direct db.<ref>.supabase.co
                                           host is IPv6-only)

Paginates every listable resource, uses `include=` to pull in child/
related records (details, payments, transactions, tags, category,
etc.) that have no standalone list endpoint, and upserts everything
into the matching table in the `parasut` schema by `parasut_id`. Every
row also gets a `raw` jsonb copy of its exact API payload.

Usage:
    python scripts/sync_parasut.py                 # full sync, all resources
    python scripts/sync_parasut.py --only tags,warehouses,item_categories
    python scripts/sync_parasut.py --page-size 5 --only tags   # smoke test
    python scripts/sync_parasut.py --delay 2.0      # slower, extra safe
"""

import argparse
import os
import sys
import time

import psycopg2
import psycopg2.extras
import requests

API_BASE = "https://api.parasut.com"
TOKEN_URL = f"{API_BASE}/oauth/token"
API_VERSION = "v4"

DEFAULT_DELAY = 1.2  # seconds between requests -- "normal speed", stays well under typical rate limits
MAX_RETRIES = 8

# ---------------------------------------------------------------------------
# Table specs: JSON:API type (as returned by Parasut) -> table + attribute
# columns + relationship name -> column mapping. Mirrors
# supabase/migrations/20260825010000_parasut_schema_dedicated.sql exactly.
# ---------------------------------------------------------------------------

# alternate/legacy type spellings Parasut might return, normalized to our canonical type
TYPE_ALIASES = {
    "company": "companies",
    "sales_offers_details": "sales_offer_details",
    "sales_offer": "sales_offers",
}

RESOURCES = {
    "companies": {
        "table": "companies", "id_type": "bigint",
        "attrs": [
            "name", "legal_name", "tax_office", "tax_number", "mersis_no", "district", "city",
            "occupation_field", "primary_job", "app_url", "subscription_status",
            "subscription_status_for_analytics", "subscription_started_at",
            "subscription_renewed_at", "subscription_value", "valid_until",
            "trial_expiration_at", "is_in_trial_period", "end_of_grace_period_at",
            "is_in_grace_period", "total_unused_bonus_months", "is_active", "accessible",
            "inspectable", "inventory_enabled", "has_iyzico_integration",
            "has_active_subscription", "allowed_inspection_at",
        ],
        "rels": {},
    },
    "item_categories": {
        "table": "item_categories",
        "attrs": ["name", "full_path", "bg_color", "text_color", "category_type"],
        "rels": {"parent_category": "parent_category_parasut_id"},
    },
    "tags": {"table": "tags", "attrs": ["name"], "rels": {}},
    "taxes": {
        "table": "taxes",
        "attrs": ["description", "issue_date", "due_date", "net_total", "total_paid",
                  "remaining", "remaining_in_trl", "archived"],
        "rels": {"category": "category_parasut_id"},
    },
    "accounts": {
        "table": "accounts",
        "attrs": ["name", "account_type", "currency", "bank_name", "bank_branch",
                  "bank_account_no", "iban", "balance", "used_for", "last_used_at",
                  "last_adjustment_date", "bank_integration_type", "associate_email", "archived"],
        "rels": {},
    },
    "contacts": {
        "table": "contacts",
        "attrs": ["name", "short_name", "email", "contact_type", "tax_office", "tax_number",
                  "district", "postal_code", "city", "country", "address", "phone", "fax",
                  "is_abroad", "archived", "iban", "account_type", "untrackable",
                  "invoicing_preferences", "balance", "trl_balance", "usd_balance",
                  "eur_balance", "gbp_balance"],
        "rels": {"category": "category_parasut_id"},
    },
    "contact_people": {
        "table": "contact_people",
        "attrs": ["name", "email", "phone", "notes"],
        "rels": {"contact": "contact_parasut_id"},
    },
    "addresses": {
        "table": "addresses",
        "attrs": ["name", "address", "phone", "fax"],
        "rels": {"addressable": ("addressable_parasut_id", "addressable_type")},
    },
    "employees": {
        "table": "employees",
        "attrs": ["name", "email", "iban", "archived", "balance", "trl_balance",
                  "usd_balance", "eur_balance", "gbp_balance"],
        "rels": {"category": "category_parasut_id"},
    },
    "salaries": {
        "table": "salaries",
        "attrs": ["description", "currency", "issue_date", "due_date", "exchange_rate",
                  "net_total", "total_paid", "remaining", "remaining_in_trl", "archived"],
        "rels": {"employee": "employee_parasut_id", "category": "category_parasut_id"},
    },
    "bank_fees": {
        "table": "bank_fees",
        "attrs": ["description", "currency", "issue_date", "due_date", "exchange_rate",
                  "net_total", "total_paid", "remaining", "remaining_in_trl", "archived"],
        "rels": {"category": "category_parasut_id"},
    },
    "warehouses": {
        "table": "warehouses",
        "attrs": ["name", "address", "city", "district", "is_abroad", "archived"],
        "rels": {},
    },
    "products": {
        "table": "products",
        "attrs": ["code", "name", "vat_rate", "sales_excise_duty", "sales_excise_duty_type",
                  "sales_excise_duty_code", "purchase_excise_duty", "purchase_excise_duty_type",
                  "unit", "communications_tax_rate", "archived", "list_price", "currency",
                  "buying_price", "buying_currency", "list_price_in_trl", "buying_price_in_trl",
                  "inventory_tracking", "initial_stock_count", "stock_count", "gtip", "barcode",
                  "sales_invoice_details_count", "purchase_invoice_details_count"],
        "rels": {"category": "category_parasut_id"},
    },
    "inventory_levels": {
        "table": "inventory_levels",
        "attrs": ["stock_count", "initial_stock_count", "critical_stock_count"],
        "rels": {"product": "product_parasut_id", "warehouse": "warehouse_parasut_id"},
    },
    "purchase_bills": {
        "table": "purchase_bills",
        "attrs": ["item_type", "description", "issue_date", "due_date", "invoice_no", "currency",
                  "exchange_rate", "net_total", "withholding_rate", "invoice_discount_type",
                  "invoice_discount", "gross_total", "total_excise_duty",
                  "total_communications_tax", "total_vat", "total_vat_withholding",
                  "total_discount", "total_invoice_discount", "remaining", "remaining_in_trl",
                  "payment_status", "is_detailed", "sharings_count", "e_invoices_count",
                  "remaining_reimbursement", "remaining_reimbursement_in_trl", "total_paid",
                  "archived"],
        "rels": {"category": "category_parasut_id", "spender": "spender_parasut_id",
                 "supplier": "supplier_parasut_id", "pay_to": "pay_to_parasut_id",
                 "recurrence_plan": "recurrence_plan_parasut_id",
                 "active_e_document": ("active_e_document_parasut_id", "active_e_document_type")},
    },
    "purchase_bill_details": {
        "table": "purchase_bill_details",
        "attrs": ["quantity", "unit_price", "vat_rate", "vat_withholding_rate",
                  "vat_withholding", "discount_type", "discount_value", "excise_duty_type",
                  "excise_duty_value", "communications_tax_rate", "description", "net_total"],
        "rels": {"warehouse": "warehouse_parasut_id", "product": "product_parasut_id",
                 "purchase_bill": "purchase_bill_parasut_id"},
    },
    "sales_invoices": {
        "table": "sales_invoices",
        "attrs": ["invoice_no", "invoice_series", "invoice_id", "item_type", "description",
                  "issue_date", "due_date", "currency", "exchange_rate", "net_total",
                  "gross_total", "withholding", "withholding_rate", "total_excise_duty",
                  "total_communications_tax", "total_vat", "total_vat_withholding",
                  "total_discount", "total_invoice_discount", "before_taxes_total", "remaining",
                  "remaining_in_trl", "payment_status", "invoice_discount_type",
                  "invoice_discount", "billing_address", "billing_postal_code", "billing_phone",
                  "billing_fax", "tax_office", "tax_number", "country", "city", "district",
                  "is_abroad", "order_no", "order_date", "shipment_addres", "shipment_included",
                  "cash_sale", "payer_tax_numbers", "invoice_note", "append_contact_balance",
                  "e_document_accounts", "archived"],
        "rels": {"category": "category_parasut_id", "contact": "contact_parasut_id",
                 "sales_offer": "sales_offer_parasut_id",
                 "recurrence_plan": "recurrence_plan_parasut_id",
                 "active_e_document": ("active_e_document_parasut_id", "active_e_document_type")},
    },
    "sales_invoice_details": {
        "table": "sales_invoice_details",
        "attrs": ["quantity", "unit_price", "vat_rate", "vat_withholding_rate",
                  "vat_withholding", "discount_type", "discount_value", "excise_duty_type",
                  "excise_duty_value", "communications_tax_rate", "description",
                  "delivery_method", "shipping_method", "net_total"],
        "rels": {"warehouse": "warehouse_parasut_id", "product": "product_parasut_id",
                 "sales_invoice": "sales_invoice_parasut_id"},
    },
    "sales_offers": {
        "table": "sales_offers",
        "attrs": ["content", "contact_type", "status", "display_exchange_rate_in_pdf",
                  "net_total", "gross_total", "withholding", "withholding_rate",
                  "total_excise_duty", "total_communications_tax", "total_accommodation_tax",
                  "total_vat", "total_vat_withholding", "vat_withholding", "total_discount",
                  "total_invoice_discount", "description", "issue_date", "due_date", "currency",
                  "exchange_rate", "invoice_discount_type", "invoice_discount", "billing_address",
                  "billing_phone", "billing_fax", "tax_office", "tax_number", "city", "district",
                  "is_abroad", "order_no", "order_date", "sharings_count", "archived"],
        "rels": {"contact": "contact_parasut_id", "sales_invoice": "sales_invoice_parasut_id"},
    },
    "sales_offer_details": {
        "table": "sales_offer_details",
        "attrs": ["description", "net_total", "unit_price", "vat_rate", "quantity",
                  "discount_type", "discount_value", "communications_tax_rate",
                  "excise_duty_type", "excise_duty", "excise_duty_rate", "discount",
                  "communications_tax", "detail_no", "net_total_without_invoice_discount",
                  "vat_withholding", "vat_withholding_rate", "accommodation_tax_rate",
                  "accommodation_tax", "accommodation_tax_exempt", "excise_duty_value"],
        "rels": {"product": "product_parasut_id", "sales_offer": "sales_offer_parasut_id"},
    },
    "shipment_documents": {
        "table": "shipment_documents",
        "attrs": ["invoice_no", "print_note", "printed_at", "inflow", "description", "city",
                  "district", "address", "issue_date", "shipment_date", "procurement_number",
                  "archived"],
        "rels": {"contact": "contact_parasut_id"},
    },
    "stock_movements": {
        "table": "stock_movements",
        "attrs": ["detail_no", "date", "quantity"],
        "rels": {"warehouse": "warehouse_parasut_id", "product": "product_parasut_id",
                 "source": ("source_parasut_id", "source_type"),
                 "contact": "contact_parasut_id"},
    },
    "stock_updates": {"table": "stock_updates", "attrs": [], "rels": {}},
    "stock_update_details": {
        "table": "stock_update_details",
        "attrs": ["old_total_inventory", "new_total_inventory"],
        "rels": {"warehouse": "warehouse_parasut_id", "product": "product_parasut_id",
                 "stock_update": "stock_update_parasut_id"},
    },
    "payments": {
        "table": "payments",
        "attrs": ["date", "amount", "currency", "notes"],
        "rels": {"payable": ("payable_parasut_id", "payable_type"),
                 "transaction": "transaction_parasut_id"},
    },
    "transactions": {
        "table": "transactions",
        "attrs": ["description", "transaction_type", "date", "amount_in_trl", "debit_amount",
                  "debit_currency", "credit_amount", "credit_currency"],
        "rels": {"debit_account": "debit_account_parasut_id",
                 "credit_account": "credit_account_parasut_id"},
    },
    "e_invoices": {
        "table": "e_invoices",
        "attrs": ["external_id", "uuid", "env_uuid", "from_address", "from_vkn", "to_address",
                  "to_vkn", "direction", "note", "response_type", "contact_name", "scenario",
                  "status", "gtb_ref_no", "gtb_registration_no", "gtb_export_date",
                  "response_note", "issue_date", "is_expired", "is_answerable", "net_total",
                  "currency", "item_type"],
        "rels": {"invoice": "invoice_parasut_id"},
    },
    "e_archives": {
        "table": "e_archives",
        "attrs": ["uuid", "vkn", "invoice_number", "note", "is_printed", "status", "printed_at",
                  "cancellable_until", "is_signed"],
        "rels": {"sales_invoice": "sales_invoice_parasut_id"},
    },
    "e_smms": {
        "table": "e_smms",
        "attrs": ["uuid", "vkn", "invoice_number", "is_printed", "pdf_url", "printed_at"],
        "rels": {"sales_invoice": "sales_invoice_parasut_id"},
    },
    "e_invoice_inboxes": {
        "table": "e_invoice_inboxes",
        "attrs": ["vkn", "e_invoice_address", "name", "inbox_type", "address_registered_at",
                  "registered_at"],
        "rels": {},
    },
    "trackable_jobs": {
        "table": "trackable_jobs", "id_type": "text",
        "attrs": ["status", "errors"],
        "rels": {},
    },
}

# Resources with a real top-level GET list endpoint. Everything else is only
# ever reachable via `include=` on one of these (payments, transactions,
# details, addresses, contact_people, inventory_levels, e-documents, ...).
LIST_ENDPOINTS = [
    # (jsonapi type, path template, include param)
    # include values verified directly against swagger.json's per-endpoint
    # "Available: ..." list -- Parasut 400s on anything outside that list.
    ("item_categories", "/{company_id}/item_categories", "parent_category"),
    ("tags", "/{company_id}/tags", None),
    ("taxes", "/{company_id}/taxes", "category,tags,payments"),
    ("accounts", "/{company_id}/accounts", None),
    ("contacts", "/{company_id}/contacts", "category,contact_people"),
    ("employees", "/{company_id}/employees", "category"),
    ("salaries", "/{company_id}/salaries", "employee,category,tags,payments"),
    # bank_fees has NO list endpoint at all (POST/{id} only) -- can't be bulk synced.
    ("warehouses", "/{company_id}/warehouses", "inventory_levels"),
    ("products", "/{company_id}/products", "category,inventory_levels"),
    ("purchase_bills", "/{company_id}/purchase_bills",
     "category,spender,supplier,details,details.product,payments,tags,active_e_document,pay_to"),
    ("sales_invoices", "/{company_id}/sales_invoices",
     "category,contact,details,details.product,payments,tags,active_e_document"),
    ("sales_offers", "/{company_id}/sales_offers", "contact,sales_invoice"),
    ("shipment_documents", "/{company_id}/shipment_documents", "contact,tags,stock_movements"),
    ("stock_movements", "/{company_id}/stock_movements", "warehouse,product,source,contact"),
    # Phase 13.3: e_invoice_inboxes REMOVED from the general full-sync list.
    # This endpoint is a taxpayer LOOKUP service (filter[vkn]=...), not a
    # global collection -- an unfiltered call has no "list all" semantics
    # and must never be reported as a successful global sync. See
    # supabase/functions/parasut-sync/index.ts syncEInvoiceInboxes
    # (BLOCKED_LOOKUP_REQUIRES_VKN_AND_AUTH) for the lookup-only path.
]

# Parasut only embeds forward linkage (parent -> child ids) on the PARENT
# resource's own relationships block; the child resources returned in
# `included` do NOT carry a back-reference (their relationship shows only
# `{"meta": {}}`, no `data`). So for known parent/child pairs we backfill the
# child's FK column(s) using the parent's relationship linkage.
# (parent_type, parent_relation_name) -> child fk info
BACKFILL = {
    ("warehouses", "inventory_levels"): {"id_col": "warehouse_parasut_id"},
    ("products", "inventory_levels"): {"id_col": "product_parasut_id"},
    ("purchase_bills", "details"): {"id_col": "purchase_bill_parasut_id"},
    ("sales_invoices", "details"): {"id_col": "sales_invoice_parasut_id"},
    ("sales_offers", "details"): {"id_col": "sales_offer_parasut_id"},
    ("stock_updates", "details"): {"id_col": "stock_update_parasut_id"},
    ("purchase_bills", "payments"): {"id_col": "payable_parasut_id", "type_col": "payable_type", "type_val": "PurchaseBill"},
    ("sales_invoices", "payments"): {"id_col": "payable_parasut_id", "type_col": "payable_type", "type_val": "SalesInvoice"},
    ("salaries", "payments"): {"id_col": "payable_parasut_id", "type_col": "payable_type", "type_val": "Salary"},
    ("bank_fees", "payments"): {"id_col": "payable_parasut_id", "type_col": "payable_type", "type_val": "BankFee"},
    ("taxes", "payments"): {"id_col": "payable_parasut_id", "type_col": "payable_type", "type_val": "Tax"},
    ("contacts", "contact_people"): {"id_col": "contact_parasut_id"},
    ("contacts", "addresses"): {"id_col": "addressable_parasut_id", "type_col": "addressable_type", "type_val": "Contact"},
}

PAGE_SIZE_DEFAULT = 25


class RateLimiter:
    def __init__(self, delay):
        self.delay = delay
        self._last = 0.0

    def wait(self):
        elapsed = time.monotonic() - self._last
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last = time.monotonic()


def get_access_token(session, rl):
    client_id = os.environ["PARASUT_CLIENT_ID"]
    client_secret = os.environ["PARASUT_CLIENT_SECRET"]
    username = os.environ["PARASUT_USERNAME"]
    password = os.environ["PARASUT_PASSWORD"]

    rl.wait()
    resp = session.post(TOKEN_URL, data={
        "grant_type": "password",
        "client_id": client_id,
        "client_secret": client_secret,
        "username": username,
        "password": password,
        "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
    }, timeout=30)
    resp.raise_for_status()
    return resp.json()["access_token"]


def api_get(session, rl, path, params, token):
    url = f"{API_BASE}/{API_VERSION}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    for attempt in range(MAX_RETRIES):
        rl.wait()
        try:
            resp = session.get(url, params=params, headers=headers, timeout=60)
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
            wait = min(2 ** attempt, 30)
            print(f"  network error ({exc.__class__.__name__}), retrying in {wait}s...")
            time.sleep(wait)
            continue
        if resp.status_code == 429:
            retry_after = float(resp.headers.get("Retry-After", 5))
            print(f"  rate limited, waiting {retry_after}s...")
            time.sleep(retry_after)
            continue
        if resp.status_code >= 500:
            wait = min(2 ** attempt, 30)
            print(f"  server error {resp.status_code}, retrying in {wait}s...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"gave up after {MAX_RETRIES} retries on {path}")


def normalize_type(t):
    return TYPE_ALIASES.get(t, t)


def extract_row(resource, spec):
    """Build (columns_dict) for one JSON:API resource object."""
    attrs = resource.get("attributes", {}) or {}
    row = {}
    for name in spec["attrs"]:
        if name in attrs:
            value = attrs[name]
            if isinstance(value, (dict, list)):
                value = psycopg2.extras.Json(value)
            row[name] = value

    rels = resource.get("relationships", {}) or {}
    for rel_name, col in spec["rels"].items():
        rel = rels.get(rel_name)
        if not rel:
            continue
        data = rel.get("data")
        if not data:
            continue
        rid = data.get("id")
        rtype = data.get("type")
        if isinstance(col, tuple):
            id_col, type_col = col
            row[id_col] = int(rid) if rid is not None else None
            row[type_col] = rtype
        else:
            row[col] = int(rid) if rid is not None else None

    return row


def build_backfill_map(items):
    """(child_type, child_id) -> {id_col: parent_id, [type_col: type_val]}"""
    backfill = {}
    for item in items:
        parent_type = normalize_type(item.get("type"))
        rels = item.get("relationships", {}) or {}
        for rel_name, info in BACKFILL.items():
            p_type, relation_name = rel_name
            if p_type != parent_type:
                continue
            rel = rels.get(relation_name)
            if not rel:
                continue
            data = rel.get("data")
            if not data:
                continue
            linked = data if isinstance(data, list) else [data]
            for entry in linked:
                key = (normalize_type(entry.get("type")), entry.get("id"))
                fk = {info["id_col"]: int(item["id"])}
                if "type_col" in info:
                    fk[info["type_col"]] = info["type_val"]
                backfill[key] = fk
    return backfill


def upsert(cur, spec, resource, backfill_map=None):
    row = extract_row(resource, spec)
    if backfill_map:
        key = (normalize_type(resource.get("type")), resource.get("id"))
        fk = backfill_map.get(key)
        if fk:
            for col, val in fk.items():
                row.setdefault(col, val)
                if row.get(col) is None:
                    row[col] = val
    row["parasut_id"] = resource["id"] if spec.get("id_type") == "text" else int(resource["id"])
    row["raw"] = psycopg2.extras.Json(resource)
    attrs = resource.get("attributes", {}) or {}
    row["parasut_created_at"] = attrs.get("created_at")
    row["parasut_updated_at"] = attrs.get("updated_at")

    cols = list(row.keys())
    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(cols)
    update_list = ", ".join(f"{c} = excluded.{c}" for c in cols if c != "parasut_id")
    sql = (
        f"insert into parasut.{spec['table']} ({col_list}, synced_at) "
        f"values ({placeholders}, now()) "
        f"on conflict (parasut_id) do update set {update_list}, synced_at = now()"
    )
    cur.execute(sql, [row[c] for c in cols])


def process_document(cur, doc, counts):
    """Upsert every resource found in a JSON:API document's data + included."""
    items = []
    data = doc.get("data")
    if isinstance(data, list):
        items.extend(data)
    elif isinstance(data, dict):
        items.append(data)
    included = doc.get("included", []) or []
    items.extend(included)

    # parent linkage lives on primary `data` items; use it to backfill FKs
    # that included child resources don't carry themselves (see BACKFILL).
    backfill_map = build_backfill_map(data if isinstance(data, list) else ([data] if data else []))

    for item in items:
        jtype = normalize_type(item.get("type"))
        spec = RESOURCES.get(jtype)
        if not spec:
            counts.setdefault("_unmapped_" + str(jtype), 0)
            counts["_unmapped_" + str(jtype)] += 1
            continue
        upsert(cur, spec, item, backfill_map)
        counts[jtype] = counts.get(jtype, 0) + 1


def sync_list_resource(session, rl, token, conn, company_id, jtype, path_tpl, include, page_size, counts):
    path = path_tpl.format(company_id=company_id)
    page = 1
    total_fetched = 0
    while True:
        params = {"page[number]": page, "page[size]": page_size}
        if include:
            params["include"] = include
        print(f"  {jtype}: page {page}...")
        doc = api_get(session, rl, path, params, token)
        data = doc.get("data", [])
        if not data:
            break
        with conn.cursor() as cur:
            process_document(cur, doc, counts)
        conn.commit()
        total_fetched += len(data)
        meta = doc.get("meta", {})
        total_pages = meta.get("total_pages")
        if total_pages is not None:
            if page >= total_pages:
                break
        elif len(data) < page_size:
            break
        page += 1
    print(f"  {jtype}: {total_fetched} top-level records synced")


def sync_account_transactions(session, rl, token, conn, company_id, page_size, counts):
    with conn.cursor() as cur:
        cur.execute("select parasut_id from parasut.accounts")
        account_ids = [r[0] for r in cur.fetchall()]
    for acc_id in account_ids:
        path = f"/{company_id}/accounts/{acc_id}/transactions"
        page = 1
        while True:
            params = {"page[number]": page, "page[size]": page_size,
                      "include": "debit_account,credit_account"}
            print(f"  transactions (account {acc_id}): page {page}...")
            doc = api_get(session, rl, path, params, token)
            data = doc.get("data", [])
            if not data:
                break
            with conn.cursor() as cur:
                process_document(cur, doc, counts)
            conn.commit()
            meta = doc.get("meta", {})
            total_pages = meta.get("total_pages")
            if total_pages is not None:
                if page >= total_pages:
                    break
            elif len(data) < page_size:
                break
            page += 1


def sync_sales_offer_details(session, rl, token, conn, company_id, counts):
    """sales_offer_details has no list/include path -- only /sales_offers/{id}/details."""
    with conn.cursor() as cur:
        cur.execute("select parasut_id from parasut.sales_offers")
        offer_ids = [r[0] for r in cur.fetchall()]
    for offer_id in offer_ids:
        path = f"/{company_id}/sales_offers/{offer_id}/details"
        print(f"  sales_offer_details (offer {offer_id})...")
        doc = api_get(session, rl, path, {}, token)
        with conn.cursor() as cur:
            # backfill sales_offer_parasut_id manually: this endpoint has no parent-level linkage
            for item in doc.get("data", []) if isinstance(doc.get("data"), list) else [doc.get("data")]:
                if not item:
                    continue
                jtype = normalize_type(item.get("type"))
                spec = RESOURCES.get(jtype)
                if not spec:
                    counts.setdefault("_unmapped_" + str(jtype), 0)
                    counts["_unmapped_" + str(jtype)] += 1
                    continue
                row = extract_row(item, spec)
                row.setdefault("sales_offer_parasut_id", offer_id)
                if row.get("sales_offer_parasut_id") is None:
                    row["sales_offer_parasut_id"] = offer_id
                row["parasut_id"] = int(item["id"])
                row["raw"] = psycopg2.extras.Json(item)
                attrs = item.get("attributes", {}) or {}
                row["parasut_created_at"] = attrs.get("created_at")
                row["parasut_updated_at"] = attrs.get("updated_at")
                cols = list(row.keys())
                placeholders = ", ".join(["%s"] * len(cols))
                col_list = ", ".join(cols)
                update_list = ", ".join(f"{c} = excluded.{c}" for c in cols if c != "parasut_id")
                sql = (
                    f"insert into parasut.{spec['table']} ({col_list}, synced_at) "
                    f"values ({placeholders}, now()) "
                    f"on conflict (parasut_id) do update set {update_list}, synced_at = now()"
                )
                cur.execute(sql, [row[c] for c in cols])
                counts[jtype] = counts.get(jtype, 0) + 1
        conn.commit()


def sync_me(session, rl, token, conn, counts):
    doc = api_get(session, rl, "/me", {"include": "company"}, token)
    with conn.cursor() as cur:
        process_document(cur, doc, counts)
    conn.commit()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", help="Comma-separated list of resource types to sync (default: all)")
    parser.add_argument("--page-size", type=int, default=PAGE_SIZE_DEFAULT)
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="Seconds between API requests")
    parser.add_argument("--skip-account-transactions", action="store_true")
    args = parser.parse_args()

    required = ["PARASUT_USERNAME", "PARASUT_PASSWORD", "PARASUT_CLIENT_ID",
                "PARASUT_CLIENT_SECRET", "PARASUT_COMPANY_ID", "SUPABASE_DB_URL"]
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        print(f"error: missing required environment variable(s): {', '.join(missing)}", file=sys.stderr)
        return 1

    company_id = os.environ["PARASUT_COMPANY_ID"]
    only = set(args.only.split(",")) if args.only else None

    rl = RateLimiter(args.delay)
    session = requests.Session()
    token = get_access_token(session, rl)
    print("authenticated with Parasut API")

    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    counts = {}

    try:
        if not only or "companies" in only:
            print("syncing me/company...")
            sync_me(session, rl, token, conn, counts)

        for jtype, path_tpl, include in LIST_ENDPOINTS:
            if only and jtype not in only:
                continue
            print(f"syncing {jtype}...")
            sync_list_resource(session, rl, token, conn, company_id, jtype, path_tpl, include, args.page_size, counts)

        if (not only or "transactions" in only) and not args.skip_account_transactions:
            print("syncing account transactions...")
            sync_account_transactions(session, rl, token, conn, company_id, args.page_size, counts)

        if not only or "sales_offer_details" in only:
            print("syncing sales_offer_details...")
            sync_sales_offer_details(session, rl, token, conn, company_id, counts)
    finally:
        conn.close()

    print("\n=== sync summary ===")
    for k, v in sorted(counts.items()):
        print(f"  {k}: {v}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
