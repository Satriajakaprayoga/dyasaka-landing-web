# Database Structure — Dyasaka Decoration (Balloon Party Planner)

This document describes the target database structure for the project. It extends
the existing schema (`categories`, `products`, `product_images`, `bookings`,
`date_capacity`) to support:

- Items as components of a product (balloons, stand decorations, etc.)
- Consumable vs. rentable item types, each with different stock behavior
- Balloon variants (color, size) with their own price and stock
- Price history, so changing a price never rewrites past bookings
- A 3-phase checklist workflow (stock check → pickup → return) tied to
  down-payment confirmation
- Operational "project status" tracking, separate from the sales status

Use this as the source of truth for schema generation. Table names, field names,
and relationships below should be followed exactly unless noted otherwise.

---

## 1. Existing tables (unchanged)

### `categories`

General product/item grouping (e.g. "Balloon", "Stand Decoration").

- `id` (PK)
- `name`
- `slug` (unique)
- `created_at`, `updated_at`

### `date_capacity`

Global, business-wide daily event capacity. Not per product. `booked_count` is
derived (recalculated by a trigger from confirmed bookings), never written
directly by the app.

- `event_date` (PK)
- `max_capacity`
- `booked_count`

### `products`

A sellable "package" — e.g. "Birthday Deluxe". A product is a bundle of items,
not a single physical thing.

- `id` (PK)
- `category_id` (FK → categories)
- `name`
- `description`
- `price`
- `is_active`
- `created_at`, `updated_at`

### `product_images`

Ordered gallery for a product. The first image by `sort_order` is treated as the
cover/main image (no separate "is main" flag currently).

- `id` (PK)
- `product_id` (FK → products, cascade delete)
- `image_url`
- `sort_order`
- `created_at`

---

## 2. New tables — item master data

Note: `items` does **not** use a foreign key to the shared `categories` table.
`categories` continues to be used only by `products`. Items use their own
plain-string `item_category` field instead (see below) — the two taxonomies
are kept independent.

### `items`

The general concept of a component — "Latex Balloon", "Arch Stand" — not yet
tied to a specific color, size, or price. Each item has a category and a type
that controls how its stock behaves.

- `id` (PK)
- `item_category` — plain string (e.g. "Balloon", "Stand Decoration"). This is
  a deliberate departure from `products.category_id`: item categories are a
  different taxonomy from product categories (physical component type vs.
  event package type), and at this scale a free-text field is simpler than a
  separate lookup table. Admin UI should source dropdown suggestions via
  `SELECT DISTINCT item_category FROM items` (or similar), ideally as an
  autocomplete/datalist so the admin can pick an existing value or type a new
  one — this avoids a strict typo-prevention mechanism while still making
  existing categories easy to reuse.
- `name`
- `type` — one of: `consumable`, `rentable`
- `pieces_per_unit` — nullable, informational only (e.g. a stand "unit" may
  physically consist of 6 pieces; this does not affect availability math)
- `quantity_owned` — only meaningful for rentable items; total number of
  complete rentable units the business owns
- `created_at`, `updated_at`

### `item_variants`

The actual sellable/rentable unit with its own price and stock — e.g. "Latex
Balloon / Red / 12-inch". A rentable item that has no real variation (like a
stand set) still gets exactly one variant row.

- `id` (PK)
- `item_id` (FK → items)
- `color` — nullable
- `size` — nullable
- `sku` — optional, nullable
- `stock_quantity` — current stock on hand (consumable: units remaining;
  rentable: usable units currently owned, reflecting real-world condition, not
  date-based availability)
- `current_price`
- `reorder_point` — nullable; triggers a low-stock warning in the admin UI
  when `stock_quantity` falls at or below this value
- `created_at`, `updated_at`

### `item_price_history`

Append-only log of price changes for a variant. Written whenever
`current_price` is updated; never edited or deleted after insert.

- `id` (PK)
- `item_variant_id` (FK → item_variants)
- `price`
- `effective_from`
- `created_at`

### `stock_movements`

Append-only ledger of real, permanent stock changes. This table must never be
updated or deleted — only inserted into. `item_variants.stock_quantity` is a
cached total that should always be derivable by summing this ledger.

Important distinction by item type:

- **Consumable items**: routine booking usage belongs here. Confirming a
  booking that includes a consumable variant inserts a `usage` row (negative
  quantity) and decrements `stock_quantity`.
- **Rentable items**: routine booking pickup/return does **not** belong here.
  Only real ownership or condition changes do (buying a new unit, damage, loss,
  manual correction). Availability for rentables is computed live from
  `booking_items` + `items.quantity_owned` (see section 4) — never stored as a
  decrement/increment pair, to avoid stock drifting out of sync if a return
  step is missed.

Fields:

- `id` (PK)
- `item_variant_id` (FK → item_variants)
- `type` — one of: `restock`, `usage`, `damaged`, `lost`, `adjustment`,
  `purchased`
- `quantity` — positive or negative depending on type
- `booking_id` — nullable FK → bookings, set when the movement is caused by a
  booking (consumable usage)
- `note` — nullable
- `created_at`

---

## 3. New tables — product/booking item relationships

### `product_items`

The reusable "recipe" for a package — which item variants (and how many) make
up a product. Untouched by individual booking customizations.

- `id` (PK)
- `product_id` (FK → products)
- `item_variant_id` (FK → item_variants) — note: references the variant, not
  the general item, so a package can specify an exact color/size
- `quantity`

### `booking_items`

A per-booking, independently editable snapshot of the items involved. Seeded
by copying `product_items` rows when a booking is created from a product, but
can be freely edited afterward (swap items, change quantities) without
affecting the original product recipe.

- `id` (PK)
- `booking_id` (FK → bookings)
- `item_variant_id` (FK → item_variants)
- `quantity`
- `unit_price` — snapshot of `item_variants.current_price` at the moment this
  row is created; never recalculated later, so past bookings are unaffected by
  future price changes
- `rental_status` — nullable; only used when the linked variant's item is
  `rentable`. One of: `reserved`, `checked_out`, `returned`
- `checked_out_at` — nullable timestamp
- `returned_at` — nullable timestamp

**Availability rule for rentable items** (computed, not stored): for a given
item variant and event date, available units = `items.quantity_owned` minus
the sum of `booking_items.quantity` across all bookings with that variant,
status `confirmed`, and the same `event_date`. This number is always
calculated live, never cached, so cancelling a booking or the event date
passing automatically frees up availability with no manual "return" step
required for the math to stay correct.

---

## 4. New tables — booking lifecycle and checklist

### Changes to `bookings`

Add the following fields to the existing table:

- `project_status` — operational status, separate from the existing sales
  `status` field. One of: `not_started`, `preparing`, `ready`, `in_progress`,
  `returning`, `completed`
- `dp_received_at` — nullable timestamp; set when the admin marks the down
  payment as received

Note: `bookings.status` (`pending`/`confirmed`/`done`/`cancelled`) and
`bookings.project_status` are independent tracks. A booking can be
`confirmed` while its `project_status` is still `not_started`.

### `checklist_items`

A 3-phase operational checklist, generated automatically the moment
`dp_received_at` is set on a booking (not at initial booking creation — no
prep work starts until the deposit is in). Rows are seeded from that
booking's `booking_items`.

Phases and their behavior:

1. **`stock_check`** — "is this physically available, or does it need to be
   ordered/made?" Uses the full `status` range below, since this phase can
   resolve to more than done/not-done.
2. **`pickup`** — "has this left the warehouse for the event?" Simple
   progression toward `done`.
3. **`return`** — "has this come back?" Generated **only** for `booking_items`
   whose linked item is `rentable` — consumables never get a return-phase row,
   since they are not returned. When a `return`-phase row is marked `done`,
   this also updates the linked `booking_items` row: sets `rental_status =
returned` and `returned_at = now()`. This is the confirmation that a
   rentable item is back in stock and available for future bookings.

Fields:

- `id` (PK)
- `booking_id` (FK → bookings)
- `booking_item_id` — nullable FK → booking_items; null for free-text/custom
  checklist entries not tied to a specific item (e.g. "confirm venue
  address")
- `phase` — one of: `stock_check`, `pickup`, `return`
- `label` — display text, e.g. "Red Balloons x50", "Arch Stand x1"
- `status` — one of: `pending`, `in_stock`, `need_order`, `done`
  (`in_stock`/`need_order` are meaningful mainly for the `stock_check` phase;
  `pickup`/`return` phases typically only move between `pending` and `done`)
- `note` — nullable, e.g. "ordered from supplier, arriving Tuesday"
- `completed_at` — nullable timestamp
- `sort_order`
- `created_at`

---

## 5. Key business rules to preserve

- A booking's sale status and its operational/project status are tracked
  independently — do not merge them into one field.
- Checklist generation is triggered by `dp_received_at` being set, not by
  booking creation.
- Consumable stock changes are always logged in `stock_movements` as a
  permanent, append-only ledger. The cached `stock_quantity` on
  `item_variants` must stay derivable from this ledger.
- Rentable item availability for a date is always computed from
  `booking_items` + `items.quantity_owned` — never stored as a running
  decrement/increment. `stock_movements` for rentable items is reserved for
  real ownership/condition changes only (purchased, damaged, lost,
  adjustment), not routine booking pickup/return.
- `booking_items.unit_price` is a frozen snapshot taken at creation time.
  Changing `item_variants.current_price` later must never alter the price
  recorded on existing bookings.
- `product_items` is a reusable template and must not be modified by
  individual booking customizations; `booking_items` is the editable,
  per-booking copy.
- The existing `date_capacity` table and its trigger-based recalculation stay
  unchanged — it remains a separate, business-wide daily capacity check that
  sits alongside (not replacing) per-item rentable availability.
