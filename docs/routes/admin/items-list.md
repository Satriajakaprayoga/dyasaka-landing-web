# `/admin/items` — Inventory list

| | |
| --- | --- |
| **URL** | `/admin/items` |
| **Access** | Admin (session required) |
| **Rendering** | Server Component + client `ItemsTable` |
| **Source** | `app/admin/(panel)/items/page.tsx`, `components/admin/ItemsTable.tsx` |

## Purpose

Inventory master list: items (balloons, stands, cards, …) with variant counts and low-stock signals.

## Data

- `items` + `item_variants(*)`, ordered `name asc`.

## Search & filters (client-side, in `ItemsTable`)

| Control | Filters on |
| --- | --- |
| Search box | name, item_category, variant color/size/SKU |
| Tipe select | Habis Pakai (`consumable`) / Sewa (`rentable`) |
| Checkbox **Hanya stok rendah** | at least one variant with `stock_quantity <= reorder_point` (`lowStockCount`) |
| Counter | "X dari Y item" |

## Interactions

- Item name / **Varian** button → `/admin/items/[id]` (variant & stock management).
- **Ubah** → `/admin/items/[id]/edit`.
- **Hapus** → `confirm()` → `DELETE /api/admin/items?id=` → refresh; blocked (500) when variants are still referenced by stock/price history, recipes, or bookings.

## Navigation

- Breadcrumbs: `Dashboard / Inventori`.
- **Tambah Item** → `/admin/items/new`.
