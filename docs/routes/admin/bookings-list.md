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

- `bookings` + `products(name)`, ordered `event_date asc`.

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

- Inline status `<select>` per row → `PATCH /api/admin/bookings` `{ id, status }` → refresh. Status badge under the select mirrors the change.
- **Ubah** → `/admin/bookings/[id]/edit`.
- **Hapus** → `confirm()` → `DELETE /api/admin/bookings?id=` → refresh. The DB trigger recalculates `date_capacity.booked_count` on delete.

## Navigation

- Breadcrumbs: `Dashboard / Booking`.
- **Tambah Booking** → `/admin/bookings/new`.
