# Balloon Party Planner

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Postgres + Auth + Storage)

## Setup

1. Create a Supabase project.
2. In the Supabase SQL editor run `supabase/schema.sql` (tables, the
   capacity-tracking trigger, base RLS policies), then every file in
   `supabase/migrations/` in filename order — later migrations modernize
   the storage policies and open public booking inserts.
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

## Project structure

```
app/
  catalog/               # product grid, category + price filters, search
  product/[id]/          # detail: gallery + lightbox, WA inquiry, booking modal, availability calendar
  availability/          # standalone availability calendar page
  admin/
    login/               # admin sign-in (Supabase Auth)
    page.tsx             # dashboard home
    products/            # list + new (with photo upload to Storage)
    categories/          # CRUD (inline rename, pagination)
    bookings/            # list + new + edit (status workflow)
    items/               # inventory: items, variants, stock movements
  api/admin/
    products/            # JSON CRUD (session required)
    categories/          # JSON CRUD (session required)
    bookings/            # JSON CRUD (session required)
    items/               # JSON CRUD (session required)
    item-variants/       # JSON CRUD (session required)
    stock-movements/     # POST record stock movement
components/
  AvailabilityCalendar.tsx  # shared read-only calendar, used standalone + embedded
lib/
  supabase.ts            # Supabase client (public/browser)
  supabase-server.ts     # server-side Supabase client (cookie-based auth, admin routes)
  types.ts               # shared TS types matching the DB schema
  booking-helpers.ts     # date-capacity lookups + WhatsApp inquiry link builder
supabase/
  schema.sql             # full DB schema, trigger, RLS policies
  migrations/            # incremental SQL migrations (run in filename order)
middleware.ts             # protects /admin/* — redirects to /admin/login if not signed in
```

## How booking + capacity works

Customers can book in two ways:

1. **Self-service booking** — on a product page, "Booking Sekarang" opens
   a modal form (name, WhatsApp number, event date/address, optional
   theme/notes) that inserts directly into `bookings` as the anonymous
   role. The `public insert bookings` RLS policy forces the row to
   `pending`/`not_started`, requires an active product and a future
   date, and there is no public SELECT on `bookings` — visitors can
   create bookings but never read them (migration
   `20261007120000_public_booking_insert.sql`).
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
