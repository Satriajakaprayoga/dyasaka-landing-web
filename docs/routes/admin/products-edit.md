# `/admin/products/[id]/edit` — Edit product

| | |
| --- | --- |
| **URL** | `/admin/products/[id]/edit` |
| **Access** | Admin (session required) |
| **Rendering** | Dynamic Server Component (`ƒ`) + client `ProductForm` |
| **Source** | `app/admin/(panel)/products/[id]/edit/page.tsx`, `components/admin/ProductForm.tsx` |

## Purpose

Edit product master data and manage its photos.

## Data

- `products` + `product_images(*)` where `id = [id]` (`.single()`), and `categories` ordered by name — fetched in parallel.
- Unknown id → `notFound()`.

## Form (`ProductForm`, edit mode)

- Same fields as create, prefilled; adds **is_active** select (Aktif/Nonaktif — inactive products disappear from the public catalog).
- Existing photos: rendered by `ExistingImage` with delete + reorder (`sort_order`). On save, remaining photos are renumbered to contiguous `0..n-1` before new uploads append after them (no `sort_order` collisions).
- Photo validation, compression, and error handling: same pipeline as [products-new.md](products-new.md) — failed files stay selected on the form for retry, and removed photos are deleted from Storage.
- Submits `PATCH /api/admin/products` with `{ id, …changes }`.

## Navigation

- Breadcrumbs: `Dashboard / Produk / {product name} / Ubah` + **Kembali** → `/admin/products`.
