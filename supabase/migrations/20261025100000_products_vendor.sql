-- Vendor relation on products + vendor cost price (§6 redesign).
-- products.vendor_id marks which vendor supplies this product;
-- vendor_price is the buy (cost) price used to compute margin.
-- Margin is always computed (price - vendor_price), never stored.

alter table public.products
  add column vendor_id uuid references public.vendors (id) on delete set null;

alter table public.products
  add column vendor_price numeric(12, 2)
  constraint products_vendor_price_check
    check (vendor_price is null or vendor_price >= 0);

create index idx_products_vendor on public.products (vendor_id);

-- Privacy: products has a public-read RLS policy, so the table-level
-- SELECT grant would expose the new vendor columns to anon clients.
-- Drop the blanket grant and re-grant only the public-safe columns so
-- vendor_id / vendor_price stay admin-only (authenticated keeps its
-- table-level grant).
-- IMPORTANT (verified on this project's PostgREST): `select=*` does NOT
-- resolve to only the granted columns — it fails for anon with
-- `permission denied for table products` (42501). Public pages must
-- select this exact column list explicitly
-- (app/(public)/ page.tsx, catalog/page.tsx, product/[id]/page.tsx).
-- MAINTENANCE: any new public-safe products column must be added BOTH to
-- this grant list AND to those public pages' select lists.
revoke select on public.products from anon;

grant select (id, category_id, name, description, price, is_active, created_at, updated_at)
  on public.products to anon;

-- Verify afterwards (SQL editor):
--   select column_name from information_schema.role_column_grants
--     where grantee = 'anon' and table_schema = 'public'
--       and table_name = 'products';
--   -- → exactly the 8 columns above, no vendor_id / vendor_price.
--
-- Verify afterwards (REST, anon key):
--   GET /rest/v1/products?select=*            → rows WITHOUT vendor columns
--   GET /rest/v1/products?select=vendor_price → permission denied error
--
-- Verify afterwards (REST, admin session):
--   GET /rest/v1/products?select=vendor_price → rows (admin sees everything)
