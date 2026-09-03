# Balloon Party Planner

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Postgres + Auth + Storage)

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor — this creates
   all tables, the capacity-tracking trigger, and RLS policies.
3. Create a Storage bucket named `product-images` (public read).
4. Copy `.env.local.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
5. `npm install && npm run dev`

## Project structure

```
app/
  catalog/               # product grid, category + price filters, search
  product/[id]/          # product detail, WA inquiry CTA, embedded availability calendar
  availability/          # standalone availability calendar page
  admin/
    login/               # admin sign-in (Supabase Auth)
    page.tsx             # dashboard home
    products/            # list + new (with photo upload to Storage)
    categories/          # list + inline add
    bookings/            # list + new (product, theme, message, customer, date)
  api/admin/
    products/            # POST create product
    categories/          # POST create category
    bookings/            # POST create, PATCH update booking
components/
  AvailabilityCalendar.tsx  # shared read-only calendar, used standalone + embedded
lib/
  supabase.ts            # Supabase client (public/browser)
  supabase-server.ts     # server-side Supabase client (cookie-based auth, admin routes)
  types.ts               # shared TS types matching the DB schema
  booking-helpers.ts     # date-capacity lookups + WhatsApp inquiry link builder
supabase/
  schema.sql             # full DB schema, trigger, RLS policies
middleware.ts             # protects /admin/* — redirects to /admin/login if not signed in
```

## How booking + capacity works

There is no client-facing booking form. The flow is:

1. Customer browses `/catalog` (filter by category/price, or search), opens
   a product, and taps a WhatsApp button (`buildWhatsAppInquiryLink`) to ask
   about a date/theme directly with the admin.
2. Customer can check `/availability`, or the compact calendar embedded on
   the product page, to see which dates are already full — both read only
   from `date_capacity`, never from `bookings`, so customer contact info is
   never exposed publicly. Capacity is tracked globally (one calendar for
   the whole business), not per product.
3. Once the admin and customer agree over WhatsApp, the admin logs into
   `/admin` and adds the booking via `/admin/bookings/new` — product,
   theme, message, customer name/phone/address, event date, status.
4. A Postgres trigger (`bookings_after_change`) recalculates
   `date_capacity.booked_count` automatically whenever a `confirmed`
   booking is inserted, updated, or deleted — so the public calendar
   updates immediately and admin never edits the count by hand.
5. `/admin/bookings` lists all bookings so the admin can track status
   over time (`pending` → `confirmed` → `done`, or `cancelled`).

## Still to build

- Product edit/delete + category edit/delete (currently create + list only)
- Booking edit screen (API supports PATCH already, just needs a UI)
- Homepage (`/`) with hero + featured categories
- Seed data / first admin user (create via Supabase Auth dashboard, since
  there's no public sign-up — single admin only)
