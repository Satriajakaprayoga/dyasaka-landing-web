# `/admin/items/[id]` — Item detail & variants

| | |
| --- | --- |
| **URL** | `/admin/items/[id]` |
| **Access** | Admin (session required) |
| **Rendering** | Dynamic Server Component (`ƒ`) + client `VariantsPanel` |
| **Source** | `app/admin/(panel)/items/[id]/page.tsx`, `components/admin/VariantsPanel.tsx` |

## Purpose

Per-item stock and price management through its variants.

## Data

- `items` + `item_variants(*)` where `id = [id]` (`.single()`); unknown id → `notFound()`.
- `stock_movements` and `item_price_history` filtered `in (item_variant_id)` — guarded with `Promise.resolve({ data: [] })` when the item has no variants.

## Variant panel (`VariantsPanel`)

- **Tambah Varian** → inline `VariantForm` (color, size, SKU, price, reorder point, initial stock). `POST /api/admin/item-variants`; initial stock > 0 also inserts a `restock` movement ("Stok awal").
- **Ubah** → `VariantForm` prefilled; stock field hidden (stock changes only via movements). Price changes write `item_price_history` **before** the update (append-only).
- **Stok** → inline `MovementForm`: type (restock/purchased/usage/damaged/lost/adjustment) + signed quantity + note → `POST /api/admin/stock-movements` (sign validated per type; rejects negative resulting stock).
- **Hapus** → `ConfirmModal` with impact check: counts `item_price_history` / `stock_movements` / `product_items` / `booking_items` for the variant (any hit = RESTRICT blocker, confirm disabled with counts). Blocked bookings/products are listed as clickable inspection links (`ImpactBookingList` → booking detail, `ImpactProductList` → recipe editor) → confirm → `DELETE /api/admin/item-variants?id=`. The API returns a friendly 409 for FK races.
- Per-variant header: color/size (or SKU), low-stock badge, price, stock, collapsible **Riwayat** (movements with signed colored quantities + price history with timestamps).

## Navigation

- Breadcrumbs: `Dashboard / Inventori / {item name}` + **Kembali** → `/admin/items`.
- **Ubah Item** → `/admin/items/[id]/edit`.
