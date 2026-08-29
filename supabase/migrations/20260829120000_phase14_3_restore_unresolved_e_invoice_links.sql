-- Phase 14.3: restore the 4 real sales_invoices relationships that
-- syncActiveEDocuments()'s (now-removed) blanket stale-link cleanup wrongly
-- nulled. Verified live against the Parasut API: each of these 4
-- sales_invoices parents has item_type="cancelled" and archived=false, so
-- it is returned by NEITHER filter[archived]=false NOR filter[archived]=true
-- -- the two list calls syncSalesInvoices makes -- meaning the parent was
-- never present in that sync's own parentItems, and the old cleanup treated
-- the still-real child e_invoices link as stale. The standalone
-- GET /e_invoices?include=invoice endpoint (a genuine unscoped global
-- listing) confirms all 4 relationships are real and current as of this
-- phase's investigation (2026-08-29).
--
-- This is a one-time, evidence-based backfill of exactly these 4 rows --
-- not a blanket reset -- because concrete proof (a live 200 response from
-- both /e_invoices/{id}?include=invoice and /sales_invoices/{id}) exists for
-- each one individually.
update parasut.e_invoices set
  parent_type = 'sales_invoices',
  parent_parasut_id = v.parent_id
from (values
  (1039238103::bigint, 1052770408::bigint),
  (1053844283::bigint, 1069847471::bigint),
  (1060947175::bigint, 1078897329::bigint),
  (1067768657::bigint, 1087830427::bigint)
) as v(e_invoice_id, parent_id)
where parasut.e_invoices.parasut_id = v.e_invoice_id
  and parasut.e_invoices.parent_type is null;
