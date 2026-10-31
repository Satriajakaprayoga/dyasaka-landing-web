# `/admin/plans` — Purchase plans list (§15)

| | |
| --- | --- |
| **URL** | `/admin/plans` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/plans/page.tsx` |

## Purpose

Stored intentions before they become purchase orders — buying goods,
building something new, repairs, research, upgrades. Kept separate from
the orders list so a plan can change, shrink or be dropped freely.

## Data

- `purchase_plans` + `booking:bookings(customer_name)` (browser client,
  newest first).
- Booking picker options: `bookings(id, customer_name, event_date)`,
  50 newest by event date.

## Create form

Judul (required), Jenis (`Beli Barang / Buat Baru / Perbaikan / Riset /
Upgrade`), Estimasi anggaran (Rp), Target selesai (date), Booking
(opsional — ties the plan to an event), Alasan → `POST /api/admin/plans`
→ push to `/admin/plans/{id}` (lines are added there; the API also
accepts starter `lines[]` but the form sends none).

## List

- Rows link to the detail page: clipboard icon, title,
  `PlanTypeBadge` + `PlanStatusBadge`, subline `Untuk {customer} ·
  Anggaran {formatRupiah} · Target {date}` (present parts only).
- Trash button → `ConfirmModal` ("Semua baris di dalamnya ikut
  terhapus") → `DELETE /api/admin/plans?id=` — always allowed; ledger
  rows survive with the link cleared.
- Skeleton loading, `EmptyState`, error banner.

## Navigation

- Breadcrumbs: `Dashboard / Rencana`.
- Sidebar: **Rencana** (mobile via the Lainnya drawer).
