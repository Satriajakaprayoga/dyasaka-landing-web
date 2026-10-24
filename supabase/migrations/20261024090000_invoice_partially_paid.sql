-- ============================================================
-- Invoices §9 revision: editable-until-paid status model.
-- Adds 'partially_paid' as a system-derived status.
-- Run AFTER 20261021100000_invoices.sql (already applied; this
-- revises it in place).
-- Run manually: supabase db push / SQL editor / psql.
--
-- Model (decided — replaces the old "immutable after issue"):
--   draft          editable (also deletable)
--   issued         editable — lines/dates/bank, payments, void
--   partially_paid editable — same actions; NEVER set by hand:
--                  derived from amount_paid > 0 AND balance_due > 0.
--                  The API recomputes it on every write (save-lines,
--                  record-payment); nothing here back-fills rows.
--   paid           READ-ONLY, strictly — no void, no payment
--                  reversal (accepted trade-off: a wrongly recorded
--                  final payment can only be fixed via direct DB
--                  edit)
--   void           read-only
-- ============================================================

-- 1) Widen the status check. The constraint was created inline in
--    20261021100000, so it carries Postgres' default name
--    {table}_{column}_check.
alter table public.invoices
  drop constraint invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'issued', 'partially_paid', 'paid', 'void'));

-- 2) Public visibility: a partially-paid invoice must stay reachable
--    through its token exactly like issued/paid — otherwise the
--    customer's link 404s the moment the first partial payment is
--    recorded.
create or replace function public.get_invoice_by_token(p_token text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'invoice', to_jsonb(i) - 'access_token',
    'items', coalesce((
      select json_agg(to_jsonb(ii) order by ii.sort_order, ii.id)
      from public.invoice_items ii
      where ii.invoice_id = i.id
    ), '[]'::json),
    'booking', json_build_object(
      'customer_name', b.customer_name,
      'phone', b.phone,
      'event_date', b.event_date,
      'event_address', b.event_address,
      'theme', b.theme
    )
  )
  from public.invoices i
  join public.bookings b on b.id = i.booking_id
  where i.access_token = p_token
    and i.status in ('issued', 'partially_paid', 'paid');
$$;

-- create or replace keeps ACLs; re-asserting keeps the file
-- idempotent (repo style, cf. 20261020130000).
revoke all on function public.get_invoice_by_token(text) from public;
revoke all on function public.get_invoice_by_token(text) from anon;
revoke all on function public.get_invoice_by_token(text) from authenticated;
grant execute on function public.get_invoice_by_token(text) to anon;
grant execute on function public.get_invoice_by_token(text) to authenticated;

-- Verify afterwards:
--   select pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'invoices'::regclass
--       and conname = 'invoices_status_check';
--   (definition must include 'partially_paid'.)
--   select prosrc from pg_proc where proname = 'get_invoice_by_token';
--   (source must filter status in ('issued','partially_paid','paid').)
-- Smoke test: as admin, record a partial payment on an issued
-- invoice, then open the public link in an incognito browser — it
-- must render with the "Bayar Sebagian" badge and the remaining
-- balance, NOT 404.
