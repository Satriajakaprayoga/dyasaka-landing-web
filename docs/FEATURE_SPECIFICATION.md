# Feature Specification — Dyasaka Decoration (Balloon Party Planner)

This document describes the features to build on top of the database structure
defined in `database-structure.md`. Each feature maps directly to tables and
fields in that document — refer to it for schema details. This file focuses on
behavior, flow, and what each screen/feature needs to do.

> **Status update (Oct 2026):** the catalog and product detail pages have since
> been redesigned, "Paket Termasuk" is implemented, and a customer-facing
> booking form now exists on the product page (public insert-as-`pending` via
> `supabase/migrations/20261007120000_public_booking_insert.sql`). The booking
> core (sections 2–5 below) is also implemented: the recipe editor ("Isi
> Paket"), booking item snapshots with `transport_fee` + custom bookings,
> DP-received → auto checklist → 3-phase workflow with manual project status,
> and the dashboard operational views
> (`supabase/migrations/20261020120000_booking_workflow.sql`). The spec is
> kept as written; differences from reality are noted inline.

---

## 1. Customer-facing

These formed the original customer-facing surface — listed for completeness.
Per the status note above, the catalog and product detail pages have since
been redesigned.

- Catalog browsing with search, category filter, and price range filter
  _(since redesigned: filter chips, sorting, URL-driven state, pagination)_
- Product detail page with image gallery and WhatsApp CTA
  _(since redesigned: slider gallery with fullscreen zoom lightbox, plus the
  booking modal below)_
- Public availability calendar — standalone page and embedded on product pages
- ~~No customer-facing booking form; all bookings are entered by the admin
  after negotiation happens on WhatsApp~~ — **Changed:** a "Booking Sekarang"
  modal on the product page now lets customers insert a booking themselves;
  it always lands as `pending`/unpaid and the admin still confirms it
  (WhatsApp remains where the sale is negotiated and finalized)

**New addition to product detail:** show which item variants are included in
the package (e.g. "Includes: 50 Red Balloons, 1 Arch Stand"), so customers can
see what they're getting without needing to ask. — **Implemented** ("Paket
Termasuk" on the product page).

**Follow-up needed:** the customer-facing booking modal predates the
vendor/furniture/transport-fee additions below (section 7). Decide whether
customers can request vendors/furniture at booking time, or whether those are
always added by the admin afterward — see section 7 for the recommended
default.

---

## 2. Admin — Catalog & Inventory Management

### Item & variant management

- Create/edit `items` (general concept — "Latex Balloon", "Arch Stand"),
  setting `item_category` (plain string) and type (`consumable` or
  `rentable`)
- Create/edit `item_variants` under an item — color, size, SKU, current price,
  stock quantity, reorder point
- For rentable items with no real variation (e.g. a stand set), the admin
  still creates exactly one variant row — the UI should not force a
  color/size input when it doesn't apply
- Set `quantity_owned` on the item level, for rentable items only — this is
  the number of complete rentable units the business owns
- Item picker/list UI should visually separate items by `item_category` (e.g.
  grouped sections or filter chips) rather than one undifferentiated list —
  this matters in particular once furniture items (chairs, tables) exist
  alongside decoration items (balloons, stands); see section 7.2

### Stock management

- View current `stock_quantity` per variant
- Record a stock movement (restock, damaged, lost, adjustment, purchased) —
  every entry is a new row, nothing is ever edited or deleted; the displayed
  stock quantity is always derived from this history
- View stock movement history per variant, so the admin can see why a number
  changed
- Low-stock indicator — any variant where `stock_quantity <= reorder_point`
  is visibly flagged on the inventory list

### Price management

- Edit `current_price` on a variant — this action writes a row to
  `item_price_history` before or alongside the update, so the old price is
  never lost
- View price history per variant
- Changing a price must never alter `unit_price` already stored on existing
  `booking_items` rows — past bookings keep the price they were created with

### Package (product) builder

- Create/edit a `product`, then attach `item_variants` to it via
  `product_items` with quantities — this defines what the package includes
- This is a template only — editing a product's recipe after bookings exist
  does not retroactively change those existing bookings

---

## 3. Admin — Booking Management

### Creating a booking

- Admin selects a product (or builds a custom booking) and enters customer
  details, event date, address, theme, and message — same as the existing
  flow
- On creation, `booking_items` rows are copied from the selected product's
  `product_items`, with `unit_price` set to each variant's `current_price` at
  that moment
- Admin can edit the resulting `booking_items` for this specific booking —
  swap an item, change quantity, add/remove rows — without affecting the
  original product recipe
- Admin can enter a `transport_fee` for the booking — manual numeric field,
  not auto-calculated (see section 7.3)

### Adding items beyond the package recipe

- The booking's item list is not limited to what the selected product
  originally included — admin can add further `booking_items` rows for any
  item variant, including furniture (chairs, tables) that were never part of
  the product recipe
- This reuses the exact same add-item mechanism as swapping/customizing a
  package item; furniture is simply another rentable item, grouped visually
  under its own `item_category` (see section 7.2)

### Rentable availability check

- When adding/confirming a rentable item on a booking (decoration stands or
  furniture), the system must check live availability for that event date:
  `quantity_owned` minus the sum of that variant's quantity across all other
  `confirmed` bookings on the same date
- If the requested quantity would exceed what's available, warn the admin
  before allowing confirmation (does not need to hard-block — admin may
  override with knowledge the system doesn't have, e.g. an early return)

### Booking status

- Existing sales status (`pending`, `confirmed`, `done`, `cancelled`) stays as
  is, with the existing capacity trigger behavior on `date_capacity`
  unchanged

---

## 4. Admin — Deposit & Project Workflow

This is the core new feature area.

### Marking DP received

- Admin action on a booking: "Mark DP received" — sets `dp_received_at` to
  the current time
- This action triggers automatic generation of the full checklist for this
  booking (see below) — this should happen exactly once per booking; marking
  DP received again should not duplicate the checklist

### Checklist generation (automatic, on DP received)

For each row in the booking's `booking_items`:

- Always generate one `stock_check` phase row
- Always generate one `pickup` phase row
- Generate one `return` phase row **only if** the item is `rentable` —
  consumable items never get a return-phase row
- Admin can also manually add free-text checklist rows not tied to a specific
  item (e.g. "confirm venue address", "call customer to confirm arrival
  time") — these have `booking_item_id` left empty

Vendors (`booking_vendors`) are **not** part of checklist generation — they
have their own status field (`pending`/`confirmed`/`cancelled`) and are
tracked separately. Do not generate `checklist_items` rows for vendors.

### Stock-check phase (screen/behavior)

- Lists each item needed for the booking
- Admin marks each as `in_stock` or `need_order`
- `need_order` is a visible flag only — this does not auto-create a purchase
  order or stock movement; it is a manual reminder for the admin to go buy or
  make the item
- Optional note field per row for details ("ordered from supplier, arriving
  Tuesday")

### Pickup phase (screen/behavior)

- Lists each item to be loaded/packed for the event
- Admin checks off each item as `done` when physically prepared/loaded
- For rentable items, marking pickup `done` should set the linked
  `booking_items.rental_status` to `checked_out` and record
  `checked_out_at`

### Return phase (screen/behavior, rentable items only)

- Lists only the rentable items from this booking (including furniture)
- Admin checks off each item as `done` when it physically comes back
- Marking a return-phase row `done` must:
  - Set the linked `booking_items.rental_status` to `returned`
  - Set `booking_items.returned_at` to the current time
  - This is what actually confirms the item is available for future bookings
    — not the event date simply passing

### Project status

- `bookings.project_status` reflects the overall pipeline state:
  `not_started` → `preparing` → `ready` → `in_progress` → `returning` →
  `completed`
- Decide and implement one of two approaches (confirm with stakeholder before
  building):
  - **Automatic**: status advances on its own as checklist phases are fully
    completed (e.g. all `stock_check` + `pickup` rows done → `ready`)
  - **Manual**: admin sets the status directly; the checklist is a supporting
    tool shown alongside it, not a trigger
- Regardless of approach, the admin should always be able to see current
  `project_status` at a glance from the bookings list, not just from inside
  the booking detail page

---

## 5. Admin — Dashboard / Operational Views

These are read-only views built from existing data — no new tables required.

- **Upcoming events needing prep** — bookings with an upcoming `event_date`
  where `pickup` phase checklist items are not yet all `done`
- **Items currently out** — `booking_items` where `rental_status =
checked_out`, across all active bookings
- **Low stock** — variants where `stock_quantity <= reorder_point`
- **Needs ordering** — checklist rows where `phase = stock_check` and
  `status = need_order`, across all bookings with `dp_received_at` set
- **Vendors booked this week** — `booking_vendors` joined to upcoming
  `bookings`, status `confirmed`, so the admin can see who needs to be
  reminded/reconfirmed
- **Goods to buy** — shortfall for upcoming bookings (see section 11)
- **Orders awaiting delivery** — purchase orders with status `ordered` or
  `partially_received`
- **Bookings by source** — count of bookings per `source` (see section 10)
- **Helpers assigned this week** — `booking_staff` rows for upcoming bookings
  that are not cancelled, with a warning where a person is double-booked
- **Cash this month** — money in, money out and net from the ledger (see
  section 13)
- **Plans not yet executed** — purchase plans that are `approved` or
  `in_progress` (see section 16)

These views are intended to be the admin's day-to-day task list and should be
visible on the main admin dashboard, not buried inside individual booking
pages.

---

## 6. Admin — Vendor Management (new)

### Vendor master data

- Create/edit `vendors` — name, `vendor_category` (plain string, e.g.
  "Clown", "Photographer"), phone, address, social media, notes
- Create/edit `vendor_services` under a vendor — optional predefined
  offerings with a reference price; a vendor does not require any services
  defined to be bookable

### Adding a vendor to a booking

- From a booking, admin adds a `booking_vendors` row — selecting a vendor,
  optionally a predefined `vendor_service`, and entering the `agreed_price`
  actually negotiated for this event (independent of the service's reference
  price)
- **Double-booking check:** before confirming, check whether the same vendor
  already has another `confirmed` `booking_vendors` row on the same
  `event_date`. If so, show a warning banner to the admin — this does not
  block the action; the admin has final say (the vendor may genuinely be able
  to cover both events)
- Vendor status (`pending`/`confirmed`/`cancelled`) is tracked independently
  of the booking's own sales status and `project_status`

---

## 7. Furniture & Transportation (new)

### 7.1 Overview

Two additions to support "Basic Birthday"-style bookings where the customer
also needs rented chairs/tables and a location-dependent transport cost.

### 7.2 Furniture as rentable items

- Chairs, tables, and similar rentable property are created as ordinary
  `items` with `type = rentable` and `item_category = "Furniture"` (or
  similar) — no new table, no special-cased logic
- They follow the exact same stock, availability, and checklist
  (pickup/return) rules as any other rentable item (see sections 2 and 4)
- **UI requirement:** the item picker on the booking screen must visually
  separate furniture from decoration items — e.g. grouped sections or
  filterable tabs by `item_category` — rather than one flat list. This is a
  display-only requirement; the underlying query/data model is unchanged.

### 7.3 Transportation fee

- `bookings.transport_fee` — manual numeric field, nullable
- Admin enters this per booking based on the negotiated amount; no
  zone/distance lookup or automatic calculation is built for this phase
- Should appear on the booking creation/edit screen near the other
  booking-level fields (not treated as a `booking_items` row, since it isn't
  a physical item)

---

## 8. Admin — Company Settings (new)

- One settings screen to edit the company profile: name, logo upload, address,
  phone, email, and the Instagram, Facebook and TikTok links
- A bank accounts list under it: add, edit, deactivate, reorder. Only active
  accounts can be chosen when issuing an invoice
- Logo, social links and bank accounts are also shown on the public site
  (footer or contact area) and on invoices
- Only one company profile exists; the screen edits it, it never creates a
  second one

---

## 9. Invoices (new)

### Admin side

- From a booking, the admin creates an invoice. The lines are prefilled from
  the booking's items (as frozen copies) plus the transport fee when set;
  vendor lines are added by hand when needed. The admin can edit, remove or
  add custom lines before issuing
- Choose which active bank account is shown on the invoice
- Issuing the invoice assigns the invoice number, freezes all lines and
  totals, and copies the company name and chosen bank account into the invoice
- Statuses: `draft` (editable, not visible to customers), `issued`, `paid`,
  `void`. An issued invoice cannot be edited; to correct it, void it and create
  a new one
- The admin gets the invoice link to send to the customer over WhatsApp
- A booking can have several invoices: first a **deposit invoice** with one
  line (the deposit amount, typed by the admin, optionally prefilled from a
  percentage), later one **final invoice**. Items added to the booking after
  the deposit are not billed until the final invoice
- Recording a customer payment creates an `in` transaction in the ledger
  linked to the booking and the invoice (see section 13). Paid amount and
  balance are calculated from those rows; they are not typed onto the invoice
- The final invoice draft is prefilled with every current booking line and
  shows the total, the payments already received (including the deposit) and
  the remaining balance
- If items are added after the final invoice was issued, the admin voids it
  and issues a new final invoice. The old link then shows a short "replaced"
  notice pointing to the current invoice

### Customer side

- The customer opens the invoice through the private link; no login
- The invoice page shows company logo and name, customer and event details,
  the line items, totals, amount paid, balance due and the bank account to pay
  into
- A "Download PDF" button opens the browser's print dialog, where the
  customer saves the invoice as PDF — generated on demand from the stored
  invoice data, no PDF files are stored
- A wrong or unknown link shows a plain "not found" page and reveals nothing
  about other invoices
- Draft invoices are not viewable through the public link. A void invoice
  shows only a short "replaced by a newer invoice" notice with a link to the
  booking's current invoice, and no amounts
- When the team has finished setup, the customer opens the final invoice link
  to see exactly how much is left to pay

### Decisions (recorded)

- **Several invoices per booking.** `invoices.booking_id` is not unique. Each
  invoice has an `invoice_type` (`dp` or `final`), and a booking may have at
  most one non-void invoice of each type. A wrong issued invoice is voided and
  replaced; the voided number is never reused. This supersedes the earlier
  one-invoice-per-booking decision.
- Paid amount and balance due are calculated from the ledger, not stored on the
  invoice, so an issued invoice stays frozen while payments change.
- Invoices snapshot the customer name, phone, event address and event date at
  issue.
- Invoice numbers follow `INV/YYYY/MM/NNNN` (per-month sequence, zero-padded,
  assigned at issue; concurrent issues retry on the unique constraint).
- PDFs come from the browser print dialog, not a PDF library.
- Draft lines are only prefilled from booking items + transport; vendor
  lines are typed by the admin when needed, and drafts never auto-resync
  when the booking changes afterwards.
- **Open:** whether the deposit is a fixed percentage of the total or typed
  freely each time.

---

## 10. Traffic-Source Analytics (new)

- On first landing, record where the visitor came from (UTM parameters first,
  page referrer as fallback) and keep it in the browser until a booking is
  made
- When the public booking form is submitted, save that value into the
  booking's `source` (and `utm_campaign` if present)
- The admin booking form has a manual source dropdown (Instagram, Facebook,
  TikTok, WhatsApp, referral, other) for bookings negotiated only on WhatsApp
- The admin dashboard shows bookings per source, so the owner can see which
  platform actually produces bookings
- Links shared on social media should carry a UTM tag, because in-app browsers
  often send no referrer. The admin needs a short note or helper explaining
  how to build these links
- Visit counting (`page_visits`) is optional and deferred; a ready-made
  analytics tool can cover visits meanwhile

---

## 11. Planning and Procurement (new)

### Planning screen

- Shows, per item variant, what upcoming confirmed bookings need, what is in
  stock, and the shortfall, for a selectable period (for example next 2 weeks
  or next month)
- Consumables: shortfall is demand minus `stock_quantity`; items at or below
  `reorder_point` are also flagged
- Rentables: shortfall is the highest single-date demand minus
  `quantity_owned`. The screen should name the date that causes the shortage
- This screen only reads existing data; it stores nothing

### Suppliers

- Create and edit suppliers (name, phone, address, note)
- Keep this list separate from vendors in the admin navigation

### Purchase orders

- Create a purchase order from the shortfall list (prefilled) or from scratch,
  choosing a supplier, expected arrival date and lines (item variant,
  quantity, planned unit cost)
- Statuses: `draft` → `ordered` → `partially_received` → `received`, or
  `cancelled`
- An order can optionally be linked to a booking when it exists for a specific
  event
- A `need_order` row in a booking's stock-check phase offers a shortcut to
  start a purchase order for that booking

### Receiving goods

- The admin records the quantity received per line, which may be less than
  ordered; the order moves to `partially_received` until everything has
  arrived
- Each receipt writes a `restock` stock movement (consumables) or a
  `purchased` stock movement (rentables); stock is never edited directly
- If the order is linked to a booking, the matching stock-check row changes
  from `need_order` to `in_stock`
- The actual `unit_cost` is stored on the order line. It never changes the
  customer-facing price on `item_variants`

### Open decision

Buy per booking, or restock in bulk from reorder points. Both are supported by
the same tables; the decision affects which screen is the main entry point.

---

## 12. Admin — Staff and Helper Planning (new)

### Staff list

- Create and edit staff: name, phone, role, an informational pay basis
  (monthly, weekly, per event) and an active flag. Permanent staff and event
  helpers are the same kind of record
- Keep this list separate from vendors and suppliers in the admin navigation

### Planning helpers for an event

- From a booking, the admin assigns staff: choose the person, the role on this
  event and the planned pay. This works like adding a vendor to a booking
- If the same person already has another non-cancelled assignment on the same
  event date, show a warning banner. It never blocks the admin
- Assignments have a status: `planned`, `confirmed`, `cancelled`
- The booking page shows the expected helper cost (planned pay of
  non-cancelled assignments) next to the actual amount paid
- Paying a helper is done from the assignment: it opens the expense form
  prefilled with the person, the booking and the planned pay; saving creates an
  `out` transaction (see section 13). Whether an assignment is paid is shown
  from the ledger rows, not typed by hand

---

## 13. Admin — Cashflow Ledger (new)

- One screen to record every money movement: direction, amount, date,
  category, account (cash or a bank), description, and optional links to a
  booking, invoice, purchase order, staff member, vendor or plan line
- Customer payments are recorded here (or from the invoice page shortcut),
  linked to the booking and the invoice they were paid against
- Expenses are recorded here too: gasoline, helper pay, salary, vendor
  payments, goods purchases, repairs
- Weekly or monthly salary uses the optional period fields so the admin can
  see which period a payment covered. Per-event helper pay needs only the
  booking link
- Rows are never edited or deleted. A mistake is corrected with a "reverse"
  action that adds a reversing row, after which the admin enters the correct
  one
- The list can be filtered by month, category, account and booking, and shows
  money in, money out and net for the filter
- Transaction categories are managed in a small settings list (name and
  direction). New categories can be added; used ones can be deactivated, not
  deleted

---

## 14. Admin — Margin per Event (new)

- On each booking, a margin panel shows **expected** and **actual** side by
  side:
  - Revenue: expected from the final invoice (or booking total), actual from
    received payments
  - Costs: materials (consumable quantity times the cost snapshot), vendors,
    helpers, and other event expenses linked to the booking
  - Margin: revenue minus costs
- Expected costs before the event use the vendor cost price and the planned
  helper pay, so the admin can judge a booking's profitability before it
  happens
- Transactions that are goods-purchase payments linked to a purchase order are
  not counted in event margin, because material cost already enters through
  the item cost snapshot. They appear in cashflow only
- Fixed salaries and rent are not part of event margin unless the admin links
  a payment to a booking
- A list view ranks recent events by margin
- Cost data is admin-only and never visible on public pages or invoices

---

## 15. Admin — Monthly Cashflow Report (new)

- Money in, money out and net per month, grouped by transaction category, with
  an optional account filter
- Uses the date the money moved. The period fields on salary rows are kept so
  a period-based view can be added later
- Read-only; built entirely from the ledger

---

## 16. Admin — Purchase Plans (new)

### Creating a plan

- A plan has a title, a type (`buy`, `create`, `fix`, `rnd`, `upgrade`), a
  reason, an optional target date, an optional budget and an optional linked
  booking
- Plans can be started from three places: the shortfall list (add to plan), a
  booking's `need_order` row, or from scratch for repairs, tools, R&D and
  upgrades
- Lines are free text with an optional catalog item. Each line has a
  quantity, an estimated unit cost, an optional supplier, and for upgrades the
  item being replaced

### Following execution

- Statuses: `draft` → `approved` → `in_progress` → `done`, or `cancelled`
- An approved plan's lines are turned into purchase orders, grouped by
  supplier. Each plan line stays linked to its order line, so the plan shows
  which lines are not executed, ordered, or done
- Lines that involve no supplier (an in-house repair, something the team
  builds) are marked done by hand, and their cost is entered as an expense in
  the ledger linked to the plan line
- The plan page shows estimated cost against actual cost, taken from order
  lines and linked ledger rows
- Plan status moves automatically as lines are linked and completed;
  cancelling is manual

### R&D and upgrades

- For `rnd` plans, each line records an outcome (`testing`, `adopted`,
  `rejected`) and a short note. When a line is adopted, the admin creates the
  real item and variant and the line is pointed at it
- For `upgrade` plans, retiring the replaced units is a normal stock
  adjustment, so the stock ledger stays accurate

---

## 17. Explicitly out of scope for this phase

- ~~Customer-facing booking form~~ — **built since the spec was written**: the
  product-page modal inserts a `pending` booking directly via the public RLS
  insert policy; the sale is still confirmed and closed on WhatsApp by the
  admin
- Customer-facing vendor/furniture selection — for now, vendors and furniture
  are added to a booking by the admin only, after the customer's initial
  (possibly self-service) booking request; not exposed in the public booking
  modal
- Multi-admin roles / permissions beyond the existing single-admin auth
- Purchase order automation from "needs ordering" flags
- Multi-day / date-range bookings (current model assumes a single
  `event_date` per booking)
- Payroll calculation (tax, deductions, payslips): staff pay is recorded as
  ledger rows only
- Double-entry accounting, tax reports, depreciation of rentable items
- Bank statement import or reconciliation
- Automatic/zone-based transportation fee calculation
- Hard-blocking vendor double-booking (warning only, per section 6)
- Automatic reordering or supplier price comparison
- Online payment inside the invoice page (the invoice only shows bank details)
- Customer accounts or logins (invoice access is by private link only)
