# `/admin/orders` — Purchase orders list + create (§11, §15)

| | |
| --- | --- |
| **URL** | `/admin/orders` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`ƒ`, Suspense boundary for `useSearchParams`) |
| **Source** | `app/admin/(panel)/orders/page.tsx` |

## Purpose

Belanja ke supplier — the screen that wires plans ↔ ledger ↔
inventory. A PO starts as a draft; sending it to the supplier commits
the purchase, receiving goods adds stock, paying writes the ledger row.

## Data (parallel, browser client)

- `purchase_orders` + `supplier:suppliers(name)`,
  `booking:bookings(customer_name)`,
  `purchase_order_items(quantity_ordered, unit_cost)`, newest first.
- Suppliers (picker), bookings (50 newest, optional PO target).
- Catalog for the line editor: `items` +
  `item_variants(id, color, size, current_price, cost_price)` flattened
  into a `variantById` map (child→parent embeds arrive as objects —
  `as unknown as` cast).
- Open plan lines: `purchase_plan_lines` where
  `purchase_order_item_id is null` (≤200), filtered client-side to
  `done_at` null on approved/in_progress plans — the "Dari rencana"
  options.

## Create form ("Buat Pesanan")

Header: Supplier (required), Booking (opsional), Target datang
(date), Catatan. Lines editor (`LinesEditor`): per line a variant
`select` grouped by `item_category`, Jumlah, Harga Pokok (prefilled
`cost_price ?? current_price` when a variant is picked), and an
optional plan-line link; rows can be added/removed (one minimum).

→ `POST /api/admin/purchase-orders` → push `/admin/orders/{id}`.

**Shortcut prefill**: opening
`?booking_id=…&item_variant_id=…&quantity=…` opens the form with the
first line filled (used by the checklist "Buat PO" button on booking
detail); the cost prefill lands once the catalog state arrives.

## List

- Rows link to the detail page: cart chip, supplier name +
  `OrderStatusBadge` (draft/Dipesan/Sebagian/Diterima/Dibatalkan),
  subline `Untuk {customer} · {total} · Target {date}` (present parts
  only; total = Σ quantity_ordered × unit_cost).
- Trash button on drafts → `ConfirmModal` ("Rencana yang tertaut akan
  kembali terbuka") → `DELETE /api/admin/purchase-orders?id=` → local
  row filter.
- Skeleton loading, `EmptyState` ("atau mulai dari checklist
  booking"), error banner with safe-JSON fallback.

## Navigation

- Breadcrumbs: `Dashboard / Pembelian`.
- Sidebar: **Pembelian** (mobile via the Lainnya drawer).
