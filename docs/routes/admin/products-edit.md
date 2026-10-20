# `/admin/products/[id]/edit` — Edit product

| | |
| --- | --- |
| **URL** | `/admin/products/[id]/edit` |
| **Access** | Admin (session required) |
| **Rendering** | Dynamic Server Component (`ƒ`) + client `ProductForm`, `RecipePanel` |
| **Source** | `app/admin/(panel)/products/[id]/edit/page.tsx`, `components/admin/ProductForm.tsx`, `components/admin/RecipePanel.tsx` |

## Purpose

Edit product master data, manage its photos, and maintain the package recipe ("Isi Paket").

## Data

- `products` + `product_images(*)` + `product_items(id, product_id, item_variant_id, quantity, item_variants(color, size, current_price, items(name)))` where `id = [id]` (`.single()`); plus `categories` and the variant catalog `items(id, name, item_category, type, quantity_owned, item_variants(id, color, size, current_price))` ordered by name — fetched in parallel. Embed rows are cast (`as unknown as`) because child→parent embeds return objects.
- Unknown id → `notFound()`.

## Form (`ProductForm`, edit mode)

- Same fields as create, prefilled; adds **is_active** select (Aktif/Nonaktif — inactive products disappear from the public catalog).
- Existing photos: rendered by `ExistingImage` with delete + reorder (`sort_order`). On save, remaining photos are renumbered to contiguous `0..n-1` before new uploads append after them (no `sort_order` collisions).
- Photo validation, compression, and error handling: same pipeline as [products-new.md](products-new.md) — failed files stay selected on the form for retry, and removed photos are deleted from Storage.
- Submits `PATCH /api/admin/products` with `{ id, …changes }`.

## Recipe ("Isi Paket", `RecipePanel`)

- Lists the recipe rows: item/variant label, reference price (`formatRupiah(current_price)`, Sewa/Habis Pakai), inline quantity editor (PATCHes on blur when changed), delete via `ConfirmModal` (plain confirm — recipe rows have no children; existing bookings are unaffected).
- **Tambah Item** — variant `<select>` grouped by `item_category` via optgroup (label includes price) + qty → `POST /api/admin/product-items`, which **upserts** on `(product_id, item_variant_id)` (same variant twice = quantity update).
- Empty state: "Belum ada item dalam paket." The recipe drives both the public "Paket Termasuk" list and the auto-seeding of new bookings' `booking_items`.
- Page layout is widened to `max-w-3xl` to fit the panel.

## Navigation

- Breadcrumbs: `Dashboard / Produk / {product name} / Ubah` + **Kembali** → `/admin/products`.
