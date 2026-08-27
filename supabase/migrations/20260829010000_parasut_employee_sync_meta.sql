-- Phase 10.1: Employee LIST response meta/link fields.
--
-- Real API verification (GET /v4/{company_id}/employees, live account,
-- this migration's authoring session), across every real flow:
--   * unfiltered:            meta = {current_page:1, total_pages:1, total_count:6,
--                             per_page:15, payable_total:"0.0", advance_total:"0.0",
--                             export_url:"https://api.parasut.com/v4/666034/employees/export"}
--   * filter[archived]=false: identical payable_total/advance_total ("0.0"/"0.0"),
--                             total_count:6, export_url carries the same filter
--                             querystring appended (.../export?filter%5Barchived%5D=false).
--   * filter[archived]=true:  total_count:0, total_pages:0, payable_total/advance_total
--                             still real "0.0" (not null -- a real zero on an empty set),
--                             export_url carries filter%5Barchived%5D=true.
--   * page[size]=50:          identical payable_total/advance_total/total_count as
--                             unfiltered page[size]=15 -- these two meta fields do NOT
--                             vary by pagination, confirmed identical across all pages
--                             tested (there is only 1 real page in this account).
--   * links.self/first/prev/next/last: real, all technical pagination URLs
--     pointing back at this same endpoint with the request's own filter/page
--     querystring -- carry no business data, not stored.
--
-- payable_total/advance_total: real, always "0.0" in this account. This
-- coincidentally equals the sum of the 6 employees' real `balance` field
-- (also always "0.0" for all 6) -- but because every value involved is
-- zero, this account's data cannot prove or disprove whether payable_total
-- is literally SUM(balance) or an independently computed API metric. Never
-- recomputed here -- the verbatim API meta value is stored every sync, not
-- a locally-summed value. No currency is attached (API does not specify one
-- on this field; parasut.employees' own balance fields are already
-- multi-currency, so a bare "TL" label here would be a fabrication).
--
-- export_url (the *meta.export_url* value itself, e.g.
-- ".../employees/export" or ".../employees/export?filter[archived]=..."):
-- real, durable, no query token/signature, identical across repeated calls
-- for the same filter (only the filter querystring varies, not a random
-- token) -- safe to store and to show verbatim as reference text. It is
-- NOT a fetchable public link: it is a protected Parasut API endpoint that
-- requires this account's own OAuth2 bearer token, so it is displayed as
-- text (the real API meta value), never rendered as a clickable <a href>
-- for anonymous/public users.
--
-- Separately verified (NOT stored, NOT shown anywhere): actually calling
-- that export_url (server-side, with our own bearer token, during this
-- audit only) returns `data.attributes.url`, a temporary AWS S3
-- pre-signed URL containing X-Amz-Credential/X-Amz-Signature query
-- parameters -- a genuine short-lived credentialed secret. That derived
-- S3 URL is never persisted, logged to a table, or exposed in any view/UI;
-- this migration only stores the stable meta.export_url *endpoint*
-- reference, never the signed download link it produces when invoked.

create table if not exists parasut.employee_sync_meta (
  resource text not null,
  filter_scope text not null,
  payable_total numeric,
  advance_total numeric,
  export_url text,
  source_total_count integer,
  source_current_page integer,
  source_total_pages integer,
  source_per_page integer,
  fetched_at timestamptz not null default now(),
  raw_meta jsonb not null,
  primary key (resource, filter_scope)
);

comment on table parasut.employee_sync_meta is
  'One row per (resource, filter_scope) snapshot of the real Parasut employee LIST response links/meta block. Overwritten every real (non dry-run) sync with the current authoritative API value; never merged with per-employee rows. raw_meta is the full verbatim links+meta object and is never exposed to a public view.';

-- Public view: only the real, safe, business-relevant fields. raw_meta and
-- pagination current_page/per_page links are intentionally excluded from
-- the public view (technical/duplicative of sync internals, not shown as
-- business data to demo users) but remain queryable in the base table for
-- sync/pagination verification.
create or replace view public.parasut_employee_meta_demo
as
select
  resource,
  filter_scope,
  payable_total,
  advance_total,
  export_url,
  source_total_count,
  fetched_at
from parasut.employee_sync_meta
order by filter_scope;

grant select on public.parasut_employee_meta_demo to authenticated, anon;
