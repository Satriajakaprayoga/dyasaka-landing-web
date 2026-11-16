-- ============================================================
-- Public booking throttle.
--
-- The "public insert bookings" policy keeps anonymous inserts to a
-- well-formed pending row, but nothing limits how *many* rows one
-- visitor can create. A trivial script could flood the admin queue
-- with thousands of pending bookings.
--
-- This trigger adds two database-enforced limits for anonymous
-- visitors only (an authenticated admin is unaffected):
--   1. at most 3 pending bookings from the same phone in 24 hours;
--   2. no duplicate pending/confirmed booking for the same phone and
--      event date.
--
-- SECURITY DEFINER is required because anon has no SELECT grant on
-- bookings (correctly — it holds customer contact data). The function
-- only reads aggregates, takes no dynamic SQL and uses a locked
-- search_path.
-- ============================================================

create index if not exists idx_bookings_phone_created
  on public.bookings (phone, created_at desc);

create index if not exists idx_bookings_phone_event_date
  on public.bookings (phone, event_date);

create or replace function public.enforce_public_booking_throttle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_pending int;
  duplicate_booking int;
begin
  -- Admin (cookie session) inserts are not throttled.
  if auth.uid() is not null then
    return new;
  end if;

  select count(*)
    into recent_pending
  from public.bookings b
  where regexp_replace(b.phone, '\D', '', 'g') =
        regexp_replace(new.phone, '\D', '', 'g')
    and b.status = 'pending'
    and b.created_at > now() - interval '24 hours';

  if recent_pending >= 3 then
    raise exception using
      errcode = 'check_violation',
      message = 'Terlalu banyak booking dari nomor ini. Coba lagi nanti atau hubungi admin via WhatsApp.';
  end if;

  select count(*)
    into duplicate_booking
  from public.bookings b
  where regexp_replace(b.phone, '\D', '', 'g') =
        regexp_replace(new.phone, '\D', '', 'g')
    and b.event_date = new.event_date
    and b.status in ('pending', 'confirmed');

  if duplicate_booking > 0 then
    raise exception using
      errcode = 'unique_violation',
      message = 'Sudah ada booking untuk nomor dan tanggal ini. Hubungi admin via WhatsApp untuk perubahan.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_public_booking_throttle() from public;
revoke all on function public.enforce_public_booking_throttle() from anon;
revoke all on function public.enforce_public_booking_throttle() from authenticated;

drop trigger if exists trg_bookings_public_throttle on public.bookings;
create trigger trg_bookings_public_throttle
  before insert on public.bookings
  for each row
  execute function public.enforce_public_booking_throttle();

-- Verify afterwards:
--   select tgname from pg_trigger where tgrelid = 'public.bookings'::regclass;
