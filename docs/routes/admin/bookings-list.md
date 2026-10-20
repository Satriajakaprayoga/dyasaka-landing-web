# `/admin/bookings` — Booking list

| | |
| --- | --- |
| **URL** | `/admin/bookings` |
| **Access** | Admin (session required) |
| **Rendering** | Server Component + client `BookingsTable` |
| **Source** | `app/admin/(panel)/bookings/page.tsx`, `components/admin/BookingsTable.tsx` |

## Purpose

Manage all event bookings: schedule overview, status workflow, edits.

## Data

- `bookings` + `products(name)`, ordered `event_date asc`. `products` is null for custom bookings → Produk cell shows "Custom".
- Bookings arrive from two sources: manual admin entry (`/admin/bookings/new`) and **self-service booking on the public product page** — the latter insert directly as `pending` / `not_started` via the `"public insert bookings"` RLS policy (`supabase/migrations/20261007120000_public_booking_insert.sql`) and wait here for confirmation.

## Search & filters (client-side, in `BookingsTable`)

| Control | Filters on |
| --- | --- |
| Search box | customer name, phone, theme, product name |
| Status select | Pending / Confirmed / Selesai / Dibatalkan |
| Periode select | **Akan Datang** (`event_date >= today`) / **Sudah Lewat** |
| Counter | "X dari Y booking" |

### Filter persistence

Filters survive navigation (`usePersistentFilters`): URL params (`?q=&status=&period=&page=`) are primary; sessionStorage (`admin-bookings-filters`) restores them when returning with a clean URL. **Reset Filter** clears both.

## Pagination

Client-side, 10 rows per page (`components/admin/Pagination.tsx`). Page number is part of the persisted filter state; changing any filter resets to page 1; page changes scroll to top.

## Interactions

- Inline status `<select>` per row → `PATCH /api/admin/bookings` `{ id, status }` → refresh. Status badge + **project status badge** under the select mirror the change.
- Date and customer-name cells link to `/admin/bookings/[id]` (the operational detail page).
- **Detail** → `/admin/bookings/[id]` (explicit action button, first in the actions column).
- **Ubah** → `/admin/bookings/[id]/edit`.
- **Hapus** → `ConfirmModal` with cascade info: counts `booking_items` + `checklist_items` (both cascade), plus a note when the booking is `confirmed` (capacity recalculated) and a **"Lihat detail booking"** link into `/admin/bookings/[id]` for a final check before confirming → confirm → `DELETE /api/admin/bookings?id=` → refresh.

## Navigation

- Breadcrumbs: `Dashboard / Booking`.
- **Tambah Booking** → `/admin/bookings/new`.
