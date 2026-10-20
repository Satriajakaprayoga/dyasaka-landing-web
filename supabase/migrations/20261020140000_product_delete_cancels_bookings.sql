-- ============================================================
-- Product deletion cancels its bookings instead of being blocked.
--
-- bookings.product_id keeps its ON DELETE RESTRICT FK; a BEFORE
-- DELETE trigger on products severs the references before the RI
-- check runs (BEFORE row triggers fire before the AFTER-row RI
-- check), so the delete succeeds:
--   * pending/confirmed bookings → status = 'cancelled' (the usual
--     bookings_after_change chain recalculates date_capacity per row,
--     freeing the event dates)
--   * done/cancelled bookings keep their status (history preserved)
--   * every affected booking gets product_id = null (legal since
--     20261020120000 made the column nullable; custom bookings and
--     the public insert policy are unaffected)
-- Run manually: supabase db execute / SQL editor / psql.
-- ============================================================

create or replace function public.cancel_bookings_of_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Active bookings fall through to cancelled.
  update public.bookings
  set status = 'cancelled', product_id = null
  where product_id = old.id and status in ('pending', 'confirmed');

  -- done/cancelled keep their status — only the link is severed.
  update public.bookings
  set product_id = null
  where product_id = old.id;

  return old;
end;
$$;

drop trigger if exists trg_products_cancel_bookings on public.products;
create trigger trg_products_cancel_bookings
before delete on public.products
for each row
execute function cancel_bookings_of_product();

-- Trigger invocation checks EXECUTE against the DML role; product
-- deletes come from admin actions, i.e. as `authenticated`. anon can
-- never delete products (RLS), so it gets nothing.
revoke all on function public.cancel_bookings_of_product() from public;
revoke all on function public.cancel_bookings_of_product() from anon;
grant execute on function public.cancel_bookings_of_product() to authenticated;

-- Verify afterwards:
--   select tgname from pg_trigger
--     where tgrelid = 'products'::regclass and not tgisinternal;
--   select proname, prosecdef, proacl from pg_proc
--     where proname = 'cancel_bookings_of_product';
-- Smoke test: note a product's bookings, delete the product, then:
--   select id, status, product_id from bookings
--     where product_id is null and status = 'cancelled';
-- (previously-active rows appear here with product_id null; the
-- date_capacity rows for their event dates must show a lower
-- booked_count for previously-confirmed ones.)
