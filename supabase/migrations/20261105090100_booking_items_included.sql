-- ============================================================
-- 20261105090100_booking_items_included.sql
-- Snapshot of product_items.is_included onto the per-booking copy.
-- When true, the item was part of the package it was booked from —
-- its unit_price is Rp 0 (or whatever the admin negotiated) and the
-- final-invoice prefill must NOT reprice it at the live catalog
-- price the way it does for ordinary add-on lines.
--
-- Default false, deliberately NO backfill: pre-migration bookings
-- had every recipe line frozen at the then-current price, and
-- flipping their flag would silently change future invoice totals
-- (booking price instead of live price). Only bookings created
-- after the bookings API starts writing the flag get the new
-- behavior.
--
-- booking_items is admin-only (no anon grant/policy) — no grants
-- needed here.
-- ============================================================

alter table public.booking_items
  add column if not exists is_included boolean not null default false;

-- Verify afterwards (SQL editor):
--   select column_name, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'booking_items'
--      and column_name = 'is_included';
--   -- → 'false'.
