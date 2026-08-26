-- Phase 5: products, warehouses, inventory_levels, stock_movements,
-- item_categories.
--
-- parasut.products, parasut.warehouses, parasut.inventory_levels,
-- parasut.stock_movements, and parasut.item_categories already exist and
-- already have every column this phase needs (created in the very first
-- schema migration, unused until now). No table or sync_runs column
-- changes are needed -- only new read-only demo views.
--
-- public.parasut_sales_invoice_details_demo and
-- public.parasut_purchase_bill_details_demo (Phase 2 / Phase 4) already
-- left-join parasut.products for product_name -- once this phase's product
-- sync runs, those existing views start resolving real product names
-- automatically. No change to those views is needed or made here.

create view public.parasut_item_categories_demo
as
select
  parasut_id,
  name,
  full_path,
  category_type,
  parent_category_parasut_id,
  synced_at
from parasut.item_categories
order by full_path nulls last, name nulls last;

-- Products. category_name is resolved via a real left join; stays null
-- when the product has no category or the category hasn't been synced --
-- never fabricated.
create view public.parasut_products_demo
as
select
  p.parasut_id,
  p.code,
  p.name,
  p.unit,
  p.barcode,
  p.vat_rate,
  p.list_price,
  p.currency,
  p.buying_price,
  p.buying_currency,
  p.inventory_tracking,
  p.initial_stock_count,
  p.stock_count,
  p.archived,
  p.category_parasut_id,
  c.name as category_name,
  p.synced_at
from parasut.products p
left join parasut.item_categories c on c.parasut_id = p.category_parasut_id
order by p.name nulls last;

create view public.parasut_warehouses_demo
as
select
  parasut_id,
  name,
  address,
  city,
  district,
  archived,
  synced_at
from parasut.warehouses
order by name nulls last;

-- Per-warehouse stock levels. product_name/warehouse_name resolved via
-- real left joins.
create view public.parasut_inventory_levels_demo
as
select
  il.parasut_id,
  il.product_parasut_id,
  p.name as product_name,
  p.code as product_code,
  il.warehouse_parasut_id,
  w.name as warehouse_name,
  il.stock_count,
  il.initial_stock_count,
  il.critical_stock_count,
  il.synced_at
from parasut.inventory_levels il
left join parasut.products p on p.parasut_id = il.product_parasut_id
left join parasut.warehouses w on w.parasut_id = il.warehouse_parasut_id
order by p.name nulls last, w.name nulls last;

-- Stock movements. source is polymorphic (sales_invoice_details,
-- purchase_bill_details, shipment_documents); only source_type/
-- source_parasut_id are exposed here (no join, since resolving a name
-- would require three different joins with no single "name" column that
-- makes sense across those types) -- real, not fabricated.
create view public.parasut_stock_movements_demo
as
select
  sm.parasut_id,
  sm.date,
  sm.quantity,
  sm.product_parasut_id,
  p.name as product_name,
  sm.warehouse_parasut_id,
  w.name as warehouse_name,
  sm.source_type,
  sm.source_parasut_id,
  sm.contact_parasut_id,
  ct.name as contact_name,
  sm.synced_at
from parasut.stock_movements sm
left join parasut.products p on p.parasut_id = sm.product_parasut_id
left join parasut.warehouses w on w.parasut_id = sm.warehouse_parasut_id
left join parasut.contacts ct on ct.parasut_id = sm.contact_parasut_id
order by sm.date desc nulls last;

grant select on public.parasut_item_categories_demo to authenticated, anon;
grant select on public.parasut_products_demo to authenticated, anon;
grant select on public.parasut_warehouses_demo to authenticated, anon;
grant select on public.parasut_inventory_levels_demo to authenticated, anon;
grant select on public.parasut_stock_movements_demo to authenticated, anon;
