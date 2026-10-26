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
- External vendors (clown, photographer, etc.) booked per event, separate
  from owned inventory
- Rentable property (chairs, tables) handled via the same item structure as
  decoration stands
- A manual transportation fee per booking
- Company profile and bank accounts, shown to customers and on invoices
- Invoices that customers can open by private link and download as PDF
- Traffic-source tracking, so each booking records where the customer came from
- Planning and procurement of goods (suppliers, purchase orders, receiving)

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

### `bookings`

A recorded event booking. This is the central table that most new tables
attach to (`booking_items`, `checklist_items`,
`stock_movements`). Existing fields:

- `id` (PK)
- `product_id` (FK → products) — see note below on custom bookings
- `customer_name`
- `phone`
- `event_date`
- `event_address`
- `theme`
- `message`
- `status` — one of: `pending`, `confirmed`, `done`, `cancelled`. Only
  `confirmed` bookings consume `date_capacity` and rentable availability.
- `created_at`, `updated_at`

Fields added by this redesign (defined in their own sections below, listed
here so the full picture of `bookings` is in one place):

- `project_status` — operational pipeline status (section 4)
- `dp_received_at` — down payment timestamp, triggers checklist generation
  (section 4)
- `transport_fee` — manual transportation fee (section 7)
- `source` — where the customer came from (section 10)
- `utm_campaign` — optional campaign tag (section 10)

Note on `product_id`: the feature spec allows the admin to build a "custom
booking" not based on a predefined product. If that is supported, `product_id`
must be nullable. Confirm this before generating the migration.

Privacy rule to preserve: this table holds customer name, phone, and event
address, so anonymous/public clients must never be able to read it. The public
booking form may only insert (always as `pending`), never select.

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

## 5. Vendors (external partners)

Vendors are people/businesses the business coordinates with (photographer,
clown, MC, rented-property owners). This section was originally sketched as
`vendors` + `vendor_services` + `booking_vendors`, then briefly implemented
as vendor → items (`items.vendor_id` + a `service` item type) and reverted —
inventory items were too heavy for "a vendor's offerings are just info +
price". Current state:

- **Built:** the `vendors` master table below (20261024100000). Items keep
  no vendor link — `items.vendor_id` and the `service` item type were
  dropped again in 20261025090000, and checklist generation is back to the
  original (stock_check + pickup for everything, return for rentable only).
- **Built:** the product relation (20261025100000) — `products.vendor_id`
  (nullable FK → vendors, `on delete set null`) and `products.vendor_price`
  (nullable cost, `>= 0`). Margin = `products.price − vendor_price`,
  always computed, never hand-entered. Vendor offerings that are simpler
  than inventory items live as plain product rows. Because products has a
  public-read RLS policy, the migration re-grants anon SELECT at column
  level (public-safe columns only), so `vendor_id` / `vendor_price` are
  admin-only — PostgREST `select=*` returns exactly the granted columns.
  Invoice lines sourced from a vendor's product carry
  `source_type 'vendor'`; the customer invoice itself only ever shows the
  description.

### `vendors`

Admin-only master record (20261024100000). RLS: enable + a single
`admin all` policy `to authenticated` — deliberately no anon/public policy,
vendors are internal supplier data and never appear on customer-facing
invoices (invoice lines show only the description).

- `id` (PK)
- `name` — not null (e.g. "RW Photograph")
- `phone` — nullable
- `note` — nullable, free text (e.g. "DP 50%")
- `is_active` — not null, default true
- `created_at`, `updated_at` — `updated_at` maintained by the shared
  `set_updated_at()` trigger

---

## 6. Rentable property (chairs, tables, etc.)

No new tables needed — these are modeled as ordinary `items` with
`type = rentable`, exactly like stands (e.g. `item_category = "Furniture"`).
They follow the same availability math, stock movement rules, and checklist
(pickup/return) behavior as any other rentable item.

The only requirement is on the admin UI side: furniture items should be
visually separated from decoration items when adding items to a booking (e.g.
grouped/filterable by `item_category`), rather than mixed into one
undifferentiated list — this is a UI grouping concern, not a schema change.

Furniture can be added to a booking as an **addition beyond the product's
original recipe** — `booking_items` already supports rows that aren't part of
the original `product_items` template, so renting chairs/tables for a
"Basic Birthday" booking is just additional `booking_items` rows on that
booking, same mechanism as swapping a balloon color.

---

## 7. Transportation fee

Handled as a manual field on `bookings`, not a zone/lookup table, since
pricing is sometimes negotiated case-by-case rather than fixed by distance.

### Changes to `bookings`

- `transport_fee` — numeric, nullable; entered manually by the admin per
  booking, same spirit as `date_capacity` being admin-managed rather than
  system-calculated

---

## 8. Company profile and bank accounts

There is exactly one company, so the profile is a single-row settings table,
not a growing list. Logo, social links and bank details are meant to be shown
to customers, so anonymous read is allowed. Only the admin can write.

### `company_profile`

- `id` (PK) — only one row should ever exist
- `company_name`
- `logo_url` — points into Supabase Storage, same approach as product images
- `address`
- `phone`
- `email`
- `instagram_url`, `facebook_url`, `tiktok_url` — nullable plain text, one
  field per platform
- `updated_at`

### `company_bank_accounts`

A separate child table, because the business may have more than one account
and an invoice must show the right one.

- `id` (PK)
- `bank_name`
- `account_holder`
- `account_number`
- `is_active` — only active accounts are offered for new invoices
- `sort_order`
- `created_at`, `updated_at`

---

## 9. Invoices

An invoice stores its own copy of everything it shows, rather than reading
live from bookings, items, or company settings. This is the same "freeze the
price" principle as `booking_items.unit_price`. Snapshots are frozen, but the
invoice itself is **editable until it is paid** (see the decision below).

### `invoices`

- `id` (PK)
- `booking_id` (FK → bookings)
- `invoice_number` — unique, human-readable
- `access_token` — unique, long and unguessable; this is what the customer's
  link contains, never the booking id or invoice id
- `status` — one of: `draft`, `issued`, `partially_paid`, `paid`, `void`.
  `partially_paid` is system-derived — the API recomputes it on every write
  (`amount_paid > 0` and `balance_due > 0`) and never accepts it from clients
- `issue_date`
- `due_date` — nullable
- `subtotal`
- `total`
- `amount_paid` — for example the down payment received
- `balance_due`
- `bank_account_id` — FK → `company_bank_accounts`, `on delete set null`;
  the draft-time working reference for which account to show. Only used
  while drafting — at issue the account is copied into
  `bank_account_snapshot` and the snapshot is what invoices display
  forever after
- `company_name_snapshot` — company name as it was when issued
- `bank_account_snapshot` — the bank name, holder and number shown on this
  invoice, copied as text when issued
- `notes` — nullable
- `created_at`, `updated_at`

### `invoice_items`

Frozen copy of the invoice lines. Lines can come from booking items, vendors,
the transport fee, or be typed freely by the admin.

- `id` (PK)
- `invoice_id` (FK → invoices, cascade delete)
- `description`
- `quantity`
- `unit_price`
- `line_total` — GENERATED ALWAYS AS (`quantity` * `unit_price`) STORED
- `source_type` — one of: `item`, `vendor`, `transport`, `custom`
- `sort_order`

### Customer access rules

- Customers have no accounts, and `bookings` must stay unreadable to the
  public, so the invoice page is reached only through `access_token`.
- The public must never get a general select permission on `invoices`. The
  lookup by token should go through a server route or database function that
  returns the single matching invoice, so one token never exposes any other
  invoice.
- The PDF is generated on demand from the stored invoice data. PDF files are
  not stored.
- Invoices in `draft` or `void` status are never visible through the public
  link. Voiding an invoice keeps the row and changes its status; nothing is
  deleted.

**Decision (recorded):** one invoice per booking, in an editable-until-paid
model. `booking_id` is a UNIQUE foreign key (`on delete cascade`), so a
booking cannot grow a second invoice; the down payment is recorded as a
payment against that single invoice (`amount_paid` / `balance_due`), not as a
separate DP invoice.

- `draft`, `issued` and `partially_paid` are fully editable: lines, due date,
  notes and bank account can be corrected at any time; totals recompute and
  the status re-derives from the payment math on every save (settled → `paid`,
  money in → `partially_paid`, nothing in → `issued`). Editing the bank
  account after issue re-snapshots `bank_account_snapshot`.
- `paid` is strictly read-only — no void, no payment reversal (accepted
  trade-off: a wrongly recorded final payment can only be fixed by direct DB
  edit). `void` is read-only too, reachable only from `issued` /
  `partially_paid`.
- Deleting is draft-only: issued invoices keep their `access_token` links
  alive, so void — not delete — is the correction path after issue. Voided
  rows are kept and their numbers are never reused — the invoice number
  sequence counts every invoice issued in the month, regardless of later
  status.

---

## 10. Traffic-source analytics

The website can only learn where a visitor came from at the moment they
arrive, so the source is captured on first landing, kept in the browser, and
saved into the booking when the booking is created.

### Changes to `bookings`

- `source` — plain string, nullable. Suggested values: `instagram`,
  `facebook`, `tiktok`, `whatsapp`, `referral`, `other`. Kept as free text in
  the same spirit as `item_category`.
- `utm_campaign` — nullable plain string

Sources of the value:

- Public booking form: taken from the UTM parameters on the link, or from the
  page referrer when no UTM tag exists. Social in-app browsers often send no
  referrer, so links shared on Instagram, Facebook and TikTok should carry a
  UTM tag.
- Admin booking form: a manual source dropdown, because bookings negotiated
  only on WhatsApp carry no automatic source.

### `page_visits` (optional, build later)

Only needed to compare visits against bookings per platform.

- `id` (PK)
- `source`
- `utm_campaign` — nullable
- `landing_path`
- `visited_at`

Anonymous visitors may insert into this table but never read it. It grows over
time, so it is deferred until conversion tracking is actually wanted.

---

## 11. Planning and procurement

Three separate questions, only the third needs new tables:

1. **Planning:** what is needed? Computed from upcoming `booking_items`.
2. **Gap:** what is missing? Computed, never stored.
3. **Procurement:** what was ordered, from whom, and did it arrive? Stored.

### How the gap is computed

- Consumables: demand from upcoming confirmed bookings, minus current
  `stock_quantity`, with `reorder_point` kept as a safety floor.
- Rentables: the gap is date-based. It is the highest demand on any single
  date minus `items.quantity_owned`. Two events needing more chairs than are
  owned on the same day is a shortage even if total stock looks fine.

### `suppliers`

Shops or people goods are bought from. Kept separate from `vendors`, which
are service providers booked for an event.

- `id` (PK)
- `name`
- `phone`
- `address` — nullable
- `notes` — nullable
- `created_at`, `updated_at`

### `purchase_orders`

- `id` (PK)
- `supplier_id` (FK → suppliers)
- `booking_id` — nullable FK → bookings; set only when the order exists for a
  specific event
- `status` — one of: `draft`, `ordered`, `partially_received`, `received`,
  `cancelled`
- `order_date` — nullable
- `expected_date` — nullable
- `note` — nullable
- `created_at`, `updated_at`

### `purchase_order_items`

- `id` (PK)
- `purchase_order_id` (FK → purchase_orders, cascade delete)
- `item_variant_id` (FK → item_variants)
- `quantity_ordered`
- `quantity_received` — starts at zero; supports deliveries that arrive in
  parts
- `unit_cost` — what was actually paid

### Receiving goods

- Receiving a line writes a row to `stock_movements`: type `restock` for
  consumable items, `purchased` for rentable items. Stock is never edited
  directly, so purchases and stock cannot drift apart.
- When the order is linked to a booking, receiving the goods also moves the
  matching `stock_check` checklist row from `need_order` to `in_stock`.
- `unit_cost` is the first cost data in the system. It is stored on purchase
  order lines only; it does not change `item_variants.current_price`, which
  stays the customer-facing selling price.

**Open decision:** buy per booking (an order exists because one event needs
it) or restock in bulk from reorder points. The schema supports both because
`purchase_orders.booking_id` is nullable.

---

## 12. Key business rules to preserve

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
- Vendors are admin-only data: no anon RLS policy, and invoice lines
  expose only the description, never the vendor. Items (inventory) carry no
  vendor link — the vendor relation lives on products (`products.vendor_id`
  + `vendor_price`, hidden from public reads via anon column grants; see
  section 5).
- `item_category` is a plain string, intentionally independent of
  `products.category_id`. Do not merge them into a shared `categories`
  table.
- `transport_fee` is always admin-entered per booking; do not build automatic
  distance/zone-based calculation for this phase.
- Invoices are frozen records: line items, totals, company name and bank
  account are copied into the invoice when it is issued. Later changes to
  prices, items or company settings never alter an issued invoice.
- Invoice access for customers is by `access_token` only, and public clients
  never get a general select permission on `invoices` or `bookings`.
- `company_profile` holds one row only.
- `source` on bookings is recorded at booking creation and is never inferred
  later; bookings made before the field existed stay empty.
- Procurement never edits stock directly. Receiving goods always goes through
  `stock_movements`.
- Suppliers (goods you buy) and vendors (services/property you source for an
  event) are separate tables and separate admin screens.
