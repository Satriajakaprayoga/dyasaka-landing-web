# `/admin/bookings/new` — Create booking

| | |
| --- | --- |
| **URL** | `/admin/bookings/new` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/bookings/new/page.tsx`, `components/admin/BookingForm.tsx` |

## Purpose

Record a booking taken from a WhatsApp conversation.

## Data

- `products` where `is_active = true` (browser client) for the product select.

## Form (`BookingForm`, create mode)

- Product (select), customer name + phone (required), event date + address (required), theme, message.
- Status select defaults to `confirmed` (admin records an already-agreed booking; `pending` available for holds).
- Submits `POST /api/admin/bookings` → `router.push('/admin/bookings')` + refresh. The DB trigger updates `date_capacity.booked_count`, so the public calendar reflects it immediately.

## Navigation

- Breadcrumbs: `Dashboard / Booking / Tambah Booking` + **Kembali** → `/admin/bookings`.
