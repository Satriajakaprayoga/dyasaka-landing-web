-- ============================================================
-- Invoices (docs/DATABASE_SRUCTURE.md §9,
-- docs/FEATURE_SPECIFICATION.md §9).
-- Run AFTER 20261021090000_company_settings.sql.
-- Run manually: supabase db execute / SQL editor / psql.
--
-- Decisions recorded in the docs:
--   * ONE invoice per booking — invoices.booking_id is UNIQUE, so
--     the DP is recorded as a payment (amount_paid) against the
--     single invoice, not as a second document.
--   * invoice_number 'INV/YYYY/MM/NNNN' is assigned at issue time
--     (unique constraint backs the API's race retry).
--   * The public page resolves an invoice ONLY through
--     get_invoice_by_token() — there is intentionally NO anon
--     SELECT policy on invoices/invoice_items, ever.
-- ============================================================

-- gen_random_bytes() for access_token (default on Supabase; the
-- guard keeps the file re-runnable on plain Postgres).
create extension if not exists pgcrypto;

-- ---------- §9 invoices ----------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  -- UNIQUE: one invoice per booking; booking delete cascades.
  booking_id uuid not null unique
    references public.bookings(id) on delete cascade,
  -- Assigned when the invoice is issued; drafts have null.
  invoice_number text unique,
  access_token text not null unique
    default encode(gen_random_bytes(32), 'hex'),
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'paid', 'void')),
  issue_date date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0
    check (amount_paid >= 0),
  balance_due numeric(12,2) not null default 0,
  -- Draft-time working reference; snapshotted to
  -- bank_account_snapshot (text) at issue.
  bank_account_id uuid
    references public.company_bank_accounts(id) on delete set null,
  company_name_snapshot text,
  bank_account_snapshot text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_issue_date
  on public.invoices (issue_date);

-- ---------- §9 invoice_items ----------

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null
    references public.invoices(id) on delete cascade,
  description text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as
    (quantity * unit_price) stored,
  source_type text not null default 'custom'
    check (source_type in ('item', 'vendor', 'transport', 'custom')),
  sort_order int not null default 0
);

create index if not exists idx_invoice_items_invoice
  on public.invoice_items (invoice_id);

-- ---------- updated_at trigger ----------

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

-- ---------- RLS ----------

-- Admin-only CRUD. Deliberately NO anon SELECT policy: the public
-- invoice page must never list or guess invoices — it goes through
-- get_invoice_by_token() below, which filters by token + status.
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "admin all invoices" on public.invoices;
create policy "admin all invoices"
on public.invoices for all
to authenticated
using (true)
with check (true);

drop policy if exists "admin all invoice_items" on public.invoice_items;
create policy "admin all invoice_items"
on public.invoice_items for all
to authenticated
using (true)
with check (true);

-- ---------- public access by token ----------

-- SECURITY DEFINER: customers are anon and invoices carry no anon
-- SELECT policy, so the lookup must run as the owner. Returns the
-- invoice (access_token stripped), its ordered lines and the
-- bill-to fields — but ONLY for issued/paid invoices; draft, void
-- and unknown tokens are indistinguishable (null → 404).
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
    and i.status in ('issued', 'paid');
$$;

revoke all on function public.get_invoice_by_token(text) from public;
revoke all on function public.get_invoice_by_token(text) from anon;
revoke all on function public.get_invoice_by_token(text) from authenticated;
grant execute on function public.get_invoice_by_token(text) to anon;
grant execute on function public.get_invoice_by_token(text) to authenticated;

-- Verify afterwards:
--   select column_name, data_type from information_schema.columns
--     where table_schema='public' and table_name in ('invoices','invoice_items')
--     order by table_name, ordinal_position;
--   select indexname from pg_indexes
--     where tablename in ('invoices','invoice_items');
--   select conname from pg_constraint
--     where conrelid = 'invoices'::regclass and contype in ('u','f');
--   select proname, prosecdef, proconfig from pg_proc
--     where proname = 'get_invoice_by_token';
--   select policyname, cmd, roles from pg_policies
--     where tablename in ('invoices','invoice_items');
--   (no policy row with cmd = 'SELECT' + anon role may exist.)
-- Anon REST negative tests (anon key only):
--   GET  /rest/v1/invoices?select=*            → []
--   GET  /rest/v1/invoice_items?select=*       → []
--   POST /rest/v1/rpc/get_invoice_by_token with a draft token     → null
--   POST /rest/v1/rpc/get_invoice_by_token with an issued token
--        → json; the invoice object must NOT contain access_token
