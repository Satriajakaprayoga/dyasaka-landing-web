# `/admin/vendors` — Vendor management

| | |
| --- | --- |
| **URL** | `/admin/vendors` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/vendors/page.tsx` |

## Purpose

Master data for external partners (photographer, clown, rented-property
owners). Products reference vendors via `products.vendor_id` +
`vendor_price` (cost) — set on the product form, surfaced as a computed
margin. Vendors never appear on the customer invoice.

## Data

- `vendors` (browser client, ordered by name).

## List & forms

- **Tambah** card — Nama Vendor (required), Telepon, Catatan (all
  optional beyond the name) → `POST /api/admin/vendors`. New vendors
  start `is_active = true` (no checkbox on create).
- Rows — name + **Nonaktif** badge when inactive; subline joins phone
  and note. **Ubah** expands an inline form (name, phone, note,
  **Aktif** checkbox) → `PATCH`. **Hapus** → `ConfirmModal` plain
  confirm — deletion is never blocked (`products.vendor_id` is
  `ON DELETE SET NULL`; linked products just lose their vendor).
- Pagination (8/page), skeleton loading, error banner — same patterns
  as the categories page.

## Navigation

- Breadcrumbs: `Dashboard / Vendor`.
- Sidebar: **Vendor** (between Inventori and Booking; mobile via the
  Lainnya drawer).
