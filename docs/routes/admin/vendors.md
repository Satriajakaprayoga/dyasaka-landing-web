# `/admin/vendors` — Vendor management

| | |
| --- | --- |
| **URL** | `/admin/vendors` |
| **Access** | Admin (session required) |
| **Rendering** | Server shell + client `VendorsView` |
| **Source** | `app/admin/(panel)/vendors/page.tsx`, `components/admin/VendorsView.tsx`, `components/admin/useInfiniteList.ts`, `app/api/admin/vendors/route.ts` (GET) |

## Purpose

Master data for external partners (photographer, clown, rented-property
owners). Products reference vendors via `products.vendor_id` +
`vendor_price` (cost) — set on the product form, surfaced as a computed
margin. Vendors never appear on the customer invoice.

## Data

- `GET /api/admin/vendors?page=&limit=&search=` — paginated server-side, 12 vendors per batch, ordered `name asc` with `id` as the deterministic tiebreaker. Returns `{ items, total, hasMore }`.
- `search` → case-insensitive `ilike` across name, phone and note (single `or=` — plain columns only, commas/parens/backslashes stripped from input before building the pattern).

## Search

| Control | Filters on |
| --- | --- |
| Search box (debounced 350 ms) | name, phone, note (via API `search`) |
| Counter | "X dari Y vendor" (X = items loaded, Y = API `total`) |

Search changes reset to batch 1 and scroll to top. Empty search result shows a **Reset Filter** action. Filters are plain component state (not persisted) — the list resets when navigating away.

## Infinite scroll

- `useInfiniteList("/api/admin/vendors", { search }, 12)` from the shared hook: appends batches, drops stale responses (request id + `AbortController`), dedupes by id.
- One sentinel element after the list card, observed by an `IntersectionObserver` with `rootMargin: 200px`; a post-load visibility re-check covers the "sentinel already on screen" case.
- No pagination controls and no "Load more" button. End of data shows **"Semua vendor sudah ditampilkan"**; a failed batch shows **"Gagal memuat. Coba lagi"** with a manual retry.

## States

| State | List card |
| --- | --- |
| First load / filter reset | 4 skeleton rows |
| Loading next batch | 3 skeleton rows at the bottom |
| Error (nothing loaded) | EmptyState + retry |
| Error on next batch | inline "Gagal memuat. Coba lagi" + retry |
| End of data | "Semua vendor sudah ditampilkan" |
| No filter match | "Tidak ada vendor yang cocok" + Reset Filter |

## List & forms

- **Tambah** card — Nama Vendor (required), Telepon, Catatan (all
  optional beyond the name) → `POST /api/admin/vendors` →
  `list.reload()`. New vendors start `is_active = true` (no checkbox on
  create).
- Rows — name + **Nonaktif** badge when inactive; subline joins phone
  and note. **Ubah** expands an inline form (name, phone, note,
  **Aktif** checkbox) → `PATCH` → `list.reload()` + `router.refresh()`.
  **Hapus** → `ConfirmModal` plain confirm — deletion is never blocked
  (`products.vendor_id` is `ON DELETE SET NULL`; linked products just
  lose their vendor) → the row is removed **locally** (`removeLocal`)
  and `total` decremented — no refetch, scroll position kept +
  `router.refresh()`.

## Navigation

- Breadcrumbs: `Dashboard / Vendor`.
- Sidebar: **Vendor** (between Inventori and Booking; mobile via the
  Lainnya drawer).
