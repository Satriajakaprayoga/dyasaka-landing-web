# `/admin/suppliers` — Supplier master data (§16)

| | |
| --- | --- |
| **URL** | `/admin/suppliers` |
| **Access** | Admin (session required) |
| **Rendering** | Server shell + client `SuppliersView` |
| **Source** | `app/admin/(panel)/suppliers/page.tsx`, `components/admin/SuppliersView.tsx`, `components/admin/useInfiniteList.ts`, `app/api/admin/suppliers/route.ts` (GET) |

## Purpose

Material shops for purchase plans and purchase orders — separate master
data from event `vendors` (performers & rentals). Plan lines and POs
reference suppliers by id; deletion is blocked while references exist.

## Data

- `GET /api/admin/suppliers?page=&limit=&search=` — paginated server-side, 12 suppliers per batch, ordered `name asc` with `id` as the deterministic tiebreaker. Returns `{ items, total, hasMore }`.
- `search` → case-insensitive `ilike` across name, phone, address and notes (single `or=` — plain columns only, commas/parens/backslashes stripped from input before building the pattern).

## Search

| Control | Filters on |
| --- | --- |
| Search box (debounced 350 ms) | name, phone, address, notes (via API `search`) |
| Counter | "X dari Y supplier" (X = items loaded, Y = API `total`) |

Search changes reset to batch 1 and scroll to top. Empty search result shows a **Reset Filter** action. Filters are plain component state (not persisted) — the list resets when navigating away.

## Infinite scroll

- `useInfiniteList("/api/admin/suppliers", { search }, 12)` from the shared hook: appends batches, drops stale responses (request id + `AbortController`), dedupes by id.
- One sentinel element after the list card, observed by an `IntersectionObserver` with `rootMargin: 200px`; a post-load visibility re-check covers the "sentinel already on screen" case.
- No pagination controls and no "Load more" button. End of data shows **"Semua supplier sudah ditampilkan"**; a failed batch shows **"Gagal memuat. Coba lagi"** with a manual retry.

## States

| State | List card |
| --- | --- |
| First load / filter reset | 4 skeleton rows |
| Loading next batch | 3 skeleton rows at the bottom |
| Error (nothing loaded) | EmptyState + retry |
| Error on next batch | inline "Gagal memuat. Coba lagi" + retry |
| End of data | "Semua supplier sudah ditampilkan" |
| No filter match | "Tidak ada supplier yang cocok" + Reset Filter |

## List & forms

- **Tambah** card — Nama (required), Telepon, Alamat, Catatan →
  `POST /api/admin/suppliers` → `list.reload()`.
- Rows — name; subline joins phone · address. **Ubah** expands an
  inline form (same fields) → `PATCH` → `list.reload()` +
  `router.refresh()`. **Hapus** → `ConfirmModal` warning that
  suppliers used by orders or plans cannot be deleted → the row is
  removed **locally** (`removeLocal`) and `total` decremented — no
  refetch, scroll position kept + `router.refresh()` (the API maps the
  FK violation to a friendly 409).

## Navigation

- Breadcrumbs: `Dashboard / Supplier`.
- Sidebar: **Supplier** (right after Vendor; mobile via the Lainnya
  drawer).
