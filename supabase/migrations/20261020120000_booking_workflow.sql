-- ============================================================
-- Booking core workflow (docs/FEATURE_SPECIFICATION.md §2–§5):
--   * bookings.transport_fee (§3)
--   * bookings.product_id becomes nullable — admin "custom" bookings
--     that don't follow a catalog package (§3). The public insert
--     policy is unchanged: a null product_id fails the policy's
--     EXISTS on products, so anonymous visitors still can't create
--     custom bookings; the admin API path is unaffected by RLS.
--   * unique (product_id, item_variant_id) on product_items — upsert
--     target for the recipe editor (§2)
--   * generate_booking_checklist() — auto 3-phase checklist when the
--     down payment is marked received (§4)
--   * sync_checklist_rental_status() — checklist "done" drives
--     booking_items.rental_status (§4)
--
-- Run manually: supabase db execute / SQL editor / psql.
-- ============================================================

-- ---------- §3 columns ----------

alter table public.bookings
  add column if not exists transport_fee numeric(12,2);

-- Drop NOT NULL on bookings.product_id if it is still set (guarded so
-- the file is safe to re-run).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'product_id'
      and is_nullable = 'NO'
  ) then
    alter table public.bookings alter column product_id drop not null;
  end if;
end
$$;

-- ---------- §2 recipe uniqueness ----------

-- Upsert target for POST /api/admin/product-items. If a legacy dataset
-- contains duplicates on (product_id, item_variant_id), deduplicate
-- BEFORE running this file, e.g.:
--   delete from product_items a using product_items b
--   where a.product_id = b.product_id
--     and a.item_variant_id = b.item_variant_id
--     and a.id > b.id;
create unique index if not exists uniq_product_items_product_variant
  on public.product_items (product_id, item_variant_id);

-- ---------- §4 checklist generation on DP received ----------

-- Coexists with trg_bookings_after_change (date_capacity maintenance):
-- disjoint logic and tables, so both triggers on `bookings` are fine.
create or replace function generate_booking_checklist()
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

drop trigger if exists trg_bookings_generate_checklist on public.bookings;
create trigger trg_bookings_generate_checklist
after insert or update of dp_received_at on public.bookings
for each row
when (new.dp_received_at is not null)
execute function generate_booking_checklist();

-- ---------- §4 checklist done → rental_status sync ----------

create or replace function sync_checklist_rental_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phase text;
  v_booking_item_id uuid;
begin
  select phase, booking_item_id
  into v_phase, v_booking_item_id
  from public.checklist_items
  where id = new.id;

  -- Free-text rows ("Tambah baris bebas") aren't tied to a booking
  -- item; there is nothing to sync.
  if v_booking_item_id is null then
    return new;
  end if;

  if v_phase = 'pickup' then
    update public.booking_items
    set rental_status = 'checked_out', checked_out_at = now()
    where id = v_booking_item_id;
  elsif v_phase = 'return' then
    update public.booking_items
    set rental_status = 'returned', returned_at = now()
    where id = v_booking_item_id;
  end if;
  -- phase 'stock_check' has no rental side effect.

  -- Deliberately fires only on the transition TO done: un-marking a
  -- row does not rewind rental_status / timestamps (history is kept).
  return new;
end;
$$;

drop trigger if exists trg_checklist_items_done on public.checklist_items;
create trigger trg_checklist_items_done
after update of status on public.checklist_items
for each row
when (new.status = 'done' and old.status is distinct from 'done')
execute function sync_checklist_rental_status();

-- Direct EXECUTE stays locked down for client roles; the EXECUTE the
-- trigger invocations need is granted in 20261020130000 (Postgres
-- checks EXECUTE on trigger functions at invocation, against the DML
-- role — checklist triggers fire from admin actions, i.e. as
-- `authenticated`).
revoke all on function generate_booking_checklist() from public;
revoke all on function generate_booking_checklist() from anon;
revoke all on function generate_booking_checklist() from authenticated;
revoke all on function sync_checklist_rental_status() from public;
revoke all on function sync_checklist_rental_status() from anon;
revoke all on function sync_checklist_rental_status() from authenticated;

-- Verify afterwards:
--   select column_name, is_nullable from information_schema.columns
--     where table_schema='public' and table_name='bookings'
--       and column_name in ('product_id','transport_fee');
--   select indexname from pg_indexes where tablename='product_items';
--   select tgname from pg_trigger
--     where tgrelid in ('bookings'::regclass,'checklist_items'::regclass)
--       and not tgisinternal;
--   select proname, prosecdef from pg_proc
--     where proname in ('generate_booking_checklist','sync_checklist_rental_status');
-- Smoke test (after marking a booking's DP received):
--   select phase, label, sort_order from checklist_items
--     where booking_id = '<id>' order by sort_order;
