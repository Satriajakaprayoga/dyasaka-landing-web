# `/admin/bookings/[id]` — Booking detail & workflow

| | |
| --- | --- |
| **URL** | `/admin/bookings/[id]` |
| **Access** | Admin (session required) |
| **Rendering** | Dynamic Server Component (`ƒ`) + client panels |
| **Source** | `app/admin/(panel)/bookings/[id]/page.tsx`, `components/admin/BookingItemsPanel.tsx`, `components/admin/ChecklistPanel.tsx`, `components/admin/BookingDetailActions.tsx` |

## Purpose

The operational hub for one booking: the item snapshot (independently
editable, even for custom bookings), the 3-phase DP checklist, and the
workflow controls (DP received, project status).

## Data

- `bookings("*, products(name)")` single — unknown id → `notFound()`.
- Async section under `<Suspense fallback={<BookingPanelsSkeleton />}>` fetches in parallel:
  - `booking_items` + `item_variants(color, size, items(name, type, quantity_owned))` (cast `as unknown as` — child→parent embeds return objects).
  - `checklist_items` ordered by `sort_order`.
  - Same-date confirmed demand: `bookings` ids on the same `event_date` (`neq` self, `status = 'confirmed'`) → their `booking_items`, reduced in JS to `Record<variantId, qty>`.
  - Variant catalog (`items` + `item_variants`) for the add-item picker.

## Header

Customer name + `BookingStatusBadge` + `ProjectStatusBadge` + DP badge (green timestamp / amber "DP Belum"), product name or "Booking custom", and `BookingDetailActions`:

- **Tandai DP Diterima** (hidden once set) — `confirm()` → `PATCH /api/admin/bookings { dp_received_at }` → refresh. The DB trigger `trg_bookings_generate_checklist` builds the checklist.
- **Status Proyek** `<select>` (manual) — `PATCH { project_status }` → refresh.

## Summary card

Telepon, tanggal acara, produk (or "— Custom / tanpa paket —"), biaya transport (`formatRupiah`, "—" when null), alamat, tema, DP timestamp, pesan.

## Item Booking panel (`BookingItemsPanel`)

- **Tambah Item** — optgroup variant picker (grouped by `item_category`), qty, price prefilled from `current_price` → `POST /api/admin/booking-items`. Rows added after DP got matching catch-up checklist rows.
- Rows: item/variant label, inline qty + unit price edits (`PATCH` on blur), subtotal, `RentalStatusBadge` + keluar/kembali timestamps for rentables.
- **Amber non-blocking warning** when a rentable's qty exceeds `quantity_owned − same-date confirmed demand`.
- **Hapus** — `confirm()` (mentions checklist rows) → `DELETE ?id=`; checklist rows cascade via FK.

## Checklist panel (`ChecklistPanel`)

- Three phase cards: **Persiapan Stok** (`stock_check`), **Pengambilan** (`pickup`), **Pengembalian** (`return`), rows sorted by `sort_order`.
- Row: label (strikethrough when done), status `<select>` (stock_check: Menunggu/Stok Ada/Perlu Pesan/Selesai; pickup+return: Menunggu/Selesai) → `PATCH`; saving "Selesai" stamps `completed_at` and the DB trigger syncs `rental_status` (pickup → `checked_out`, return → `returned`). Un-marking does not rewind rental status.
- Inline note (saved on blur), `completed_at` timestamp, return rows show the synced `RentalStatusBadge`.
- **Baris bebas** — free-text row per phase → `POST` (`booking_item_id` null, sorted last; no rental side effects).
- No checklist + no DP → hint card: "Checklist dibuat otomatis saat DP ditandai diterima."

## Navigation

- Breadcrumbs: `Dashboard / Booking / {customer name}` + **Kembali** → `/admin/bookings`.
- Reached from the bookings list (date/customer link or the **Detail** action button) and after creating a booking in `/admin/bookings/new`.
