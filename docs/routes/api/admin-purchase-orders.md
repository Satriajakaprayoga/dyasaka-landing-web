# `/api/admin/purchase-orders` — Purchase orders API (§11, §15)

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/purchase-orders/route.ts` |

The bridge between plans, ledger and inventory. A PO is a COMMITMENT
to a supplier; plans stay editable intentions. Receiving a line writes
a stock movement (`restock` for consumables, `purchased` for rentables)
and bumps `stock_quantity`; paying writes ONE ledger `out` row carrying
`purchase_order_id` — cashflow only, never event margin (material cost
enters margin through the booking-item cost snapshot).

## POST — create draft

Body: `{ supplier_id, lines[], booking_id?, expected_date?, note? }`.

- `supplier_id` required, must exist (400 `'Supplier wajib dipilih'` /
  `'Supplier tidak ditemukan'`); `expected_date` ISO date or null.
- `lines[]` validated per row (400 naming `'Baris N: …'`):
  `item_variant_id` required, integer `quantity_ordered > 0`,
  `unit_cost ≥ 0`. Optional per line: `plan_line_id` — links an open
  plan line to its new order line.
- Insert order (`status 'draft'`) + items, then set each plan line's
  `purchase_order_item_id` and recompute every affected plan's status
  (approved → in_progress). 23503 → 400 `'Booking tidak ditemukan'`.

→ `{ order, items }` 201.

## PATCH — `{ id, action }` dispatch

Load order (404 `'Pesanan tidak ditemukan'`) + its items (ordered by
`id` — the table has no timestamps).

### `save` — expected date / note

Draft or ordered only (409 `'Pesanan yang sudah mulai diterima tidak
bisa diubah'`). Allow-list patch of `expected_date` (ISO date) /
`note`; empty patch → 400 `'No changes'`. → `{ order }`.

### `order` — the commitment

Draft only (409 `'Pesanan sudah dikirim ke supplier'`). Sets
`status = 'ordered'` and `order_date = today`. → `{ order }`.

### `receive` — per-line, partial deliveries

Ordered or partially_received only (409 `'Hanya pesanan terkirim yang
bisa menerima barang'`). Body `lines: [{ id, quantity }]` — per row:
item must belong to this order, integer `quantity > 0` and ≤ remaining
(400 `'Baris N: melebihi sisa (…)'`).

For each row: insert a `stock_movements` row (`restock` when the
variant's item is consumable, else `purchased`) carrying the PO's
`booking_id` and note `PO {order_date}`, then increment the variant's
`stock_quantity`. Booking-linked orders then flip the matching
stock-check checklist rows (`status 'need_order' → 'in_stock'`, matched
through `booking_items.booking_item_id` — checklist has no variant
column). Finally bump each line's `quantity_received`, recompute the
order status (all lines full → `received`, any received →
`partially_received`) and recompute the plans linked via
`purchase_order_item_id`. → `{ order, items }` (fresh items).

### `cancel`

Draft or ordered only (409 `'Pesanan yang sudah mulai diterima tidak
bisa dibatalkan'`). Sets `status = 'cancelled'`, unlinks every plan
line pointing at this order's items (`purchase_order_item_id = null`)
and recomputes their plans — a cancelled order is not "ordered". →
`{ order }`.

### `pay` — one ledger row

Blocked for draft/cancelled (409 `'Hanya pesanan terkirim yang bisa
dibayar'`). `total = Σ quantity_ordered × unit_cost`; paid so far = Σ
ledger `out` rows with this `purchase_order_id`. `amount` must satisfy
`0 < amount ≤ remaining` (400 `'Nominal pembayaran harus di antara 0
dan sisa tagihan (…)'`); optional `transaction_date` (ISO) and
`account`. Category: body `category_id` or the seeded `'Goods purchase'`
out-category (400 with a hint when missing). Inserts ONE `transactions`
row: `direction 'out'`, description `'Bayar pesanan {supplier}'`,
`purchase_order_id` set, `booking_id` informational only. → `{ order,
transaction, paid, remaining }`.

Unknown `action` → 400 `'Unknown action'`; missing `id`/`action` → 400
`'Missing id or action'`.

## DELETE — drop draft

Query: `?id=` (400 `'Missing order id'`). Draft only — 409 `'Hanya
draft yang dapat dihapus — batalkan (cancel) yang sudah dikirim'`.
Items cascade; plan-line links die with them (`on delete set null`)
and statuses never regress, so no plan recompute is needed. →
`{ ok: true }`.
