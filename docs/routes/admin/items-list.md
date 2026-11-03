# `/admin/items` — Inventory list

| | |
| --- | --- |
| **URL** | `/admin/items` |
| **Access** | Admin (session required) |
| **Rendering** | Server shell + client `ItemsView` (table `ItemsTable` / cards `ItemCardList`) |
| **Source** | `app/admin/(panel)/items/page.tsx`, `components/admin/ItemsView.tsx`, `components/admin/ItemsTable.tsx`, `components/admin/ItemCardList.tsx`, `components/admin/useInfiniteList.ts`, `app/api/admin/items/route.ts` (GET) |

## Purpose

Inventory master list: items (balloons, stands, cards, …) with variant counts and low-stock signals. Works on desktop/tablet (table or card view) and phones (cards only).

## Data

- `GET /api/admin/items?page=&limit=&search=&type=&low=` — paginated server-side, 12 items per batch, ordered `name asc` with `id` as the deterministic tiebreaker. Returns `{ items, total, hasMore }`; rows embed `item_variants(*)`.
- `search` spans items (name, `item_category`) **and** variant fields (color/size/SKU). Since search crosses two tables, matching item ids are resolved in parallel sub-queries and the main query narrows with `.in()`; a matchless candidate set short-circuits to `{ items: [], total: 0 }`.
- `type` → `consumable`/`rentable` (other values ignored); `low=1` → items with at least one variant where `stock_quantity <= reorder_point` (`reorder_point` non-null). PostgREST cannot compare two columns, so the low-stock candidate set is computed from fetched `item_variants(item_id, stock_quantity, reorder_point)` rows and intersected with the search set.
- `lowStockCount(variants)` (`ItemsTable.tsx`) is the client-side mirror used for the per-item badges — same rule as the dashboard low-stock card.

## Views

| Screen | Default | Layout |
| --- | --- | --- |
| Phone (< 768px) | **Cards, forced** | 1 column; table and view toggle hidden |
| Tablet (768–1024px) | Table | Cards: 2 columns |
| Desktop (> 1024px) | Table | Cards: 3 columns |

- The toggle switches table/cards on ≥ 768px and persists to `localStorage` (`itemViewMode`), falling back to table.
- View switching via `matchMedia` — no reload, loaded items and scroll position are kept. Only one view is mounted at a time.
- Both views are presentation-only with the same props (`items`, `deletingId`, `loadingMore`, `onDelete`); the card list renders its own loading-more skeletons.

### Table

Columns `ITEM | KATEGORI | TIPE | VARIAN | AKSI`. Sticky header (`sticky top-0`), `overflow-x-auto` wrapper, AKSI column has a fixed min-width so Varian/Ubah/Hapus never clip. Rentable items show a muted "Dimiliki: N unit" sub-line; the VARIAN cell shows the variant count plus a red "N stok rendah" badge when applicable.

### Card

White rounded card: item name (link) + type badge ("Sewa" amber / "Habis Pakai" blue), chips for category and variant count, red low-stock badge, "Dimiliki: N unit" line for rentables, divider, then Varian / Ubah / Hapus — ≥ 44px tall buttons on phones, right-aligned on desktop.

## Search & filters (server-side)

| Control | Filters on |
| --- | --- |
| Search box (debounced 350 ms) | name, item_category, variant color/size/SKU (via API `search`) |
| Tipe select | Habis Pakai (`consumable`) / Sewa (`rentable`) |
| Checkbox **Hanya stok rendah** | at least one variant with `stock_quantity <= reorder_point` (API `low=1`) |
| Counter | "X dari Y item" (X = items loaded, Y = API `total`) |

Any filter change resets to batch 1 and scrolls to top. Empty filter result shows a **Reset Filter** action; an empty catalog shows **Tambah Item**.

### Filter persistence

Filters survive navigation (`usePersistentFilters`): URL params (`?q=&type=&low=`) are primary; sessionStorage (`admin-items-filters`) restores them when returning with a clean URL. **Reset Filter** clears both. (The old persisted shape carried a `page` key — extra keys are ignored by the restore logic.)

## Infinite scroll

- `useInfiniteList("/api/admin/items", { search, type, low })` from the shared `useInfiniteList` hook (`components/admin/useInfiniteList.ts`): appends 12-item batches, tracks `items/page/hasMore/loading/loadingMore/error/total`; stale responses dropped via request id + `AbortController`; appended items deduped by id.
- One sentinel element after the active view, observed by an `IntersectionObserver` with `rootMargin: 200px`; a post-load visibility re-check covers the "sentinel already on screen" case (initial short page, after delete).
- No pagination controls and no "Load more" button. End of data shows **"Semua item sudah ditampilkan"**; a failed batch shows **"Gagal memuat. Coba lagi"** with a manual retry.

## States

| State | Table | Cards |
| --- | --- | --- |
| First load / filter reset | 8-row skeleton | 6 skeleton cards |
| Loading next batch | 3 skeleton rows at the bottom | 3 skeleton cards at the bottom |
| Error (nothing loaded) | EmptyState + retry | same |
| Error on next batch | inline "Gagal memuat. Coba lagi" + retry | same |
| End of data | "Semua item sudah ditampilkan" | same |
| No filter match | "Tidak ada item yang cocok" + Reset Filter | same |

## Interactions

- Item name / **Varian** → `/admin/items/[id]` (variant & stock management).
- **Ubah** → `/admin/items/[id]/edit`.
- **Hapus** → `ConfirmModal` with impact check: variant ids come from the loaded rows, then counts `item_price_history` / `stock_movements` / `product_items` / `booking_items` (any hit = RESTRICT blocker, confirm disabled) + cascade info (N variants deleted). Blocked bookings/products are listed as clickable inspection links (`ImpactBookingList` → booking detail, `ImpactProductList` → recipe editor) → confirm → `DELETE /api/admin/items?id=` → the row is removed **locally** (`removeLocal`) and `total` decremented — no refetch, scroll position kept. The API returns a friendly 409 for FK races.
- **Tambah Item** (page header) → `/admin/items/new`.

## Navigation

- Breadcrumbs: `Dashboard / Inventori`.
- **Tambah Item** → `/admin/items/new`.
