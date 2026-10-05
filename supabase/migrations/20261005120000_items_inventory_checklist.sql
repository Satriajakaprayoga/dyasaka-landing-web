-- ============================================================
-- Items, inventory, package recipes & booking checklist
-- Implements docs/DATABASE_SRUCTURE.md sections 2–4.
-- Run manually: supabase db execute / SQL editor / psql.
-- ============================================================

-- ---------- Changes to existing tables ----------

-- categories: doc lists created_at + updated_at
alter table categories
  add column updated_at timestamptz not null default now();

-- bookings: operational project status (independent of sales `status`)
-- and down-payment marker that triggers checklist generation.
alter table bookings
  add column project_status text not null default 'not_started'
    check (project_status in (
      'not_started', 'preparing', 'ready',
      'in_progress', 'returning', 'completed'
    )),
  add column dp_received_at timestamptz;

-- ---------- Item master data ----------

create table items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  type text not null
    check (type in ('consumable', 'rentable')),
  pieces_per_unit int,
  quantity_owned int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_items_category on items(category_id);

create table item_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  color text,
  size text,
  sku text,
  stock_quantity int not null default 0,
  current_price numeric(12,2) not null,
  reorder_point int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_item_variants_item on item_variants(item_id);

-- Append-only. Never updated or deleted after insert.
create table item_price_history (
  id uuid primary key default gen_random_uuid(),
  item_variant_id uuid not null
    references item_variants(id) on delete restrict,
  price numeric(12,2) not null,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_item_price_history_variant
  on item_price_history(item_variant_id);

-- Append-only ledger. stock_variants.stock_quantity must always be
-- derivable by summing quantity here. Never updated or deleted.
-- Consumable booking usage belongs here; rentable pickup/return does NOT
-- (rentable availability is computed live from booking_items + items).
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_variant_id uuid not null
    references item_variants(id) on delete restrict,
  type text not null
    check (type in ('restock', 'usage', 'damaged', 'lost',
                    'adjustment', 'purchased')),
  quantity int not null,
  booking_id uuid references bookings(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index idx_stock_movements_variant on stock_movements(item_variant_id);

-- ---------- Product recipes & booking snapshots ----------

-- Reusable recipe. Not modified by individual booking customizations.
create table product_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  item_variant_id uuid not null
    references item_variants(id) on delete restrict,
  quantity int not null check (quantity > 0)
);

create index idx_product_items_product on product_items(product_id);
create index idx_product_items_variant on product_items(item_variant_id);

-- Per-booking, independently editable snapshot.
-- unit_price is frozen at creation time; never recalculated.
create table booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  item_variant_id uuid not null
    references item_variants(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  rental_status text
    check (rental_status in ('reserved', 'checked_out', 'returned')),
  checked_out_at timestamptz,
  returned_at timestamptz
);

create index idx_booking_items_booking on booking_items(booking_id);
create index idx_booking_items_variant on booking_items(item_variant_id);

-- ---------- 3-phase checklist (generated on DP received) ----------

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  booking_item_id uuid references booking_items(id) on delete cascade,
  phase text not null
    check (phase in ('stock_check', 'pickup', 'return')),
  label text not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_stock', 'need_order', 'done')),
  note text,
  completed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_checklist_items_booking on checklist_items(booking_id);

-- ============================================================
-- Row Level Security
-- Public (anon) needs read on items/variants/product_items so the
-- customer-facing product page can show "Includes: ...". Internal
-- tables (price history, stock ledger, booking items, checklist)
-- stay admin-only. Writes are authenticated-only everywhere.
-- ============================================================

alter table items enable row level security;
alter table item_variants enable row level security;
alter table item_price_history enable row level security;
alter table stock_movements enable row level security;
alter table product_items enable row level security;
alter table booking_items enable row level security;
alter table checklist_items enable row level security;

-- Public read access (storefront "includes" display)
create policy "public read items" on items
  for select using (true);

create policy "public read item_variants" on item_variants
  for select using (true);

create policy "public read product_items" on product_items
  for select using (true);

-- Admin (authenticated) full access
create policy "admin all items" on items
  for all using (auth.role() = 'authenticated');

create policy "admin all item_variants" on item_variants
  for all using (auth.role() = 'authenticated');

create policy "admin all item_price_history" on item_price_history
  for all using (auth.role() = 'authenticated');

create policy "admin all stock_movements" on stock_movements
  for all using (auth.role() = 'authenticated');

create policy "admin all product_items" on product_items
  for all using (auth.role() = 'authenticated');

create policy "admin all booking_items" on booking_items
  for all using (auth.role() = 'authenticated');

create policy "admin all checklist_items" on checklist_items
  for all using (auth.role() = 'authenticated');
