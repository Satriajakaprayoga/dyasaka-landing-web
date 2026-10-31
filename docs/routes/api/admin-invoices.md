# `/api/admin/invoices` — Invoice API (state machine, §9)

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/invoices/route.ts` |

Several invoices per booking over its life: first a deposit invoice
(`invoice_type 'dp'`, one typed line), later the `'final'` invoice. At
most ONE non-void invoice of each type per booking — enforced by the
partial unique index `invoices_booking_type_live (booking_id,
invoice_type) WHERE status <> 'void'`; a void frees the slot for a
reissue. `booking_id` is never client-writable.

Statuses: `draft` (editable) → `issued` (**FROZEN** — lines, totals,
snapshots) → `paid` (derived: balance reaches zero) / `void`
(read-only). Correction of an issued/paid invoice means **void +
reissue** — never an edit. `amount_paid`/`balance_due` are not stored:
paid = Σ ledger `in` rows carrying `invoice_id` (helper `paidAmount`),
like `stock_quantity` from `stock_movements`.

## POST — create draft

Body: `{ booking_id, invoice_type?, amount?, description? }` —
`invoice_type` defaults to `final` (only `'dp'` honored otherwise).

Booking must exist (404 `'Booking tidak ditemukan'`) and not be
`cancelled` (400 `'Booking yang dibatalkan tidak bisa dibuatkan
invoice'`). A live invoice of the same type → 409 `'Booking ini sudah
memiliki invoice DP/final — batalkan (void) yang lama untuk membuat
yang baru'` (the partial unique index is the race referee — `23505` on
insert maps to the same 409).

Lines are prefilled as copies:

- **DP** — exactly one line: description `'Deposit (DP)'` (or
  `body.description` trimmed ≤200), qty 1, `amount` > 0 required (400
  `'Nominal DP harus lebih besar dari 0'`), `source_type 'custom'`.
  The UI prefills a percentage of the booking total.
- **Final** — 1) the package first (`products(name, price)` embed,
  `source_type 'custom'`, sort 0) when the booking has a product;
  2) item lines from `booking_items`, labeled `"Name (Color, Size)"`
  like the checklist, priced at the **live catalog price**
  (`item_variants.current_price`) with fallback to the booking's frozen
  `unit_price`; 3) `'Biaya Transport'` last when `transport_fee > 0`.

Prices are copied either way — later catalog changes never touch an
existing invoice. `subtotal = total` = Σ lines; `access_token` comes
from the DB default. → `{ invoice }` 201.

## PATCH — `{ id, action, … }` dispatch

Loads the invoice (404 `'Invoice tidak ditemukan'`), then:

### `save-lines` (draft only — else 409 `'Hanya draft yang dapat diubah — invoice terbit tidak bisa diedit'`)

Body also carries `lines[]`, `due_date?`, `notes?`, `bank_account_id?`
(`''` → null = clear). Lines validated (400 naming the row, `'Baris N:
…'`): description trimmed non-empty ≤200, integer `quantity > 0`,
`unit_price ≥ 0`; `source_type` ∈ `item | vendor | transport` else
`custom`. The line set is **replace-all** (delete + insert,
`sort_order = i*10`); `subtotal = total` recomputed. → `{ invoice,
items }`.

### `issue` (draft only — else 409 `'Invoice sudah diterbitkan'`)

Guards: ≥1 line (400 `'Invoice minimal harus memiliki satu baris'`),
`bank_account_id` set (400 `'Pilih rekening bank terlebih dahulu'`)
**and** its account `is_active` (400 `'Pilih rekening bank yang
aktif'`), booking `status ∈ ('confirmed','done')` (400 `'Booking belum
dikonfirmasi'`).

On success: `issue_date = today`, totals frozen from `line_total`s, and
snapshots copied — `company_name_snapshot` from `company_profile`,
`bank_account_snapshot = "{bank} a/n {holder} • {number}"`,
`customer_name_snapshot`, `phone_snapshot`, `event_address_snapshot`,
`event_date_snapshot`.

Invoice number `INV/YYYY/MM/NNNN`: sequence = invoices issued that
month + 1 (voided included — numbers are never reused), zero-padded to
4. A concurrent issue racing for the same number hits the unique
constraint (`23505`) and the route retries with the next number up to
5×. → `{ invoice, items }`.

### `record-payment` (issued only — else 409 `'Pembayaran hanya dicatat pada invoice yang terbit'`)

Body: `{ amount, transaction_date?, account? }` — must satisfy
`0 < amount ≤ balance_due` (else 400 naming the remaining balance).
The payment lands in the **ledger** as an `in` row: category
`'Customer payment'` (seeded; missing → 400 pointing at Kas settings),
description `'Pembayaran invoice {number}'`, optional account, linked
`booking_id` + `invoice_id`. The invoice row itself only flips to
`'paid'` when the new paid total covers `total` — nothing else is
edited. → `{ invoice, transaction, paid, balance_due }`. A wrong
payment is fixed by reversing the ledger row in Kas, not here.

### `void` (issued | paid — else 409 `'Hanya invoice terbit atau lunas yang dapat dibatalkan'`)

Sets `status = 'void'`; the row is kept. Ledger payments are NOT
touched (reverse them in Kas if they were wrong). The old public token
stops rendering amounts and shows the "replaced" notice instead. →
`{ invoice }`.

Unknown action → 400.

## Draft editor picker (UI, `InvoiceManager`)

The draft page also loads, next to the variant catalog, the active
vendor-tagged products (`products.select("id, name, price, vendor_id,
vendors(name)").not("vendor_id", "is", null).eq("is_active", true)`).
The add-line select has two kinds of optgroups: inventory variants
grouped by `item_category` (`source_type 'item'` at `current_price`)
and **Vendor** products grouped by vendor name (`source_type 'vendor'`,
qty 1 at the product's selling price — admin adjusts). Vendor lines are
invoice-only: they never enter `booking_items` or the checklist, and
the POST prefill adds none.

## DELETE — delete draft

Query: `?id=` (400 when missing; 404 unknown). Only `draft` invoices
are deletable (409 `'Hanya draft yang dapat dihapus'`); line rows
cascade. Issued/paid/void invoices are kept for the record — to
"correct" one, void it and create a fresh draft of the same type.
→ `{ ok: true }`.
