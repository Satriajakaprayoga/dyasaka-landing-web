-- ============================================================
-- Revert the vendor→items coupling (kept: vendors table itself).
--
-- 20261024100000_vendors.sql was already applied. Per the revised
-- vendor design, vendors will relate to products (products.vendor_id
-- + vendor price/margin) instead of inventory items — inventory stays
-- purely physical:
--   * drop items.vendor_id (+ index) — any existing assignments are
--     intentionally discarded
--   * items.type back to ('consumable','rentable') — the 'service'
--     type was only introduced for vendor services
--   * generate_booking_checklist() back to the original
--     (stock_check + pickup for every booking item, return for
--     rentable only)
--
-- The vendors table, its updated_at trigger and its admin-only RLS
-- from 20261024100000 stay in place.
--
-- Run manually: supabase db execute / SQL editor / psql.
-- ============================================================

drop index if exists public.idx_items_vendor;

alter table public.items drop column if exists vendor_id;

alter table public.items drop constraint if exists items_type_check;
alter table public.items
  add constraint items_type_check
  check (type in ('consumable', 'rentable'));

-- Original body from 20261020120000_booking_workflow.sql.
create or replace function public.generate_booking_checklist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Exactly-once guard. `update of dp_received_at` fires even when the
  -- new value equals the old one (e.g. an unrelated PATCH that happens
  -- to include the column), so the WHEN clause alone is not enough —
  -- bail out if this booking already has checklist rows.
  if exists (
    select 1 from public.checklist_items where booking_id = new.id
  ) then
    return new;
  end if;

  -- 3 phases per booking item: stock_check + pickup for everything,
  -- return only for rentable items. Label mirrors the storefront
  -- "Paket Termasuk" format: "Latex Balloon (Merah, 12 inci) x50".
  with bi as (
    select
      bi.id,
      bi.quantity,
      i.name,
      i.type,
      v.color,
      v.size,
      row_number() over (order by bi.id) as rn
    from public.booking_items bi
    join public.item_variants v on v.id = bi.item_variant_id
    join public.items i on i.id = v.item_id
    where bi.booking_id = new.id
  ),
  seed as (
    select id, 'stock_check'::text as phase, 0 as phase_offset from bi
    union all
    select id, 'pickup'::text, 1 from bi
    union all
    select id, 'return'::text, 2 from bi where type = 'rentable'
  )
  insert into public.checklist_items
    (booking_id, booking_item_id, phase, label, status, sort_order)
  select
    new.id,
    bi.id,
    seed.phase,
    concat_ws(
      ' ',
      bi.name,
      case
        when bi.color is not null or bi.size is not null
          then '(' || concat_ws(', ', bi.color, bi.size) || ')'
      end,
      'x' || bi.quantity
    ),
    'pending',
    (bi.rn * 10) + seed.phase_offset
  from seed
  join bi on bi.id = seed.id;

  return new;
end;
$$;

-- ACLs survive CREATE OR REPLACE; re-grant anyway so this file stays
-- self-contained and re-runnable.
revoke all on function public.generate_booking_checklist() from public;
revoke all on function public.generate_booking_checklist() from anon;
grant execute on function public.generate_booking_checklist() to authenticated;

-- Verify afterwards:
--   column items.vendor_id is gone; items_type_check rejects 'service'
--   vendors table still exists with its RLS + updated_at trigger
