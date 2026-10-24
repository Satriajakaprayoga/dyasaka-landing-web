# Route Documentation

One markdown file per route, mirroring the `app/` directory structure. Docs describe the final state of the codebase — update a route's doc when changing the route.

## Shared patterns

- **Delete confirmation** (`components/admin/ConfirmModal.tsx`) — every admin delete opens a modal instead of `window.confirm`. Rows with RESTRICT-referencing children (categories, items, variants) first run count queries (`head: true`) against the referencing tables; blockers disable the confirm button and say what still uses the row ("masih dipakai N booking"), while CASCADE children are listed as "akan ikut terhapus" (N foto, N baris checklist, …). Product deletion is not blocked: its active bookings are cancelled by the `trg_products_cancel_bookings` trigger and the modal says so. Where bookings or products are part of the impact, the modal also renders them as **inspection links** — `ImpactBookingList` (customer + date + status, links to the booking detail; active ones marked "akan dibatalkan") and `ImpactProductList` (links to the recipe editor) — and the bookings-table modal links to the booking itself, so the admin can check every reference before confirming. Child-row deletes (recipe, booking items, checklist) use the same modal with a plain confirm or a small cascade count. The APIs also map PostgREST `23503` to a friendly Indonesian 409 as a race-condition backstop.
- **Filter persistence** (`components/admin/usePersistentFilters.ts`) — the Produk, Inventori, and Booking tables keep their filters across navigation. URL search params are the source of truth (shareable, browser back/forward friendly); sessionStorage mirrors them per feature, so returning to the feature with a clean URL restores the last filters. **Reset Filter** clears both.
- **Pagination** (`components/admin/Pagination.tsx`) — client-side slicing of the filtered rows with numbered pages + prev/next ("Menampilkan X–Y dari Z"). The page number lives in the same persistent filter state (`?page=`), any filter change resets to page 1, page changes scroll back to the top, and deleting the last row of the last page clamps safely.

## Public site (`app/(public)` — shared header + footer, no auth)

`app/(public)/layout.tsx` renders the public header nav and `SiteFooter` (`components/landing/SiteFooter.tsx`) around every public route.

| Route | Doc | Purpose |
| --- | --- | --- |
| `/` | [public/home.md](public/home.md) | Dynamic landing page (`ƒ`): hero, featured packages, categories, gallery, how-to-order, testimonials, FAQ, WhatsApp CTA band |
| `/catalog` | [public/catalog.md](public/catalog.md) | Active products with search + filters (URL params), pagination |
| `/product/[id]` | [public/product-detail.md](public/product-detail.md) | Gallery + lightbox, price, WhatsApp inquiry, booking modal, availability calendar |
| `/availability` | [public/availability.md](public/availability.md) | Public availability calendar (7 months ahead) |
| `/invoice/[token]` | [public/invoice-view.md](public/invoice-view.md) | Customer invoice by unguessable token (app root, standalone like `/offline`); print-to-PDF, `noindex` |

## Admin panel (`app/admin/(panel)` — session required)

Desktop uses the dark sidebar (`AdminSidebar`); phones/tablets get a fixed bottom tab bar (`components/admin/BottomNav.tsx`) with Dashboard, Produk, Inventori, Booking, and **Lainnya** — the Lainnya button slides the sidebar in as a drawer (backdrop + close button + scroll lock) exposing the remaining sidebar items (Vendor, Kategori, Pengaturan, Lihat Situs, Keluar).

| Route | Doc | Purpose |
| --- | --- | --- |
| `/admin` | [admin/dashboard.md](admin/dashboard.md) | Stats cards, upcoming bookings, 4 operational views (prep / checked-out / low stock / need order) |
| `/admin/login` | [admin/login.md](admin/login.md) | Standalone login (email/password) |
| `/admin/products` | [admin/products-list.md](admin/products-list.md) | Product list, search/filters, pagination, delete |
| `/admin/products/new` | [admin/products-new.md](admin/products-new.md) | Create product + upload photos |
| `/admin/products/[id]/edit` | [admin/products-edit.md](admin/products-edit.md) | Edit product, manage photos, is_active, recipe ("Isi Paket") |
| `/admin/bookings` | [admin/bookings-list.md](admin/bookings-list.md) | Booking list, search/filters, pagination, inline status change |
| `/admin/bookings/new` | [admin/bookings-new.md](admin/bookings-new.md) | Record a new booking (product or custom) |
| `/admin/bookings/[id]` | [admin/bookings-detail.md](admin/bookings-detail.md) | Booking detail: item snapshot, 3-phase checklist, DP + project status |
| `/admin/bookings/[id]/edit` | [admin/bookings-edit.md](admin/bookings-edit.md) | Edit booking details/status |
| `/admin/items` | [admin/items-list.md](admin/items-list.md) | Inventory list, search/filters, pagination, low-stock badge |
| `/admin/items/new` | [admin/items-new.md](admin/items-new.md) | Create item (consumable/rentable) with category autocomplete |
| `/admin/items/[id]` | [admin/items-detail.md](admin/items-detail.md) | Variant management, stock movements, price history |
| `/admin/items/[id]/edit` | [admin/items-edit.md](admin/items-edit.md) | Edit item master data |
| `/admin/vendors` | [admin/vendors.md](admin/vendors.md) | Vendor CRUD (inline edit, delete un-assigns items) |
| `/admin/categories` | [admin/categories.md](admin/categories.md) | Product category CRUD (inline rename, pagination) |
| `/admin/settings` | [admin/settings.md](admin/settings.md) | Company profile (single row, logo upload) + bank account list for invoices |

## API routes (`app/api/admin` — JSON, session required)

| Route | Doc | Methods |
| --- | --- | --- |
| `/api/admin/products` | [api/admin-products.md](api/admin-products.md) | POST, PATCH, DELETE |
| `/api/admin/categories` | [api/admin-categories.md](api/admin-categories.md) | POST, PATCH, DELETE |
| `/api/admin/bookings` | [api/admin-bookings.md](api/admin-bookings.md) | POST (optional product + recipe seeding), PATCH (allow-list), DELETE |
| `/api/admin/items` | [api/admin-items.md](api/admin-items.md) | POST, PATCH, DELETE |
| `/api/admin/vendors` | [api/admin-vendors.md](api/admin-vendors.md) | POST, PATCH (allow-list), DELETE (SET NULL on items) |
| `/api/admin/product-items` | [api/admin-product-items.md](api/admin-product-items.md) | POST (upsert), PATCH, DELETE |
| `/api/admin/booking-items` | [api/admin-booking-items.md](api/admin-booking-items.md) | POST (checklist catch-up), PATCH, DELETE |
| `/api/admin/checklist-items` | [api/admin-checklist-items.md](api/admin-checklist-items.md) | POST (free-text row), PATCH, DELETE |
| `/api/admin/item-variants` | [api/admin-item-variants.md](api/admin-item-variants.md) | POST, PATCH, DELETE |
| `/api/admin/stock-movements` | [api/admin-stock-movements.md](api/admin-stock-movements.md) | POST |
| `/api/admin/company-profile` | [api/admin-company-profile.md](api/admin-company-profile.md) | PATCH (single seeded row — no POST by design) |
| `/api/admin/bank-accounts` | [api/admin-bank-accounts.md](api/admin-bank-accounts.md) | POST, PATCH (allow-list), DELETE |
| `/api/admin/invoices` | [api/admin-invoices.md](api/admin-invoices.md) | POST (draft + prefill), PATCH (`action` dispatch: save-lines / issue / record-payment / void), DELETE (draft only) |

## Infrastructure routes

| Route | Doc | Purpose |
| --- | --- | --- |
| `/manifest.webmanifest` | — | PWA manifest (`app/manifest.ts`) |
| `/offline` | — | Offline fallback page, precached by the service worker |
| `/icon.svg` | — | Favicon (`app/icon.svg`) |
| `/sw.js` | — | Service worker (`public/sw.js`, prod-only registration) |
