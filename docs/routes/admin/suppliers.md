# `/admin/suppliers` — Supplier master data (§16)

| | |
| --- | --- |
| **URL** | `/admin/suppliers` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/suppliers/page.tsx` |

## Purpose

Material shops for purchase plans and purchase orders — separate master
data from event `vendors` (performers & rentals). Plan lines and POs
reference suppliers by id; deletion is blocked while references exist.

## Data

- `suppliers` (browser client, ordered by name).

## List & forms

- **Tambah** card — Nama (required), Telepon, Alamat, Catatan →
  `POST /api/admin/suppliers`.
- Rows — name; subline joins phone / address / notes. **Ubah** expands
  an inline form → `PATCH`. **Hapus** → `ConfirmModal` warning that
  suppliers used by orders or plans cannot be deleted → `DELETE ?id=`
  (the API maps the FK violation to a friendly 409).
- Pagination (8/page), skeleton loading, error banner — same patterns
  as the staff/vendors pages.

## Navigation

- Breadcrumbs: `Dashboard / Supplier`.
- Sidebar: **Supplier** (right after Vendor; mobile via the Lainnya
  drawer).
