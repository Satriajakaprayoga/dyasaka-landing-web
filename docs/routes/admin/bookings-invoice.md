# `/admin/bookings/[id]/invoice/[invoiceId]` — Invoice editor

| | |
| --- | --- |
| **URL** | `/admin/bookings/[id]/invoice/[invoiceId]` |
| **Access** | Admin (session required) |
| **Rendering** | Dynamic Server Component (`ƒ`) + client `InvoiceManager` |
| **Source** | `app/admin/(panel)/bookings/[id]/invoice/[invoiceId]/page.tsx`, `components/admin/InvoiceManager.tsx` |

## Purpose

The single screen for one invoice of a booking: edit its draft lines, issue it, record customer payments into the ledger, copy/send the public link, void or delete. Reached from the invoice slots on [bookings-detail.md](bookings-detail.md) — a slot with a live invoice links here, an empty slot creates the draft first.

## Data

Nine parallel queries:

- `bookings("id, customer_name, phone, status, event_date")` (`.maybeSingle()`) and `invoices(*)` by `[invoiceId]`.
- **URL integrity check:** the page calls `notFound()` unless the booking exists, the invoice exists, and `invoice.booking_id === booking.id` — an invoice id from another booking can't be opened through this route.
- `invoice_items(*)` ordered `sort_order`, the stored snapshot (empty for a draft with no lines yet).
- Active `company_bank_accounts` ordered `sort_order`, and `company_profile(company_name, logo_url)` (`limit 1`).
- Variant catalog `items(... item_variants(...))` ordered by name, and active `products` **that have a `vendor_id`** with `vendors(name)` — the "Tambah dari Katalog" picker offers both materials and vendor products.
- Two ledger sums (`transactions` where `direction = 'in'`): this invoice's rows → `initialPaid`, and the whole booking's rows → `bookingPaid` (the "already received, including DP" figure on a final draft).

## Document header

Company logo + `company_name_snapshot` (fallback: live profile name), type ("Invoice DP" / "Invoice Final"), customer/event from the issue snapshots (fallback: booking), invoice number, issue date and due date.

## Draft (`status = 'draft'`)

- **Baris Invoice** — editable rows: description, qty, unit price, line total; add/remove rows. "Tambah dari Katalog…" appends a one-qty line from the variant catalog (description `Item — Color — Size`, price `current_price`, `source_type 'item'`) or from a vendor product (price `products.price`, `source_type 'vendor'`). Prefilled at creation from the booking's items + `transport_fee`; the draft never re-syncs to later booking changes.
- **Jatuh Tempo**, **Rekening Bank** (active accounts only), **Catatan**.
- Footer shows the live subtotal; for a final invoice it also shows the booking's payments so far and the remaining balance after this invoice.
- **Simpan Draft** — `PATCH /api/admin/invoices { action: 'save-lines', lines, due_date, notes, bank_account_id }`; disabled while any line is invalid (empty description, qty < 1, negative price).
- **Terbitkan** — confirm dialog, then saves the current lines first (issuing freezes what is *stored*), then `PATCH { action: 'issue' }`. Disabled without at least one line and a selected bank account (tooltip says which).
- **Hapus Draft** — confirm → `DELETE /api/admin/invoices?id=` → back to the booking detail.

## Issued / partially paid / paid

- Read-only line table plus Subtotal, Total, **Dibayar** and **Sisa Tagihan**, with a note that issued invoices are permanent (void and reissue to correct).
- **Pembayaran & Pengiriman** (issued only): amount (max = current balance) + date → `PATCH { action: 'record-payment' }`, which writes an `in` transaction through the invoices API and returns the re-derived `paid`/`balance_due`. Fully paid shows "Invoice sudah lunas." and hides the form.
- Public link input + **Copy** (clipboard, 2 s "Tersalin" feedback) and **Kirim via WhatsApp** — `buildWhatsAppLink(normalizePhoneToWa(booking.phone), …)` with the link prefilled.
- **Batalkan Invoice** (void) via confirm modal → `PATCH { action: 'void' }`; the public link then shows the "replaced" notice and the type's slot on the booking detail frees up for a reissue.

## Navigation

- Breadcrumbs: `Dashboard / Booking / {customer name} / Invoice` + **Kembali** → the booking detail.
- Back after deleting a draft → `/admin/bookings/[id]`.
