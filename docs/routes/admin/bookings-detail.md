# `/admin/bookings/[id]` — Booking detail & workflow

| | |
| --- | --- |
| **URL** | `/admin/bookings/[id]` |
| **Access** | Admin (session required) |
| **Rendering** | Dynamic Server Component (`ƒ`) + client panels |
| **Source** | `app/admin/(panel)/bookings/[id]/page.tsx`, `components/admin/BookingItemsPanel.tsx`, `components/admin/ChecklistPanel.tsx`, `components/admin/BookingStaffPanel.tsx`, `components/admin/BookingDetailActions.tsx` |

## Purpose

The operational hub for one booking: the item snapshot (independently
editable, even for custom bookings), the 3-phase DP checklist, helper
staffing with planned vs actual pay, and the margin per event — around
the workflow controls (DP received, project status, invoices).

## Data

- `bookings("*, products(name, vendor_price)")` single — unknown id →
  `notFound()`; the vendor price feeds the margin's vendor row.
- Every invoice of the booking (`id, status, invoice_type`, oldest
  first) — the action buttons render one slot per type.
- Async section under `<Suspense fallback={<BookingPanelsSkeleton />}>` fetches in parallel:
  - `booking_items` + `item_variants(color, size, cost_price, items(name, type, quantity_owned))` (cast `as unknown as` — child→parent embeds return objects; `cost_price` is the margin's material fallback).
  - `checklist_items` ordered by `sort_order`.
  - Same-date confirmed demand: `bookings` ids on the same `event_date` (`neq` self, `status = 'confirmed'`) → their `booking_items`, reduced in JS to `Record<variantId, qty>`.
  - Variant catalog (`items` + `item_variants`) for the add-item picker.
  - Active `staff` and the booking's `booking_staff` + `staff(name)`.
  - Active `out` `transaction_categories` (helper-pay form) and the booking's `transactions` (direction, amount, purchase_order_id, booking_staff_id).
  - The live final invoice's `total` (`invoice_type 'final'`, status issued/paid) — the margin's expected revenue when present.
  - Follow-ups: same-date `booking_items` (demand above), double-booking check (same-date non-cancelled bookings → their `booking_staff` matching this booking's staff ids) → `Record<staffId, string[]>` of other customer names.

## Header

Customer name + `BookingStatusBadge` + `ProjectStatusBadge` + DP badge (green timestamp / amber "DP Belum"), product name or "Booking custom", and `BookingDetailActions`:

- **Tandai DP Diterima** (hidden once set) — `confirm()` → `PATCH /api/admin/bookings { dp_received_at }` → refresh. The DB trigger `trg_bookings_generate_checklist` builds the checklist.
- **Status Proyek** `<select>` (manual) — `PATCH { project_status }` → refresh.
- **Invoice slots** (`InvoiceRef[]` → `liveByType`, one per type): a live (non-void) invoice shows as a link — **Invoice DP** / **Invoice Final** — to `/admin/bookings/[id]/invoice/[invoiceId]`; an empty slot shows **+ Invoice DP** / **Buat Invoice Final** (`POST /api/admin/invoices { booking_id, invoice_type }` → push to the new draft; the final button reads **Terbitkan Ulang Invoice Final** once any voided invoice exists). Voiding frees the slot for a reissue.

## Summary card

Telepon, tanggal acara, produk (or "— Custom / tanpa paket —"), biaya transport (`formatRupiah`, "—" when null), alamat, tema, DP timestamp, pesan.

## Item Booking panel (`BookingItemsPanel`)

- **Tambah Item** — optgroup variant picker (grouped by `item_category`), qty, price prefilled from `current_price` → `POST /api/admin/booking-items`. Rows added after DP got matching catch-up checklist rows.
- Rows: item/variant label, inline qty + unit price edits (`PATCH` on blur), subtotal, `RentalStatusBadge` + keluar/kembali timestamps for rentables.
- **Amber non-blocking warning** when a rentable's qty exceeds `quantity_owned − same-date confirmed demand`.
- **Hapus** — `ConfirmModal` with impact check (counts the booking item's `checklist_items` cascade) → `DELETE ?id=`; checklist rows cascade via FK.

## Checklist panel (`ChecklistPanel`)

- Three phase cards: **Persiapan Stok** (`stock_check`), **Pengambilan** (`pickup`), **Pengembalian** (`return`), rows sorted by `sort_order`.
- Row: label (strikethrough when done), status `<select>` (stock_check: Menunggu/Stok Ada/Perlu Pesan/Selesai; pickup+return: Menunggu/Selesai) → `PATCH`; saving "Selesai" stamps `completed_at` and the DB trigger syncs `rental_status` (pickup → `checked_out`, return → `returned`). Un-marking does not rewind rental status.
- Inline note (saved on blur), `completed_at` timestamp, return rows show the synced `RentalStatusBadge`.
- **Baris bebas** — free-text row per phase → `POST` (`booking_item_id` null, sorted last; no rental side effects).
- Row delete (X) — `ConfirmModal` plain confirm (checklist rows have no children) → `DELETE ?id=`.
- No checklist + no DP → hint card: "Checklist dibuat otomatis saat DP ditandai diterima."

## Staff panel (`BookingStaffPanel`)

- **Tambah** — staff `<select>` (active only), role, rencana bayar →
  `POST /api/admin/booking-staff` (starts `planned`).
- Rows: name, role, status badge (`Rencana` amber / `Dikonfirmasi`
  green / `Dibatalkan` gray), planned pay vs **actual pay read from the
  ledger** (Σ `out` rows carrying that `booking_staff_id` — never typed
  by hand).
- **Bayar** — inline form (amount prefilled with the remaining planned
  pay, date, out-category defaulting to the seeded helper-pay category,
  description `Bayar helper {name} — {booking}`) → `POST
  /api/admin/transactions` with `booking_staff_id` + `staff_id` links,
  so the ledger stays the single money source.
- **Konfirmasi / Batal** status buttons (`PATCH { status }`); **Hapus**
  offered only while nothing has been paid.
- **Amber double-booking warning** — the same person on another
  non-cancelled booking with the same event date (names listed, links
  by customer); warning only, never blocks.

## Margin Acara panel (server-rendered table, §14)

Expected vs actual, side by side: Pendapatan (live final invoice's
frozen total, else booking total + transport), Bahan (consumables at
frozen `unit_cost` → variant `cost_price` fallback), Vendor
(`products.vendor_price`), Helper (Σ planned / Σ ledger `out`), Biaya
lain (actual `out` rows without PO or helper links), Total biaya, and
the Margin row (actual red when negative). PO-linked purchases are
cashflow-only — their material cost already entered through the cost
snapshot; fixed salaries don't count unless linked to this booking.

## Navigation

- Breadcrumbs: `Dashboard / Booking / {customer name}` + **Kembali** → `/admin/bookings`.
- Reached from the bookings list (date/customer link or the **Detail** action button) and after creating a booking in `/admin/bookings/new`.
