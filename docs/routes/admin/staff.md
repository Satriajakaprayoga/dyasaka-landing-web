# `/admin/staff` — Staff & helper master data (§13)

| | |
| --- | --- |
| **URL** | `/admin/staff` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/staff/page.tsx` |

## Purpose

People the business pays — `staff tetap` and per-event helpers. The
booking detail page assigns them to events (see
[admin/bookings-detail.md](bookings-detail.md)); salary payments live in
the ledger with the assignment link.

## Data

- `staff` (browser client, ordered by name).

## List & forms

- **Tambah** card — Nama (required), Telepon, Peran (helper / sopir /
  dekorator…), Dasar gaji (bulanan / per acara…), Catatan — all beyond
  the name optional → `POST /api/admin/staff`. New staff start
  `is_active = true` (no checkbox on create).
- Rows — avatar initial + name + **Nonaktif** badge when inactive;
  subline joins role · phone · pay basis. **Ubah** expands an inline
  form (same fields + **Aktif** checkbox) → `PATCH`. **Hapus** →
  `ConfirmModal` warning that staff with assignments cannot be deleted
  (nonaktifkan instead) — the API maps the FK violation to a friendly
  409.
- Pagination (8/page), skeleton loading, error banner — same patterns
  as the vendors page.

## Navigation

- Breadcrumbs: `Dashboard / Staff`.
- Sidebar: **Staff** (mobile via the Lainnya drawer).
