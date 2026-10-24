# `/admin/vendors` — Vendor management

| | |
| --- | --- |
| **URL** | `/admin/vendors` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/vendors/page.tsx` |

## Purpose

Master data for external partners (photographer, clown, rented-property
owners). Vendors are attached to **items** (`items.vendor_id`) — the
relation is vendor → items, never vendor → products (products = own
packages assembled from multiple vendors' goods).

## Data

- `vendors` (browser client, ordered by name) + `items(vendor_id)` rows
  (non-null only), reduced in JS to a per-vendor `item_count`.

## List & forms

- **Tambah** card — Nama Vendor (required), Telepon, Catatan (all
  optional beyond the name) → `POST /api/admin/vendors`. New vendors
  start `is_active = true` (no checkbox on create).
- Rows — name + **Nonaktif** badge when inactive; subline joins phone,
  "N item", note. **Ubah** expands an inline form (name, phone, note,
  **Aktif** checkbox) → `PATCH`. **Hapus** → `ConfirmModal`:
  deletion is never blocked (`items.vendor_id` is ON DELETE SET NULL) —
  the modal says how many items keep working as unassigned ("tanpa
  vendor"), or that none are connected.
- Pagination (8/page), skeleton loading, error banner — same patterns
  as the categories page.

## Where vendors surface

- Item form (`/admin/items/new`, `/admin/items/[id]/edit`) — optional
  **Vendor** select (inactive vendors suffixed "(nonaktif)", still
  selectable so existing links stay re-assignable).
- Invoice draft picker — a catalog line whose item has a vendor is
  stored with invoice `source_type 'vendor'` (house items stay
  `'item'`). Vendors themselves never appear on the customer invoice —
  only the line description.

## Navigation

- Breadcrumbs: `Dashboard / Vendor`.
- Sidebar: **Vendor** (between Inventori and Booking; mobile via the
  Lainnya drawer).
