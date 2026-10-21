# `/api/admin/invoices` — Invoice API (state machine)

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/invoices/route.ts` |

One invoice per booking (`invoices.booking_id` UNIQUE) — the DP is
recorded as a payment against it, not as a second document.
`booking_id` is never client-writable.

## POST — create draft

Body: `{ booking_id }` (400 when missing). Booking must exist (404
`'Booking tidak ditemukan'`) and must not be `cancelled` (400
`'Booking yang dibatalkan tidak bisa dibuatkan invoice'`). An existing
invoice → 409 `'Booking ini sudah memiliki invoice'`.

The draft is inserted with DB-default `access_token` and its lines are
**prefilled as copies** from `booking_items` (embed
`item_variants(color, size, items(name))`, description `"Name (Color,
Size)"` like the checklist labels, frozen `unit_price`, `source_type
'item'`, `sort_order i*10`) plus one `'Biaya Transport'` line when
`transport_fee > 0` (`source_type 'transport'`). `subtotal = total =
balance_due` = sum of lines. → `{ invoice }` 201.

## PATCH — `{ id, action, … }` dispatch

Loads the invoice (404 `'Invoice tidak ditemukan'`), then:

### `save-lines` (draft only — else 409 `'Hanya draft yang dapat diubah'`)

Body also carries `lines[]`, `due_date?`, `notes?`,
`bank_account_id?` (`''` → null). Lines validated: description
trimmed non-empty ≤200 chars, integer `quantity > 0`, `unit_price ≥
0` — first violation names the row (`'Baris N: …'`, 400). The line set
is **replace-all** (delete + insert, `sort_order = i*10`), then
`subtotal`/`total` are recomputed from `line_total` and
`balance_due = total − amount_paid`. → `{ invoice, items }`.

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

### `record-payment` (issued only — else 409)

Body: `{ amount }` — must satisfy `0 < amount ≤ balance_due`
(otherwise 400 naming the remaining balance). `amount_paid += amount`,
`balance_due = total − amount_paid`; `balance_due ≤ 0` flips status to
`'paid'`. Overpay is rejected. → `{ invoice }`.

### `void` (issued only — else 409 `'Hanya invoice berstatus terbit yang dapat dibatalkan'`)

Sets `status = 'void'`; the row is kept. Paid invoices can no longer be
voided. → `{ invoice }`.

Unknown action → 400.

## DELETE — delete draft

Query: `?id=` (400 when missing; 404 unknown). Only `draft` invoices
are deletable (409 `'Hanya draft yang dapat dihapus'`); the line rows
cascade. Issued/paid/void invoices are kept for the record — to
"correct" one, void it (a re-issue of the same booking is not possible,
since `booking_id` is unique).
→ `{ ok: true }`.
