-- ============================================================
-- 20261105090000_product_item_flags.sql
-- Recipe rows get two independent flags (both default true, which
-- preserves today's semantics for every existing row):
--   is_included    — part of the packet. Booking seeding adds the
--                    item at Rp 0 (its cost lives inside the package
--                    price); the flag is snapshotted onto
--                    booking_items so invoices keep the 0.
--   is_show_public — row renders in the public product page's
--                    "Paket Termasuk" list. Off = admin-only.
--
-- No grant changes needed: product_items has a TABLE-level anon
-- grant + "public read" RLS (20261005120000), so new columns are
-- anon-readable automatically — unlike products, whose vendor
-- columns required the column-level re-grant in 20261025100000.
-- (is_included leaking publicly is harmless: it only says the item
-- belongs to the packet, which the page already displayed.)
-- ============================================================

alter table public.product_items
  add column if not exists is_included boolean not null default true,
  add column if not exists is_show_public boolean not null default true;

-- Verify afterwards (SQL editor):
--   select column_name, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'product_items'
--      and column_name in ('is_included', 'is_show_public');
--   -- → both 'true', NOT NULL.
--
-- Verify afterwards (REST, anon key):
--   GET /rest/v1/product_items?select=is_included,is_show_public&limit=1
--   → rows (no permission error — table-level grant covers new columns).
