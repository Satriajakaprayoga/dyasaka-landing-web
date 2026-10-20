-- ============================================================
-- Fix: "permission denied for function recalc_date_capacity"
-- when a visitor creates a booking from the storefront, and the
-- same latent bug for the checklist triggers.
-- Run AFTER 20261020120000. Run manually: supabase db execute /
-- SQL editor / psql.
--
-- Root cause: Postgres checks EXECUTE on trigger functions at
-- invocation, against the role performing the DML — and EXECUTE on a
-- function called *inside* another function is checked against that
-- caller's effective role. 20261007120000 made recalc_date_capacity()
-- SECURITY DEFINER and revoked EXECUTE from anon/authenticated, but
-- its caller bookings_after_change() still ran as SECURITY INVOKER —
-- so an anon insert checked EXECUTE as anon and was denied. (The
-- earlier note "trigger invocation does not require EXECUTE" was
-- wrong; it also meant the revokes in 20261020120000 would break the
-- admin DP flow identically.)
--
-- Fix:
--   1. bookings_after_change() becomes SECURITY DEFINER (search path
--      pinned, names qualified), so the internal recalc_date_capacity()
--      call is privilege-checked as the table owner — who keeps
--      EXECUTE; only client roles were revoked.
--   2. The roles that legitimately fire each trigger get EXECUTE on
--      that trigger's function, and nothing more:
--        bookings_after_change()         → anon, authenticated
--        generate_booking_checklist()    → authenticated
--        sync_checklist_rental_status()  → authenticated
--      (anon never reaches generate_booking_checklist: the public
--      insert policy forces dp_received_at null, so the trigger's
--      WHEN clause filters the invocation out.)
--      recalc_date_capacity() stays revoked from every client role —
--      it is now only ever called from inside the definer function.
-- ============================================================

-- 1) Capacity trigger entry point runs as the table owner end-to-end.
create or replace function public.bookings_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.recalc_date_capacity(OLD.event_date);
    return OLD;
  end if;

  perform public.recalc_date_capacity(NEW.event_date);

  -- If the date changed on update, recalc the old date too
  if TG_OP = 'UPDATE' and OLD.event_date is distinct from NEW.event_date then
    perform public.recalc_date_capacity(OLD.event_date);
  end if;

  return NEW;
end;
$$;

-- 2) EXECUTE for the DML roles (checked at trigger invocation).
--    GRANT/REVOKE are idempotent, so this file is safe to re-run.
revoke all on function public.bookings_after_change() from public;
grant execute on function public.bookings_after_change() to anon;
grant execute on function public.bookings_after_change() to authenticated;

grant execute on function public.generate_booking_checklist() to authenticated;
grant execute on function public.sync_checklist_rental_status() to authenticated;

-- Verify afterwards:
--   select proname, prosecdef, proacl from pg_proc
--     where proname in ('bookings_after_change','recalc_date_capacity',
--                       'generate_booking_checklist',
--                       'sync_checklist_rental_status');
--   (bookings_after_change: prosecdef = true; recalc_date_capacity:
--    no anon/authenticated entry in proacl; the other two: EXECUTE
--    for authenticated only.)
-- Smoke test: insert a booking from the storefront modal as a logged-
-- out visitor — must succeed, and date_capacity.booked_count must
-- change once the admin confirms it.
