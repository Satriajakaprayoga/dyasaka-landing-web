# Route Documentation

One markdown file per route, mirroring the `app/` directory structure. Docs describe the final state of the codebase — update a route's doc when changing the route.

## Shared patterns

- **Filter persistence** (`components/admin/usePersistentFilters.ts`) — the Produk, Inventori, and Booking tables keep their filters across navigation. URL search params are the source of truth (shareable, browser back/forward friendly); sessionStorage mirrors them per feature, so returning to the feature with a clean URL restores the last filters. **Reset Filter** clears both.
- **Pagination** (`components/admin/Pagination.tsx`) — client-side slicing of the filtered rows with numbered pages + prev/next ("Menampilkan X–Y dari Z"). The page number lives in the same persistent filter state (`?page=`), any filter change resets to page 1, page changes scroll back to the top, and deleting the last row of the last page clamps safely.

## Public site (`app/(public)` — shared header, no auth)

| Route | Doc | Purpose |
| --- | --- | --- |
| `/` | [public/home.md](public/home.md) | Landing page, CTAs to catalog & availability |
| `/catalog` | [public/catalog.md](public/catalog.md) | Active products with search + filters (URL params), pagination |
| `/product/[id]` | [public/product-detail.md](public/product-detail.md) | Product gallery, price, WhatsApp inquiry, availability calendar |
| `/availability` | [public/availability.md](public/availability.md) | Public availability calendar (7 months ahead) |

## Admin panel (`app/admin/(panel)` — session required)

Desktop uses the dark sidebar (`AdminSidebar`); phones/tablets get a fixed bottom tab bar (`components/admin/BottomNav.tsx`) with Dashboard, Produk, Inventori, Booking, and **Lainnya** — the Lainnya button slides the sidebar in as a drawer (backdrop + close button + scroll lock) exposing Kategori, Lihat Situs, and Keluar.

| Route | Doc | Purpose |
| --- | --- | --- |
| `/admin` | [admin/dashboard.md](admin/dashboard.md) | Stats cards + upcoming bookings |
| `/admin/login` | [admin/login.md](admin/login.md) | Standalone login (email/password) |
| `/admin/products` | [admin/products-list.md](admin/products-list.md) | Product list, search/filters, pagination, delete |
| `/admin/products/new` | [admin/products-new.md](admin/products-new.md) | Create product + upload photos |
| `/admin/products/[id]/edit` | [admin/products-edit.md](admin/products-edit.md) | Edit product, manage photos, is_active |
| `/admin/bookings` | [admin/bookings-list.md](admin/bookings-list.md) | Booking list, search/filters, pagination, inline status change |
| `/admin/bookings/new` | [admin/bookings-new.md](admin/bookings-new.md) | Record a new booking |
| `/admin/bookings/[id]/edit` | [admin/bookings-edit.md](admin/bookings-edit.md) | Edit booking details/status |
| `/admin/items` | [admin/items-list.md](admin/items-list.md) | Inventory list, search/filters, pagination, low-stock badge |
| `/admin/items/new` | [admin/items-new.md](admin/items-new.md) | Create item (consumable/rentable) with category autocomplete |
| `/admin/items/[id]` | [admin/items-detail.md](admin/items-detail.md) | Variant management, stock movements, price history |
| `/admin/items/[id]/edit` | [admin/items-edit.md](admin/items-edit.md) | Edit item master data |
| `/admin/categories` | [admin/categories.md](admin/categories.md) | Product category CRUD (inline rename, pagination) |

## API routes (`app/api/admin` — JSON, session required)

| Route | Doc | Methods |
| --- | --- | --- |
| `/api/admin/products` | [api/admin-products.md](api/admin-products.md) | POST, PATCH, DELETE |
| `/api/admin/categories` | [api/admin-categories.md](api/admin-categories.md) | POST, PATCH, DELETE |
| `/api/admin/bookings` | [api/admin-bookings.md](api/admin-bookings.md) | POST, PATCH, DELETE |
| `/api/admin/items` | [api/admin-items.md](api/admin-items.md) | POST, PATCH, DELETE |
| `/api/admin/item-variants` | [api/admin-item-variants.md](api/admin-item-variants.md) | POST, PATCH, DELETE |
| `/api/admin/stock-movements` | [api/admin-stock-movements.md](api/admin-stock-movements.md) | POST |

## Infrastructure routes

| Route | Doc | Purpose |
| --- | --- | --- |
| `/manifest.webmanifest` | — | PWA manifest (`app/manifest.ts`) |
| `/offline` | — | Offline fallback page, precached by the service worker |
| `/icon.svg` | — | Favicon (`app/icon.svg`) |
| `/sw.js` | — | Service worker (`public/sw.js`, prod-only registration) |
