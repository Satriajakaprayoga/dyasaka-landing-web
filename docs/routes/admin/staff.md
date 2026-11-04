# `/admin/staff` — Staff & helper master data (§13)

| | |
| --- | --- |
| **URL** | `/admin/staff` |
| **Access** | Admin (session required) |
| **Rendering** | Server shell + client `StaffView` |
| **Source** | `app/admin/(panel)/staff/page.tsx`, `components/admin/StaffView.tsx`, `components/admin/useInfiniteList.ts`, `app/api/admin/staff/route.ts` (GET) |

## Purpose

People the business pays — `staff tetap` and per-event helpers. The
booking detail page assigns them to events (see
[admin/bookings-detail.md](bookings-detail.md)); salary payments live in
the ledger with the assignment link.

## Data

- `GET /api/admin/staff?page=&limit=&search=` — paginated server-side, 12 staff per batch, ordered `name asc` with `id` as the deterministic tiebreaker. Returns `{ items, total, hasMore }`.
- `search` → case-insensitive `ilike` across name, phone, role, pay_basis and notes (single `or=` — plain columns only, commas/parens/backslashes stripped from input before building the pattern).

## Search

| Control | Filters on |
| --- | --- |
| Search box (debounced 350 ms) | name, phone, role, pay_basis, notes (via API `search`) |
| Counter | "X dari Y staff" (X = items loaded, Y = API `total`) |

Search changes reset to batch 1 and scroll to top. Empty search result shows a **Reset Filter** action. Filters are plain component state (not persisted) — the list resets when navigating away.

## Infinite scroll

- `useInfiniteList("/api/admin/staff", { search }, 12)` from the shared hook: appends batches, drops stale responses (request id + `AbortController`), dedupes by id.
- One sentinel element after the list card, observed by an `IntersectionObserver` with `rootMargin: 200px`; a post-load visibility re-check covers the "sentinel already on screen" case.
- No pagination controls and no "Load more" button. End of data shows **"Semua staff sudah ditampilkan"**; a failed batch shows **"Gagal memuat. Coba lagi"** with a manual retry.

## States

| State | List card |
| --- | --- |
| First load / filter reset | 4 skeleton rows |
| Loading next batch | 3 skeleton rows at the bottom |
| Error (nothing loaded) | EmptyState + retry |
| Error on next batch | inline "Gagal memuat. Coba lagi" + retry |
| End of data | "Semua staff sudah ditampilkan" |
| No filter match | "Tidak ada staff yang cocok" + Reset Filter |

## List & forms

- **Tambah** card — Nama (required), Telepon, Peran (helper / sopir /
  dekorator…), Dasar gaji (bulanan / per acara…), Catatan — all beyond
  the name optional → `POST /api/admin/staff` → `list.reload()`. New
  staff start `is_active = true` (no checkbox on create).
- Rows — avatar initial + name + **Nonaktif** badge when inactive;
  subline joins role · phone · pay basis. **Ubah** expands an inline
  form (same fields + **Aktif** checkbox) → `PATCH` → `list.reload()`
  + `router.refresh()`. **Hapus** → `ConfirmModal` warning that staff
  with assignments cannot be deleted (nonaktifkan instead) → the row
  is removed **locally** (`removeLocal`) and `total` decremented — no
  refetch, scroll position kept + `router.refresh()`. The API maps the
  FK violation to a friendly 409.

## Navigation

- Breadcrumbs: `Dashboard / Staff`.
- Sidebar: **Staff** (mobile via the Lainnya drawer).
