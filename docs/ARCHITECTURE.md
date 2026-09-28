# Dyasaka Decoration — Architecture & Project Interpretation

This document is an interpretive deep-dive into the codebase: what the system is,
how it is structured, why key decisions were made, and how data flows through it.
For setup instructions and a quick tour, see the root `README.md`.

---

## 1. What this project is

**Dyasaka Decoration** (package name `balloon-party-planner`) is a web application
for a small balloon-decoration business in Indonesia. It serves two very different
audiences from one codebase:

| Audience | Surface | Purpose |
|---|---|---|
| Customers | `/`, `/catalog`, `/product/[id]`, `/availability` | Browse packages, check date availability, initiate contact |
| Owner (single admin) | `/admin/*` + `/api/admin/*` | Manage catalog and record bookings after off-platform negotiation |

The defining business insight of this project: **the sale is closed on WhatsApp,
not on the website.** The site is a storefront and availability checker; the
booking itself is entered by the admin after negotiating with the customer over
WhatsApp. There is deliberately no customer-facing booking form.

UI copy is Indonesian (`lang="id"`, prices formatted `Rp x.xxx` via
`toLocaleString('id-ID')`, calendar headers in Indonesian), confirming the
target market.

---

## 2. Tech stack

- **Next.js 14.2** (App Router) + **TypeScript** + **React 18**
- **Tailwind CSS 3** for styling (no component library)
- **Supabase** as the entire backend:
  - **Postgres** — data + triggers + Row Level Security (RLS)
  - **Auth** — email/password, single admin, no public sign-up UI
  - **Storage** — `product-images` bucket (public read)
- `@supabase/ssr` for cookie-based auth in server contexts and middleware

There is no custom server, no separate API service, no other database. Supabase
*is* the backend; Next.js is both the UI and a thin authorized proxy for admin writes.

---

## 3. High-level architecture

```
                       ┌──────────────────────────────────────┐
                       │              Next.js 14              │
  Customer ───────────►│  Public pages (RSC)                  │
   (anon)              │   /  /catalog  /product/[id]         │
                       │   /availability                      │
                       │        │                             │
                       │        │ browser client (anon JWT)   │
                       │        ▼                             │
                       │  ┌───────────────────────────┐       │
                       │  │ AvailabilityCalendar (CSR)│──┐    │
                       │  └───────────────────────────┘  │    │
                       └─────────────────────────────────┼────┘
                                                         │
  Admin ───────────────►┌────────────────────────────────┼────┐
   (authenticated)      │ middleware.ts                  │    │
                        │  gates /admin/* via cookies ───┤    │
                        │                                │    │
                        │  Admin pages (mix RSC + CSR)   │    │
                        │  API routes /api/admin/*       │    │
                        │   (server client, cookie JWT) ─┤    │
                        └────────────────────────────────┼────┘
                                                         │
                        ┌────────────────────────────────▼────┐
                        │              Supabase               │
                        │  Postgres (RLS on every table)      │
                        │   ├─ categories, products,          │
                        │   │  product_images                 │
                        │   ├─ date_capacity  ◄── trigger ──  │
                        │   └─ bookings (admin-only)          │
                        │  Auth (email/password)              │
                        │  Storage (product-images, public r) │
                        └─────────────────────────────────────┘
```

### The two Supabase clients (`lib/`)

| File | Used by | Auth context |
|---|---|---|
| `lib/supabase.ts` (`createBrowserClient`) | Client components (login, admin forms, calendar) | Whatever session is in the browser cookies — anon for visitors |
| `lib/supabase-server.ts` (`createServerSupabase`) | Server components + API routes | Request cookies forwarded to Supabase, so RLS sees `authenticated` for the admin |

`createServerSupabase` (lib/supabase-server.ts:10) is the highest fan-in function
in the codebase — every admin server component and every API route depends on it.
It is the seam between Next.js and Supabase auth.

Note: even API routes use the **anon/publishable key**, not the `service_role`
key. Authorization is enforced by *Postgres RLS* (via the forwarded admin
session), with an explicit `auth.getUser()` check in each route handler as a
first line of defense. The database, not application code, is the security
boundary.

---

## 4. Domain model (database interpretation)

Five tables (`supabase/schema.sql`, mirrored in `supabase/migrations/`):

```
categories 1───* products 1───* product_images
                    │
                    └──────* bookings ──(trigger)──► date_capacity
```

### Table-by-table reading

- **`categories`** — name + unique `slug` (slug generated by `slugify()` in
  app/api/admin/categories/route.ts:4). `products.category_id` is
  `ON DELETE RESTRICT`, so a category with products cannot be deleted — this is
  what makes the admin "Hapus" button fail safely.

- **`products`** — the balloon package. `price numeric(12,2)`, `is_active`
  flag. The public catalog filters with `is_active = true` (enforced twice:
  in the query *and* in the RLS select policy for anon). Indexes on
  `category_id` and `price` support the catalog filters.

- **`product_images`** — ordered photo URLs (`sort_order`) pointing into
  Supabase Storage. `ON DELETE CASCADE` with products. The catalog "cover
  image" is simply the lowest `sort_order` image, picked client-side
  (app/catalog/page.tsx:91).

- **`date_capacity`** — the heart of the scheduling design. One row per
  calendar **date** (`event_date` is the primary key) with `max_capacity`
  (default 1) and `booked_count`. Crucially it is a **global, business-wide
  calendar**, not per product: the company can only do N events per day total.

- **`bookings`** — a recorded sale. Holds customer PII (`customer_name`,
  `phone`, `event_address`). `status` is constrained to
  `'pending' | 'confirmed' | 'done' | 'cancelled'`. **No RLS select policy for
  anon exists at all** — the public literally cannot read bookings.

### The capacity trigger (`recalc_date_capacity` / `bookings_after_change`)

Rather than maintaining `booked_count` in application code, a Postgres trigger
(schema.sql:109) fires AFTER insert/update/delete on `bookings` and
**recomputes** the count from scratch:

```sql
booked_count = count(*) from bookings
               where event_date = p_date and status = 'confirmed'
```

Interpretation:
- `booked_count` is a *derived value*, and Postgres is the single writer. The
  admin can never desync it, and the app never has race-prone
  `+1/-1` increment logic.
- Only `confirmed` bookings consume capacity. `pending` and `cancelled` do not.
- If a booking's `event_date` changes, **both** the old and new dates are
  recalculated (schema.sql:101).
- The function also lazily creates the `date_capacity` row for a date the first
  time it is touched — so rows only exist for dates that have booking history.
  Missing rows are interpreted by the app as "fully open"
  (`isDateAvailable` in lib/booking-helpers.ts:29).

---

## 5. The core business flow (interpretation)

The README describes the flow; here is *why* it is shaped this way.

1. **Discovery** — Customer filters the catalog (search `ilike` on name,
   category, min/max price) or browses. All queries run in a server component
   using the anon browser client; RLS only exposes active products.

2. **Availability check** — Customer opens `/availability` (7 months ahead) or
   the compact calendar embedded on the product page. The client component
   fetches `date_capacity` directly from Supabase (public read policy) and
   renders green (available) / red (full) / gray (past) days.

   **Privacy by design:** the public surface only ever touches
   `date_capacity` — an aggregate — never `bookings`. Customer names, phones,
   and addresses are structurally unreachable by anon clients because there is
   no anon select policy on `bookings` to begin with.

3. **Contact** — The only CTA is "Tanya via WhatsApp"
   (`buildWhatsAppInquiryLink`, lib/booking-helpers.ts:46), a `wa.me` deep link
   with a prefilled Indonesian message naming the package. Price, theme, date,
   and payment are negotiated off-platform. The business number comes from
   `NEXT_PUBLIC_BUSINESS_WA_NUMBER`.

4. **Booking recording** — The admin opens `/admin/bookings/new` and enters
   the agreed details. POST /api/admin/bookings verifies the session, inserts
   the row, and the trigger updates the public calendar instantly. Status
   defaults to `confirmed` since the deal is already agreed (a `pending`
   option exists for soft reservations).

5. **Lifecycle tracking** — `/admin/bookings` lists bookings ordered by event
   date with color-coded status. `PATCH /api/admin/bookings` supports status
   transitions (`pending → confirmed → done`, or `cancelled`), and the trigger
   recalculates capacity on every change (e.g. cancelling frees the date).

---

## 6. Security model

Defense is layered, and the deepest layer is the database:

1. **Route gate** — `middleware.ts` matches `/admin/:path*`, resolves the user
   from cookies, and redirects anon users to `/admin/login` (and logged-in
   users away from the login page).

2. **API-route check** — every handler in `app/api/admin/*` calls
   `supabase.auth.getUser()` and returns 401 before touching data. This matters
   because API routes are *not* covered by the middleware matcher.

3. **RLS (the real boundary)** —
   - anon: `SELECT` on categories, active products, images, `date_capacity`. Nothing else.
   - `authenticated`: full CRUD on everything, via `auth.role() = 'authenticated'`.
   - Storage: mirrored policies on `storage.objects` for the `product-images`
     bucket — authenticated write, public read
     (supabase/migrations/20260910231042_storage_policies_product_images.sql).

**Assumption to be aware of:** "admin" is modeled as *any* authenticated user.
There is no role table or `is_admin` claim. This is coherent for a
single-owner business (no sign-up UI exists; the account is created in the
Supabase dashboard), but adding a second staff login would silently grant
full admin rights. Hardening would mean checking a specific user ID or a
custom JWT claim in the policies.

---

## 7. Code organization

```
app/                     Next.js App Router
  page.tsx               Static hero homepage (links to catalog/availability)
  layout.tsx             Shell: header nav, metadata, lang="id"
  catalog/page.tsx       RSC; reads searchParams, queries products+categories
  product/[id]/page.tsx  RSC; product + images + WhatsApp CTA + <AvailabilityCalendar compact/>
  availability/page.tsx  Thin wrapper around the calendar (7 months)
  admin/
    login/               CSR; signInWithPassword → redirect /admin
    page.tsx             RSC dashboard (product count, pending-booking count)
    products/            RSC list + CSR "new" form (photo upload)
    categories/          CSR list + inline add/delete
    bookings/            RSC list + CSR "new" form
  api/admin/             POST products, POST categories, POST+PATCH bookings
components/
  AvailabilityCalendar   The only shared component; client-side month grid,
                         reads date_capacity for [today, today+N months]
lib/
  supabase.ts            Browser client (+ a leftover connection self-test)
  supabase-server.ts     Cookie-bound server client
  booking-helpers.ts     Capacity range fetch, availability predicate, wa.me builder
  types.ts               TS types mirroring the DB tables
supabase/
  schema.sql             Canonical full schema (setup script)
  migrations/            CLI-generated migrations (initial schema + storage RLS)
middleware.ts            /admin/* auth gate
```

Rendering strategy is pragmatic: **read paths are React Server Components**
(fast first paint, direct DB access), while anything with **state or browser
APIs is a client component** (forms, login, calendar). There is no global state
management; each page fetches what it needs.

---

## 8. Observations & known gaps

Findings from reading the code (not bugs in the business logic, but worth
knowing):

- **Debug leftovers.** `checkConnection()` in lib/supabase.ts:18 runs a query
  and logs on every load of the browser client module. The calendar cell has an
  `onClick` that `alert()`s the raw capacity map (components/AvailabilityCalendar.tsx:113).
- **Capacity default mismatch.** `isDateAvailable` defaults to capacity 1, but
  the calendar calls it with `defaultCapacity = 2`
  (components/AvailabilityCalendar.tsx:107) — a missing `date_capacity` row is
  therefore treated as allowing 2 events, while the helper's own default says 1.
- **`auth.role() = 'authenticated'` as admin check** — see §6; fine for one
  owner, not for multi-user.
- **Half-finished CRUD.** Products and categories support create + list (+ delete
  for categories); no edit UI, no product delete. Booking PATCH exists in the
  API but has no UI — status changes currently require a manual API call.
- **Admin pages use the anon-key client everywhere.** This works because RLS
  recognizes the admin session, but note the pattern: the app has no
  service-role usage at all, by design.
- **No tests, no lint config, no CI** — a single-developer business tool.
- **Homepage is minimal** (hero + two links); README lists it as "still to build"
  for featured categories.

---

## 9. Summary

Dyasaka Decoration is a well-scoped example of a **Supabase-first storefront**:
the Next.js app is mostly a rendering layer, while the interesting logic —
capacity accounting, authorization, privacy separation — lives in the database
as triggers and RLS policies. The product decisions (WhatsApp-first sales,
admin-entered bookings, global daily capacity, public aggregate-only calendar)
all follow from one constraint: a small service business that closes sales in
chat, but wants a professional catalog and an honest view of its calendar online.
