-- ============================================================
-- items: replace categories FK with plain-string item_category
-- docs/DATABASE_SRUCTURE.md §2 — item categories are a separate
-- taxonomy from product categories; kept as free text sourced via
-- SELECT DISTINCT item_category in the admin UI (datalist).
-- Run manually: SQL editor / psql. Idempotent guards included.
-- ============================================================

-- 1. New column (default '' so existing rows pass the NOT NULL add)
alter table items
  add column if not exists item_category text not null default '';

-- 2. Backfill from the old FK for rows created before this change
update items i
set item_category = c.name
from categories c
where c.id = i.category_id;

-- 3. The app always supplies a value — keep the column strict
alter table items alter column item_category drop default;

-- 4. Drop the old FK column (its constraint goes with it)
drop index if exists idx_items_category;
alter table items drop column if exists category_id;
