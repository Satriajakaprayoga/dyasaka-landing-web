-- ============================================================
-- Public booking: allow anonymous visitors to create bookings
-- from the storefront product detail page.
--
-- Run manually:
--   supabase db execute --file supabase/migrations/20261007120000_public_booking_insert.sql
-- (or paste into the Supabase Studio SQL editor)
-- ============================================================

-- 1) Public insert policy. The client cannot force admin-controlled
--    fields: status/project_status must be their defaults ('pending' /
--    'not_started'), no down-payment marker, the product must be
--    active, and inputs must be sane lengths. event_date must be
--    today or later.
create policy "public insert bookings"
  on bookings
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and project_status = 'not_started'
    and dp_received_at is null
    and exists (
      select 1 from products p
      where p.id = product_id and p.is_active = true
    )
    and char_length(trim(customer_name)) between 1 and 100
    and char_length(trim(phone)) between 5 and 25
    and char_length(event_address) between 1 and 500
    and event_date >= current_date
    and (theme is null or char_length(theme) <= 200)
    and (message is null or char_length(message) <= 1000)
  );

-- There is intentionally still NO public SELECT on bookings — customers
-- can create a booking but can never read anyone's contact info.

-- 2) trg_bookings_after_change maintains date_capacity.booked_count via
--    recalc_date_capacity(). That function runs with the inserting
--    role's privileges, and anon has no write access to date_capacity
--    (by design — clients must never edit availability), so a public
--    booking insert would fail inside the trigger. Re-create it as
--    SECURITY DEFINER so the counter maintenance runs as the table
--    owner. This is the legitimate SECURITY DEFINER case: internal
--    maintenance on a table that stays read-only for clients. It takes
--    a date parameter only, uses no dynamic SQL, references no auth
--    claims, and direct calls are revoked below (trigger invocation
--    does not require EXECUTE).
create or replace function recalc_date_capacity(p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Ensure a row exists for this date
  insert into public.date_capacity (event_date, max_capacity, booked_count)
  values (p_date, 1, 0)
  on conflict (event_date) do nothing;

  update public.date_capacity
  set booked_count = (
    select count(*) from public.bookings
    where event_date = p_date
      and status = 'confirmed'
  )
  where event_date = p_date;
end;
$$;

revoke all on function recalc_date_capacity(date) from public;
revoke all on function recalc_date_capacity(date) from anon;
revoke all on function recalc_date_capacity(date) from authenticated;

-- Verify afterwards:
--   select policyname, cmd, roles from pg_policies where tablename = 'bookings';
--   select proname, prosecdef from pg_proc where proname = 'recalc_date_capacity';
