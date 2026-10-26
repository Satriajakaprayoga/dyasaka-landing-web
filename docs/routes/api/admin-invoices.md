# `/api/admin/invoices` — Invoice API (state machine)

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/invoices/route.ts` |

One invoice per booking (`invoices.booking_id` UNIQUE) — the DP is
recorded as a payment against it, not as a second document.
`booking_id` is never client-writable.

Editable-until-paid model: `draft`, `issued` and `partially_paid` accept
edits; `paid` and `void` are read-only. `partially_paid` is
**system-derived** on every write (`amount_paid > 0 && balance_due >
0` → `partially_paid`, `balance_due ≤ 0` with money in → `paid`,
nothing in → `issued`) — clients never send it.

## POST — create draft

Body: `{ booking_id }` (400 when missing). Booking must exist (404
`'Booking tidak ditemukan'`) and must not be `cancelled` (400
`'Booking yang dibatalkan tidak bisa dibuatkan invoice'`). An existing
invoice → 409 `'Booking ini sudah memiliki invoice'`.

The draft is inserted with DB-default `access_token` and its lines are
**prefilled as copies**, in three groups:

1. **Package line first** — when the booking has a `product_id`
   (`products(name, price)` embed): description = product name, qty 1,
   `unit_price` = the product's price, `source_type 'custom'`,
   `sort_order 0`. Custom bookings (no product) skip this line.
2. **Item lines** — from `booking_items` (embed
   `item_variants(color, size, current_price, items(name))`),
   description `"Name (Color, Size)"` like the checklist labels,
   priced at the **live catalog price** (`item_variants.current_price`)
   with fallback to the booking's frozen `unit_price` when the variant
   is gone; `source_type 'item'`, `sort_order (i+1)*10`.
3. **`'Biaya Transport'` last** — when `transport_fee > 0`
   (`source_type 'transport'`, qty 1, `sort_order = lines.length*10`).

Prices are copied either way — later catalog changes never touch an
existing invoice. `subtotal = total = balance_due` = sum of lines. →
`{ invoice }` 201.

## Draft editor picker (UI, `InvoiceManager`)

The draft page also loads, next to the variant catalog, the active
vendor-tagged products (`products.select("id, name, price, vendor_id,
vendors(name)").not("vendor_id", "is", null).eq("is_active", true)`).
The "Tambah dari Katalog…" select then has two kinds of optgroups:
inventory variants grouped by `item_category` (`source_type 'item'` at
`current_price`) and **Vendor** products grouped by vendor name
(`source_type 'vendor'`, qty 1 at the product's selling price — admin
adjusts). Vendor lines are invoice-only: they never enter
`booking_items` or the checklist, and the POST prefill adds none.

## PATCH — `{ id, action, … }` dispatch

Loads the invoice (404 `'Invoice tidak ditemukan'`), then:

### `save-lines` (draft | issued | partially_paid — else 409 `'Invoice lunas atau dibatalkan tidak dapat diubah'`)

Body also carries `lines[]`, `due_date?`, `notes?`,
`bank_account_id?` (`''` → null). Lines validated: description
trimmed non-empty ≤200 chars, integer `quantity > 0`, `unit_price ≥
0` — first violation names the row (`'Baris N: …'`, 400).

Issued/partially-paid extras: ≥1 line (400), `bank_account_id`
required — changing it re-snapshots `bank_account_snapshot` from the
(now required-active) account; an unchanged id keeps its issued-time
snapshot even if the bank was later deactivated. A new total below
`amount_paid` → 400 `'Total baru lebih kecil dari pembayaran tercatat
…'`.

The line set is **replace-all** (delete + insert, `sort_order =
i*10`), then `subtotal`/`total` are recomputed and
`balance_due = total − amount_paid`; the status re-derives from the
payment math (drafts stay `draft`). → `{ invoice, items }`.

### `issue` (draft only — else 409 `'Invoice sudah diterbitkan'`)

Guards: ≥1 line (400 `'Invoice minimal harus memiliki satu baris'`),
`bank_account_id` set **and** its account `is_active` (400 `'Pilih
rekening bank yang aktif'`), booking `status ∈ ('confirmed','done')`
(400 `'Booking belum dikonfirmasi'`). On success: `issue_date =
today`, `status = 'issued'`, totals frozen, and snapshots copied —
`company_name_snapshot` from `company_profile`,
`bank_account_snapshot = "{bank} a/n {holder} • {number}"`.

Invoice number `INV/YYYY/MM/NNNN`: sequence = invoices issued that
month + 1 (voided ones included — numbers are never reused), zero-
padded to 4. A concurrent issue racing for the same number hits the
unique constraint (`23505`) and the route retries with the next
sequence up to 5×. → `{ invoice, items }`.

### `record-payment` (issued | partially_paid — else 409)

Body: `{ amount }` — must satisfy `0 < amount ≤ balance_due`
(otherwise 400 naming the remaining balance). `amount_paid += amount`,
`balance_due = total − amount_paid`; `balance_due ≤ 0` flips status to
`'paid'`, anything else to `'partially_paid'`. Overpay is rejected.
→ `{ invoice }`.

### `void` (issued | partially_paid — else 409 `'Hanya invoice terbit atau bayar sebagian yang dapat dibatalkan'`)

Sets `status = 'void'`; the row is kept. `paid` is strictly read-only —
no void, no payment reversal. → `{ invoice }`.

Unknown action → 400.

## DELETE — delete draft

Query: `?id=` (400 when missing; 404 unknown). Only `draft` invoices
are deletable (409 `'Hanya draft yang dapat dihapus'`); the line rows
cascade. Issued/paid/void invoices are kept for the record — to
"correct" one, void it (a re-issue of the same booking is not possible,
since `booking_id` is unique).
→ `{ ok: true }`.
