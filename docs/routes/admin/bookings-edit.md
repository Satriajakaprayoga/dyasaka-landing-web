# `/admin/bookings/[id]/edit` — Edit booking

| | |
| --- | --- |
| **URL** | `/admin/bookings/[id]/edit` |
| **Access** | Admin (session required) |
| **Rendering** | Dynamic Server Component (`ƒ`) + client `BookingForm` |
| **Source** | `app/admin/(panel)/bookings/[id]/edit/page.tsx`, `components/admin/BookingForm.tsx` |

## Purpose

Edit any booking field or its status.

## Data

- `bookings` where `id = [id]` (`.single()`) and `products` ordered by name — parallel.
- Unknown id → `notFound()`.

## Form (`BookingForm`, edit mode)

- All create-mode fields prefilled plus the full status select (pending / confirmed / done / cancelled).
- Submits `PATCH /api/admin/bookings` with `{ id, …changes }`; changing `event_date` re-triggers the capacity recalculation.

## Navigation

- Breadcrumbs: `Dashboard / Booking / {customer name} / Ubah` + **Kembali** → `/admin/bookings`.
