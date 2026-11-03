# `/admin/products` — Product list

| | |
| --- | --- |
| **URL** | `/admin/products` |
| **Access** | Admin (session required) |
| **Rendering** | Server shell + client `ProductsView` (table `ProductsTable` / cards `ProductCardList`) |
| **Source** | `app/admin/(panel)/products/page.tsx`, `components/admin/ProductsView.tsx`, `components/admin/ProductsTable.tsx`, `components/admin/ProductCardList.tsx`, `components/admin/useInfiniteProducts.ts`, `app/api/admin/products/route.ts` (GET) |

## Purpose

Manage the product catalog: scan, filter, edit, delete. Works on desktop/tablet (table or card view) and phones (cards only).

## Data

- `GET /api/admin/products?page=&limit=&search=&category=&status=` — paginated server-side, 12 items per batch, ordered `created_at desc`. Returns `{ items, total, hasMore }`; `items` rows embed `categories(name)` + `product_images(image_url, sort_order)`.
- `search` → case-insensitive `ilike` on name/description (PostgREST or-filter, special chars stripped); `category` → `category_id` (ignored if not a UUID); `status` → `active`/`inactive` (`is_active`); `total` via `count: "exact"`.
- Category options for the dropdown are fetched once client-side from `categories` (id + name).

## Views

| Screen | Default | Layout |
| --- | --- | --- |
| Phone (< 768px) | **Cards, forced** | 1 column; table and view toggle hidden |
| Tablet (768–1024px) | Table | Cards: 2 columns |
| Desktop (> 1024px) | Table | Cards: 3 columns |

- The toggle switches table/cards on ≥ 768px and persists to `localStorage` (`productViewMode`), falling back to table.
- View switching via `matchMedia` — no reload, loaded items and scroll position are kept. Only one view is mounted at a time.
- Both views are presentation-only with the same props (`items`, `deletingId`, `loadingMore`, `onEdit`, `onDelete`); `ProductCardList` also renders its own loading-more skeletons.

### Table

Columns `PRODUK | KATEGORI | HARGA | STATUS | AKSI`. Sticky header (`sticky top-0`), `overflow-x-auto` wrapper, AKSI column has a fixed min-width so the actions never clip. Harga shows the price plus, when `vendor_price` is set, a muted `vendor Rp X · margin Rp Y` sub-line (margin = `price − vendor_price`, computed, never stored; vendor columns are admin-only per the 20261025100000 grants).

### Card

White rounded card: cover image/box icon + name + status badge ("Aktif" green / "Nonaktif" gray), 2-line truncated description, category chip, prominent price with a conditional light-gray vendor/margin strip, divider, then Ubah (outlined) and Hapus (red outlined) — 50%-width, ≥ 44px tall buttons on phones, right-aligned on desktop. Cards in a grid row stretch to equal heights.

## Search & filters (server-side)

| Control | Filters on |
| --- | --- |
| Search box (debounced 350 ms) | name, description (`ilike`, via API `search`) |
| Kategori select | category id (options from `categories` table) |
| Status select | Aktif / Nonaktif (`is_active`) |
| Counter | "X dari Y produk" (X = items loaded, Y = API `total`) |

Any filter change resets to batch 1 and scrolls to top. Empty filter result shows a **Reset Filter** action; a totally empty catalog shows **Tambah Produk**.

### Filter persistence

Filters survive navigation (`usePersistentFilters`): URL params (`?q=&cat=&status=`) are primary; sessionStorage (`admin-products-filters`) restores them when returning with a clean URL. **Reset Filter** clears both. Persisted `cat` values holding a category *name* (pre-redesign) are reset to `all` once the category list loads.

## Infinite scroll

- `useInfiniteProducts({ search, category, status })`: appends 12-item batches, tracks `items/page/hasMore/loading/loadingMore/error/total`; stale responses dropped via request id + `AbortController`; appended items deduped by id.
- One sentinel element after the active view, observed by an `IntersectionObserver` with `rootMargin: 200px`; a post-load visibility re-check covers the "sentinel already on screen" case (initial short page, after delete).
- No pagination controls and no "Load more" button. End of data shows **"Semua produk sudah ditampilkan"**; a failed batch shows **"Gagal memuat. Coba lagi"** with a manual retry (no auto-retry loop).

## States

| State | Table | Cards |
| --- | --- | --- |
| First load / filter reset | 8-row skeleton | 6 skeleton cards |
| Loading next batch | 3 skeleton rows at the bottom | 3 skeleton cards at the bottom |
| Error (nothing loaded) | EmptyState + retry | same |
| Error on next batch | inline "Gagal memuat. Coba lagi" + retry | same |
| End of data | "Semua produk sudah ditampilkan" | same |
| No filter match | "Produk tidak ditemukan" + Reset Filter | same |

## Interactions

- **Ubah** → `router.push` to `/admin/products/[id]/edit`; returning remounts the view and refetches from batch 1 (edits/new products appear naturally).
- **Hapus** → `ConfirmModal` with impact check: counts active bookings (shown as "akan dibatalkan" — the DB trigger `trg_products_cancel_bookings` cancels pending/confirmed bookings and unlinks the rest), plus cascade info (`product_images` incl. storage files, `product_items` recipe rows). Every linked booking is listed inside the modal (`ImpactBookingList`, active first). Confirm → `DELETE /api/admin/products?id=` → the row is removed **locally** (`removeLocal`) and `total` decremented — no refetch, scroll position kept. If too few items remain on screen while more exist, the next batch loads automatically.
- **Tambah Produk** (page header) → `/admin/products/new`.

## Navigation

- Breadcrumbs: `Dashboard / Produk`.
- **Tambah Produk** → `/admin/products/new`.
