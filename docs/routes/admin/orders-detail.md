# `/admin/orders/[id]` — Purchase order detail (§11, §15)

| | |
| --- | --- |
| **URL** | `/admin/orders/{id}` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`ƒ`) |
| **Source** | `app/admin/(panel)/orders/[id]/page.tsx` |

## Purpose

The PO lifecycle in one screen: send the draft to the supplier, track
partial deliveries into stock, pay the bill into the ledger.

## Data (parallel, browser client)

- `purchase_orders` + `supplier:suppliers(id, name, phone)`,
  `booking:bookings(id, customer_name)` — `.maybeSingle()`, miss →
  "Pesanan tidak ditemukan" empty state.
- `purchase_order_items` +
  `item_variants(color, size, items(name, type))`, `.order("id")`
  (the table has no timestamps).
- Active `out` transaction categories (payment picker) and the order's
  ledger rows (`transactions` where `purchase_order_id = id`).

Derived: `total = Σ quantity_ordered × unit_cost`, `paid = Σ out
ledger rows`, `remaining = max(total − paid, 0)`.

## Header

Supplier name + `OrderStatusBadge`, meta (Untuk {customer} link,
Target date, Dipesan date), total. Draft/ordered rows offer an inline
Ubah toggle (expected date + note → PATCH `save`). Draft shows
**Hapus Draft** (`ConfirmModal` → DELETE → push `/admin/orders`) and
**Kirim ke Supplier** (`window.confirm` → PATCH `order`); ordered
shows **Batalkan** (`ConfirmModal` — notes that linked plan lines
reopen — → PATCH `cancel`).

## Lines table

Variant / Dipesan / Diterima / Harga Pokok / Subtotal. While the order
is ordered/partially_received, each line with a remaining balance gets
a **Terima** button → inline receiving row (qty, default = remaining,
max remaining) → PATCH `receive { lines: [{ id, quantity }] }` →
order + items state replaced from the response. A footnote explains
the stock side effect (restock/purchased + checklist flip).

## Payment card

Total / Dibayar / Sisa grid, ledger history (description, category,
date, amount), and — for any non-draft, non-cancelled status — a pay
form: Nominal (default = remaining), Tanggal, Akun, Kategori (active
out-categories, empty = API default "Goods purchase") → PATCH
`pay { amount, transaction_date, account, category_id }` → the
returned transaction is appended locally. A footnote explains PO
payments are cashflow only and never event margin.

## Navigation

- Breadcrumbs: `Dashboard / Pembelian / {supplier}`.
- Reached from the orders list, or after creating an order.
