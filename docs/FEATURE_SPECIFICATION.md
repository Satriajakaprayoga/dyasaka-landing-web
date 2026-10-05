# Feature Specification — Dyasaka Decoration (Balloon Party Planner)

This document describes the features to build on top of the database structure
defined in `database-structure.md`. Each feature maps directly to tables and
fields in that document — refer to it for schema details. This file focuses on
behavior, flow, and what each screen/feature needs to do.

---

## 1. Customer-facing (existing, unchanged)

These already exist in the current codebase and are not being redesigned —
listed here only for completeness.

- Catalog browsing with search, category filter, and price range filter
- Product detail page with image gallery and WhatsApp CTA
- Public availability calendar — standalone page and embedded on product pages
- No customer-facing booking form; all bookings are entered by the admin after
  negotiation happens on WhatsApp

**New addition to product detail:** show which item variants are included in
the package (e.g. "Includes: 50 Red Balloons, 1 Arch Stand"), so customers can
see what they're getting without needing to ask.

---

## 2. Admin — Catalog & Inventory Management

### Item & variant management

- Create/edit `items` (general concept — "Latex Balloon", "Arch Stand"),
  setting category and type (`consumable` or `rentable`)
- Create/edit `item_variants` under an item — color, size, SKU, current price,
  stock quantity, reorder point
- For rentable items with no real variation (e.g. a stand set), the admin
  still creates exactly one variant row — the UI should not force a
  color/size input when it doesn't apply
- Set `quantity_owned` on the item level, for rentable items only — this is
  the number of complete rentable units the business owns

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

### Rentable availability check

- When adding/confirming a rentable item on a booking, the system must check
  live availability for that event date: `quantity_owned` minus the sum of
  that variant's quantity across all other `confirmed` bookings on the same
  date
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

- Lists only the rentable items from this booking
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

These views are intended to be the admin's day-to-day task list and should be
visible on the main admin dashboard, not buried inside individual booking
pages.

---

## 6. Explicitly out of scope for this phase

- Customer-facing booking form (sale is still closed via WhatsApp)
- Multi-admin roles / permissions beyond the existing single-admin auth
- Purchase order automation from "needs ordering" flags
- Multi-day / date-range bookings (current model assumes a single
  `event_date` per booking)
- Cost price / profit margin tracking (separate from customer-facing price)
