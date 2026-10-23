-- ============================================================
-- Vendors + services-as-items (docs/DATABASE_SRUCTURE.md §5).
--   * vendors — master data for external partners (photographer,
--     clown, rented property owners). Admin-only: vendors are
--     internal supplier data; customers never see vendor info on
--     invoices (invoice lines show only the description).
--   * items.vendor_id — the relation is vendor → items, NOT vendor →
--     products (products = own packages assembled from multiple
--     vendors' goods). One vendor per item: the same service offered
--     by two vendors = two item rows (accepted at this scale).
--     `on delete set null`: deleting a vendor keeps its items working
--     as unassigned (house) items.
--   * items.type widens to ('consumable','rentable','service') —
--     services (photographer, clown) are ordinary items reusing the
--     variant pricing/pickers; the rental lifecycle (quantity_owned,
--     checkout/return, rental_status) stays unused for them.
--   * generate_booking_checklist() — service items get no pickup row
--     (nothing physical to load); return stayed rentable-only.
--     stock_check is kept for every type: on a service row it reads
--     as "book/confirm the vendor" ("Perlu Pesan").
--
-- Run manually: supabase db execute / SQL editor / psql.
-- ============================================================

-- ---------- vendors ----------

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- BEFORE UPDATE trigger via the shared function (created in
-- 20261021090000). EXECUTE is already granted to `authenticated`
-- there; trigger invocation checks EXECUTE against the DML role
-- (see 20261020130000).
drop trigger if exists trg_vendors_updated_at on public.vendors;
create trigger trg_vendors_updated_at
before update on public.vendors
for each row
execute function public.set_updated_at();

-- ---------- items.vendor_id + service type ----------

alter table public.items
  add column vendor_id uuid references public.vendors(id) on delete set null;

create index idx_items_vendor on public.items(vendor_id);

-- Inline constraint from 20261005120000 was auto-named items_type_check.
alter table public.items drop constraint if exists items_type_check;
alter table public.items
  add constraint items_type_check
  check (type in ('consumable', 'rentable', 'service'));

-- ---------- checklist trigger: skip pickup for services ----------

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

  -- Phases per booking item: stock_check for everything (on a
  -- service row it means "book the vendor"), pickup for physical
  -- items only (consumable + rentable — a service has nothing to
  -- load), return only for rentable items. Label mirrors the
  -- storefront "Paket Termasuk" format:
  -- "Latex Balloon (Merah, 12 inci) x50".
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
    select id, 'pickup'::text, 1 from bi where type in ('consumable', 'rentable')
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

-- ---------- RLS: vendors are admin-only ----------

alter table public.vendors enable row level security;

-- Deliberately NO anon/public policy — vendors never appear on the
-- storefront or on invoices.
drop policy if exists "admin all vendors" on public.vendors;
create policy "admin all vendors"
on public.vendors for all
to authenticated
using (true)
with check (true);

-- Verify afterwards:
--   insert into items (item_category, name, type) values ('T', 't', 'service'); → OK
--   insert into items (item_category, name, type) values ('T', 't', 'bogus');   → check violation
--   anon REST: GET /rest/v1/vendors → [] (RLS blocks, no policy)
--   authenticated REST: GET /rest/v1/vendors → rows
-- Checklist: confirm a booking whose items include a service variant —
--   DP received must generate stock_check rows for the service but NO
--   pickup/return rows for it.
