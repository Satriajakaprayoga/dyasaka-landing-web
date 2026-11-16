# Balloon Party Planner

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Postgres + Auth + Storage)

## Setup

1. Create a Supabase project.
2. In the Supabase SQL editor (or with the Supabase CLI) run every file in
   `supabase/migrations/` in filename order. The first file is the initial
   schema; later ones add inventory, the booking workflow, invoices, the
   ledger, staff/procurement and the public read policies. Do **not** run
   `supabase/schema.sql` as well — it is a historical snapshot of the
   original five-table schema and would collide with the migrations.
3. Create a Storage bucket named `product-images` (the
   `20261006120000_modernize_storage_policies.sql` migration makes it
   public and adds the policies).
4. Create `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   NEXT_PUBLIC_BUSINESS_WA_NUMBER=your-wa-number
   NEXT_PUBLIC_SITE_URL=your-public-url   # optional, used for JSON-LD
   ```
5. `npm install && npm run dev`

Checks: `npm run typecheck`, `npm run lint`, `npm test` (Node's built-in
runner, no extra dependency) and `npm run build`. CI runs all four on every
push and pull request from a clean `npm ci`.

Optional dev setting: when opening the dev server through a LAN IP, set
`ALLOWED_DEV_ORIGINS=172.16.1.25` (comma-separated) so Next 16 allows the
HMR assets. It is not needed for `next start` or by other machines.

## Project structure

```
app/
  (public)/              # landing, catalog, product/[id], availability
  offline/               # offline fallback (service worker)
  invoice/[token]/       # public invoice by private token
  admin/
    login/               # admin sign-in (Supabase Auth)
    (panel)/             # dashboard, products, items, bookings, vendors,
                         # suppliers, staff, ledger, report, plans, orders,
                         # categories, settings (sidebar + bottom-nav shell)
  api/admin/             # JSON CRUD per resource (session required)
components/
  landing/               # public page sections
  admin/                 # admin panels, forms, tables, shared hooks
  AvailabilityCalendar   # shared read-only calendar, standalone + embedded
lib/
  supabase.ts            # Supabase client (public/browser)
  supabase-server.ts     # server-side Supabase client (cookie-based auth, admin routes)
  types.ts               # shared TS types matching the DB schema
  booking-helpers.ts     # date-capacity lookups + WhatsApp link builders
  revalidate-public.ts   # purges cached public pages after admin writes
supabase/
  migrations/            # source of truth (run in filename order)
  schema.sql             # historical snapshot of the original schema — do not run
proxy.ts                 # protects /admin/* — redirects to /admin/login if not signed in
```

Deeper references: `docs/ARCHITECTURE.md` (design and data flow),
`docs/DATABASE_SRUCTURE.md` (schema), `docs/FEATURE_SPECIFICATION.md`
(feature behavior), `docs/routes/README.md` (every route's doc).

## How booking + capacity works

Customers can book in two ways:

1. **Self-service booking** — on a product page, "Booking Sekarang" opens
   a modal form (name, WhatsApp number, event date/address, optional
   theme/notes) that inserts directly into `bookings` as the anonymous
   role. The `public insert bookings` RLS policy forces the row to
   `pending`/`not_started`, requires an active product and a future
   date, and there is no public SELECT on `bookings` — visitors can
   create bookings but never read them (migration
   `20261007120000_public_booking_insert.sql`). A follow-up trigger
   (`20261116100000_public_booking_throttle.sql`) caps anonymous inserts at
   3 pending bookings per phone in 24 hours and rejects a duplicate
   pending/confirmed booking for the same phone and event date. Admin
   (authenticated) inserts bypass both limits.
2. **Admin manual entry** — the classic flow: the customer asks via the
   WhatsApp button (`buildWhatsAppInquiryLink`) or follows up after
   booking, and the admin records/adjusts it under `/admin/bookings`.

Availability stays safe either way:

- Customers only ever read `date_capacity` (the compact calendar on the
  product page and `/availability`); `bookings`, which holds customer
  contact info, has no public SELECT policy.
- Capacity is tracked globally (one calendar for the whole business),
  not per product.
- A Postgres trigger (`bookings_after_change`) recalculates
  `date_capacity.booked_count` on every insert/update/delete. Its
  helper `recalc_date_capacity()` is SECURITY DEFINER so the counter
  maintenance also works for anonymous inserts while `date_capacity`
  itself stays read-only for clients.
- Bookings move `pending` → `confirmed` → `done` (or `cancelled`) from
  the admin list; the public calendar updates as soon as a booking is
  confirmed.

## Still to build

- Seed data / first admin user (create via Supabase Auth dashboard, since
  there's no public sign-up — single admin only)
