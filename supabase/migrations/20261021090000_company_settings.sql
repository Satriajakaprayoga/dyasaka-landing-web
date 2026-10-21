-- ============================================================
-- Company settings (docs/DATABASE_SRUCTURE.md §8,
-- docs/FEATURE_SPECIFICATION.md §8):
--   * company_profile — single-row settings table, seeded with
--     'Dyasaka Decoration'. No INSERT policy exists for anyone, so
--     the one-row invariant is enforced at the database level: the
--     screen can only ever edit the seeded row.
--   * company_bank_accounts — bank accounts an invoice can be paid
--     into; only active ones are offered when issuing.
--   * set_updated_at() — shared BEFORE UPDATE trigger function.
--   * storage bucket `company-assets` (public) for the logo, with
--     policies mirroring product-images.
--
-- Run manually: supabase db execute / SQL editor / psql.
-- ============================================================

-- ---------- §8 company_profile ----------

create table if not exists public.company_profile (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  logo_url text,
  address text,
  phone text,
  email text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  updated_at timestamptz not null default now()
);

-- Idempotent seed: exactly one row, created only when missing.
insert into public.company_profile (company_name)
select 'Dyasaka Decoration'
where not exists (select 1 from public.company_profile);

-- ---------- §8 company_bank_accounts ----------

create table if not exists public.company_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_holder text not null,
  account_number text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- shared updated_at trigger ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger functions check EXECUTE at invocation, against the role
-- performing the DML (see 20261020130000). Only `authenticated`
-- writes these tables, so only it gets EXECUTE.
revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;
grant execute on function public.set_updated_at() to authenticated;

drop trigger if exists trg_company_profile_updated_at on public.company_profile;
create trigger trg_company_profile_updated_at
before update on public.company_profile
for each row
execute function public.set_updated_at();

drop trigger if exists trg_company_bank_accounts_updated_at on public.company_bank_accounts;
create trigger trg_company_bank_accounts_updated_at
before update on public.company_bank_accounts
for each row
execute function public.set_updated_at();

-- ---------- RLS ----------

alter table public.company_profile enable row level security;
alter table public.company_bank_accounts enable row level security;

-- Public read: logo, socials and bank details are shown to customers
-- (footer/contact area, invoices).
drop policy if exists "public read company_profile" on public.company_profile;
create policy "public read company_profile"
on public.company_profile for select
to anon, authenticated
using (true);

drop policy if exists "public read company_bank_accounts" on public.company_bank_accounts;
create policy "public read company_bank_accounts"
on public.company_bank_accounts for select
to anon, authenticated
using (true);

-- Admin update only — and deliberately NO INSERT policy for anyone,
-- so the single-row invariant cannot be violated through the API.
-- (The seed above runs as the table owner, which bypasses RLS.)
drop policy if exists "admin update company_profile" on public.company_profile;
create policy "admin update company_profile"
on public.company_profile for update
to authenticated
using (true)
with check (true);

drop policy if exists "admin all company_bank_accounts" on public.company_bank_accounts;
create policy "admin all company_bank_accounts"
on public.company_bank_accounts for all
to authenticated
using (true)
with check (true);

-- ---------- storage: company-assets bucket (logo) ----------

insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "admin all company-assets" on storage.objects;
create policy "admin all company-assets"
on storage.objects for all
to authenticated
using (bucket_id = 'company-assets')
with check (bucket_id = 'company-assets');

drop policy if exists "public read company-assets" on storage.objects;
create policy "public read company-assets"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'company-assets');

-- Verify afterwards:
--   select company_name from company_profile;  -- exactly one row
--   select policyname, cmd, roles from pg_policies
--     where tablename in ('company_profile','company_bank_accounts')
--     order by tablename, policyname;
--   (company_profile must have no INSERT policy row at all.)
--   select id, public from storage.buckets where id = 'company-assets';
--   select policyname, cmd, roles from pg_policies
--     where tablename = 'objects' and policyname like '%company-assets%';
-- Anon REST negative/positive tests (anon key only):
--   GET  /rest/v1/company_profile?select=*        → seeded row
--   POST /rest/v1/company_profile                 → RLS violation
--   GET  /rest/v1/company_bank_accounts?select=*  → []
