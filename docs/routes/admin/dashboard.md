# `/admin` — Dashboard

| | |
| --- | --- |
| **URL** | `/admin` |
| **Access** | Admin (session required; `middleware.ts` guards `/admin/*`, RLS enforces writes) |
| **Rendering** | Dynamic Server Component (`ƒ`) |
| **Source** | `app/admin/(panel)/page.tsx` |

## Purpose

Operational overview: stat cards and the next 5 upcoming bookings.

## Data (all parallel `Promise.all`)

- Count queries (`head: true`): products, bookings with `status='pending'`, bookings with `status='confirmed'`, categories.
- `bookings` joined with `products(name)`, `event_date >= today`, ordered ascending, limit 5.

## Interactions

- Stat cards link to their list pages.
- Quick actions: **+ Produk** → `/admin/products/new`, **+ Booking** → `/admin/bookings/new`.
- **Lihat semua →** → `/admin/bookings`.

## Navigation

- Sidebar (`AdminSidebar`): Dashboard, Produk, Inventori, Booking, Kategori + logout.
- Mobile/tablet (`< lg`): fixed bottom nav (`BottomNav`) with Dashboard, Produk, Inventori, Booking; Kategori is reachable via the Kategori stat card on this page.
- Root of the admin breadcrumb tree — no breadcrumbs on this page.
