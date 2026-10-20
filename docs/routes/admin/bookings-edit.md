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

- All create-mode fields prefilled plus the full status select (pending / confirmed / done / cancelled) and the optional **Biaya Transport** field. Product can be switched or cleared to "— Custom / tanpa paket —".
- Submits `PATCH /api/admin/bookings` with `{ id, …changes }` (API applies an allow-list); changing `event_date` re-triggers the capacity recalculation. Note: switching the product here does not re-seed `booking_items` — edit items on the detail page.
- On success redirects back to `/admin/bookings`.

## Navigation

- Breadcrumbs: `Dashboard / Booking / {customer name} / Ubah` + **Kembali** → `/admin/bookings`.
