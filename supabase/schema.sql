-- ============================================================
-- Balloon Party Planner — Supabase schema
-- ============================================================

-- ---------- Categories ----------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- Products ----------
create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  description text,
  price numeric(12,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_category on products(category_id);
create index idx_products_price on products(price);

-- ---------- Product images ----------
create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_product_images_product on product_images(product_id);

-- ---------- Date capacity ----------
-- Controls how many events can be booked per calendar date.
create table date_capacity (
  event_date date primary key,
  max_capacity int not null default 1,
  booked_count int not null default 0
);

-- ---------- Bookings ----------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  customer_name text not null,
  phone text not null,
  event_date date not null,
  event_address text not null,
  theme text,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_date on bookings(event_date);
create index idx_bookings_status on bookings(status);

-- ============================================================
-- Trigger: keep date_capacity.booked_count in sync
-- Recalculates the confirmed-booking count for a date whenever
-- a booking's status or event_date changes.
-- ============================================================

create or replace function recalc_date_capacity(p_date date)
returns void as $$
begin
  -- Ensure a row exists for this date
  insert into date_capacity (event_date, max_capacity, booked_count)
  values (p_date, 1, 0)
  on conflict (event_date) do nothing;

  update date_capacity
  set booked_count = (
    select count(*) from bookings
    where event_date = p_date
      and status = 'confirmed'
  )
  where event_date = p_date;
end;
$$ language plpgsql;

create or replace function bookings_after_change()
returns trigger as $$
begin
  if TG_OP = 'DELETE' then
    perform recalc_date_capacity(OLD.event_date);
    return OLD;
  end if;

  perform recalc_date_capacity(NEW.event_date);

  -- If the date changed on update, recalc the old date too
  if TG_OP = 'UPDATE' and OLD.event_date is distinct from NEW.event_date then
    perform recalc_date_capacity(OLD.event_date);
  end if;

  return NEW;
end;
$$ language plpgsql;

create trigger trg_bookings_after_change
after insert or update or delete on bookings
for each row execute function bookings_after_change();

-- ============================================================
-- Row Level Security
-- Public (anon) can: read categories/products/images, read
-- date_capacity, and insert a booking (status forced to pending).
-- Only the admin (authenticated) can write products/categories/
-- images/date_capacity and update booking status.
-- ============================================================

alter table categories enable row level security;
alter table products enable row level security;
alter table product_images enable row level security;
alter table date_capacity enable row level security;
alter table bookings enable row level security;

-- Public read access
create policy "public read categories" on categories
  for select using (true);

create policy "public read products" on products
  for select using (is_active = true);

create policy "public read product_images" on product_images
  for select using (true);

create policy "public read date_capacity" on date_capacity
  for select using (true);

-- Bookings are admin-entered only — no public insert policy.
-- Clients only ever see date_capacity (booked/available), never
-- the bookings table itself (which holds customer contact info).

-- Admin (authenticated) full access
create policy "admin all categories" on categories
  for all using (auth.role() = 'authenticated');

create policy "admin all products" on products
  for all using (auth.role() = 'authenticated');

create policy "admin all product_images" on product_images
  for all using (auth.role() = 'authenticated');

create policy "admin all date_capacity" on date_capacity
  for all using (auth.role() = 'authenticated');

create policy "admin all bookings" on bookings
  for all using (auth.role() = 'authenticated');
