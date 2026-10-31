-- ============================================================
-- Invoices §9 revision: multi-invoice per booking, payments in the
-- ledger (docs/DATABASE_SRUCTURE.md §9, docs/FEATURE_SPECIFICATION.md §9).
-- Run AFTER 20261101090000_ledger_staff_procurement_plans.sql
-- (needs public.transactions + the seeded 'Customer payment' category).
-- Run manually: supabase db execute / SQL editor / psql.
--
-- Model (supersedes the old one-invoice + editable-until-paid design):
--   * A booking has SEVERAL invoices over its life: first a deposit
--     invoice (invoice_type 'dp', a single typed line), later a
--     'final' invoice. At most ONE non-void invoice of each type per
--     booking — enforced by a partial unique index.
--   * draft     editable, never visible to customers
--   * issued    FROZEN — correction means void + reissue
--   * paid      derived: balance due reaches zero
--   * void      read-only; old link shows a "replaced" notice pointing
--               to the current invoice, no amounts
--   * amount_paid / balance_due are GONE as columns — they are
--     calculated from ledger `in` rows (transactions.invoice_id), so
--     an issued invoice stays frozen while payments change.
--   * Customer/event details are snapshotted at issue, like the
--     company name and bank account.
--
-- Data migration: every existing amount_paid becomes a ledger `in`
-- row (category "Customer payment") BEFORE the columns are dropped,
-- so no payment record is lost. partially_paid rows become `issued`
-- (their paid amount lives in the ledger from now on).
-- ============================================================

-- 1) invoice_type. Existing invoices are the single-invoice kind,
--    i.e. final invoices.
alter table public.invoices
  add column if not exists invoice_type text not null default 'final';

alter table public.invoices
  drop constraint if exists invoices_invoice_type_check;
alter table public.invoices
  add constraint invoices_invoice_type_check
  check (invoice_type in ('dp', 'final'));

-- 2) Migrate recorded payments into the ledger. Idempotent: an
--    invoice is only migrated while it has no ledger rows yet.
insert into public.transactions
  (direction, amount, transaction_date, category_id, account,
   description, booking_id, invoice_id)
select
  'in',
  i.amount_paid,
  coalesce(i.issue_date, i.updated_at::date, current_date),
  (select id from public.transaction_categories
    where name = 'Customer payment'
    order by sort_order
    limit 1),
  null,
  coalesce('Pembayaran invoice ' || i.invoice_number, 'Pembayaran invoice'),
  i.booking_id,
  i.id
from public.invoices i
where i.amount_paid > 0
  and not exists (
    select 1 from public.transactions t where t.invoice_id = i.id
  );

-- 3) Settle status. paid stays paid; partially_paid goes back to
--    issued (it had money in but not settled — the balance now comes
--    from the ledger rows inserted above).
update public.invoices set status = 'issued' where status = 'partially_paid';

alter table public.invoices drop constraint invoices_status_check;
alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'issued', 'paid', 'void'));

-- 4) booking_id loses its UNIQUE constraint; invoice_type + the
--    partial unique index take over the "one live invoice per type"
--    rule. Voided invoices free the slot for the reissue.
alter table public.invoices
  drop constraint if exists invoices_booking_id_key;

create unique index if not exists invoices_booking_type_live
  on public.invoices (booking_id, invoice_type)
  where status <> 'void';

-- 5) Customer/event snapshots, copied in at issue like the company
--    name and bank account.
alter table public.invoices
  add column if not exists customer_name_snapshot text;
alter table public.invoices
  add column if not exists phone_snapshot text;
alter table public.invoices
  add column if not exists event_address_snapshot text;
alter table public.invoices
  add column if not exists event_date_snapshot date;

-- 6) Drop the cached payment columns — calculated from the ledger
--    from now on.
alter table public.invoices
  drop column if exists amount_paid;
alter table public.invoices
  drop column if exists balance_due;

-- 7) Public access by token — one RPC for all three cases:
--      issued / paid → the full invoice; amount_paid and balance_due
--        are computed from the ledger right here, and the bill-to
--        fields prefer the issue-time snapshot, falling back to the
--        booking for invoices issued before snapshots existed.
--      void          → a slim "replaced" payload: no amounts, just
--                      the number and the current invoice's token
--                      (same booking + type, non-void), if any.
--      draft / unknown → null (indistinguishable → 404).
create or replace function public.get_invoice_by_token(p_token text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when i.status in ('issued', 'paid') then
      json_build_object(
        'replaced', false,
        'invoice', to_jsonb(i) - 'access_token'
          || jsonb_build_object(
            'amount_paid', coalesce(pay.paid, 0),
            'balance_due', greatest(i.total - coalesce(pay.paid, 0), 0)
          ),
        'items', coalesce((
          select json_agg(to_jsonb(ii) order by ii.sort_order, ii.id)
          from public.invoice_items ii
          where ii.invoice_id = i.id
        ), '[]'::json),
        'booking', json_build_object(
          'customer_name', coalesce(i.customer_name_snapshot, b.customer_name),
          'phone', coalesce(i.phone_snapshot, b.phone),
          'event_date', coalesce(i.event_date_snapshot, b.event_date),
          'event_address', coalesce(i.event_address_snapshot, b.event_address),
          'theme', b.theme
        )
      )
    when i.status = 'void' then
      json_build_object(
        'replaced', true,
        'invoice_number', i.invoice_number,
        'current_token', cur.access_token
      )
    else null
  end
  from public.invoices i
  join public.bookings b on b.id = i.booking_id
  left join lateral (
    select sum(t.amount) as paid
    from public.transactions t
    where t.invoice_id = i.id and t.direction = 'in'
  ) pay on true
  left join lateral (
    select c.access_token
    from public.invoices c
    where c.booking_id = i.booking_id
      and c.invoice_type = i.invoice_type
      and c.status <> 'void'
    order by c.created_at desc
    limit 1
  ) cur on i.status = 'void'
  where i.access_token = p_token
    and i.status in ('issued', 'paid', 'void');
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
--       and conname in ('invoices_status_check','invoices_invoice_type_check');
--   (status must be draft/issued/paid/void; type must be dp/final.)
--   select indexdef from pg_indexes
--     where indexname = 'invoices_booking_type_live';
--   (must be unique, partial: WHERE status <> 'void'.)
--   select column_name from information_schema.columns
--     where table_name='invoices'
--       and column_name in ('amount_paid','balance_due');
--   (must return ZERO rows.)
--   select column_name from information_schema.columns
--     where table_name='invoices'
--       and column_name in ('customer_name_snapshot','phone_snapshot',
--                           'event_address_snapshot','event_date_snapshot')
--     order by column_name;                    -- 4 rows
--   select count(*) from transactions where invoice_id is not null;
--   (must equal the number of invoices that had amount_paid > 0.)
-- Smoke tests:
--   * Open a paid invoice's public link → renders with amounts;
--     amount_paid equals the sum of its ledger rows.
--   * Void an issued invoice, open its old link → "replaced" notice
--     with a link to the new invoice, no amounts shown.
--   * POST /rest/v1/rpc/get_invoice_by_token with a draft token → null.
