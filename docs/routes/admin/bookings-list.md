# `/admin/bookings` — Booking list

| | |
| --- | --- |
| **URL** | `/admin/bookings` |
| **Access** | Admin (session required) |
| **Rendering** | Server shell + client `BookingsView` (table `BookingsTable` / cards `BookingCardList`) |
| **Source** | `app/admin/(panel)/bookings/page.tsx`, `components/admin/BookingsView.tsx`, `components/admin/BookingsTable.tsx`, `components/admin/BookingCardList.tsx`, `components/admin/useInfiniteList.ts`, `app/api/admin/bookings/route.ts` (GET) |

## Purpose

Manage all event bookings: schedule overview, status workflow, edits. Works on desktop/tablet (table or card view) and phones (cards only).

## Data

- `GET /api/admin/bookings?page=&limit=&search=&status=&period=` — paginated server-side, 12 bookings per batch, ordered `event_date asc` with `id` as the deterministic tiebreaker. Returns `{ items, total, hasMore }`; rows embed `products(name)` (null for custom bookings → shown as "Custom").
- `search` → case-insensitive `ilike` on customer name, phone, theme, **and** product name. PostgREST's `or=` logic tree cannot mix embedded filters (`products.name`) with plain ones (verified: PGRST100), so matching booking ids are resolved in parallel sub-queries (direct columns + bookings of name-matched products) and the main query narrows with `.in()`.
- `status` → `pending`/`confirmed`/`done`/`cancelled` (other values ignored); `period` → `upcoming` (`event_date >= today`) / `past` (`< today`), computed in the **Asia/Jakarta** timezone to match the previous client-side filter.
- Bookings arrive from two sources: manual admin entry (`/admin/bookings/new`) and **self-service booking on the public product page** — the latter insert directly as `pending` / `not_started` via the `"public insert bookings"` RLS policy (`supabase/migrations/20261007120000_public_booking_insert.sql`) and wait here for confirmation.

## Views

| Screen | Default | Layout |
| --- | --- | --- |
| Phone (< 768px) | **Cards, forced** | 1 column; table and view toggle hidden |
| Tablet (768–1024px) | Table | Cards: 2 columns |
| Desktop (> 1024px) | Table | Cards: 3 columns |

- The toggle switches table/cards on ≥ 768px and persists to `localStorage` (`bookingViewMode`), falling back to table.
- View switching via `matchMedia` — no reload, loaded items and scroll position are kept. Only one view is mounted at a time.
- Both views are presentation-only with the same props (`items`, `deletingId`, `statusBusyId`, `loadingMore`, `onStatusChange`, `onDelete`); the card list renders its own loading-more skeletons.

### Table

Columns `TANGGAL | PRODUK | TEMA | CUSTOMER | STATUS | AKSI`. Sticky header (`sticky top-0`), `overflow-x-auto` wrapper, AKSI column has a fixed min-width so Detail/Ubah/Hapus never clip. Date and customer name link to the booking detail.

### Card

White rounded card: event date (link) + booking status badge, customer name (link) + phone, chips for product ("Custom" when null) and theme, then the inline status `<select>` + project status badge, divider, and Detail / Ubah / Hapus — ≥ 44px tall buttons on phones, right-aligned on desktop.

## Search & filters (server-side)

| Control | Filters on |
| --- | --- |
| Search box (debounced 350 ms) | customer name, phone, theme, product name (via API `search`) |
| Status select | Pending / Confirmed / Selesai / Dibatalkan |
| Periode select | **Akan Datang** (`event_date >= today`) / **Sudah Lewat** |
| Counter | "X dari Y booking" (X = items loaded, Y = API `total`) |

Any filter change resets to batch 1 and scrolls to top. Empty filter result shows a **Reset Filter** action; an empty catalog shows **Tambah Booking**.

### Filter persistence

Filters survive navigation (`usePersistentFilters`): URL params (`?q=&status=&period=`) are primary; sessionStorage (`admin-bookings-filters`) restores them when returning with a clean URL. **Reset Filter** clears both. (The old persisted shape carried a `page` key — extra keys are ignored by the restore logic.)

## Infinite scroll

- `useInfiniteList("/api/admin/bookings", { search, status, period })` from the shared `useInfiniteList` hook (`components/admin/useInfiniteList.ts`): appends 12-item batches, tracks `items/page/hasMore/loading/loadingMore/error/total`; stale responses dropped via request id + `AbortController`; appended items deduped by id.
- One sentinel element after the active view, observed by an `IntersectionObserver` with `rootMargin: 200px`; a post-load visibility re-check covers the "sentinel already on screen" case (initial short page, after delete).
- No pagination controls and no "Load more" button. End of data shows **"Semua booking sudah ditampilkan"**; a failed batch shows **"Gagal memuat. Coba lagi"** with a manual retry.

## States

| State | Table | Cards |
| --- | --- | --- |
| First load / filter reset | 8-row skeleton | 6 skeleton cards |
| Loading next batch | 3 skeleton rows at the bottom | 3 skeleton cards at the bottom |
| Error (nothing loaded) | EmptyState + retry | same |
| Error on next batch | inline "Gagal memuat. Coba lagi" + retry | same |
| End of data | "Semua booking sudah ditampilkan" | same |
| No filter match | "Tidak ada booking yang cocok" + Reset Filter | same |

## Interactions

- **Inline status `<select>`** (table row and card) → `PATCH /api/admin/bookings` `{ id, status }` → the row is updated **in place** (`updateLocal`) — no refetch; status badge mirrors the change, project status badge unchanged (separate field). Failures surface as a red error strip.
- **Detail** → `/admin/bookings/[id]` (date/customer cells and the explicit Detail button).
- **Ubah** → `/admin/bookings/[id]/edit`.
- **Hapus** → `ConfirmModal` with cascade info: counts `booking_items` + `checklist_items` (both cascade), plus a note when the booking is `confirmed` (capacity recalculated) and a **"Lihat detail booking"** link (`ModalLinkRow`) → confirm → `DELETE /api/admin/bookings?id=` → the row is removed **locally** (`removeLocal`) and `total` decremented — no refetch, scroll position kept. If too few items remain on screen while more exist, the next batch loads automatically.
- **Tambah Booking** (page header) → `/admin/bookings/new`.

## Navigation

- Breadcrumbs: `Dashboard / Booking`.
- **Tambah Booking** → `/admin/bookings/new`.
