# `/admin/products` — Product list

| | |
| --- | --- |
| **URL** | `/admin/products` |
| **Access** | Admin (session required) |
| **Rendering** | Server Component + client `ProductsTable` |
| **Source** | `app/admin/(panel)/products/page.tsx`, `components/admin/ProductsTable.tsx` |

## Purpose

Manage the product catalog: scan, filter, edit, delete.

## Data

- `products` + `categories(name)` + `product_images(image_url, sort_order)`, ordered `created_at desc`.

## Search & filters (client-side, in `ProductsTable`)

| Control | Filters on |
| --- | --- |
| Search box | name, description, category name (case-insensitive `includes`) |
| Kategori select | exact category name (options built from loaded rows) |
| Status select | Aktif / Nonaktif (`is_active`) |
| Counter | "X dari Y produk" |

Empty filter result shows a **Reset Filter** action.

### Filter persistence

Filters survive navigation (`usePersistentFilters`): URL params (`?q=&cat=&status=&page=`) are primary; sessionStorage (`admin-products-filters`) restores them when returning with a clean URL. **Reset Filter** clears both.

## Pagination

Client-side, 10 rows per page (`components/admin/Pagination.tsx`). Page number is part of the persisted filter state; changing any filter resets to page 1; page changes scroll to top.

## Interactions

- Row **Ubah** → `/admin/products/[id]/edit`.
- Row **Hapus** → `confirm()` → `DELETE /api/admin/products?id=` → `router.refresh()`. Server also removes the product's Storage objects (best effort).

## Navigation

- Breadcrumbs: `Dashboard / Produk`.
- **Tambah Produk** → `/admin/products/new`.
