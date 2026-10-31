-- ============================================================
-- Money ledger, staff, procurement, purchase plans + cost fields
-- (docs/DATABASE_SRUCTURE.md §11, §12, §13, §15 + §2/§3 cost fields).
-- Run AFTER 20261025100000_products_vendor.sql.
-- Run manually: supabase db execute / SQL editor / psql.
--
-- Contents:
--   §11  suppliers, purchase_orders, purchase_order_items — the
--        procurement tables were never migrated, but the ledger and
--        plan lines reference them, so they are created here first.
--        The receiving/screen flow is a later build; tables only.
--   §12  transaction_categories + transactions — one append-only
--        ledger for every money movement. Customer payments live
--        here (invoice_id), replacing any separate payments table.
--   §13  staff + booking_staff — planned helper cost per event.
--   §15  purchase_plans + purchase_plan_lines — intentions before
--        they become purchase orders (buy/create/fix/rnd/upgrade).
--   §2/§3  item_variants.cost_price + booking_items.unit_cost —
--        per-event material cost for the margin report.
--
-- All new tables are admin-only: RLS enabled with a single
-- "admin all ... to authenticated" policy and deliberately NO anon
-- policy — money, pay and supplier data never touch the public site
-- (§16). planned_pay, cost_price and unit_cost are internal.
-- ============================================================

-- ---------- §11 suppliers ----------

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row
execute function public.set_updated_at();

-- ---------- §11 purchase_orders ----------

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  -- Set only when the order exists for a specific event.
  booking_id uuid references public.bookings(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  order_date date,
  expected_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_purchase_orders_supplier
  on public.purchase_orders (supplier_id);
create index if not exists idx_purchase_orders_booking
  on public.purchase_orders (booking_id);

drop trigger if exists trg_purchase_orders_updated_at on public.purchase_orders;
create trigger trg_purchase_orders_updated_at
before update on public.purchase_orders
for each row
execute function public.set_updated_at();

-- ---------- §11 purchase_order_items ----------

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null
    references public.purchase_orders(id) on delete cascade,
  item_variant_id uuid not null references public.item_variants(id),
  quantity_ordered int not null check (quantity_ordered > 0),
  -- Starts at zero; supports deliveries that arrive in parts.
  quantity_received int not null default 0 check (quantity_received >= 0),
  -- What was actually paid — the first cost data in the system.
  unit_cost numeric(12,2) not null check (unit_cost >= 0)
);

create index if not exists idx_purchase_order_items_order
  on public.purchase_order_items (purchase_order_id);
create index if not exists idx_purchase_order_items_variant
  on public.purchase_order_items (item_variant_id);

-- ---------- §13 staff ----------

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  -- Plain string, informational (e.g. "Helper", "Driver", "Decorator").
  role text,
  -- Informational only (e.g. "monthly", "weekly", "per event").
  pay_basis text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_staff_updated_at on public.staff;
create trigger trg_staff_updated_at
before update on public.staff
for each row
execute function public.set_updated_at();

-- ---------- §13 booking_staff ----------

create table if not exists public.booking_staff (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  -- NO ACTION (restrict): deleting a staff member with assignments is
  -- blocked — deactivate instead, so planned/actual pay history and
  -- the ledger rows pointing here stay intact.
  staff_id uuid not null references public.staff(id),
  -- The role on this event; null falls back to the staff member's own.
  role text,
  -- The pay agreed for this event, BEFORE it happens.
  planned_pay numeric(12,2) not null check (planned_pay >= 0),
  status text not null default 'planned'
    check (status in ('planned', 'confirmed', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_booking_staff_booking
  on public.booking_staff (booking_id);
create index if not exists idx_booking_staff_staff
  on public.booking_staff (staff_id);

drop trigger if exists trg_booking_staff_updated_at on public.booking_staff;
create trigger trg_booking_staff_updated_at
before update on public.booking_staff
for each row
execute function public.set_updated_at();

-- ---------- §15 purchase_plans ----------

create table if not exists public.purchase_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  plan_type text not null
    check (plan_type in ('buy', 'create', 'fix', 'rnd', 'upgrade')),
  reason text,
  -- Set when the plan exists for one event.
  booking_id uuid references public.bookings(id) on delete set null,
  budget_estimate numeric(12,2),
  target_date date,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'in_progress', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_purchase_plans_booking
  on public.purchase_plans (booking_id);

drop trigger if exists trg_purchase_plans_updated_at on public.purchase_plans;
create trigger trg_purchase_plans_updated_at
before update on public.purchase_plans
for each row
execute function public.set_updated_at();

-- ---------- §15 purchase_plan_lines ----------

create table if not exists public.purchase_plan_lines (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null
    references public.purchase_plans(id) on delete cascade,
  -- Optional: tools, repairs and R&D items are often not in the catalog.
  item_variant_id uuid references public.item_variants(id) on delete set null,
  description text not null,
  quantity int not null check (quantity > 0),
  estimated_unit_cost numeric(12,2),
  supplier_id uuid references public.suppliers(id) on delete set null,
  -- The link that shows the line was ordered.
  purchase_order_item_id uuid
    references public.purchase_order_items(id) on delete set null,
  -- For `upgrade` plans: the existing item being replaced.
  replaces_item_variant_id uuid
    references public.item_variants(id) on delete set null,
  -- Set by hand for lines that involve no supplier (in-house repair,
  -- something the team builds).
  done_at timestamptz,
  -- `rnd` plans only.
  outcome text check (outcome in ('testing', 'adopted', 'rejected')),
  outcome_note text,
  sort_order int not null default 0
);

create index if not exists idx_purchase_plan_lines_plan
  on public.purchase_plan_lines (plan_id);

-- ---------- §12 transaction_categories ----------
-- A real lookup table (unlike item_category): reports add up amounts
-- per category, and a misspelled free-text value would split a total.

create table if not exists public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  direction text not null check (direction in ('in', 'out')),
  is_active boolean not null default true,
  sort_order int not null default 0
);

-- Seed the starter categories once (doc §12 examples). Re-running
-- never duplicates: the insert only fires when the table is empty.
insert into public.transaction_categories (name, direction, sort_order)
select seed.name, seed.direction, seed.sort_order
from (values
  ('Customer payment', 'in'::text, 10),
  ('Gasoline',         'out'::text, 20),
  ('Helper pay',       'out'::text, 30),
  ('Salary',           'out'::text, 40),
  ('Vendor payment',   'out'::text, 50),
  ('Goods purchase',   'out'::text, 60),
  ('Repair',           'out'::text, 70)
) as seed(name, direction, sort_order)
where not exists (select 1 from public.transaction_categories);

-- ---------- §12 transactions (append-only ledger) ----------
-- NEVER updated or deleted by the app: a mistake is corrected with a
-- reversing row (reverses_transaction_id), never an edit.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in', 'out')),
  -- Always positive; the direction gives the sign.
  amount numeric(12,2) not null check (amount > 0),
  -- The date the money actually moved.
  transaction_date date not null default current_date,
  category_id uuid not null references public.transaction_categories(id),
  -- Which pot the money is in or came from (e.g. "Cash", "BCA").
  account text,
  description text,
  -- Optional links — at most the relevant ones are set per row.
  booking_id uuid references public.bookings(id) on delete set null,
  -- Set on customer payments: which invoice they were paid against.
  invoice_id uuid references public.invoices(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  plan_line_id uuid references public.purchase_plan_lines(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  booking_staff_id uuid references public.booking_staff(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  -- The period a payment covers (weekly/monthly salary). Not needed
  -- for per-event helper pay.
  period_start date,
  period_end date,
  -- Set when a row corrects an earlier mistaken row.
  reverses_transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_date
  on public.transactions (transaction_date);
create index if not exists idx_transactions_category
  on public.transactions (category_id);
create index if not exists idx_transactions_booking
  on public.transactions (booking_id);
create index if not exists idx_transactions_invoice
  on public.transactions (invoice_id);
create index if not exists idx_transactions_booking_staff
  on public.transactions (booking_staff_id);

-- ---------- §2/§3 cost fields ----------

-- What one unit costs the business, updated from the unit_cost of the
-- latest received purchase order line. Internal — never shown to
-- customers; used only for margin reporting (§14).
alter table public.item_variants
  add column if not exists cost_price numeric(12,2);

-- Frozen at booking-item creation, same pattern as unit_price.
-- Consumables only: rentables are assets with no per-event cost.
alter table public.booking_items
  add column if not exists unit_cost numeric(12,2);

-- ---------- RLS: everything admin-only ----------

alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.staff enable row level security;
alter table public.booking_staff enable row level security;
alter table public.purchase_plans enable row level security;
alter table public.purchase_plan_lines enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "admin all suppliers" on public.suppliers;
create policy "admin all suppliers"
on public.suppliers for all to authenticated using (true) with check (true);

drop policy if exists "admin all purchase orders" on public.purchase_orders;
create policy "admin all purchase orders"
on public.purchase_orders for all to authenticated using (true) with check (true);

drop policy if exists "admin all purchase order items" on public.purchase_order_items;
create policy "admin all purchase order items"
on public.purchase_order_items for all to authenticated using (true) with check (true);

drop policy if exists "admin all staff" on public.staff;
create policy "admin all staff"
on public.staff for all to authenticated using (true) with check (true);

drop policy if exists "admin all booking_staff" on public.booking_staff;
create policy "admin all booking_staff"
on public.booking_staff for all to authenticated using (true) with check (true);

drop policy if exists "admin all purchase plans" on public.purchase_plans;
create policy "admin all purchase plans"
on public.purchase_plans for all to authenticated using (true) with check (true);

drop policy if exists "admin all purchase plan lines" on public.purchase_plan_lines;
create policy "admin all purchase plan lines"
on public.purchase_plan_lines for all to authenticated using (true) with check (true);

drop policy if exists "admin all transaction_categories" on public.transaction_categories;
create policy "admin all transaction_categories"
on public.transaction_categories for all to authenticated using (true) with check (true);

drop policy if exists "admin all transactions" on public.transactions;
create policy "admin all transactions"
on public.transactions for all to authenticated using (true) with check (true);

-- Verify afterwards:
--   select table_name from information_schema.tables
--     where table_schema='public'
--       and table_name in ('suppliers','purchase_orders','purchase_order_items',
--                          'staff','booking_staff','purchase_plans',
--                          'purchase_plan_lines','transaction_categories',
--                          'transactions')
--     order by table_name;                      -- 9 rows
--   select name, direction from transaction_categories order by sort_order;  -- 7 rows
--   select column_name from information_schema.columns
--     where table_name='item_variants' and column_name='cost_price';
--   select column_name from information_schema.columns
--     where table_name='booking_items' and column_name='unit_cost';
--   select policyname from pg_policies
--     where tablename in ('transactions','staff','booking_staff',
--                         'purchase_plans','purchase_plan_lines');
--   (no policy row with role anon may exist for any of them.)
-- Anon REST negative tests (anon key only):
--   GET /rest/v1/transactions          → []
--   GET /rest/v1/staff                 → []
--   GET /rest/v1/transaction_categories → []
