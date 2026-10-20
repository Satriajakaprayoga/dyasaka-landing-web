# `/admin` — Dashboard

| | |
| --- | --- |
| **URL** | `/admin` |
| **Access** | Admin (session required; `middleware.ts` guards `/admin/*`, RLS enforces writes) |
| **Rendering** | Dynamic Server Component (`ƒ`) |
| **Source** | `app/admin/(panel)/page.tsx` |

## Purpose

Operational overview: stat cards, the next 5 upcoming bookings, and four operational views (§5) in a `grid gap-6 lg:grid-cols-2` — each Suspense-wrapped with a `DashboardSectionSkeleton` fallback and an `EmptyState` when empty.

## Data

- Count queries (`head: true`): products, bookings with `status='pending'`, bookings with `status='confirmed'`, categories.
- `bookings` joined with `products(name)`, `event_date >= today`, ordered ascending, limit 5.
- Operational sections (independent async components):
  - **Perlu Persiapan** — bookings `event_date >= today`, `status != 'cancelled'`, `dp_received_at` not null, embed `checklist_items(phase, status)`; filtered in JS to bookings with a pickup row not `done`. Badge shows pickup progress "x/y". Rows link to the booking detail.
  - **Barang Keluar** — `booking_items` with `rental_status='checked_out'` (limit 10) + `item_variants(…items(name))` + `bookings(customer_name, event_date)` (nested parent embeds → cast). Rows link to the booking detail.
  - **Stok Menipis** — `item_variants` + `items(id, name)`; JS filter `reorder_point != null && stock_quantity <= reorder_point` (same rule as the ItemsTable badge), lowest stock first, max 10. Rows link to the item detail.
  - **Perlu Dipesan** — `checklist_items` where `phase='stock_check'`, `status='need_order'`, embed `bookings!inner(customer_name, event_date, dp_received_at)` excluding cancelled bookings; JS-filtered to DP-paid bookings. Rows link to the booking detail.

## Interactions

- Stat cards link to their list pages.
- Quick actions: **+ Produk** → `/admin/products/new`, **+ Booking** → `/admin/bookings/new`.
- **Lihat semua →** → `/admin/bookings`.

## Navigation

- Sidebar (`AdminSidebar`): Dashboard, Produk, Inventori, Booking, Kategori + logout.
- Mobile/tablet (`< lg`): fixed bottom nav (`BottomNav`) with Dashboard, Produk, Inventori, Booking, and **Lainnya** — which opens the sidebar drawer (Kategori, Lihat Situs, Keluar).
- Root of the admin breadcrumb tree — no breadcrumbs on this page.
