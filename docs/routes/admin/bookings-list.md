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

## Interactions

- Inline status `<select>` per row → `PATCH /api/admin/bookings` `{ id, status }` → refresh. Status badge under the select mirrors the change.
- **Ubah** → `/admin/bookings/[id]/edit`.
- **Hapus** → `confirm()` → `DELETE /api/admin/bookings?id=` → refresh. The DB trigger recalculates `date_capacity.booked_count` on delete.

## Navigation

- Breadcrumbs: `Dashboard / Booking`.
- **Tambah Booking** → `/admin/bookings/new`.
